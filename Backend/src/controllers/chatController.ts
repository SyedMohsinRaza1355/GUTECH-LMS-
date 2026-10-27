// ==============================================================================
// GUTech Internal LMS - Classroom Chat Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { ChatMessage } from '../types/index.js';

export const listChatMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('You must be enrolled or assigned to this course to view classroom chat'));
    }

    const limit = parseInt(req.query.limit as string, 10) || 50;
    const before = req.query.before as string;

    let messages = mockDb.chatMessages.filter(m => m.courseId === id);

    if (before) {
      const beforeTime = new Date(before).getTime();
      messages = messages.filter(m => new Date(m.createdAt).getTime() < beforeTime);
    }

    // Sort newest first to paginate, then reverse for chat rendering
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginated = messages.slice(0, limit).reverse();

    // Soft-deleted messages: mask body
    const formatted = paginated.map(m => {
      if (m.deletedAt) {
        return {
          ...m,
          body: '[This message was deleted]'
        };
      }
      return m;
    });

    const nextCursor = paginated.length > 0 ? paginated[0].createdAt : null;

    return res.status(200).json({
      data: formatted,
      meta: {
        cursor: nextCursor || undefined,
        limit
      }
    });
  } catch (err) {
    next(err);
  }
};

export const sendChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('Only members of this course can send messages'));
    }

    const { body } = req.body;
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return next(badRequest('Message body cannot be empty'));
    }

    // XSS sanitization: ensure text is stripped/plain text
    const cleanBody = body.trim();

    const userProfile = mockDb.profiles.find(p => p.id === user.id);

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      courseId: id,
      senderId: user.id,
      senderName: user.fullName,
      senderRole: user.role,
      senderAvatar: userProfile?.avatarUrl || null,
      body: cleanBody,
      createdAt: new Date().toISOString(),
      deletedAt: null
    };

    mockDb.chatMessages.push(newMsg);

    return res.status(201).json({ data: newMsg });
  } catch (err) {
    next(err);
  }
};

export const deleteChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // messageId
    const user = req.user;
    if (!user) return next(forbidden());

    const message = mockDb.chatMessages.find(m => m.id === id);
    if (!message) return next(notFound('Message not found'));

    // Rule: Sender can delete within 5 min; course teacher or admin can delete anytime
    const isSender = message.senderId === user.id;
    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === message.courseId && ct.teacherId === user.id);
    const isAdmin = user.role === 'admin';

    if (isSender) {
      const msgAgeMs = Date.now() - new Date(message.createdAt).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      if (msgAgeMs > fiveMinutes && !isTeacher && !isAdmin) {
        return next(forbidden('Senders can only unsend messages within 5 minutes of posting'));
      }
    } else if (!isTeacher && !isAdmin) {
      return next(forbidden('You do not have permission to delete this message'));
    }

    message.deletedAt = new Date().toISOString();

    return res.status(200).json({
      data: { message: 'Message deleted' }
    });
  } catch (err) {
    next(err);
  }
};
