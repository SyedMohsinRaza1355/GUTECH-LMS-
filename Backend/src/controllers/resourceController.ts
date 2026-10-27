// ==============================================================================
// GUTech Internal LMS - Resource Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { Resource } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';

export const listCourseResources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const membership = user.role === 'admin' ? { data: true, error: null } : user.role === 'teacher'
        ? await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', id).eq('teacher_id', user.id).maybeSingle()
        : await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', id).eq('student_id', user.id).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) return next(forbidden('You do not have permission to view resources for this course'));
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
      const search = ((req.query.search as string) || '').trim();
      let query = supabaseAdmin.from('resources').select('*,profiles!resources_uploaded_by_fkey(full_name)', { count: 'exact' }).eq('course_id', id).order('created_at', { ascending: false });
      if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return res.status(200).json({ data: (data || []).map(row => ({
        id: row.id, courseId: row.course_id, uploadedBy: row.uploaded_by,
        title: row.title, description: row.description, filePath: row.file_path,
        fileName: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes),
        createdAt: row.created_at, uploaderName: row.profiles?.full_name || 'Faculty Instructor'
      })), meta: { page, pageSize, total: count || 0 } });
    }

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('You do not have permission to view resources for this course'));
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const search = ((req.query.search as string) || '').toLowerCase().trim();

    let items = mockDb.resources.filter(r => r.courseId === id);
    if (search) {
      items = items.filter(r => r.title.toLowerCase().includes(search) || (r.description && r.description.toLowerCase().includes(search)));
    }

    const total = items.length;
    const paginated = items.slice((page - 1) * pageSize, page * pageSize);

    const enhanced = paginated.map(r => {
      const uploader = mockDb.profiles.find(p => p.id === r.uploadedBy);
      return {
        ...r,
        uploaderName: uploader?.fullName || 'Faculty Instructor'
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

export const createResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // courseId
    const user = req.user;
    if (!user) return next(forbidden());

    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    if (user.role !== 'admin' && !isTeacher) {
      return next(forbidden('Only instructors assigned to this course can upload resources'));
    }

    const { title, description } = req.body;
    const file = req.file;

    // Check if file was provided via multer
    const fileName = file ? file.originalname : (req.body.fileName || 'document.pdf');
    const mimeType = file ? file.mimetype : (req.body.mimeType || 'application/pdf');
    const sizeBytes = file ? file.size : (parseInt(req.body.sizeBytes, 10) || 1024 * 1024 * 2);

    // Validate MIME types
    const allowedMime = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'image/png',
      'image/jpeg',
      'application/zip',
      'application/x-zip-compressed'
    ];

    if (!allowedMime.includes(mimeType) && !fileName.endsWith('.pdf')) {
      return next(badRequest('File type not permitted. Allowed: PDF, DOCX, PPTX, Images, ZIP.'));
    }

    if (sizeBytes > 25 * 1024 * 1024) {
      return next(badRequest('File exceeds maximum allowable limit of 25 MB'));
    }

    const newResource: Resource = {
      id: `r-${Date.now()}`,
      courseId: id,
      uploadedBy: user.id,
      title,
      description: description || null,
      filePath: `resources/${id}/${Date.now()}-${fileName}`,
      fileName,
      mimeType,
      sizeBytes,
      createdAt: new Date().toISOString()
    };

    mockDb.resources.unshift(newResource);

    return res.status(201).json({
      data: {
        ...newResource,
        uploaderName: user.fullName
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getResourceDownloadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    if (isSupabaseConfigured() && user.isDemoUser !== true) {
      const { data: resource, error } = await supabaseAdmin.from('resources').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!resource) return next(notFound('Resource not found'));
      const membership = user.role === 'admin' ? { data: true, error: null } : user.role === 'teacher'
        ? await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', resource.course_id).eq('teacher_id', user.id).maybeSingle()
        : await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', resource.course_id).eq('student_id', user.id).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) return next(forbidden('You are not authorized to download this resource'));
      const { data: signed, error: signedError } = await supabaseAdmin.storage.from('resources').createSignedUrl(resource.file_path, 60);
      if (signedError) throw signedError;
      return res.status(200).json({ data: { downloadUrl: signed.signedUrl, expiresInSeconds: 60, fileName: resource.file_name, sizeBytes: Number(resource.size_bytes) } });
    }

    const resource = mockDb.resources.find(r => r.id === id);
    if (!resource) return next(notFound('Resource not found'));

    // Check enrollment or teacher in course
    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === resource.courseId && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === resource.courseId && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('You are not authorized to download this resource'));
    }

    // Return signed URL with 60 second expiry
    const signedUrl = `https://storage.gutech.edu.om/download/${encodeURIComponent(resource.filePath)}?token=signed-${Date.now()}&expires=60`;

    return res.status(200).json({
      data: {
        downloadUrl: signedUrl,
        expiresInSeconds: 60,
        fileName: resource.fileName,
        sizeBytes: resource.sizeBytes
      }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    const resourceIndex = mockDb.resources.findIndex(r => r.id === id);
    if (resourceIndex === -1) return next(notFound('Resource not found'));

    const resource = mockDb.resources[resourceIndex];
    if (user.role !== 'admin' && resource.uploadedBy !== user.id) {
      return next(forbidden('You can only delete resources uploaded by yourself'));
    }

    mockDb.resources.splice(resourceIndex, 1);

    return res.status(200).json({
      data: { message: 'Resource removed successfully' }
    });
  } catch (err) {
    next(err);
  }
};
