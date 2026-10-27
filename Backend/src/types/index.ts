// ==============================================================================
// GUTech Internal LMS - Domain & API Types
// ==============================================================================

export type UserRole = 'admin' | 'teacher' | 'student';
export type QuestionType = 'mcq_single' | 'mcq_multi' | 'true_false';
export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'rejected';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  rollNo?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  fullName: string;
  isDemoUser?: boolean;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    cursor?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  teachers?: UserProfile[];
  studentsCount?: number;
}

export interface Resource {
  id: string;
  courseId: string;
  uploadedBy: string;
  title: string;
  description?: string | null;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploaderName?: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  createdBy: string;
  title: string;
  instructions: string;
  maxMarks: number;
  dueAt: string;
  allowLate: boolean;
  attachmentPath?: string | null;
  createdAt: string;
  updatedAt: string;
  submissionsCount?: number;
  mySubmission?: Submission | null;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  textAnswer?: string | null;
  filePath?: string | null;
  submittedAt: string;
  isLate: boolean;
  marksObtained?: number | null;
  feedback?: string | null;
  gradedBy?: string | null;
  gradedAt?: string | null;
  studentName?: string;
  studentRollNo?: string;
}

export interface QuizQuestionOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: QuizQuestionOption[];
  marks: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  createdBy: string;
  title: string;
  description?: string | null;
  timeLimitMinutes: number;
  opensAt: string;
  closesAt: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  questionsCount?: number;
  totalMarks?: number;
  myAttempt?: QuizAttempt | null;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  submittedAt?: string | null;
  answers: Record<string, string[]>;
  score?: number | null;
  studentName?: string;
}

export interface Announcement {
  id: string;
  courseId?: string | null;
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  courseTitle?: string;
  isRead?: boolean;
}

export interface ChatMessage {
  id: string;
  courseId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string | null;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Complaint {
  id: string;
  raisedBy: string;
  raisedByName?: string;
  courseId?: string | null;
  courseTitle?: string | null;
  category: string;
  subject: string;
  description: string;
  attachmentPath?: string | null;
  status: ComplaintStatus;
  adminResponse?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentMarkItem {
  studentId: string;
  courseId: string;
  courseTitle?: string;
  kind: 'assignment' | 'quiz';
  itemId: string;
  title: string;
  obtained?: number | null;
  max: number;
  gradedAt?: string | null;
}
