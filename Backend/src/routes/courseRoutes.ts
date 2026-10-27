// ==============================================================================
// GUTech Internal LMS - Course Sub-Routes
// ==============================================================================

import { Router } from 'express';
import { getMyCourses, getCourseDetail } from '../controllers/courseController.js';
import { listCourseResources, createResource } from '../controllers/resourceController.js';
import { listAssignments, createAssignment } from '../controllers/assignmentController.js';
import { listCourseQuizzes, createQuiz } from '../controllers/quizController.js';
import { listChatMessages, sendChatMessage } from '../controllers/chatController.js';
import { getCourseGradebook, exportGradebookCsv } from '../controllers/marksController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createAssignmentSchema,
  createQuizSchema,
  sendMessageSchema
} from '../schemas/index.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

// Course Detail
router.get('/:id', getCourseDetail);

// Course Resources
router.get('/:id/resources', listCourseResources);
router.post('/:id/resources', requireRole('admin', 'teacher'), createResource);

// Course Assignments
router.get('/:id/assignments', listAssignments);
router.post('/:id/assignments', requireRole('admin', 'teacher'), validateRequest({ body: createAssignmentSchema }), createAssignment);

// Course Quizzes
router.get('/:id/quizzes', listCourseQuizzes);
router.post('/:id/quizzes', requireRole('admin', 'teacher'), validateRequest({ body: createQuizSchema }), createQuiz);

// Classroom Chat
router.get('/:id/messages', listChatMessages);
router.post('/:id/messages', chatRateLimiter, validateRequest({ body: sendMessageSchema }), sendChatMessage);

// Gradebook
router.get('/:id/gradebook', requireRole('admin', 'teacher'), getCourseGradebook);
router.get('/:id/gradebook.csv', requireRole('admin', 'teacher'), exportGradebookCsv);

export default router;
