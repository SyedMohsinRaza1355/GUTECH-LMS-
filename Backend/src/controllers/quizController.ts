// ==============================================================================
// GUTech Internal LMS - Quiz & Auto-Grading Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, conflict, badRequest, unprocessable } from '../utils/errors.js';
import { Quiz, QuizQuestion, QuizAttempt } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';
import { recordAudit } from '../utils/audit.js';

export const listCourseQuizzes = async (req: Request, res: Response, next: NextFunction) => {
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
      let query = supabaseAdmin.from('quizzes').select('*').eq('course_id', id).order('opens_at');
      if (user.role === 'student') query = query.eq('is_published', true);
      const { data: rows, error } = await query;
      if (error) throw error;
      const quizIds = (rows || []).map(row => row.id);
      const [{ data: questions, error: questionError }, { data: attempts, error: attemptError }] = await Promise.all([
        supabaseAdmin.from('quiz_questions').select('quiz_id,marks').in('quiz_id', quizIds.length ? quizIds : ['00000000-0000-0000-0000-000000000000']),
        user.role === 'student'
          ? supabaseAdmin.from('quiz_attempts').select('id,quiz_id,student_id,started_at,submitted_at,answers,score').in('quiz_id', quizIds.length ? quizIds : ['00000000-0000-0000-0000-000000000000']).eq('student_id', user.id)
          : supabaseAdmin.from('quiz_attempts').select('id,quiz_id').in('quiz_id', quizIds.length ? quizIds : ['00000000-0000-0000-0000-000000000000'])
      ]);
      if (questionError) throw questionError;
      if (attemptError) throw attemptError;
      const now = Date.now();
      return res.status(200).json({ data: (rows || []).map(row => {
        const quizQuestions = (questions || []).filter(question => question.quiz_id === row.id);
        const attempt = user.role === 'student' ? (attempts || []).find((item: any) => item.quiz_id === row.id) as any : undefined;
        const attemptsCount = user.role === 'student' ? undefined : (attempts || []).filter((item: any) => item.quiz_id === row.id).length;
        return {
          attemptsCount,
          id: row.id, courseId: row.course_id, createdBy: row.created_by, title: row.title,
          description: row.description, timeLimitMinutes: row.time_limit_minutes,
          opensAt: row.opens_at, closesAt: row.closes_at, isPublished: row.is_published,
          createdAt: row.created_at, updatedAt: row.updated_at,
          status: now < Date.parse(row.opens_at) ? 'upcoming' : now > Date.parse(row.closes_at) ? 'ended' : 'active',
          questionsCount: quizQuestions.length, totalMarks: quizQuestions.reduce((sum, question) => sum + Number(question.marks), 0),
          myAttempt: attempt ? { id: attempt.id, quizId: attempt.quiz_id, studentId: attempt.student_id, startedAt: attempt.started_at, submittedAt: attempt.submitted_at, answers: attempt.answers, score: attempt.score === null ? null : Number(attempt.score) } : null
        };
      }) });
    }

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('Access denied'));
    }

    let quizzes = mockDb.quizzes.filter(q => q.courseId === id);

    // Students only see published quizzes
    if (user.role === 'student') {
      quizzes = quizzes.filter(q => q.isPublished);
    }

    const enhanced = quizzes.map(q => {
      const questions = mockDb.quizQuestions.filter(qq => qq.quizId === q.id);
      const totalMarks = questions.reduce((sum, qq) => sum + qq.marks, 0);
      const myAttempt = user.role === 'student' ? mockDb.quizAttempts.find(qa => qa.quizId === q.id && qa.studentId === user.id) : null;

      const now = new Date();
      const opens = new Date(q.opensAt);
      const closes = new Date(q.closesAt);

      let status = 'upcoming';
      if (now < opens) status = 'upcoming';
      else if (now > closes) status = 'ended';
      else status = 'active';

      return {
        ...q,
        attemptsCount: user.role === 'student' ? undefined : mockDb.quizAttempts.filter(qa => qa.quizId === q.id).length,
        status,
        questionsCount: questions.length,
        totalMarks,
        myAttempt: myAttempt || null
      };
    });

    return res.status(200).json({ data: enhanced });
  } catch (err) {
    next(err);
  }
};

