// ==============================================================================
// GUTech Internal LMS - Assignment & Submission Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, conflict, unprocessable } from '../utils/errors.js';
import { Assignment, Submission } from '../types/index.js';

export const listAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('Access denied'));
    }

    const assignments = mockDb.assignments.filter(a => a.courseId === id);

    const list = assignments.map(a => {
      const submissions = mockDb.submissions.filter(s => s.assignmentId === a.id);
      const mySubmission = user.role === 'student' ? submissions.find(s => s.studentId === user.id) : null;

      return {
        ...a,
        submissionsCount: submissions.length,
        mySubmission: mySubmission || null
      };
    });

    return res.status(200).json({ data: list });
  } catch (err) {
    next(err);
  }
};

export const createAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only teachers of this course can create assignments'));
    }

    const { title, instructions, maxMarks, dueAt, allowLate, attachmentPath } = req.body;

    const newAssignment: Assignment = {
      id: `a-${Date.now()}`,
      courseId: id,
      createdBy: user.id,
      title,
      instructions,
      maxMarks,
      dueAt,
      allowLate: Boolean(allowLate),
      attachmentPath: attachmentPath || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockDb.assignments.unshift(newAssignment);

    return res.status(201).json({ data: newAssignment });
  } catch (err) {
    next(err);
  }
};

export const patchAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    const assignment = mockDb.assignments.find(a => a.id === id);
    if (!assignment) return next(notFound('Assignment not found'));

    if (user.role !== 'admin' && assignment.createdBy !== user.id) {
      return next(forbidden('Only the creator of this assignment can modify it'));
    }

    const { title, instructions, maxMarks, dueAt, allowLate } = req.body;
    if (title) assignment.title = title;
    if (instructions) assignment.instructions = instructions;
    if (maxMarks) assignment.maxMarks = maxMarks;
    if (dueAt) assignment.dueAt = dueAt;
    if (allowLate !== undefined) assignment.allowLate = allowLate;
    assignment.updatedAt = new Date().toISOString();

    return res.status(200).json({ data: assignment });
  } catch (err) {
    next(err);
  }
};

export const deleteAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    const index = mockDb.assignments.findIndex(a => a.id === id);
    if (index === -1) return next(notFound('Assignment not found'));

    const assignment = mockDb.assignments[index];
    if (user.role !== 'admin' && assignment.createdBy !== user.id) {
      return next(forbidden('Only the creator or an admin can delete this assignment'));
    }

    mockDb.assignments.splice(index, 1);
    mockDb.submissions = mockDb.submissions.filter(s => s.assignmentId !== id);

    return res.status(200).json({ data: { message: 'Assignment deleted successfully' } });
  } catch (err) {
    next(err);
  }
};

export const submitAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // assignmentId
    const user = req.user;
    if (!user || user.role !== 'student') return next(forbidden('Only students can submit assignments'));

    const assignment = mockDb.assignments.find(a => a.id === id);
    if (!assignment) return next(notFound('Assignment not found'));

    // Check if enrolled
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === assignment.courseId && e.studentId === user.id);
    if (!isEnrolled) return next(forbidden('You are not enrolled in this course'));

    const { textAnswer, filePath } = req.body;
    const now = new Date();
    const dueDate = new Date(assignment.dueAt);
    const isLate = now.getTime() > dueDate.getTime();

    // Check allow_late rule
    if (isLate && !assignment.allowLate) {
      return next(conflict('Assignment deadline has passed and late submissions are not accepted.'));
    }

    const existingIndex = mockDb.submissions.findIndex(s => s.assignmentId === id && s.studentId === user.id);

    if (existingIndex >= 0) {
      // Resubmission: update and reset prior marks/feedback as per spec rule
      const sub = mockDb.submissions[existingIndex];
      sub.textAnswer = textAnswer || sub.textAnswer;
      sub.filePath = filePath || sub.filePath;
      sub.submittedAt = now.toISOString();
      sub.isLate = isLate;
      sub.marksObtained = null; // Clears prior grade
      sub.feedback = null;
      sub.gradedAt = null;
      sub.gradedBy = null;

      return res.status(200).json({ data: sub });
    }

    const newSub: Submission = {
      id: `sub-${Date.now()}`,
      assignmentId: id,
      studentId: user.id,
      textAnswer: textAnswer || null,
      filePath: filePath || null,
      submittedAt: now.toISOString(),
      isLate,
      marksObtained: null,
      feedback: null,
      gradedBy: null,
      gradedAt: null
    };

    mockDb.submissions.push(newSub);

    return res.status(200).json({ data: newSub });
  } catch (err) {
    next(err);
  }
};

export const listSubmissionsForTeacher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // assignmentId
    const user = req.user;
    if (!user) return next(forbidden());

    const assignment = mockDb.assignments.find(a => a.id === id);
    if (!assignment) return next(notFound('Assignment not found'));

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === assignment.courseId && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only teachers of this course can view submissions'));
    }

    // Get all enrolled students in this course
    const enrollments = mockDb.enrollments.filter(e => e.courseId === assignment.courseId);

    const submissions = enrollments.map(e => {
      const student = mockDb.profiles.find(p => p.id === e.studentId);
      const sub = mockDb.submissions.find(s => s.assignmentId === id && s.studentId === e.studentId);

      return {
        studentId: e.studentId,
        studentName: student?.fullName || 'Student',
        studentEmail: student?.email || '',
        studentRollNo: student?.rollNo || '',
        isSubmitted: Boolean(sub),
        submission: sub || null
      };
    });

    return res.status(200).json({
      data: {
        assignment,
        submissions
      }
    });
  } catch (err) {
    next(err);
  }
};

export const gradeSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // submissionId
    const user = req.user;
    if (!user) return next(forbidden());

    const submission = mockDb.submissions.find(s => s.id === id);
    if (!submission) return next(notFound('Submission not found'));

    const assignment = mockDb.assignments.find(a => a.id === submission.assignmentId);
    if (!assignment) return next(notFound('Related assignment not found'));

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === assignment.courseId && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only instructors of this course can grade submissions'));
    }

    const { marks, feedback } = req.body;

    if (marks > assignment.maxMarks) {
      return next(unprocessable(`Marks awarded (${marks}) cannot exceed maximum allowable marks (${assignment.maxMarks})`));
    }

    submission.marksObtained = marks;
    submission.feedback = feedback || null;
    submission.gradedBy = user.id;
    submission.gradedAt = new Date().toISOString();

    return res.status(200).json({ data: submission });
  } catch (err) {
    next(err);
  }
};
