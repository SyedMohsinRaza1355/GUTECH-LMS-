// ==============================================================================
// GUTech Internal LMS - Zod Validation Schemas
// ==============================================================================

import { z } from 'zod';

// Pagination & Query Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().min(1, 'Please enter your GUTech username or email'),
  password: z.string().min(1, 'Password is required')
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

// Admin Schemas
export const createUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must have at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'teacher', 'student']),
  rollNo: z.string().trim().optional().nullable(),
  courseIds: z.array(z.string().uuid()).max(20).optional(),
  tempPassword: z.string()
    .min(8, 'Temporary password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Temporary password must contain a letter')
    .regex(/[0-9]/, 'Temporary password must contain a number')
});

export const patchUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  rollNo: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

// Course Schemas
export const createCourseSchema = z.object({
  code: z.string().min(2, 'Course code is required (e.g. CS101)').max(10).toUpperCase(),
  title: z.string().min(3, 'Course title is required'),
  description: z.string().optional()
});

export const patchCourseSchema = z.object({
  code: z.string().min(2).max(10).toUpperCase().optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  isArchived: z.boolean().optional()
});

export const setTeachersSchema = z.object({
  teacherIds: z.array(z.string().uuid()).min(1, 'At least one teacher must be assigned')
});

export const enrollStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()).optional(),
  csvContent: z.string().optional()
}).refine(data => data.studentIds?.length || data.csvContent, {
  message: 'Either studentIds or csvContent must be provided'
});

// Resource Schemas
export const createResourceSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional()
});

// Assignment Schemas
export const createAssignmentSchema = z.object({
  title: z.string().min(3, 'Assignment title is required'),
  instructions: z.string().min(5, 'Instructions are required'),
  maxMarks: z.coerce.number().positive('Max marks must be greater than zero'),
  dueAt: z.string().datetime('Must be a valid ISO datetime string'),
  allowLate: z.boolean().default(false),
  attachmentPath: z.string().optional().nullable()
});

export const patchAssignmentSchema = z.object({
  title: z.string().min(3).optional(),
  instructions: z.string().min(5).optional(),
  maxMarks: z.coerce.number().positive().optional(),
  dueAt: z.string().datetime().optional(),
  allowLate: z.boolean().optional(),
  attachmentPath: z.string().optional().nullable()
});

export const submitAssignmentSchema = z.object({
  textAnswer: z.string().optional(),
  filePath: z.string().optional()
}).refine(data => data.textAnswer || data.filePath, {
  message: 'Submission must contain a text response or an attached file'
});

export const gradeSubmissionSchema = z.object({
  marks: z.coerce.number({ invalid_type_error: 'Marks must be a number' }).finite().min(0, 'Marks must be 0 or higher'),
  feedback: z.string().optional().nullable()
});

// Quiz Schemas
export const createQuizQuestionSchema = z.object({
  position: z.number().int().min(1),
  type: z.enum(['mcq_single', 'mcq_multi', 'true_false']),
  prompt: z.string().min(2, 'Question prompt is required'),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1)
    })
  ).min(2, 'At least 2 options required'),
  correctOptionIds: z.array(z.string()).min(1, 'At least one correct option must be selected'),
  marks: z.coerce.number().positive().default(1)
});

export const createQuizSchema = z.object({
  title: z.string().min(3, 'Quiz title is required'),
  description: z.string().optional(),
  timeLimitMinutes: z.coerce.number().int().positive('Time limit must be positive'),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  isPublished: z.boolean().default(false),
  questions: z.array(createQuizQuestionSchema).min(1, 'Quiz must have at least one question')
});

export const submitQuizAttemptSchema = z.object({
  answers: z.record(z.string(), z.array(z.string())) // { [questionId]: ['a'] }
});

// Announcement Schemas
export const createAnnouncementSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Title is required'),
  body: z.string().min(5, 'Body is required'),
  isPinned: z.boolean().default(false)
});

// Chat Schemas
export const sendMessageSchema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(2000, 'Message cannot exceed 2000 characters')
});

// Complaint Schemas
export const createComplaintSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
  category: z.enum(['academic', 'technical', 'facility', 'conduct', 'other']),
  subject: z.string().min(3, 'Subject is required'),
  description: z.string().min(15, 'Please provide at least 15 characters describing your complaint'),
  attachmentPath: z.string().optional().nullable()
});

export const respondComplaintSchema = z.object({
  status: z.enum(['in_review', 'resolved', 'rejected']),
  adminResponse: z.string().min(5, 'A clear response is required when updating complaint status')
});
