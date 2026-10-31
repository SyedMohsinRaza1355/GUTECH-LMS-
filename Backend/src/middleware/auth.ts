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

// Verifying a session costs two round trips to Supabase (token check, profile). Run them in
// parallel and remember the result for a few seconds so a page that fires several requests
// does not pay for it each time. Deactivation/role changes call clearSessionCache().
const SESSION_TTL_MS = 15_000;
const sessionCache = new Map<string, { user: AuthUser; expires: number }>();

export const clearSessionCache = (userId?: string) => {
  if (!userId) { sessionCache.clear(); return; }
  for (const [token, entry] of sessionCache) if (entry.user.id === userId) sessionCache.delete(token);
};

const subjectOf = (token: string): string | null => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
};

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
      const cached = sessionCache.get(token);
      if (cached && cached.expires > Date.now()) {
        req.user = cached.user;
        return next();
      }

      const subject = subjectOf(token);
      const [authResult, guessedProfile] = await Promise.all([
        supabaseAdmin.auth.getUser(token),
        subject ? supabaseAdmin.from('profiles').select('id, role, full_name, is_active').eq('id', subject).maybeSingle() : Promise.resolve(null)
      ]);
      const user = authResult.data?.user;
      if (authResult.error || !user) {
        return next(unauthorized('Invalid or expired authentication session'));
      }

      // The profile was fetched speculatively by the token's subject; only trust it if Supabase confirmed that subject.
      let profile: any = guessedProfile && !guessedProfile.error && guessedProfile.data && guessedProfile.data.id === user.id ? guessedProfile.data : null;
      if (!profile) {
        const { data, error: profileErr } = await supabaseAdmin.from('profiles').select('id, role, full_name, is_active').eq('id', user.id).single();
        if (profileErr || !data) return next(unauthorized('User profile could not be loaded'));
        profile = data;
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
      if (sessionCache.size > 500) sessionCache.clear();
      sessionCache.set(token, { user: req.user, expires: Date.now() + SESSION_TTL_MS });
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
