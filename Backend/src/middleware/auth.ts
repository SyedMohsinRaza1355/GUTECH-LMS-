// ==============================================================================
// GUTech Internal LMS - Authentication & Authorization Middlewares
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { unauthorized, forbidden } from '../utils/errors.js';
import { supabaseAdmin, isSupabaseConfigured } from '../config/index.js';
import { AuthUser, UserRole } from '../types/index.js';
import { mockDb } from '../repositories/mockDb.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(unauthorized('Missing or malformed Authorization header'));
    }

    const token = authHeader.split(' ')[1];
    req.token = token;

    // Demo token is tied to one profile, so it cannot be used to switch identities.
    if (token.startsWith('demo-token-')) {
      const profileId = token.replace('demo-token-', '');
      const user = mockDb.profiles.find(p => p.id === profileId && p.isActive);
      if (!user) {
        return next(unauthorized('Invalid or inactive user session'));
      }
      req.user = {
        id: user.id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        isDemoUser: true
      };
      return next();
    }

    // Live Supabase Auth verification
    if (isSupabaseConfigured()) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return next(unauthorized('Invalid or expired authentication session'));
      }

      // Fetch profile and check active status
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, role, full_name, is_active')
        .eq('id', user.id)
        .single();

      if (profileErr || !profile) {
        return next(unauthorized('User profile could not be loaded'));
      }

      if (!profile.is_active) {
        return next(forbidden('Your account has been deactivated. Please contact an administrator.'));
      }

      req.user = {
        id: profile.id,
        role: profile.role as UserRole,
        email: user.email || '',
        fullName: profile.full_name
      };
      return next();
    }

    return next(unauthorized('Session could not be verified'));
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(forbidden(`Access denied: Requires ${allowedRoles.join(' or ')} permission`));
    }
    next();
  };
};
