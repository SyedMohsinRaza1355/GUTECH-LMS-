// ==============================================================================
// Ghazali University of Technology (GUTech) LMS - In-Memory State & Seed Data Store
// 55 users: 2 admins, 3 teachers, 50 students (see roster.ts) - all with simple demo passwords
// ==============================================================================

import {
  UserProfile,
  Course,
  Resource,
  Assignment,
  Submission,
  Quiz,
  QuizQuestion,
  QuizAttempt,
  Announcement,
  ChatMessage,
  Complaint
} from '../types/index.js';
import { roster, rosterStudents, avatarFor } from './roster.js';

export interface MockDatabase {
  profiles: UserProfile[];
  credentials: { email: string; password: string }[];      // plain-text demo passwords
  courses: Course[];
  courseTeachers: { courseId: string; teacherId: string }[];
  enrollments: { courseId: string; studentId: string }[];
  resources: Resource[];
  assignments: Assignment[];
  submissions: Submission[]
  quizzes: Quiz[];
  quizQuestions: QuizQuestion[];
  quizAnswers: { questionId: string; correctOptionIds: string[] }[];
  quizAttempts: QuizAttempt[];
  announcements: Announcement[];
  announcementReads: { userId: string; announcementId: string; readAt: string }[];
  chatMessages: ChatMessage[];
  complaints: Complaint[];
  auditLogs: { id: number; actorId: string; action: string; entity: string; entityId?: string; at: string }[];
}

