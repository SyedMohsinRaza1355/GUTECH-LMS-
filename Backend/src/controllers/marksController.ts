// ==============================================================================
// GUTech Internal LMS - Marks & Gradebook Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden } from '../utils/errors.js';
import { StudentMarkItem } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';

export const getStudentTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') return next(forbidden('Only students can view pending tasks'));
    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: enrollments, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('course_id').eq('student_id', user.id);
      if (enrollmentError) throw enrollmentError;
      const courseIds = (enrollments || []).map(row => row.course_id);
      if (!courseIds.length) return res.status(200).json({ data: [] });
      const { data: assignments, error } = await supabaseAdmin.from('assignments').select('id,course_id,title,instructions,due_at,max_marks,allow_late,submissions!left(id,submitted_at)').in('course_id', courseIds).eq('submissions.student_id', user.id).order('due_at');
      if (error) throw error;
      const { data: courses, error: coursesError } = await supabaseAdmin.from('courses').select('id,code,title').in('id', courseIds);
      if (coursesError) throw coursesError;
      const courseById = new Map((courses || []).map(course => [course.id, course]));
      const now = Date.now();
      return res.status(200).json({ data: (assignments || []).filter(item => !(item.submissions || []).length).map(item => {
        const course = courseById.get(item.course_id);
        return { id: item.id, courseId: item.course_id, courseCode: course?.code || '', courseTitle: course?.title || '', title: item.title, instructions: item.instructions, dueAt: item.due_at, maxMarks: Number(item.max_marks), allowLate: item.allow_late, isOverdue: Date.parse(item.due_at) < now };
      }) });
    }
    const tasks = mockDb.assignments.filter(item => mockDb.enrollments.some(enrollment => enrollment.courseId === item.courseId && enrollment.studentId === user.id) && !mockDb.submissions.some(submission => submission.assignmentId === item.id && submission.studentId === user.id)).map(item => {
      const course = mockDb.courses.find(entry => entry.id === item.courseId);
      return { id: item.id, courseId: item.courseId, courseCode: course?.code || '', courseTitle: course?.title || '', title: item.title, instructions: item.instructions, dueAt: item.dueAt, maxMarks: item.maxMarks, allowLate: item.allowLate, isOverdue: Date.parse(item.dueAt) < Date.now() };
    }).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    return res.status(200).json({ data: tasks });
  } catch (error) {
    next(error);
  }
};

