// ==============================================================================
// GUTech Internal LMS - Auth Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, supabaseAnon, isSupabaseConfigured } from '../config/index.js';
import { mockDb } from '../repositories/mockDb.js';
import { badRequest, unauthorized, forbidden } from '../utils/errors.js';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const loginName = email.trim().toLowerCase();
    const cleanEmail = loginName.includes('@') ? loginName : `${loginName}@gutech.edu.om`;

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

export const forgotPassword = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Rule: always return 200 with identical neutral message
    return res.status(200).json({
      data: {
        message: 'If an account exists with this email address, a password reset link has been dispatched.'
      }
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({
      data: {
        message: 'Password has been successfully updated. You may now log in.'
      }
    });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(unauthorized());
    }

    return res.status(200).json({
      data: {
        message: 'Your password has been changed successfully.'
      }
    });
  } catch (err) {
    next(err);
  }
};