export const mockDb: MockDatabase = {

  // --------------------------------------------------------------------------
  // PROFILES  (2 admin · 3 teacher · 7 student)
  // --------------------------------------------------------------------------
  profiles: roster.map(person => ({
    id: person.id,
    fullName: person.fullName,
    email: person.email,
    role: person.role,
    rollNo: person.rollNo,
    avatarUrl: avatarFor(person),
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z'
  })),

  // --------------------------------------------------------------------------
  // CREDENTIALS  (demo passwords - plain text for dev only)
  // --------------------------------------------------------------------------
  credentials: roster.map(person => ({ email: person.email, password: person.password })),

  // --------------------------------------------------------------------------
  // COURSES
  // --------------------------------------------------------------------------
  courses: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      code: 'CS101',
      title: 'Introduction to Computer Science',
      description: 'Foundations of computing, data structures, and algorithmic problem solving with Python.',
      isArchived: false,
      createdAt: '2026-09-05T08:00:00Z',
      updatedAt: '2026-09-05T08:00:00Z'
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      code: 'WEB302',
      title: 'Modern Web Technologies',
      description: 'Full-stack application architecture using React, Node.js, REST APIs, and database modeling.',
      isArchived: false,
      createdAt: '2026-09-05T08:00:00Z',
      updatedAt: '2026-09-05T08:00:00Z'
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      code: 'SE405',
      title: 'Software Architecture & Quality',
      description: 'Design patterns, microservices, testing paradigms, CI/CD, and enterprise architecture.',
      isArchived: false,
      createdAt: '2026-09-05T08:00:00Z',
      updatedAt: '2026-09-05T08:00:00Z'
    },
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      code: 'DB201',
      title: 'Database Systems',
      description: 'Relational design, SQL, transactions, and database application development.',
      isArchived: false,
      createdAt: '2026-09-05T08:00:00Z',
      updatedAt: '2026-09-05T08:00:00Z'
    },
    {
      id: 'c0000000-0000-0000-0000-000000000005',
      code: 'NET210',
      title: 'Computer Networks',
      description: 'Network models, addressing, routing, transport protocols, and network security.',
      isArchived: false,
      createdAt: '2026-09-05T08:00:00Z',
      updatedAt: '2026-09-05T08:00:00Z'
    }
  ],

  courseTeachers: [
    { courseId: 'c0000000-0000-0000-0000-000000000001', teacherId: 't0000000-0000-0000-0000-000000000001' },
    { courseId: 'c0000000-0000-0000-0000-000000000002', teacherId: 't0000000-0000-0000-0000-000000000001' },
    { courseId: 'c0000000-0000-0000-0000-000000000003', teacherId: 't0000000-0000-0000-0000-000000000002' },
    { courseId: 'c0000000-0000-0000-0000-000000000004', teacherId: 't0000000-0000-0000-0000-000000000003' },
    { courseId: 'c0000000-0000-0000-0000-000000000005', teacherId: 't0000000-0000-0000-0000-000000000002' }
  ],

  enrollments: rosterStudents.flatMap(student =>
    [1, 2, 3, 4, 5].map(course => ({
      courseId: `c0000000-0000-0000-0000-00000000000${course}`,
      studentId: student.id
    }))
  ),

  // --------------------------------------------------------------------------
  // RESOURCES
  // --------------------------------------------------------------------------
  resources: [
    {
      id: 'r0000000-0000-0000-0000-000000000001',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      uploadedBy: 't0000000-0000-0000-0000-000000000001',
      title: 'Lecture 1: Web Architecture Overview',
      description: 'Slides covering Client-Server model, HTTP/2, REST vs GraphQL.',
      filePath: 'resources/c002/lecture_01.pdf',
      fileName: 'lecture_01.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 3450000,
      createdAt: '2026-09-10T10:00:00Z'
    },
    {
      id: 'r0000000-0000-0000-0000-000000000002',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      uploadedBy: 't0000000-0000-0000-0000-000000000001',
      title: 'Express & Supabase Quickstart Guide',
      description: 'Lab tutorial notes and boilerplate code setup.',
      filePath: 'resources/c002/express_supabase_guide.pdf',
      fileName: 'express_supabase_guide.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1250000,
      createdAt: '2026-09-14T14:30:00Z'
    }
  ],

  // --------------------------------------------------------------------------
  // ASSIGNMENTS
  // --------------------------------------------------------------------------
  assignments: [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      createdBy: 't0000000-0000-0000-0000-000000000001',
      title: 'Assignment 1: RESTful API Design',
      instructions: 'Build a secure Express API with JWT authentication, Zod input validation, and PostgreSQL integration.',
      maxMarks: 100,
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      allowLate: true,
      attachmentPath: null,
      createdAt: '2026-10-01T09:00:00Z',
      updatedAt: '2026-10-01T09:00:00Z'
    },
    {
      id: 'a1000000-0000-0000-0000-000000000002',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      createdBy: 't0000000-0000-0000-0000-000000000001',
      title: 'Assignment 2: State Management & Realtime Sync',
      instructions: 'Implement optimistic updates and Supabase Realtime subscriptions in React.',
      maxMarks: 50,
      dueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      allowLate: false,
      attachmentPath: null,
      createdAt: '2026-10-15T09:00:00Z',
      updatedAt: '2026-10-15T09:00:00Z'
    }
  ],

  // --------------------------------------------------------------------------
  // SUBMISSIONS
  // --------------------------------------------------------------------------
  submissions: [
    {
      id: 'sub00000-0000-0000-0000-000000000001',
      assignmentId: 'a1000000-0000-0000-0000-000000000001',
      studentId: 's0000000-0000-0000-0000-000000000001',
      textAnswer: 'GitHub repository: https://github.com/ayesha-siddiqui/web-tech-lab1',
      filePath: 'submissions/a1/ayesha_api_v1.zip',
      submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      isLate: false,
      marksObtained: 92,
      feedback: 'Excellent code architecture and clean modular design.',
      gradedBy: 't0000000-0000-0000-0000-000000000001',
      gradedAt: new Date(Date.now() - 1 * 86400000).toISOString()
    },
    {
      id: 'sub00000-0000-0000-0000-000000000002',
      assignmentId: 'a1000000-0000-0000-0000-000000000001',
      studentId: 's0000000-0000-0000-0000-000000000002',
      textAnswer: 'Completed all required endpoints with Postman collection attached.',
      filePath: 'submissions/a1/usman_submission.zip',
      submittedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      isLate: false,
      marksObtained: 88,
      feedback: 'Good work. Add rate-limiting for production readiness.',
      gradedBy: 't0000000-0000-0000-0000-000000000001',
      gradedAt: new Date(Date.now() - 12 * 3600000).toISOString()
    },
    ...['3', '4', '5'].map((n, i) => ({
      id: `sub00000-0000-0000-0000-00000000010${n}`,
      assignmentId: 'a1000000-0000-0000-0000-000000000001',
      studentId: `s0000000-0000-0000-0000-00000000000${n}`,
      textAnswer: 'Submitted API with JWT auth, Zod validation and a Postman collection.',
      filePath: null,
      submittedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
      isLate: false,
      marksObtained: null,
      feedback: null,
      gradedBy: null,
      gradedAt: null
    }))
  ],

  // --------------------------------------------------------------------------
  // QUIZZES
  // --------------------------------------------------------------------------
  quizzes: [
    {
      id: 'q0000000-0000-0000-0000-000000000001',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      createdBy: 't0000000-0000-0000-0000-000000000001',
      title: 'Quiz 1: HTTP Protocols & REST Standards',
      description: 'Timed assessment on status codes, idempotent methods, and headers.',
      timeLimitMinutes: 15,
      opensAt: new Date(Date.now() - 86400000).toISOString(),
      closesAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      isPublished: true,
      createdAt: '2026-10-10T12:00:00Z',
      updatedAt: '2026-10-10T12:00:00Z'
    }
  ],

  quizQuestions: [
    {
      id: 'qq000000-0000-0000-0000-000000000001',
      quizId: 'q0000000-0000-0000-0000-000000000001',
      position: 1,
      type: 'mcq_single',
      prompt: 'Which HTTP method is defined as idempotent and safe according to RFC 7231?',
      options: [
        { id: 'a', text: 'POST' },
        { id: 'b', text: 'GET' },
        { id: 'c', text: 'PATCH' },
        { id: 'd', text: 'CONNECT' }
      ],
      marks: 5
    },
    {
      id: 'qq000000-0000-0000-0000-000000000002',
      quizId: 'q0000000-0000-0000-0000-000000000001',
      position: 2,
      type: 'true_false',
      prompt: 'Row-Level Security (RLS) in PostgreSQL is evaluated on the database engine level, bypassing application bugs.',
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' }
      ],
      marks: 5
    },
    {
      id: 'qq000000-0000-0000-0000-000000000003',
      quizId: 'q0000000-0000-0000-0000-000000000001',
      position: 3,
      type: 'mcq_multi',
      prompt: 'Which of the following headers prevent Cross-Site Scripting (XSS) and Clickjacking? (Select all that apply)',
      options: [
        { id: 'a', text: 'Content-Security-Policy' },
        { id: 'b', text: 'X-Frame-Options' },
        { id: 'c', text: 'Accept-Encoding' },
        { id: 'd', text: 'X-Content-Type-Options' }
      ],
      marks: 10
    }
  ],

  quizAnswers: [
    { questionId: 'qq000000-0000-0000-0000-000000000001', correctOptionIds: ['b'] },
    { questionId: 'qq000000-0000-0000-0000-000000000002', correctOptionIds: ['true'] },
    { questionId: 'qq000000-0000-0000-0000-000000000003', correctOptionIds: ['a', 'b', 'd'] }
  ],

  quizAttempts: [
    {
      id: 'qa000000-0000-0000-0000-000000000001',
      quizId: 'q0000000-0000-0000-0000-000000000001',
      studentId: 's0000000-0000-0000-0000-000000000001',
      startedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      submittedAt: new Date(Date.now() - 4.8 * 3600000).toISOString(),
      answers: {
        'qq000000-0000-0000-0000-000000000001': ['b'],
        'qq000000-0000-0000-0000-000000000002': ['true'],
        'qq000000-0000-0000-0000-000000000003': ['a', 'b', 'd']
      },
      score: 20
    }
  ],

  // --------------------------------------------------------------------------
  // ANNOUNCEMENTS
  // --------------------------------------------------------------------------
  announcements: [
    {
      id: 'ann00000-0000-0000-0000-000000000001',
      courseId: null,
      authorId: 'a0000000-0000-0000-0000-000000000001',
      title: 'Welcome to GUTech Fall 2026 Academic Term',
      body: 'Welcome students and faculty members. Please ensure you have configured your portal profile and reviewed the academic integrity guidelines.',
      isPinned: true,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z'
    },
    {
      id: 'ann00000-0000-0000-0000-000000000002',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      authorId: 't0000000-0000-0000-0000-000000000001',
      title: 'Lab Session 3 Relocated to Room B-204',
      body: 'The upcoming hands-on session on Friday will be held in computer lab B-204 due to server maintenance in Hall A.',
      isPinned: false,
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T10:00:00Z'
    }
  ],

  announcementReads: [],

  // --------------------------------------------------------------------------
  // CHAT MESSAGES
  // --------------------------------------------------------------------------
  chatMessages: [
    {
      id: 'msg00000-0000-0000-0000-000000000001',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      senderId: 't0000000-0000-0000-0000-000000000001',
      senderName: 'Prof. Imran Hanif',
      senderRole: 'teacher',
      senderAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Imran&backgroundColor=4A0F16&textColor=F8B4B8',
      body: 'Hello everyone! Welcome to the WEB302 classroom channel. Feel free to ask questions here.',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      id: 'msg00000-0000-0000-0000-000000000002',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      senderId: 's0000000-0000-0000-0000-000000000001',
      senderName: 'Ayesha Siddiqui',
      senderRole: 'student',
      senderAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Ayesha&backgroundColor=FDE3E5&textColor=9B1C25',
      body: 'Thank you Professor! Could you clarify if TypeScript strict mode is required for Assignment 1?',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      id: 'msg00000-0000-0000-0000-000000000003',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      senderId: 't0000000-0000-0000-0000-000000000001',
      senderName: 'Prof. Imran Hanif',
      senderRole: 'teacher',
      senderAvatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Imran&backgroundColor=4A0F16&textColor=F8B4B8',
      body: 'Yes, strict mode is required. No "any" types are permitted in core services.',
      createdAt: new Date(Date.now() - 1.9 * 86400000).toISOString()
    }
  ],

  // --------------------------------------------------------------------------
  // COMPLAINTS
  // --------------------------------------------------------------------------
  complaints: [
    {
      id: 'comp0000-0000-0000-0000-000000000001',
      raisedBy: 's0000000-0000-0000-0000-000000000001',
      raisedByName: 'Ayesha Siddiqui',
      courseId: 'c0000000-0000-0000-0000-000000000002',
      courseTitle: 'WEB302 - Modern Web Technologies',
      category: 'academic',
      subject: 'Late penalty clarification on Assignment 1',
      description: 'I had a medical appointment on the due date and requested a 24h extension in advance.',
      status: 'resolved',
      adminResponse: 'Extension granted and late penalty waived by faculty head.',
      resolvedBy: 'a0000000-0000-0000-0000-000000000001',
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      id: 'comp0000-0000-0000-0000-000000000002',
      raisedBy: 's0000000-0000-0000-0000-000000000002',
      raisedByName: 'Usman Ghani',
      courseId: null,
      courseTitle: null,
      category: 'technical',
      subject: 'Laboratory projector flickering in Building C',
      description: 'Projector in room C-102 experiences intermittent HDMI signal loss during presentations.',
      status: 'open',
      adminResponse: null,
      resolvedBy: null,
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString()
    }
  ],

  auditLogs: []
};
