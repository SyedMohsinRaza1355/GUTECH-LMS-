// ==============================================================================
// GUTech Internal LMS - Assignment & Submission Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, conflict, unprocessable } from '../utils/errors.js';
import { Assignment, Submission } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';
import { recordAudit } from '../utils/audit.js';

export const listAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const membership = user.role === 'admin' ? { data: true, error: null } : user.role === 'teacher'
        ? await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', id).eq('teacher_id', user.id).maybeSingle()
        : await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', id).eq('student_id', user.id).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) return next(forbidden('Access denied'));

      const { data: rows, error } = await supabaseAdmin.from('assignments').select('*').eq('course_id', id).order('due_at');
      if (error) throw error;
      const assignmentIds = (rows || []).map(row => row.id);
      let submissionQuery = supabaseAdmin.from('submissions').select('*').in('assignment_id', assignmentIds.length ? assignmentIds : ['00000000-0000-0000-0000-000000000000']);
      if (user.role === 'student') submissionQuery = submissionQuery.eq('student_id', user.id);
      const { data: submissions, error: submissionError } = await submissionQuery;
      if (submissionError) throw submissionError;
      return res.status(200).json({ data: (rows || []).map(row => {
        const related = (submissions || []).filter(submission => submission.assignment_id === row.id);
        const mine = user.role === 'student' ? related[0] : null;
        return {
          id: row.id, courseId: row.course_id, createdBy: row.created_by, title: row.title,
          instructions: row.instructions, maxMarks: Number(row.max_marks), dueAt: row.due_at,
          allowLate: row.allow_late, attachmentPath: row.attachment_path,
          createdAt: row.created_at, updatedAt: row.updated_at, submissionsCount: related.length,
          ungradedCount: user.role === 'student' ? undefined : related.filter(submission => submission.marks_obtained === null).length,
          mySubmission: mine ? { id: mine.id, assignmentId: mine.assignment_id, studentId: mine.student_id, textAnswer: mine.text_answer, filePath: mine.file_path, submittedAt: mine.submitted_at, isLate: mine.is_late, marksObtained: mine.marks_obtained === null ? null : Number(mine.marks_obtained), feedback: mine.feedback, gradedBy: mine.graded_by, gradedAt: mine.graded_at } : null
        };
      }) });
    }

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
        ungradedCount: user.role === 'student' ? undefined : submissions.filter(s => s.marksObtained === null || s.marksObtained === undefined).length,
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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (user.role !== 'admin' && !teacherLink) return next(forbidden('Only teachers of this course can create assignments'));
      const { title, instructions, maxMarks, dueAt, allowLate, attachmentPath } = req.body;
      const { data, error } = await supabaseAdmin.from('assignments').insert({ course_id: id, created_by: user.id, title, instructions, max_marks: maxMarks, due_at: dueAt, allow_late: Boolean(allowLate), attachment_path: attachmentPath || null }).select().single();
      if (error) throw error;
      return res.status(201).json({ data: { id: data.id, courseId: data.course_id, createdBy: data.created_by, title: data.title, instructions: data.instructions, maxMarks: Number(data.max_marks), dueAt: data.due_at, allowLate: data.allow_late, attachmentPath: data.attachment_path, createdAt: data.created_at, updatedAt: data.updated_at } });
    }

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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: assignment, error } = await supabaseAdmin.from('assignments').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!assignment) return next(notFound('Assignment not found'));
      if (user.role !== 'admin') {
        const { data: link, error: linkError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', assignment.course_id).eq('teacher_id', user.id).maybeSingle();
        if (linkError) throw linkError;
        if (!link) return next(forbidden('Only instructors of this course can modify this assignment'));
      }
      const { title, instructions, maxMarks, dueAt, allowLate, attachmentPath } = req.body;
      if (maxMarks !== undefined) {
        const { data: top, error: topError } = await supabaseAdmin.from('submissions').select('marks_obtained').eq('assignment_id', id).not('marks_obtained', 'is', null).order('marks_obtained', { ascending: false }).limit(1).maybeSingle();
        if (topError) throw topError;
        if (top && Number(top.marks_obtained) > Number(maxMarks)) return next(unprocessable(`Maximum marks cannot be lower than the highest mark already awarded (${Number(top.marks_obtained)}).`));
      }
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title !== undefined) update.title = title;
      if (instructions !== undefined) update.instructions = instructions;
      if (maxMarks !== undefined) update.max_marks = maxMarks;
      if (dueAt !== undefined) update.due_at = dueAt;
      if (allowLate !== undefined) update.allow_late = allowLate;
      if (attachmentPath !== undefined) update.attachment_path = attachmentPath;
      const { data, error: updateError } = await supabaseAdmin.from('assignments').update(update).eq('id', id).select().single();
      if (updateError) throw updateError;
      await recordAudit({ actorId: user.id, action: 'assignment.update', entity: 'assignment', entityId: id, live: true, metadata: { title: data.title, changes: Object.keys(update).filter(key => key !== 'updated_at') } });
      return res.status(200).json({ data: { id: data.id, courseId: data.course_id, createdBy: data.created_by, title: data.title, instructions: data.instructions, maxMarks: Number(data.max_marks), dueAt: data.due_at, allowLate: data.allow_late, attachmentPath: data.attachment_path, createdAt: data.created_at, updatedAt: data.updated_at } });
    }

    const assignment = mockDb.assignments.find(a => a.id === id);
    if (!assignment) return next(notFound('Assignment not found'));

    if (user.role !== 'admin' && !mockDb.courseTeachers.some(ct => ct.courseId === assignment.courseId && ct.teacherId === user.id)) {
      return next(forbidden('Only instructors of this course can modify this assignment'));
    }

    const { title, instructions, maxMarks, dueAt, allowLate } = req.body;
    if (maxMarks !== undefined) {
      const awarded = mockDb.submissions.filter(sub => sub.assignmentId === id && sub.marksObtained !== null && sub.marksObtained !== undefined).map(sub => Number(sub.marksObtained));
      if (awarded.length && Math.max(...awarded) > Number(maxMarks)) {
        return next(unprocessable(`Maximum marks cannot be lower than the highest mark already awarded (${Math.max(...awarded)}).`));
      }
    }
    if (title) assignment.title = title;
    if (instructions) assignment.instructions = instructions;
    if (maxMarks) assignment.maxMarks = maxMarks;
    if (dueAt) assignment.dueAt = dueAt;
    if (allowLate !== undefined) assignment.allowLate = allowLate;
    assignment.updatedAt = new Date().toISOString();
    await recordAudit({ actorId: user.id, action: 'assignment.update', entity: 'assignment', entityId: id, live: false, metadata: { title: assignment.title } });

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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: assignment, error } = await supabaseAdmin.from('assignments').select('id,course_id,created_by').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!assignment) return next(notFound('Assignment not found'));
      if (user.role !== 'admin') {
        const { data: link, error: linkError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', assignment.course_id).eq('teacher_id', user.id).maybeSingle();
        if (linkError) throw linkError;
        if (!link) return next(forbidden('Only instructors of this course or an admin can delete this assignment'));
      }
      await recordAudit({ actorId: user.id, action: 'assignment.delete', entity: 'assignment', entityId: id, live: true, metadata: { courseId: assignment.course_id } });
      const { error: deleteError } = await supabaseAdmin.from('assignments').delete().eq('id', id);
      if (deleteError) throw deleteError;
      return res.status(200).json({ data: { message: 'Assignment deleted successfully' } });
    }

    const index = mockDb.assignments.findIndex(a => a.id === id);
    if (index === -1) return next(notFound('Assignment not found'));

    const assignment = mockDb.assignments[index];
    if (user.role !== 'admin' && !mockDb.courseTeachers.some(ct => ct.courseId === assignment.courseId && ct.teacherId === user.id)) {
      return next(forbidden('Only instructors of this course or an admin can delete this assignment'));
    }
    await recordAudit({ actorId: user.id, action: 'assignment.delete', entity: 'assignment', entityId: id, live: false, metadata: { title: assignment.title } });

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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: assignment, error } = await supabaseAdmin.from('assignments').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!assignment) return next(notFound('Assignment not found'));
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', assignment.course_id).eq('student_id', user.id).maybeSingle();
      if (enrollmentError) throw enrollmentError;
      if (!enrollment) return next(forbidden('You are not enrolled in this course'));
      const now = new Date();
      const isLate = now.getTime() > new Date(assignment.due_at).getTime();
      if (isLate && !assignment.allow_late) return next(conflict('Assignment deadline has passed and late submissions are not accepted.'));
      const { textAnswer, filePath } = req.body;
      const { data, error: submissionError } = await supabaseAdmin.from('submissions').upsert({ assignment_id: id, student_id: user.id, text_answer: textAnswer || null, file_path: filePath || null, submitted_at: now.toISOString(), is_late: isLate, marks_obtained: null, feedback: null, graded_by: null, graded_at: null }, { onConflict: 'assignment_id,student_id' }).select().single();
      if (submissionError) throw submissionError;
      return res.status(200).json({ data: { id: data.id, assignmentId: data.assignment_id, studentId: data.student_id, textAnswer: data.text_answer, filePath: data.file_path, submittedAt: data.submitted_at, isLate: data.is_late, marksObtained: data.marks_obtained, feedback: data.feedback, gradedBy: data.graded_by, gradedAt: data.graded_at } });
    }

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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: assignment, error } = await supabaseAdmin.from('assignments').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!assignment) return next(notFound('Assignment not found'));
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', assignment.course_id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (user.role !== 'admin' && !teacherLink) return next(forbidden('Only teachers of this course can view submissions'));
      const { data: enrollmentRows, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('student_id,profiles(id,full_name,email,roll_no)').eq('course_id', assignment.course_id);
      if (enrollmentError) throw enrollmentError;
      const { data: submissionRows, error: submissionsError } = await supabaseAdmin.from('submissions').select('*').eq('assignment_id', id);
      if (submissionsError) throw submissionsError;
      const submissions = (enrollmentRows || []).map((row: any) => {
        const profile = row.profiles;
        const sub = (submissionRows || []).find(item => item.student_id === row.student_id);
        return { studentId: row.student_id, studentName: profile?.full_name || 'Student', studentEmail: profile?.email || '', studentRollNo: profile?.roll_no || '', isSubmitted: Boolean(sub), submission: sub ? { id: sub.id, assignmentId: sub.assignment_id, studentId: sub.student_id, textAnswer: sub.text_answer, filePath: sub.file_path, submittedAt: sub.submitted_at, isLate: sub.is_late, marksObtained: sub.marks_obtained === null ? null : Number(sub.marks_obtained), feedback: sub.feedback, gradedBy: sub.graded_by, gradedAt: sub.graded_at } : null };
      });
      return res.status(200).json({ data: { assignment: { id: assignment.id, courseId: assignment.course_id, createdBy: assignment.created_by, title: assignment.title, instructions: assignment.instructions, maxMarks: Number(assignment.max_marks), dueAt: assignment.due_at, allowLate: assignment.allow_late, attachmentPath: assignment.attachment_path, createdAt: assignment.created_at, updatedAt: assignment.updated_at }, submissions } });
    }

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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: submission, error } = await supabaseAdmin.from('submissions').select('*,assignments(*)').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!submission) return next(notFound('Submission not found'));
      const assignment = submission.assignments as any;
      if (!assignment) return next(notFound('Related assignment not found'));
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', assignment.course_id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (user.role !== 'admin' && !teacherLink) return next(forbidden('Only instructors of this course can grade submissions'));
      const { marks, feedback } = req.body;
      if (marks > Number(assignment.max_marks)) return next(unprocessable(`Marks awarded (${marks}) cannot exceed maximum allowable marks (${assignment.max_marks})`));
      const { data, error: gradeError } = await supabaseAdmin.from('submissions').update({ marks_obtained: marks, feedback: feedback || null, graded_by: user.id, graded_at: new Date().toISOString() }).eq('id', id).select().single();
      if (gradeError) throw gradeError;
      await recordAudit({ actorId: user.id, action: 'grade.save', entity: 'submission', entityId: id, live: true, metadata: { assignment: assignment.title, studentId: submission.student_id, previousMarks: submission.marks_obtained, marks, maxMarks: Number(assignment.max_marks) } });
      return res.status(200).json({ data: { id: data.id, assignmentId: data.assignment_id, studentId: data.student_id, textAnswer: data.text_answer, filePath: data.file_path, submittedAt: data.submitted_at, isLate: data.is_late, marksObtained: Number(data.marks_obtained), feedback: data.feedback, gradedBy: data.graded_by, gradedAt: data.graded_at } });
    }

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

    await recordAudit({ actorId: user.id, action: 'grade.save', entity: 'submission', entityId: id, live: false, metadata: { assignment: assignment.title, studentId: submission.studentId, previousMarks: submission.marksObtained, marks, maxMarks: assignment.maxMarks } });
    submission.marksObtained = marks;
    submission.feedback = feedback || null;
    submission.gradedBy = user.id;
    submission.gradedAt = new Date().toISOString();

    return res.status(200).json({ data: submission });
  } catch (err) {
    next(err);
  }
};
