// ==============================================================================
// GUTech Internal LMS - Announcement Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { Announcement } from '../types/index.js';

export const listAnnouncements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const courseId = req.query.courseId as string;

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
      // Course-specific: must be assigned teacher or admin
      const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === courseId && ct.teacherId === user.id);
      if (user.role !== 'admin' && !isTeacher) {
        return next(forbidden('You cannot post announcements to a course you do not teach'));
      }
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
