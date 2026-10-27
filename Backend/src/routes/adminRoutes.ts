// ==============================================================================
// GUTech Internal LMS - Admin Routes
// ==============================================================================

import { Router } from 'express';
import {
  listUsers,
  createUser,
  patchUser,
  resetUserPassword
} from '../controllers/adminController.js';
import {
  listAllCoursesAdmin,
  createCourseAdmin,
  patchCourseAdmin,
  deleteCourseAdmin,
  setCourseTeachers,
  enrollStudents,
  unenrollStudent
} from '../controllers/courseController.js';
import {
  listAdminComplaints,
  respondComplaint
} from '../controllers/complaintController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createUserSchema,
  patchUserSchema,
  createCourseSchema,
  patchCourseSchema,
  setTeachersSchema,
  enrollStudentsSchema,
  respondComplaintSchema
} from '../schemas/index.js';

const router = Router();

// All routes require authenticated user with role = 'admin'
router.use(requireAuth, requireRole('admin'));

// User Management
router.get('/users', listUsers);
router.post('/users', validateRequest({ body: createUserSchema }), createUser);
router.patch('/users/:id', validateRequest({ body: patchUserSchema }), patchUser);
router.post('/users/:id/reset-password', resetUserPassword);

// Course Management
router.get('/courses', listAllCoursesAdmin);
router.post('/courses', validateRequest({ body: createCourseSchema }), createCourseAdmin);
router.patch('/courses/:id', validateRequest({ body: patchCourseSchema }), patchCourseAdmin);
router.delete('/courses/:id', deleteCourseAdmin);
router.put('/courses/:id/teachers', validateRequest({ body: setTeachersSchema }), setCourseTeachers);
router.post('/courses/:id/enrollments', validateRequest({ body: enrollStudentsSchema }), enrollStudents);
router.delete('/courses/:id/enrollments/:studentId', unenrollStudent);

// Complaint Queue & Resolution
router.get('/complaints', listAdminComplaints);
router.patch('/complaints/:id', validateRequest({ body: respondComplaintSchema }), respondComplaint);

export default router;
