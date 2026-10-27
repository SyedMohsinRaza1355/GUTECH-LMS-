// ==============================================================================
// GUTech Internal LMS - Rate Limiting Middlewares
// ==============================================================================

import rateLimit from 'express-rate-limit';

// Login rate limiter: 5 attempts per 15 min per IP/email
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again in 15 minutes.'
    }
  }
});

// Chat message rate limiter: 20 messages per minute per user/IP
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Chat rate limit exceeded (maximum 20 messages per minute).'
    }
  }
});

// Forgot password limiter: 3 requests per hour
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset requests. Please try again in an hour.'
    }
  }
});

// General API rate limiter: 120 requests per minute
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.'
    }
  }
});
