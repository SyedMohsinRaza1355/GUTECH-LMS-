// ==============================================================================
// GUTech Internal LMS - Marks & Gradebook Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden } from '../utils/errors.js';
import { StudentMarkItem } from '../types/index.js';

export const getStudentMarks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    // Security Rule: Student can ONLY view their own marks
    const studentId = user.id;
    const courseId = req.query.courseId as string;

    const items: StudentMarkItem[] = [];

    // 1. Gather Assignment marks
    const assignments = mockDb.assignments.filter(a => (courseId ? a.courseId === courseId : true));
    for (const a of assignments) {
      // Check enrollment
      const enrolled = mockDb.enrollments.some(e => e.courseId === a.courseId && e.studentId === studentId);
      if (!enrolled) continue;

      const sub = mockDb.submissions.find(s => s.assignmentId === a.id && s.studentId === studentId);
      const course = mockDb.courses.find(c => c.id === a.courseId);

      // Marks only visible after grading is saved
      const isGraded = sub && sub.marksObtained !== null && sub.marksObtained !== undefined;

      items.push({
        studentId,
        courseId: a.courseId,
        courseTitle: course ? `${course.code}: ${course.title}` : '',
        kind: 'assignment',
        itemId: a.id,
        title: a.title,
        obtained: isGraded ? sub.marksObtained : null,
        max: a.maxMarks,
        gradedAt: isGraded ? sub.gradedAt : null
      });
    }

    // 2. Gather Quiz marks
    const quizzes = mockDb.quizzes.filter(q => (courseId ? q.courseId === courseId : true) && q.isPublished);
    for (const q of quizzes) {
      const enrolled = mockDb.enrollments.some(e => e.courseId === q.courseId && e.studentId === studentId);
      if (!enrolled) continue;

      const attempt = mockDb.quizAttempts.find(qa => qa.quizId === q.id && qa.studentId === studentId);
      const course = mockDb.courses.find(c => c.id === q.courseId);
      const questions = mockDb.quizQuestions.filter(qq => qq.quizId === q.id);
      const maxMarks = questions.reduce((sum, qq) => sum + qq.marks, 0);

      items.push({
        studentId,
        courseId: q.courseId,
        courseTitle: course ? `${course.code}: ${course.title}` : '',
        kind: 'quiz',
        itemId: q.id,
        title: q.title,
        obtained: attempt?.score !== null && attempt?.score !== undefined ? attempt.score : null,
        max: maxMarks,
        gradedAt: attempt?.submittedAt || null
      });
    }

    // Calculate aggregated metrics: sum(obtained) / sum(max) * 100 for graded items only
    let sumObtained = 0;
    let sumMax = 0;
    let gradedCount = 0;

    for (const item of items) {
      if (item.obtained !== null && item.obtained !== undefined) {
        sumObtained += item.obtained;
        sumMax += item.max;
        gradedCount++;
      }
    }

    const percentage = sumMax > 0 ? parseFloat(((sumObtained / sumMax) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      data: {
        items,
        summary: {
          totalObtained: sumObtained,
          totalMax: sumMax,
          percentage,
          gradedCount,
          pendingCount: items.length - gradedCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getCourseGradebook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only course teachers and administrators can access the gradebook'));
    }

    const course = mockDb.courses.find(c => c.id === id);
    if (!course) return next(notFound('Course not found'));

    // Columns: Assignments + Quizzes
    const assignments = mockDb.assignments.filter(a => a.courseId === id);
    const quizzes = mockDb.quizzes.filter(q => q.courseId === id);

    const columns = [
      ...assignments.map(a => ({ id: a.id, title: a.title, kind: 'assignment', maxMarks: a.maxMarks })),
      ...quizzes.map(q => {
        const questions = mockDb.quizQuestions.filter(qq => qq.quizId === q.id);
        const maxMarks = questions.reduce((sum, qq) => sum + qq.marks, 0);
        return { id: q.id, title: q.title, kind: 'quiz', maxMarks };
      })
    ];

    // Rows: Enrolled Students
    const studentIds = mockDb.enrollments.filter(e => e.courseId === id).map(e => e.studentId);
    const students = mockDb.profiles.filter(p => studentIds.includes(p.id));

    const rows = students.map(student => {
      const grades: Record<string, { obtained: number | null; max: number; status: string }> = {};
      let totalObtained = 0;
      let totalMax = 0;

      for (const col of columns) {
        if (col.kind === 'assignment') {
          const sub = mockDb.submissions.find(s => s.assignmentId === col.id && s.studentId === student.id);
          const hasScore = sub && sub.marksObtained !== null && sub.marksObtained !== undefined;
          grades[col.id] = {
            obtained: hasScore ? sub.marksObtained! : null,
            max: col.maxMarks,
            status: hasScore ? 'graded' : sub ? 'submitted' : 'pending'
          };
          if (hasScore) {
            totalObtained += sub.marksObtained!;
            totalMax += col.maxMarks;
          }
        } else {
          const attempt = mockDb.quizAttempts.find(qa => qa.quizId === col.id && qa.studentId === student.id);
          const hasScore = attempt && attempt.score !== null && attempt.score !== undefined;
          grades[col.id] = {
            obtained: hasScore ? attempt.score! : null,
            max: col.maxMarks,
            status: hasScore ? 'graded' : attempt ? 'attempted' : 'pending'
          };
          if (hasScore) {
            totalObtained += attempt.score!;
            totalMax += col.maxMarks;
          }
        }
      }

      const percentage = totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0;

      return {
        studentId: student.id,
        studentName: student.fullName,
        studentRollNo: student.rollNo,
        grades,
        totalObtained,
        totalMax,
        percentage
      };
    });

    return res.status(200).json({
      data: {
        course: { id: course.id, code: course.code, title: course.title },
        columns,
        rows
      }
    });
  } catch (err) {
    next(err);
  }
};

export const exportGradebookCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Permission denied'));
    }

    const course = mockDb.courses.find(c => c.id === id);
    if (!course) return next(notFound('Course not found'));

    const assignments = mockDb.assignments.filter(a => a.courseId === id);
    const quizzes = mockDb.quizzes.filter(q => q.courseId === id);

    const headers = ['Student Name', 'Roll Number', 'Email'];
    assignments.forEach(a => headers.push(`"${a.title} (Max ${a.maxMarks})"`.replace(/"/g, '""')));
    quizzes.forEach(q => headers.push(`"${q.title} (Quiz)"`.replace(/"/g, '""')));
    headers.push('Total Obtained', 'Total Max', 'Percentage (%)');

    const csvLines = [headers.join(',')];

    const studentIds = mockDb.enrollments.filter(e => e.courseId === id).map(e => e.studentId);
    const students = mockDb.profiles.filter(p => studentIds.includes(p.id));

    for (const student of students) {
      const row: string[] = [
        `"${student.fullName}"`,
        `"${student.rollNo || ''}"`,
        `"${student.email}"`
      ];

      let totalObt = 0;
      let totalMax = 0;

      for (const a of assignments) {
        const sub = mockDb.submissions.find(s => s.assignmentId === a.id && s.studentId === student.id);
        if (sub && sub.marksObtained !== null && sub.marksObtained !== undefined) {
          row.push(sub.marksObtained.toString());
          totalObt += sub.marksObtained;
          totalMax += a.maxMarks;
        } else {
          row.push('Pending');
        }
      }

      for (const q of quizzes) {
        const attempt = mockDb.quizAttempts.find(qa => qa.quizId === q.id && qa.studentId === student.id);
        const questions = mockDb.quizQuestions.filter(qq => qq.quizId === q.id);
        const max = questions.reduce((s, item) => s + item.marks, 0);

        if (attempt && attempt.score !== null && attempt.score !== undefined) {
          row.push(attempt.score.toString());
          totalObt += attempt.score;
          totalMax += max;
        } else {
          row.push('Pending');
        }
      }

      const pct = totalMax > 0 ? ((totalObt / totalMax) * 100).toFixed(2) : '0.00';
      row.push(totalObt.toString(), totalMax.toString(), `${pct}%`);
      csvLines.push(row.join(','));
    }

    // Spec Requirement: Must use UTF-8 BOM so Excel opens cleanly
    const BOM = '\uFEFF';
    const csvContent = BOM + csvLines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gradebook_${course.code}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
