// ==============================================================================
// GUTech Internal LMS - Announcement Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { Announcement } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';

const isLive = (req: Request): boolean => Boolean(isSupabaseConfigured()) && req.user?.isDemoUser !== true;
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const announcementFromRow = (row: any, authors: Map<string, string>, courses: Map<string, { code: string; title: string }>, readIds: Set<string>) => {
  const course = row.course_id ? courses.get(row.course_id) : null;
  return {
    id: row.id, courseId: row.course_id, authorId: row.author_id, title: row.title, body: row.body, isPinned: row.is_pinned,
    createdAt: row.created_at, updatedAt: row.updated_at,
    authorName: authors.get(row.author_id) || 'Academic Staff',
    courseTitle: course ? `${course.code}: ${course.title}` : 'Global University Notice',
    isRead: readIds.has(row.id)
  };
};

const enrichLiveAnnouncements = async (rows: any[], userId: string) => {
  const authorIds = [...new Set(rows.map(row => row.author_id))];
  const courseIds = [...new Set(rows.map(row => row.course_id).filter(Boolean))];
  const [authorResult, courseResult, readResult] = await Promise.all([
    authorIds.length ? supabaseAdmin.from('profiles').select('id,full_name').in('id', authorIds) : Promise.resolve({ data: [], error: null }),
    courseIds.length ? supabaseAdmin.from('courses').select('id,code,title').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    rows.length ? supabaseAdmin.from('announcement_reads').select('announcement_id').eq('user_id', userId).in('announcement_id', rows.map(row => row.id)) : Promise.resolve({ data: [], error: null })
  ]);
  if (authorResult.error) throw authorResult.error;
  if (courseResult.error) throw courseResult.error;
  if (readResult.error) throw readResult.error;
  const authors = new Map((authorResult.data || []).map((a: any) => [a.id, a.full_name]));
  const courses = new Map((courseResult.data || []).map((c: any) => [c.id, { code: c.code, title: c.title }]));
  const readIds = new Set((readResult.data || []).map((r: any) => r.announcement_id));
  return rows.map(row => announcementFromRow(row, authors, courses, readIds));
};

const teachesLiveCourse = async (courseId: string, userId: string) => {
  const { data, error } = await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', courseId).eq('teacher_id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

export const listAnnouncements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const courseId = req.query.courseId as string;

    if (isLive(req)) {
      let courseIds: string[];
      if (user.role === 'admin') {
        const { data, error } = await supabaseAdmin.from('courses').select('id');
        if (error) throw error;
        courseIds = (data || []).map(row => row.id);
      } else if (user.role === 'teacher') {
        const { data, error } = await supabaseAdmin.from('course_teachers').select('course_id').eq('teacher_id', user.id);
        if (error) throw error;
        courseIds = (data || []).map(row => row.course_id);
      } else {
        const { data, error } = await supabaseAdmin.from('enrollments').select('course_id').eq('student_id', user.id);
        if (error) throw error;
        courseIds = (data || []).map(row => row.course_id);
      }
      let query = supabaseAdmin.from('announcements').select('*', { count: 'exact' });
      if (courseId) {
        if (!isUuid(courseId) || (user.role !== 'admin' && !courseIds.includes(courseId))) return res.status(200).json({ data: [], meta: { page, pageSize, total: 0 } });
        query = query.eq('course_id', courseId);
      } else {
        query = courseIds.length ? query.or(`course_id.is.null,course_id.in.(${courseIds.join(',')})`) : query.is('course_id', null);
      }
      const { data: rows, count, error } = await query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return res.status(200).json({ data: await enrichLiveAnnouncements(rows || [], user.id), meta: { page, pageSize, total: count || 0 } });
    }

    // Determine relevant course IDs for user
    let userCourseIds: string[] = [];
    if (user.role === 'admin') {
      userCourseIds = mockDb.courses.map(c => c.id);
    } else if (user.role === 'teacher') {
      userCourseIds = mockDb.courseTeachers.filter(ct => ct.teacherId === user.id).map(ct => ct.courseId);
    } else {
      userCourseIds = mockDb.enrollments.filter(e => e.studentId === user.id).map(e => e.courseId);
    }

    let items = mockDb.announcements.filter(a => {
      if (courseId) return a.courseId === courseId;
      // Feed rule: global (courseId == null) plus enrolled/taught courses
      return a.courseId === null || (a.courseId && userCourseIds.includes(a.courseId));
    });

    // Sort: pinned first, then newest first
    items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = items.length;
    const paginated = items.slice((page - 1) * pageSize, page * pageSize);

    const enhanced = paginated.map(a => {
      const author = mockDb.profiles.find(p => p.id === a.authorId);
      const course = a.courseId ? mockDb.courses.find(c => c.id === a.courseId) : null;
      const isRead = mockDb.announcementReads.some(ar => ar.announcementId === a.id && ar.userId === user.id);

      return {
        ...a,
        authorName: author?.fullName || 'Academic Staff',
        courseTitle: course ? `${course.code}: ${course.title}` : 'Global University Notice',
        isRead
      };
    });

    return res.status(200).json({
      data: enhanced,
      meta: { page, pageSize, total }
    });
  } catch (err) {
    next(err);
  }
};

