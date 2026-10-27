// ==============================================================================
// GUTech Internal LMS - Auth Routes
// ==============================================================================

import { Router } from 'express';
import {
  login,
  logout,
  refreshSession,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema
} from '../schemas/index.js';
import {
  loginRateLimiter,
  forgotPasswordRateLimiter
} from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', loginRateLimiter, validateRequest({ body: loginSchema }), login);
router.post('/logout', requireAuth, logout);
router.post('/refresh', refreshSession);
router.get('/me', requireAuth, getMe);
router.post('/forgot-password', forgotPasswordRateLimiter, validateRequest({ body: forgotPasswordSchema }), forgotPassword);
router.post('/reset-password', validateRequest({ body: resetPasswordSchema }), resetPassword);
router.post('/change-password', requireAuth, validateRequest({ body: changePasswordSchema }), changePassword);

export default router;