export const getStudentMarks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const courseId = req.query.courseId as string | undefined;
      const { data: enrollmentRows, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('course_id').eq('student_id', user.id);
      if (enrollmentError) throw enrollmentError;
      const enrolledIds = (enrollmentRows || []).map(row => row.course_id);
      const allowedIds = courseId ? enrolledIds.filter(id => id === courseId) : enrolledIds;
      const noIds = ['00000000-0000-0000-0000-000000000000'];
      const ids = allowedIds.length ? allowedIds : noIds;
      const [{ data: courses, error: coursesError }, { data: assignments, error: assignmentsError }, { data: quizzes, error: quizzesError }] = await Promise.all([
        supabaseAdmin.from('courses').select('id,code,title').in('id', ids),
        supabaseAdmin.from('assignments').select('id,course_id,title,max_marks,submissions(*)').in('course_id', ids),
        supabaseAdmin.from('quizzes').select('id,course_id,title,quiz_questions(marks),quiz_attempts!inner(id,student_id,score,submitted_at)').in('course_id', ids).eq('quiz_attempts.student_id', user.id).eq('is_published', true)
      ]);
      if (coursesError) throw coursesError;
      if (assignmentsError) throw assignmentsError;
      if (quizzesError) throw quizzesError;
      const courseById = new Map((courses || []).map(course => [course.id, course]));
      const items: StudentMarkItem[] = [];
      for (const assignment of assignments || []) {
        const submission = (assignment.submissions || []).find((entry: any) => entry.student_id === user.id);
        const course = courseById.get(assignment.course_id);
        items.push({ studentId: user.id, courseId: assignment.course_id, courseTitle: course ? `${course.code}: ${course.title}` : '', kind: 'assignment', itemId: assignment.id, title: assignment.title, obtained: submission?.marks_obtained === null || submission?.marks_obtained === undefined ? null : Number(submission.marks_obtained), max: Number(assignment.max_marks), gradedAt: submission?.graded_at || null });
      }
      for (const quiz of quizzes || []) {
        const attempt = quiz.quiz_attempts?.[0];
        const course = courseById.get(quiz.course_id);
        items.push({ studentId: user.id, courseId: quiz.course_id, courseTitle: course ? `${course.code}: ${course.title}` : '', kind: 'quiz', itemId: quiz.id, title: quiz.title, obtained: attempt?.score === null || attempt?.score === undefined ? null : Number(attempt.score), max: (quiz.quiz_questions || []).reduce((sum: number, question: any) => sum + Number(question.marks), 0), gradedAt: attempt?.submitted_at || null });
      }
      const graded = items.filter(item => item.obtained !== null && item.obtained !== undefined);
      const totalObtained = graded.reduce((sum, item) => sum + Number(item.obtained), 0);
      const totalMax = graded.reduce((sum, item) => sum + item.max, 0);
      return res.status(200).json({ data: { items, summary: { totalObtained, totalMax, percentage: totalMax ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0, gradedCount: graded.length, pendingCount: items.length - graded.length } } });
    }

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

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: course, error: courseError } = await supabaseAdmin.from('courses').select('id,code,title').eq('id', id).maybeSingle();
      if (courseError) throw courseError;
      if (!course) return next(notFound('Course not found'));
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (user.role !== 'admin' && !teacherLink) return next(forbidden('Only course teachers and administrators can access the gradebook'));
      const [{ data: assignments, error: assignmentsError }, { data: quizzes, error: quizzesError }, { data: enrollments, error: enrollmentsError }] = await Promise.all([
        supabaseAdmin.from('assignments').select('id,title,max_marks,submissions(student_id,marks_obtained)').eq('course_id', id),
        supabaseAdmin.from('quizzes').select('id,title,quiz_questions(marks),quiz_attempts(student_id,score)').eq('course_id', id),
        supabaseAdmin.from('enrollments').select('profiles(id,full_name,roll_no)').eq('course_id', id)
      ]);
      if (assignmentsError) throw assignmentsError;
      if (quizzesError) throw quizzesError;
      if (enrollmentsError) throw enrollmentsError;
      const columns = [
        ...(assignments || []).map(item => ({ id: item.id, title: item.title, kind: 'assignment', maxMarks: Number(item.max_marks) })),
        ...(quizzes || []).map(item => ({ id: item.id, title: item.title, kind: 'quiz', maxMarks: (item.quiz_questions || []).reduce((sum: number, question: any) => sum + Number(question.marks), 0) }))
      ];
      const students = (enrollments || []).map((row: any) => row.profiles).filter(Boolean);
      const rows = students.map((student: any) => {
        const grades: Record<string, { obtained: number | null; max: number; status: string }> = {};
        let totalObtained = 0;
        let totalMax = 0;
        for (const column of columns) {
          const assignment = (assignments || []).find(item => item.id === column.id);
          if (assignment) {
            const submission = (assignment.submissions || []).find((item: any) => item.student_id === student.id);
            const graded = submission?.marks_obtained !== null && submission?.marks_obtained !== undefined;
            grades[column.id] = { obtained: graded ? Number(submission.marks_obtained) : null, max: column.maxMarks, status: graded ? 'graded' : submission ? 'submitted' : 'pending' };
            if (graded) { totalObtained += Number(submission.marks_obtained); totalMax += column.maxMarks; }
          } else {
            const quiz = (quizzes || []).find(item => item.id === column.id)!;
            const attempt = (quiz.quiz_attempts || []).find((item: any) => item.student_id === student.id);
            const graded = attempt?.score !== null && attempt?.score !== undefined;
            grades[column.id] = { obtained: graded ? Number(attempt.score) : null, max: column.maxMarks, status: graded ? 'graded' : attempt ? 'attempted' : 'pending' };
            if (graded) { totalObtained += Number(attempt.score); totalMax += column.maxMarks; }
          }
        }
        return { studentId: student.id, studentName: student.full_name, studentRollNo: student.roll_no, grades, totalObtained, totalMax, percentage: totalMax ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0 };
      });
      return res.status(200).json({ data: { course, columns, rows } });
    }

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

