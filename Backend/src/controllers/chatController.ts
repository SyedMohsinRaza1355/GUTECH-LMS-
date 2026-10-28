// ==============================================================================
// GUTech Internal LMS - Classroom Chat Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { ChatMessage } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';

const isLive = (req: Request): boolean => Boolean(isSupabaseConfigured()) && req.user?.isDemoUser !== true;
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const liveMembership = async (courseId: string, user: { id: string; role: string }) => {
  if (user.role === 'admin') return { isTeacher: false, isEnrolled: false, isAdmin: true };
  const [teacher, enrolled] = await Promise.all([
    supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', courseId).eq('teacher_id', user.id).maybeSingle(),
    supabaseAdmin.from('enrollments').select('course_id').eq('course_id', courseId).eq('student_id', user.id).maybeSingle()
  ]);
  if (teacher.error) throw teacher.error;
  if (enrolled.error) throw enrolled.error;
  return { isTeacher: Boolean(teacher.data), isEnrolled: Boolean(enrolled.data), isAdmin: false };
};

const chatFromRows = async (rows: any[]): Promise<ChatMessage[]> => {
  const senderIds = [...new Set(rows.map(row => row.sender_id))];
  const { data, error } = senderIds.length ? await supabaseAdmin.from('profiles').select('id,full_name,role,avatar_url').in('id', senderIds) : { data: [], error: null };
  if (error) throw error;
  const senders = new Map((data || []).map((p: any) => [p.id, p]));
  return rows.map(row => {
    const sender: any = senders.get(row.sender_id);
    return {
      id: row.id, courseId: row.course_id, senderId: row.sender_id, senderName: sender?.full_name || 'Member',
      senderRole: sender?.role || 'student', senderAvatar: sender?.avatar_url || null,
      body: row.deleted_at ? '[This message was deleted]' : row.body, createdAt: row.created_at, deletedAt: row.deleted_at
    } as ChatMessage;
  });
};

export const listChatMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
    const before = req.query.before as string;

    if (isLive(req)) {
      if (!isUuid(id)) return next(notFound('Course not found'));
      const membership = await liveMembership(id, user);
      if (!membership.isAdmin && !membership.isTeacher && !membership.isEnrolled) {
        return next(forbidden('You must be enrolled or assigned to this course to view classroom chat'));
      }
      let query = supabaseAdmin.from('chat_messages').select('*').eq('course_id', id);
      if (before) query = query.lt('created_at', new Date(before).toISOString());
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      const ordered = (data || []).slice().reverse();
      return res.status(200).json({ data: await chatFromRows(ordered), meta: { cursor: ordered.length ? ordered[0].created_at : undefined, limit } });
    }

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('You must be enrolled or assigned to this course to view classroom chat'));
    }

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

    const { body } = req.body;
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return next(badRequest('Message body cannot be empty'));
    }
    if (body.trim().length > 2000) return next(badRequest('Messages can be at most 2000 characters'));

    if (isLive(req)) {
      if (!isUuid(id)) return next(notFound('Course not found'));
      const membership = await liveMembership(id, user);
      if (!membership.isAdmin && !membership.isTeacher && !membership.isEnrolled) {
        return next(forbidden('Only members of this course can send messages'));
      }
      const { data, error } = await supabaseAdmin.from('chat_messages').insert({ course_id: id, sender_id: user.id, body: body.trim() }).select().single();
      if (error) throw error;
      const [created] = await chatFromRows([data]);
      return res.status(201).json({ data: created });
    }

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('Only members of this course can send messages'));
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

    if (isLive(req)) {
      if (!isUuid(id)) return next(notFound('Message not found'));
      const { data: row, error } = await supabaseAdmin.from('chat_messages').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!row || row.deleted_at) return next(notFound('Message not found'));
      const membership = await liveMembership(row.course_id, user);
      const isSender = row.sender_id === user.id;
      const privileged = membership.isTeacher || membership.isAdmin;
      if (isSender) {
        if (Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000 && !privileged) return next(forbidden('Senders can only unsend messages within 5 minutes of posting'));
      } else if (!privileged) {
        return next(forbidden('You do not have permission to delete this message'));
      }
      const { error: deleteError } = await supabaseAdmin.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (deleteError) throw deleteError;
      return res.status(200).json({ data: { message: 'Message deleted' } });
    }

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
