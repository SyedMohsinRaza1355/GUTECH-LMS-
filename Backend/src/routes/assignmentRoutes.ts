// ==============================================================================
// GUTech Internal LMS - Assignment Routes
// ==============================================================================

import { Router } from 'express';
import {
  patchAssignment,
  deleteAssignment,
  submitAssignment,
  listSubmissionsForTeacher,
  gradeSubmission
} from '../controllers/assignmentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  patchAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema
} from '../schemas/index.js';

const router = Router();

router.use(requireAuth);

router.patch('/:id', requireRole('admin', 'teacher'), validateRequest({ body: patchAssignmentSchema }), patchAssignment);
router.delete('/:id', requireRole('admin', 'teacher'), deleteAssignment);
router.put('/:id/submission', requireRole('student'), validateRequest({ body: submitAssignmentSchema }), submitAssignment);
router.get('/:id/submissions', requireRole('admin', 'teacher'), listSubmissionsForTeacher);

export default router;
