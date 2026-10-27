// ==============================================================================
// GUTech Internal LMS - Admin User Management Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { supabaseAdmin, supabaseAnon, config, isSupabaseConfigured } from '../config/index.js';
import { conflict, notFound } from '../utils/errors.js';
import { UserProfile } from '../types/index.js';

const liveRequest = (req: Request) => isSupabaseConfigured() && (req as any).user?.isDemoUser !== true;
const profileFromRow = (row: any): UserProfile => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  rollNo: row.roll_no,
  avatarUrl: row.avatar_url,
  isActive: row.is_active,
  mustChangePassword: row.must_change_password,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const roleFilter = req.query.role as string;
    const search = ((req.query.search as string) || '').toLowerCase().trim();

    if (liveRequest(req)) {
      let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' });
      if (roleFilter) query = query.eq('role', roleFilter);
      if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,roll_no.ilike.%${search}%`);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.range(from, to).order('created_at', { ascending: false });

      if (!error && data) {
        return res.status(200).json({
          data: data.map(profileFromRow),
          meta: { page, pageSize, total: count || 0 }
        });
      }
    }

    let filtered = [...mockDb.profiles];
    if (roleFilter) {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    if (search) {
      filtered = filtered.filter(
        u =>
          u.fullName.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          (u.rollNo && u.rollNo.toLowerCase().includes(search))
      );
    }

    const total = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return res.status(200).json({
      data: paginated,
      meta: { page, pageSize, total }
    });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, role, rollNo, tempPassword } = req.body;
    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate email
    const exists = mockDb.profiles.some(p => p.email.toLowerCase() === cleanEmail);
    if (exists) {
      return next(conflict('A user with this email address already exists in GUTech system.'));
    }

    let newUserId = `u-${Date.now()}`;

    if (isSupabaseConfigured()) {
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
      if (existing) return next(conflict('A user with this email address already exists in GUTech system.'));
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role }
      });

      if (authErr) throw authErr;
      if (authData.user) newUserId = authData.user.id;

      const { data: profile, error: pErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUserId,
          full_name: fullName,
          email: cleanEmail,
          role,
          roll_no: role === 'student' ? rollNo : null,
          is_active: true,
          must_change_password: true
        })
        .select()
        .single();

      if (pErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw pErr;
      }

      return res.status(201).json({ data: profileFromRow(profile) });
    }

    const newUser: UserProfile = {
      id: newUserId,
      fullName,
      email: cleanEmail,
      role,
      rollNo: role === 'student' ? rollNo || `GUT-2026-${Math.floor(1000 + Math.random() * 9000)}` : null,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockDb.profiles.unshift(newUser);

    return res.status(201).json({ data: newUser });
  } catch (err) {
    next(err);
  }
};

export const patchUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { fullName, role, rollNo, isActive } = req.body;

    if (liveRequest(req)) {
      const update: Record<string, unknown> = {};
      if (fullName !== undefined) update.full_name = fullName;
      if (role !== undefined) update.role = role;
      if (rollNo !== undefined) update.roll_no = rollNo;
      if (isActive !== undefined) update.is_active = isActive;
      update.updated_at = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from('profiles').update(update).eq('id', id).select().maybeSingle();
      if (error) throw error;
      if (!data) return next(notFound('User profile not found'));
      if (fullName !== undefined || role !== undefined || isActive !== undefined) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
          user_metadata: { ...(fullName !== undefined ? { full_name: fullName } : {}), ...(role !== undefined ? { role } : {}), ...(isActive !== undefined ? { is_active: isActive } : {}) }
        });
        if (authError) throw authError;
      }
      return res.status(200).json({ data: profileFromRow(data) });
    }

    const user = mockDb.profiles.find(p => p.id === id);
    if (!user) {
      return next(notFound('User profile not found'));
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (role !== undefined) user.role = role;
    if (rollNo !== undefined) user.rollNo = rollNo;
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedAt = new Date().toISOString();

    return res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
};

export const resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (liveRequest(req)) {
      const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('email').eq('id', id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return next(notFound('User not found'));
      const { error } = await supabaseAnon.auth.resetPasswordForEmail(profile.email, { redirectTo: config.passwordResetRedirect });
      if (error) throw error;
      const { error: updateError } = await supabaseAdmin.from('profiles').update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (updateError) throw updateError;
      return res.status(200).json({ data: { message: `Password reset instructions sent to ${profile.email}.` } });
    }
    const user = mockDb.profiles.find(p => p.id === id);
    if (!user) {
      return next(notFound('User not found'));
    }

    user.mustChangePassword = true;

    return res.status(200).json({
      data: {
        message: `Password reset requested for ${user.email}. User will be prompted to choose a new password on next login.`
      }
    });
  } catch (err) {
    next(err);
  }
};
