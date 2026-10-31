// ==============================================================================
// GUTech Internal LMS - Admin User Management Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { supabaseAdmin, supabaseAnon, config, isSupabaseConfigured } from '../config/index.js';
import { conflict, notFound, unprocessable } from '../utils/errors.js';
import { recordAudit, listAudit } from '../utils/audit.js';
import { clearSessionCache } from '../middleware/auth.js';
import { UserProfile } from '../types/index.js';

const liveRequest = (req: Request): boolean => Boolean(isSupabaseConfigured()) && (req as any).user?.isDemoUser !== true;
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

const nextRollNo = async (live: boolean) => {
  const prefix = `GUT-${new Date().getFullYear()}-`;
  const numbers: number[] = [];
  if (live) {
    const { data } = await supabaseAdmin.from('profiles').select('roll_no').ilike('roll_no', `${prefix}%`);
    (data || []).forEach(row => numbers.push(Number(String(row.roll_no).slice(prefix.length)) || 0));
  }
  mockDb.profiles.forEach(p => { if (p.rollNo?.startsWith(prefix)) numbers.push(Number(p.rollNo.slice(prefix.length)) || 0); });
  return `${prefix}${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, role, tempPassword } = req.body;
    const courseIds: string[] = Array.isArray(req.body.courseIds) ? req.body.courseIds : [];
    const cleanEmail = email.trim().toLowerCase();
    const live = liveRequest(req);
    const duplicateMessage = 'A user with this email address already exists in the GUTech system.';

    if (!live && mockDb.profiles.some(p => p.email.toLowerCase() === cleanEmail)) return next(conflict(duplicateMessage));

    const rollNo: string | null = role === 'student' ? (req.body.rollNo?.trim() || await nextRollNo(live)) : null;
    if (!live && rollNo && mockDb.profiles.some(p => p.rollNo === rollNo)) return next(conflict(`Roll number ${rollNo} is already assigned to another student.`));

    let newUserId = `u-${Date.now()}`;
    let created: UserProfile;

    if (live) {
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
      if (existing) return next(conflict(duplicateMessage));
      if (rollNo) {
        const { data: rollTaken } = await supabaseAdmin.from('profiles').select('id').eq('roll_no', rollNo).maybeSingle();
        if (rollTaken) return next(conflict(`Roll number ${rollNo} is already assigned to another student.`));
      }
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
        .insert({ id: newUserId, full_name: fullName, email: cleanEmail, role, roll_no: rollNo, is_active: true, must_change_password: true })
        .select()
        .single();
      if (pErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw pErr;
      }
      created = profileFromRow(profile);

      if (role === 'student' && courseIds.length) {
        const { error: enrollError } = await supabaseAdmin.from('enrollments').upsert(
          courseIds.map(courseId => ({ course_id: courseId, student_id: newUserId })),
          { onConflict: 'course_id,student_id' }
        );
        if (enrollError) throw enrollError;
      }
    } else {
      created = {
        id: newUserId,
        fullName,
        email: cleanEmail,
        role,
        rollNo,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.profiles.unshift(created);
      mockDb.credentials.push({ email: cleanEmail, password: tempPassword });
      if (role === 'student') {
        courseIds.filter(courseId => mockDb.courses.some(c => c.id === courseId)).forEach(courseId => mockDb.enrollments.push({ courseId, studentId: newUserId }));
      }
    }

    await recordAudit({ actorId: req.user!.id, action: 'user.create', entity: 'profile', entityId: newUserId, live, metadata: { email: cleanEmail, role, rollNo, enrolledCourses: role === 'student' ? courseIds.length : 0 } });
    return res.status(201).json({ data: { ...created, enrolledCourseCount: role === 'student' ? courseIds.length : 0 } });
  } catch (err) {
    next(err);
  }
};

export const patchUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { fullName, role, rollNo, isActive } = req.body;
    const live = liveRequest(req);

    if (id === req.user!.id && (isActive === false || (role !== undefined && role !== req.user!.role))) {
      return next(unprocessable('You cannot deactivate your own account or change your own role. Ask another administrator.'));
    }

    if (live) {
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
      clearSessionCache(id);
      await recordAudit({ actorId: req.user!.id, action: isActive === undefined ? 'user.update' : isActive ? 'user.activate' : 'user.deactivate', entity: 'profile', entityId: id, live, metadata: { email: data.email, changes: Object.keys(update).filter(key => key !== 'updated_at') } });
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

    await recordAudit({ actorId: req.user!.id, action: isActive === undefined ? 'user.update' : isActive ? 'user.activate' : 'user.deactivate', entity: 'profile', entityId: id, live, metadata: { email: user.email } });
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
      await recordAudit({ actorId: req.user!.id, action: 'user.reset-password', entity: 'profile', entityId: id, live: true, metadata: { email: profile.email } });
      return res.status(200).json({ data: { message: `Password reset instructions sent to ${profile.email}.` } });
    }
    const user = mockDb.profiles.find(p => p.id === id);
    if (!user) {
      return next(notFound('User not found'));
    }

    user.mustChangePassword = true;
    await recordAudit({ actorId: req.user!.id, action: 'user.reset-password', entity: 'profile', entityId: id, live: false, metadata: { email: user.email } });

    return res.status(200).json({
      data: {
        message: `Password reset requested for ${user.email}. User will be prompted to choose a new password on next login.`
      }
    });
  } catch (err) {
    next(err);
  }
};

export const listAuditTrail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 100);
    return res.status(200).json({ data: await listAudit(liveRequest(req), limit) });
  } catch (err) {
    next(err);
  }
};
