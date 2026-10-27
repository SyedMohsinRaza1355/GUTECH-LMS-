// ==============================================================================
// GUTech Internal LMS - Miscellaneous Entity Routes
// (Resources, Submissions, Messages, User Courses)
// ==============================================================================

import { Router } from 'express';
import { getResourceDownloadUrl, deleteResource } from '../controllers/resourceController.js';
import { deleteChatMessage } from '../controllers/chatController.js';
import { gradeSubmission } from '../controllers/assignmentController.js';
import { getMyCourses } from '../controllers/courseController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { gradeSubmissionSchema } from '../schemas/index.js';

const router = Router();

router.use(requireAuth);

// Resource download & delete
router.get('/resources/:id/download', getResourceDownloadUrl);
router.delete('/resources/:id', deleteResource);

// Message soft delete
router.delete('/messages/:id', deleteChatMessage);

// Submission grading
router.patch('/submissions/:id/grade', requireRole('admin', 'teacher'), validateRequest({ body: gradeSubmissionSchema }), gradeSubmission);

// Current user courses
router.get('/me/courses', getMyCourses);

export default router;
