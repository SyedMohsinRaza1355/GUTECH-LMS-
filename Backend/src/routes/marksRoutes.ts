// ==============================================================================
// GUTech Internal LMS - Marks Routes
// ==============================================================================

import { Router } from 'express';
import { getStudentMarks } from '../controllers/marksController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/marks', requireRole('student'), getStudentMarks);

export default router;
