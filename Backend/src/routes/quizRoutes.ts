// ==============================================================================
// GUTech Internal LMS - Quiz Routes
// ==============================================================================

import { Router } from 'express';
import {
  patchQuiz,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizResultsForTeacher,
  setQuizAttemptScore
} from '../controllers/quizController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { submitQuizAttemptSchema,
  quizScoreSchema
} from '../schemas/index.js';

const router = Router();

router.use(requireAuth);

router.patch('/:id', requireRole('admin', 'teacher'), patchQuiz);
router.post('/:id/attempt', requireRole('student'), startQuizAttempt);
router.post('/:id/attempt/submit', requireRole('student'), validateRequest({ body: submitQuizAttemptSchema }), submitQuizAttempt);
router.patch('/:id/attempts/:attemptId', requireRole('admin', 'teacher'), validateRequest({ body: quizScoreSchema }), setQuizAttemptScore);
router.get('/:id/results', requireRole('admin', 'teacher'), getQuizResultsForTeacher);

export default router;