export const createAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    const { courseId, title, body, isPinned } = req.body;

    // Rule: Global announcements (courseId null) are ADMIN-ONLY
    if (!courseId) {
      if (user.role !== 'admin') {
        return next(forbidden('Only university administrators can post global announcements'));
      }
    } else {
      // Course-specific: must be assigned teacher or admin (live mode checks the database below)
      const isTeacher = isLive(req) || mockDb.courseTeachers.some(ct => ct.courseId === courseId && ct.teacherId === user.id);
      if (user.role !== 'admin' && !isTeacher) {
        return next(forbidden('You cannot post announcements to a course you do not teach'));
      }
    }

    if (isLive(req)) {
      if (courseId && user.role !== 'admin' && !(await teachesLiveCourse(courseId, user.id))) {
        return next(forbidden('You cannot post announcements to a course you do not teach'));
      }
      const { data, error } = await supabaseAdmin.from('announcements').insert({ course_id: courseId || null, author_id: user.id, title, body, is_pinned: Boolean(isPinned) }).select().single();
      if (error) throw error;
      const [created] = await enrichLiveAnnouncements([data], user.id);
      return res.status(201).json({ data: created });
    }

    const newAnnouncement: Announcement = {
      id: `ann-${Date.now()}`,
      courseId: courseId || null,
      authorId: user.id,
      title,
      body,
      isPinned: Boolean(isPinned),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockDb.announcements.unshift(newAnnouncement);

    return res.status(201).json({
      data: {
        ...newAnnouncement,
        authorName: user.fullName
      }
    });
  } catch (err) {
    next(err);
  }
};

export const patchAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    if (isLive(req)) {
      if (!isUuid(id)) return next(notFound('Announcement not found'));
      const { data: existing, error } = await supabaseAdmin.from('announcements').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!existing) return next(notFound('Announcement not found'));
      if (user.role !== 'admin' && existing.author_id !== user.id) return next(forbidden('You do not have permission to edit this announcement'));
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (req.body.title) update.title = req.body.title;
      if (req.body.body) update.body = req.body.body;
      if (req.body.isPinned !== undefined) update.is_pinned = Boolean(req.body.isPinned);
      const { data, error: updateError } = await supabaseAdmin.from('announcements').update(update).eq('id', id).select().single();
      if (updateError) throw updateError;
      const [saved] = await enrichLiveAnnouncements([data], user.id);
      return res.status(200).json({ data: saved });
    }

    const announcement = mockDb.announcements.find(a => a.id === id);
    if (!announcement) return next(notFound('Announcement not found'));

    if (user.role !== 'admin' && announcement.authorId !== user.id) {
      return next(forbidden('You do not have permission to edit this announcement'));
    }

    const { title, body, isPinned } = req.body;
    if (title) announcement.title = title;
    if (body) announcement.body = body;
    if (isPinned !== undefined) announcement.isPinned = isPinned;
    announcement.updatedAt = new Date().toISOString();

    return res.status(200).json({ data: announcement });
  } catch (err) {
    next(err);
  }
};

export const deleteAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    if (isLive(req)) {
      if (!isUuid(id)) return next(notFound('Announcement not found'));
      const { data: existing, error } = await supabaseAdmin.from('announcements').select('id,author_id').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!existing) return next(notFound('Announcement not found'));
      if (user.role !== 'admin' && existing.author_id !== user.id) return next(forbidden('You do not have permission to delete this announcement'));
      const { error: deleteError } = await supabaseAdmin.from('announcements').delete().eq('id', id);
      if (deleteError) throw deleteError;
      return res.status(200).json({ data: { message: 'Announcement deleted' } });
    }

    const index = mockDb.announcements.findIndex(a => a.id === id);
    if (index === -1) return next(notFound('Announcement not found'));

    const announcement = mockDb.announcements[index];
    if (user.role !== 'admin' && announcement.authorId !== user.id) {
      return next(forbidden('You do not have permission to delete this announcement'));
    }

    mockDb.announcements.splice(index, 1);

    return res.status(200).json({ data: { message: 'Announcement deleted' } });
  } catch (err) {
    next(err);
  }
};

export const markAnnouncementRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    const { announcementId } = req.body;
    if (!announcementId) return next(badRequest('announcementId required'));

    if (isLive(req)) {
      if (!isUuid(announcementId)) return next(badRequest('announcementId must be a valid id'));
      const { error } = await supabaseAdmin.from('announcement_reads').upsert({ user_id: user.id, announcement_id: announcementId }, { onConflict: 'user_id,announcement_id' });
      if (error) throw error;
      return res.status(200).json({ data: { message: 'Marked as read' } });
    }

    const exists = mockDb.announcementReads.some(ar => ar.announcementId === announcementId && ar.userId === user.id);
    if (!exists) {
      mockDb.announcementReads.push({
        userId: user.id,
        announcementId,
        readAt: new Date().toISOString()
      });
    }

    return res.status(200).json({ data: { message: 'Marked as read' } });
  } catch (err) {
    next(err);
  }
};