// Teacher / admin work queue: assignments that have submissions waiting to be graded.
export const getGradingQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return next(forbidden('Only teachers and admins have a grading queue'));

    type Row = { assignmentId: string; courseId: string; courseCode: string; courseTitle: string; title: string; dueAt: string; maxMarks: number; ungradedCount: number; gradedCount: number; totalStudents: number; oldestSubmittedAt: string | null; lateCount: number };
    let rows: Row[] = [];
    let classes = 0;

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      let courseIds: string[];
      if (user.role === 'admin') {
        const { data, error } = await supabaseAdmin.from('courses').select('id').eq('is_archived', false);
        if (error) throw error;
        courseIds = (data || []).map(row => row.id);
      } else {
        const { data, error } = await supabaseAdmin.from('course_teachers').select('course_id').eq('teacher_id', user.id);
        if (error) throw error;
        courseIds = (data || []).map(row => row.course_id);
      }
      classes = courseIds.length;
      if (courseIds.length) {
        const [{ data: courses, error: courseError }, { data: assignments, error: assignmentError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
          supabaseAdmin.from('courses').select('id,code,title').in('id', courseIds),
          supabaseAdmin.from('assignments').select('id,course_id,title,due_at,max_marks,submissions(id,submitted_at,marks_obtained,is_late)').in('course_id', courseIds),
          supabaseAdmin.from('enrollments').select('course_id').in('course_id', courseIds)
        ]);
        if (courseError) throw courseError;
        if (assignmentError) throw assignmentError;
        if (enrollmentError) throw enrollmentError;
        const courseById = new Map((courses || []).map(course => [course.id, course]));
        const studentsByCourse = new Map<string, number>();
        (enrollments || []).forEach(row => studentsByCourse.set(row.course_id, (studentsByCourse.get(row.course_id) || 0) + 1));
        rows = (assignments || []).map((item: any) => {
          const submissions: any[] = item.submissions || [];
          const ungraded = submissions.filter(s => s.marks_obtained === null);
          const course = courseById.get(item.course_id);
          return {
            assignmentId: item.id, courseId: item.course_id, courseCode: course?.code || '', courseTitle: course?.title || '', title: item.title,
            dueAt: item.due_at, maxMarks: Number(item.max_marks), ungradedCount: ungraded.length, gradedCount: submissions.length - ungraded.length,
            totalStudents: studentsByCourse.get(item.course_id) || 0,
            oldestSubmittedAt: ungraded.length ? ungraded.map(s => s.submitted_at).sort()[0] : null,
            lateCount: ungraded.filter(s => s.is_late).length
          };
        });
      }
    } else {
      const myCourseIds = user.role === 'admin'
        ? mockDb.courses.filter(course => !course.isArchived).map(course => course.id)
        : mockDb.courseTeachers.filter(link => link.teacherId === user.id).map(link => link.courseId);
      classes = myCourseIds.length;
      rows = mockDb.assignments.filter(item => myCourseIds.includes(item.courseId)).map(item => {
        const course = mockDb.courses.find(entry => entry.id === item.courseId);
        const submissions = mockDb.submissions.filter(s => s.assignmentId === item.id);
        const ungraded = submissions.filter(s => s.marksObtained === null || s.marksObtained === undefined);
        return {
          assignmentId: item.id, courseId: item.courseId, courseCode: course?.code || '', courseTitle: course?.title || '', title: item.title,
          dueAt: item.dueAt, maxMarks: item.maxMarks, ungradedCount: ungraded.length, gradedCount: submissions.length - ungraded.length,
          totalStudents: mockDb.enrollments.filter(e => e.courseId === item.courseId).length,
          oldestSubmittedAt: ungraded.length ? ungraded.map(s => s.submittedAt).sort()[0] : null,
          lateCount: ungraded.filter(s => s.isLate).length
        };
      });
    }

    const items = rows.filter(row => row.ungradedCount > 0).sort((a, b) => Date.parse(a.oldestSubmittedAt || '') - Date.parse(b.oldestSubmittedAt || ''));
    return res.status(200).json({ data: { items, summary: { ungradedTotal: items.reduce((sum, row) => sum + row.ungradedCount, 0), assignmentsToGrade: items.length, classes } } });
  } catch (error) {
    next(error);
  }
};
