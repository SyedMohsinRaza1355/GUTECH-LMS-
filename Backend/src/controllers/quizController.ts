// ==============================================================================
// GUTech Internal LMS - Quiz & Auto-Grading Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, conflict, badRequest } from '../utils/errors.js';
import { Quiz, QuizQuestion, QuizAttempt } from '../types/index.js';

export const listCourseQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

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

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));

    // Check enrollment
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === quiz.courseId && e.studentId === user.id);
    if (!isEnrolled) return next(forbidden('You are not enrolled in this course'));

    // Check 1 attempt rule
    const existing = mockDb.quizAttempts.find(qa => qa.quizId === id && qa.studentId === user.id);
    if (existing) {
      return next(conflict('You have already taken this quiz. Only one attempt is permitted.'));
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

    const quiz = mockDb.quizzes.find(q => q.id === id);
    if (!quiz) return next(notFound('Quiz not found'));

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === quiz.courseId && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only instructors can review quiz results'));
    }

    const attempts = mockDb.quizAttempts.filter(qa => qa.quizId === id);
    const questions = mockDb.quizQuestions.filter(qq => qq.quizId === id);
    const totalMarks = questions.reduce((sum, qq) => sum + qq.marks, 0);

    const results = attempts.map(qa => {
      const student = mockDb.profiles.find(p => p.id === qa.studentId);
      return {
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
        results
      }
    });
  } catch (err) {
    next(err);
  }
};
