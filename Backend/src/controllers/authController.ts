// ==============================================================================
// GUTech Internal LMS - Auth Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, supabaseAnon, isSupabaseConfigured, config } from '../config/index.js';
import { mockDb } from '../repositories/mockDb.js';
import { badRequest, unauthorized, forbidden, unprocessable } from '../utils/errors.js';
import { recordAudit } from '../utils/audit.js';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const loginName = email.trim().toLowerCase();
    const cleanEmail = loginName.includes('@') ? loginName : `${loginName}@gutech.edu.pk`;

    // Check if live Supabase is active
    if (isSupabaseConfigured()) {
      // Keep user sessions off the privileged service-role client used for database writes.
      const { data, error } = await supabaseAnon.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (!error && data.user && data.session) {
        // Query profile
        const { data: profile, error: pErr } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile && !profile.is_active) {
          return next(forbidden('Your account has been deactivated. Please contact an administrator.'));
        }

        if (profile) {
          return res.status(200).json({
            data: {
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              profile: {
                id: profile.id,
                fullName: profile.full_name,
                email: profile.email,
                role: profile.role,
                rollNo: profile.roll_no,
                avatarUrl: profile.avatar_url,
                isActive: profile.is_active,
                mustChangePassword: profile.must_change_password
              }
            }
          });
        }
      }

      return next(unauthorized('Invalid email or password'));
    }

    // Demo accounts are checked against their seeded username and password.
    const credential = mockDb.credentials.find(c => c.email.toLowerCase() === cleanEmail && c.password === password);
    const user = credential && mockDb.profiles.find(p => p.email.toLowerCase() === cleanEmail);

    if (!user) {
      return next(unauthorized('Invalid email or password'));
    }

    if (!user.isActive) {
      return next(forbidden('Your account has been deactivated. Please contact an administrator.'));
    }

    const token = `demo-token-${user.id}`;

    return res.status(200).json({
      data: {
        accessToken: token,
        refreshToken: `refresh-${user.id}`,
        profile: user
      }
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({
      data: { message: 'Logged out successfully' }
    });
  } catch (err) {
    next(err);
  }
};

export const refreshSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return next(badRequest('Refresh token required'));
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        return next(unauthorized('Invalid or expired refresh token'));
      }
      return res.status(200).json({
        data: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token
        }
      });
    }

    const profileId = typeof refreshToken === 'string' ? refreshToken.replace(/^refresh-/, '') : '';
    const profile = mockDb.profiles.find(p => p.id === profileId && p.isActive);
    if (!profile) return next(unauthorized('Invalid or expired refresh token'));
    return res.status(200).json({ data: { accessToken: `demo-token-${profile.id}`, refreshToken } });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(unauthorized());
    }

    const user = mockDb.profiles.find(p => p.id === req.user?.id) || {
      id: req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return res.status(200).json({
      data: { profile: user }
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (isSupabaseConfigured() && email) {
      // Fire and forget: the answer must be identical whether or not the account exists.
      try {
        await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo: config.passwordResetRedirect });
      } catch (error) {
        console.warn('[auth] reset email could not be requested:', (error as Error).message);
      }
    }
    return res.status(200).json({
      data: {
        message: 'If an account exists with this email address, a password reset link has been dispatched.'
      }
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    if (!isSupabaseConfigured()) {
      return next(unprocessable('Password reset links are only available on the live portal.'));
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return next(unprocessable('This reset link is invalid or has expired. Request a new one.'));
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, { password: newPassword });
    if (updateError) throw updateError;
    await supabaseAdmin.from('profiles').update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', data.user.id);
    await recordAudit({ actorId: data.user.id, action: 'user.reset-password', entity: 'profile', entityId: data.user.id, live: true, metadata: { email: data.user.email, via: 'email-link' } });
    return res.status(200).json({ data: { message: 'Password has been successfully updated. You may now log in.' } });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(unauthorized());
    const { currentPassword, newPassword } = req.body;

    if (currentPassword === newPassword) {
      return next(unprocessable('Choose a new password that is different from your current one.'));
    }

    const live = Boolean(isSupabaseConfigured()) && user.isDemoUser !== true;
    if (live) {
      // Prove the caller knows the current password before changing anything.
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (error || !data.user || data.user.id !== user.id) return next(unprocessable('Your current password is incorrect.'));
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });
      if (updateError) throw updateError;
      await supabaseAdmin.from('profiles').update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', user.id);
    } else {
      const credential = mockDb.credentials.find(item => item.email.toLowerCase() === user.email.toLowerCase());
      if (!credential || credential.password !== currentPassword) return next(unprocessable('Your current password is incorrect.'));
      credential.password = newPassword;
      const profile = mockDb.profiles.find(item => item.id === user.id);
      if (profile) profile.mustChangePassword = false;
    }

    await recordAudit({ actorId: user.id, action: 'user.change-password', entity: 'profile', entityId: user.id, live, metadata: { email: user.email } });
    return res.status(200).json({ data: { message: 'Your password has been changed successfully.' } });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(unauthorized());
    const fullName = String(req.body.fullName).trim().replace(/\s+/g, ' ');
    const live = Boolean(isSupabaseConfigured()) && user.isDemoUser !== true;

    if (live) {
      const { data, error } = await supabaseAdmin.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', user.id).select().single();
      if (error) throw error;
      await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: { full_name: fullName, role: data.role } });
      await recordAudit({ actorId: user.id, action: 'user.update', entity: 'profile', entityId: user.id, live, metadata: { email: user.email, changes: ['full_name'] } });
      return res.status(200).json({ data: { id: data.id, fullName: data.full_name, email: data.email, role: data.role, rollNo: data.roll_no, avatarUrl: data.avatar_url, isActive: data.is_active, mustChangePassword: data.must_change_password, createdAt: data.created_at, updatedAt: data.updated_at } });
    }

    const profile = mockDb.profiles.find(item => item.id === user.id);
    if (!profile) return next(unauthorized('Profile not found'));
    profile.fullName = fullName;
    profile.updatedAt = new Date().toISOString();
    await recordAudit({ actorId: user.id, action: 'user.update', entity: 'profile', entityId: user.id, live, metadata: { email: user.email, changes: ['full_name'] } });
    return res.status(200).json({ data: profile });
  } catch (err) {
    next(err);
  }
};