export const createQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      const { data: course, error: courseError } = await supabaseAdmin.from('courses').select('id').eq('id', id).maybeSingle();
      if (courseError) throw courseError;
      if (!course) return next(notFound('Course not found'));
      if (user.role !== 'admin' && !teacherLink) return next(forbidden('Only course instructors can create quizzes'));
      const { title, description, timeLimitMinutes, opensAt, closesAt, isPublished, questions } = req.body;
      const { data: quiz, error } = await supabaseAdmin.from('quizzes').insert({ course_id: id, created_by: user.id, title, description: description || null, time_limit_minutes: timeLimitMinutes, opens_at: opensAt, closes_at: closesAt, is_published: Boolean(isPublished) }).select().single();
      if (error) throw error;
      const { data: questionRows, error: questionError } = await supabaseAdmin.from('quiz_questions').insert(questions.map((question: any) => ({ quiz_id: quiz.id, position: question.position, type: question.type, prompt: question.prompt, options: question.options, marks: question.marks }))).select('id,position');
      if (questionError) {
        await supabaseAdmin.from('quizzes').delete().eq('id', quiz.id);
        throw questionError;
      }
      const answerRows = (questionRows || []).map(question => ({ question_id: question.id, correct_option_ids: questions.find((item: any) => item.position === question.position)?.correctOptionIds || [] }));
      const { error: answerError } = await supabaseAdmin.from('quiz_answers').insert(answerRows);
      if (answerError) {
        await supabaseAdmin.from('quizzes').delete().eq('id', quiz.id);
        throw answerError;
      }
      return res.status(201).json({ data: { id: quiz.id, courseId: quiz.course_id, createdBy: quiz.created_by, title: quiz.title, description: quiz.description, timeLimitMinutes: quiz.time_limit_minutes, opensAt: quiz.opens_at, closesAt: quiz.closes_at, isPublished: quiz.is_published, createdAt: quiz.created_at, updatedAt: quiz.updated_at } });
    }

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only course instructors can create quizzes'));
    }

    const { title, description, timeLimitMinutes, opensAt, closesAt, isPublished, questions } = req.body;

    const quizId = `q-${Date.now()}`;
    const newQuiz: Quiz = {
      id: quizId,
      courseId: id,
      createdBy: user.id,
      title,
      description: description || null,
      timeLimitMinutes,
      opensAt,
      closesAt,
      isPublished: Boolean(isPublished),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockDb.quizzes.unshift(newQuiz);

    // Insert Questions and Answers
    for (const q of questions) {
      const questionId = `qq-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const newQuestion: QuizQuestion = {
        id: questionId,
        quizId,
        position: q.position,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        marks: q.marks
      };
      mockDb.quizQuestions.push(newQuestion);

      // Store correct answers securely in isolated quizAnswers store
      mockDb.quizAnswers.push({
        questionId,
        correctOptionIds: q.correctOptionIds
      });
    }

    return res.status(201).json({ data: newQuiz });
  } catch (err) {
    next(err);
  }
};

export const patchQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: quiz, error } = await supabaseAdmin.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!quiz) return next(notFound('Quiz not found'));
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', quiz.course_id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (user.role !== 'admin' && (!teacherLink || quiz.created_by !== user.id)) return next(forbidden('Only the quiz creator or an admin can modify it'));
      const { data: attempt, error: attemptError } = await supabaseAdmin.from('quiz_attempts').select('id').eq('quiz_id', id).limit(1).maybeSingle();
      if (attemptError) throw attemptError;
      const keys = Object.keys(req.body);
      if (attempt && (keys.some(key => key !== 'isPublished') || req.body.isPublished === undefined)) return next(conflict('Quiz cannot be edited after student attempts have commenced.'));
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (req.body.title !== undefined) update.title = req.body.title;
      if (req.body.description !== undefined) update.description = req.body.description;
      if (req.body.timeLimitMinutes !== undefined) update.time_limit_minutes = req.body.timeLimitMinutes;
      if (req.body.opensAt !== undefined) update.opens_at = req.body.opensAt;
      if (req.body.closesAt !== undefined) update.closes_at = req.body.closesAt;
      if (req.body.isPublished !== undefined) update.is_published = req.body.isPublished;
      const { data, error: updateError } = await supabaseAdmin.from('quizzes').update(update).eq('id', id).select().single();
      if (updateError) throw updateError;
      return res.status(200).json({ data: { id: data.id, courseId: data.course_id, createdBy: data.created_by, title: data.title, description: data.description, timeLimitMinutes: data.time_limit_minutes, opensAt: data.opens_at, closesAt: data.closes_at, isPublished: data.is_published, createdAt: data.created_at, updatedAt: data.updated_at } });
    }

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));

    // Check if any student attempt already exists
    const hasAttempts = mockDb.quizAttempts.some(qa => qa.quizId === id);
    if (hasAttempts) {
      // If attempts exist, only publishing toggle is allowed
      if (req.body.isPublished !== undefined) {
        quiz.isPublished = req.body.isPublished;
        quiz.updatedAt = new Date().toISOString();
        return res.status(200).json({ data: quiz });
      }
      return next(conflict('Quiz cannot be edited after student attempts have commenced.'));
    }

    const { title, description, timeLimitMinutes, opensAt, closesAt, isPublished } = req.body;
    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (timeLimitMinutes) quiz.timeLimitMinutes = timeLimitMinutes;
    if (opensAt) quiz.opensAt = opensAt;
    if (closesAt) quiz.closesAt = closesAt;
    if (isPublished !== undefined) quiz.isPublished = isPublished;
    quiz.updatedAt = new Date().toISOString();

    return res.status(200).json({ data: quiz });
  } catch (err) {
    next(err);
  }
};

export const startQuizAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // quizId
    const user = req.user;
    if (!user || user.role !== 'student') return next(forbidden('Only students can attempt quizzes'));

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: quiz, error } = await supabaseAdmin.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!quiz) return next(notFound('Quiz not found'));
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', quiz.course_id).eq('student_id', user.id).maybeSingle();
      if (enrollmentError) throw enrollmentError;
      if (!enrollment) return next(forbidden('You are not enrolled in this course'));
      const { data: existing, error: existingError } = await supabaseAdmin.from('quiz_attempts').select('id,started_at,submitted_at').eq('quiz_id', id).eq('student_id', user.id).maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const expiresMs = new Date(existing.started_at).getTime() + quiz.time_limit_minutes * 60000;
        if (existing.submitted_at || Date.now() >= expiresMs) return next(conflict('You have already taken this quiz. Only one attempt is permitted.'));
        const { data: resumeQuestions, error: resumeError } = await supabaseAdmin.from('quiz_questions').select('id,position,type,prompt,options,marks').eq('quiz_id', id).order('position');
        if (resumeError) throw resumeError;
        return res.status(200).json({ data: { attemptId: existing.id, startedAt: existing.started_at, expiresAt: new Date(expiresMs).toISOString(), timeLimitMinutes: quiz.time_limit_minutes, questions: resumeQuestions, resumed: true } });
      }
      const now = new Date();
      if (!quiz.is_published || now < new Date(quiz.opens_at) || now > new Date(quiz.closes_at)) return next(conflict('Quiz is not currently open for attempts.'));
      const { data: attempt, error: attemptError } = await supabaseAdmin.from('quiz_attempts').insert({ quiz_id: id, student_id: user.id, answers: {}, score: null }).select().single();
      if (attemptError?.code === '23505') return next(conflict('You have already taken this quiz. Only one attempt is permitted.'));
      if (attemptError) throw attemptError;
      const { data: questions, error: questionError } = await supabaseAdmin.from('quiz_questions').select('id,position,type,prompt,options,marks').eq('quiz_id', id).order('position');
      if (questionError) throw questionError;
      return res.status(200).json({ data: { attemptId: attempt.id, startedAt: attempt.started_at, expiresAt: new Date(new Date(attempt.started_at).getTime() + quiz.time_limit_minutes * 60000).toISOString(), timeLimitMinutes: quiz.time_limit_minutes, questions } });
    }

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));

    // Check enrollment
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === quiz.courseId && e.studentId === user.id);
    if (!isEnrolled) return next(forbidden('You are not enrolled in this course'));

    // Check 1 attempt rule
    const existing = mockDb.quizAttempts.find(qa => qa.quizId === id && qa.studentId === user.id);
    if (existing) {
      const expiresMs = new Date(existing.startedAt).getTime() + quiz.timeLimitMinutes * 60 * 1000;
      if (existing.submittedAt || Date.now() >= expiresMs) {
        return next(conflict('You have already taken this quiz. Only one attempt is permitted.'));
      }
      // Unfinished and still within the time limit (e.g. the page was refreshed): resume it.
      return res.status(200).json({
        data: {
          attemptId: existing.id,
          startedAt: existing.startedAt,
          expiresAt: new Date(expiresMs).toISOString(),
          timeLimitMinutes: quiz.timeLimitMinutes,
          resumed: true,
          questions: mockDb.quizQuestions.filter(qq => qq.quizId === id).map(qq => ({ id: qq.id, position: qq.position, type: qq.type, prompt: qq.prompt, options: qq.options, marks: qq.marks }))
        }
      });
    }

    const now = new Date();
    if (now < new Date(quiz.opensAt) || now > new Date(quiz.closesAt)) {
      return next(conflict('Quiz is not currently open for attempts.'));
    }

    const startedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + quiz.timeLimitMinutes * 60 * 1000).toISOString();

    const newAttempt: QuizAttempt = {
      id: `qa-${Date.now()}`,
      quizId: id,
      studentId: user.id,
      startedAt,
      answers: {},
      score: null
    };

    mockDb.quizAttempts.push(newAttempt);

    // CRITICAL SECURITY RULE: Return questions WITHOUT answers!
    const questions = mockDb.quizQuestions
      .filter(qq => qq.quizId === id)
      .map(qq => ({
        id: qq.id,
        position: qq.position,
        type: qq.type,
        prompt: qq.prompt,
        options: qq.options,
        marks: qq.marks
      }));

    return res.status(200).json({
      data: {
        attemptId: newAttempt.id,
        startedAt,
        expiresAt,
        timeLimitMinutes: quiz.timeLimitMinutes,
        questions
      }
    });
  } catch (err) {
    next(err);
  }
};

export const submitQuizAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // quizId
    const user = req.user;
    if (!user || user.role !== 'student') return next(forbidden('Only students can submit quiz attempts'));

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: quiz, error } = await supabaseAdmin.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!quiz) return next(notFound('Quiz not found'));
      const { data: attempt, error: attemptError } = await supabaseAdmin.from('quiz_attempts').select('*').eq('quiz_id', id).eq('student_id', user.id).maybeSingle();
      if (attemptError) throw attemptError;
      if (!attempt) return next(notFound('Quiz attempt session not found. Please start the quiz first.'));
      if (attempt.submitted_at) return next(conflict('Quiz attempt has already been submitted'));
      const { answers } = req.body as { answers: Record<string, string[]> };
      const { data: questions, error: questionError } = await supabaseAdmin.from('quiz_questions').select('id,marks,quiz_answers(correct_option_ids)').eq('quiz_id', id).order('position');
      if (questionError) throw questionError;
      const isExpired = Date.now() > new Date(attempt.started_at).getTime() + (quiz.time_limit_minutes * 60 + 10) * 1000;
      let totalScore = 0;
      for (const question of questions || []) {
        const answerRelation = (question as any).quiz_answers;
        const answer = Array.isArray(answerRelation) ? answerRelation[0] : answerRelation;
        if (!answer) continue;
        const selected = (answers[question.id] || []).map(value => value.trim().toLowerCase()).sort();
        const correct = (answer.correct_option_ids as string[]).map(value => value.trim().toLowerCase()).sort();
        if (!isExpired && selected.length === correct.length && selected.every((value, index) => value === correct[index])) totalScore += Number(question.marks);
      }
      const submittedAt = new Date().toISOString();
      const { data: saved, error: saveError } = await supabaseAdmin.from('quiz_attempts').update({ answers, score: totalScore, submitted_at: submittedAt }).eq('id', attempt.id).is('submitted_at', null).select('id').maybeSingle();
      if (saveError) throw saveError;
      if (!saved) return next(conflict('Quiz attempt has already been submitted'));
      return res.status(200).json({ data: { message: isExpired ? 'Quiz auto-submitted on time expiration' : 'Quiz submitted and auto-graded successfully', score: totalScore, totalMarks: (questions || []).reduce((sum, question) => sum + Number(question.marks), 0), submittedAt } });
    }

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));

    const attempt = mockDb.quizAttempts.find(qa => qa.quizId === id && qa.studentId === user.id);
    if (!attempt) return next(notFound('Quiz attempt session not found. Please start the quiz first.'));

    if (attempt.submittedAt) {
      return next(conflict('Quiz attempt has already been submitted'));
    }

    const { answers } = req.body as { answers: Record<string, string[]> };

    // Check time limit with 10 second network grace period
    const started = new Date(attempt.startedAt).getTime();
    const allowedEnd = started + (quiz.timeLimitMinutes * 60 + 10) * 1000;
    const now = Date.now();

    const isExpired = now > allowedEnd;

    // Server-Side Auto-Grading Engine against isolated quizAnswers
    let totalScore = 0;
    const questions = mockDb.quizQuestions.filter(qq => qq.quizId === id);

    for (const q of questions) {
      const studentSelected = (answers[q.id] || []).map(s => s.trim().toLowerCase()).sort();
      const answerRecord = mockDb.quizAnswers.find(qa => qa.questionId === q.id);

      if (!answerRecord) continue;

      const correctOptions = answerRecord.correctOptionIds.map(s => s.trim().toLowerCase()).sort();

      // Multi-select / single / true-false: all-or-nothing evaluation per spec
      const isCorrect =
        studentSelected.length === correctOptions.length &&
        studentSelected.every((val, idx) => val === correctOptions[idx]);

      if (isCorrect && !isExpired) {
        totalScore += q.marks;
      }
    }

    attempt.answers = answers;
    attempt.submittedAt = new Date().toISOString();
    attempt.score = totalScore;

    return res.status(200).json({
      data: {
        message: isExpired ? 'Quiz auto-submitted on time expiration' : 'Quiz submitted and auto-graded successfully',
        score: totalScore,
        totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
        submittedAt: attempt.submittedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getQuizResultsForTeacher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // quizId
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: quiz, error } = await supabaseAdmin.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!quiz) return next(notFound('Quiz not found'));
      const { data: teacherLink, error: teacherError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', quiz.course_id).eq('teacher_id', user.id).maybeSingle();
      if (teacherError) throw teacherError;
      if (user.role !== 'admin' && !teacherLink) return next(forbidden('Only instructors can review quiz results'));
      const [{ data: attempts, error: attemptsError }, { data: questions, error: questionsError }] = await Promise.all([
        supabaseAdmin.from('quiz_attempts').select('id,student_id,score,started_at,submitted_at,answers,profiles(full_name,roll_no)').eq('quiz_id', id).order('submitted_at', { ascending: false }),
        supabaseAdmin.from('quiz_questions').select('id,position,type,prompt,options,marks').eq('quiz_id', id).order('position')
      ]);
      if (attemptsError) throw attemptsError;
      if (questionsError) throw questionsError;
      const { data: answerRows, error: answersError } = (questions || []).length
        ? await supabaseAdmin.from('quiz_answers').select('question_id,correct_option_ids').in('question_id', (questions || []).map(question => question.id))
        : { data: [], error: null };
      if (answersError) throw answersError;
      const correctByQuestion = new Map((answerRows || []).map((row: any) => [row.question_id, row.correct_option_ids]));
      const reviewQuestions = (questions || []).map((question: any) => ({ id: question.id, position: question.position, type: question.type, prompt: question.prompt, options: question.options, marks: Number(question.marks), correctOptionIds: correctByQuestion.get(question.id) || [] }));
      const totalMarks = (questions || []).reduce((sum, question) => sum + Number(question.marks), 0);
      return res.status(200).json({ data: { quiz: { id: quiz.id, courseId: quiz.course_id, createdBy: quiz.created_by, title: quiz.title, description: quiz.description, timeLimitMinutes: quiz.time_limit_minutes, opensAt: quiz.opens_at, closesAt: quiz.closes_at, isPublished: quiz.is_published, createdAt: quiz.created_at, updatedAt: quiz.updated_at }, questions: reviewQuestions, results: (attempts || []).map((attempt: any) => ({ attemptId: attempt.id, studentId: attempt.student_id, studentName: attempt.profiles?.full_name || 'Student', studentRollNo: attempt.profiles?.roll_no || '', score: attempt.score === null ? null : Number(attempt.score), totalMarks, startedAt: attempt.started_at, submittedAt: attempt.submitted_at, answers: attempt.answers || {} })) } });
    }

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === quiz.courseId && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only instructors can review quiz results'));
    }

    const attempts = mockDb.quizAttempts.filter(qa => qa.quizId === id);
    const questions = mockDb.quizQuestions.filter(qq => qq.quizId === id);
    const totalMarks = questions.reduce((sum, qq) => sum + qq.marks, 0);

    const reviewQuestions = questions.slice().sort((a, b) => a.position - b.position).map(qq => ({
      id: qq.id, position: qq.position, type: qq.type, prompt: qq.prompt, options: qq.options, marks: qq.marks,
      correctOptionIds: mockDb.quizAnswers.find(a => a.questionId === qq.id)?.correctOptionIds || []
    }));

    const results = attempts.map(qa => {
      const student = mockDb.profiles.find(p => p.id === qa.studentId);
      return {
        answers: qa.answers || {},
        attemptId: qa.id,
        studentId: qa.studentId,
        studentName: student?.fullName || 'Student',
        studentRollNo: student?.rollNo || '',
        score: qa.score,
        totalMarks,
        startedAt: qa.startedAt,
        submittedAt: qa.submittedAt
      };
    });

    return res.status(200).json({
      data: {
        quiz,
        questions: reviewQuestions,
        results
      }
    });
  } catch (err) {
    next(err);
  }
};

// Teacher / admin override of a student's quiz score (partial credit, appeals, corrections).
export const setQuizAttemptScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, attemptId } = req.params; // quizId, attemptId
    const user = req.user;
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return next(forbidden('Only instructors can change quiz scores'));
    const score = Number(req.body.score);
    const live = Boolean(isSupabaseConfigured()) && user.isDemoUser !== true;

    if (live) {
      const { data: quiz, error } = await supabaseAdmin.from('quizzes').select('id,course_id,title').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!quiz) return next(notFound('Quiz not found'));
      if (user.role !== 'admin') {
        const { data: link, error: linkError } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', quiz.course_id).eq('teacher_id', user.id).maybeSingle();
        if (linkError) throw linkError;
        if (!link) return next(forbidden('Only instructors of this course can change quiz scores'));
      }
      const [{ data: attempt, error: attemptError }, { data: questions, error: questionsError }] = await Promise.all([
        supabaseAdmin.from('quiz_attempts').select('id,quiz_id,student_id,score,submitted_at').eq('id', attemptId).eq('quiz_id', id).maybeSingle(),
        supabaseAdmin.from('quiz_questions').select('marks').eq('quiz_id', id)
      ]);
      if (attemptError) throw attemptError;
      if (questionsError) throw questionsError;
      if (!attempt) return next(notFound('Quiz attempt not found'));
      if (!attempt.submitted_at) return next(conflict('This attempt has not been submitted yet, so it cannot be scored.'));
      const totalMarks = (questions || []).reduce((sum, question) => sum + Number(question.marks), 0);
      if (score > totalMarks) return next(unprocessable(`Score ${score} cannot exceed the quiz total of ${totalMarks}.`));
      const { error: updateError } = await supabaseAdmin.from('quiz_attempts').update({ score }).eq('id', attemptId);
      if (updateError) throw updateError;
      await recordAudit({ actorId: user.id, action: 'grade.quiz', entity: 'quiz_attempt', entityId: attemptId, live: true, metadata: { quiz: quiz.title, studentId: attempt.student_id, previousScore: attempt.score === null ? null : Number(attempt.score), score, totalMarks, note: req.body.note || null } });
      return res.status(200).json({ data: { attemptId, score, totalMarks } });
    }

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));
    if (user.role !== 'admin' && !mockDb.courseTeachers.some(ct => ct.courseId === quiz.courseId && ct.teacherId === user.id)) {
      return next(forbidden('Only instructors of this course can change quiz scores'));
    }
    const attempt = mockDb.quizAttempts.find(qa => qa.id === attemptId && qa.quizId === id);
    if (!attempt) return next(notFound('Quiz attempt not found'));
    if (!attempt.submittedAt) return next(conflict('This attempt has not been submitted yet, so it cannot be scored.'));
    const totalMarks = mockDb.quizQuestions.filter(qq => qq.quizId === id).reduce((sum, qq) => sum + qq.marks, 0);
    if (score > totalMarks) return next(unprocessable(`Score ${score} cannot exceed the quiz total of ${totalMarks}.`));
    await recordAudit({ actorId: user.id, action: 'grade.quiz', entity: 'quiz_attempt', entityId: attemptId, live: false, metadata: { quiz: quiz.title, studentId: attempt.studentId, previousScore: attempt.score, score, totalMarks, note: req.body.note || null } });
    attempt.score = score;
    return res.status(200).json({ data: { attemptId, score, totalMarks } });
  } catch (err) {
    next(err);
  }
};
