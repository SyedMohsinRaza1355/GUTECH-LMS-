// ==============================================================================
// GUTech Internal LMS - Complaints & Grievance Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, forbidden, unprocessable } from '../utils/errors.js';
import { Complaint, ComplaintStatus } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';

const liveRequest = (req: Request) => isSupabaseConfigured() && req.user?.isDemoUser !== true;

async function mapLiveComplaints(rows: any[]): Promise<Complaint[]> {
  if (!rows.length) return [];
  const profileIds = [...new Set(rows.map(row => row.raised_by))];
  const courseIds = [...new Set(rows.map(row => row.course_id).filter(Boolean))];
  const [{ data: profiles, error: profileError }, { data: courses, error: courseError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name').in('id', profileIds),
    courseIds.length ? supabaseAdmin.from('courses').select('id,code,title').in('id', courseIds) : Promise.resolve({ data: [], error: null })
  ]);
  if (profileError) throw profileError;
  if (courseError) throw courseError;
  return rows.map(row => {
    const profile = profiles?.find(person => person.id === row.raised_by);
    const course = courses?.find(item => item.id === row.course_id);
    return {
      id: row.id, raisedBy: row.raised_by, raisedByName: profile?.full_name,
      courseId: row.course_id, courseTitle: course ? `${course.code}: ${course.title}` : null,
      category: row.category, subject: row.subject, description: row.description,
      attachmentPath: row.attachment_path, status: row.status, adminResponse: row.admin_response,
      resolvedBy: row.resolved_by, createdAt: row.created_at, updatedAt: row.updated_at
    };
  });
}

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    const { courseId, category, subject, description, attachmentPath } = req.body;

    if (liveRequest(req)) {
      if (courseId) {
        const membership = user.role === 'admin' ? { data: { id: courseId }, error: null } : user.role === 'teacher'
          ? await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', courseId).eq('teacher_id', user.id).maybeSingle()
          : await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', courseId).eq('student_id', user.id).maybeSingle();
        if (membership.error) throw membership.error;
        if (!membership.data) return next(forbidden('You can only file a complaint for a course you belong to'));
      }
      const { data, error } = await supabaseAdmin.from('complaints').insert({ raised_by: user.id, course_id: courseId || null, category, subject, description, attachment_path: attachmentPath || null }).select().single();
      if (error) throw error;
      const [complaint] = await mapLiveComplaints([data]);
      return res.status(201).json({ data: complaint });
    }

    let courseTitle = null;
    if (courseId) {
      const course = mockDb.courses.find(c => c.id === courseId);
      courseTitle = course ? `${course.code}: ${course.title}` : null;
    }

    const newComplaint: Complaint = {
      id: `comp-${Date.now()}`,
      raisedBy: user.id,
      raisedByName: user.fullName,
      courseId: courseId || null,
      courseTitle,
      category,
      subject,
      description,
      attachmentPath: attachmentPath || null,
      status: 'open',
      adminResponse: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockDb.complaints.unshift(newComplaint);

    return res.status(201).json({
      data: newComplaint
    });
  } catch (err) {
    next(err);
  }
};

export const listMyComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    if (liveRequest(req)) {
      const { data, error } = await supabaseAdmin.from('complaints').select('*').eq('raised_by', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data: await mapLiveComplaints(data || []) });
    }

    const myComplaints = mockDb.complaints.filter(c => c.raisedBy === user.id);

    return res.status(200).json({
      data: myComplaints
    });
  } catch (err) {
    next(err);
  }
};

export const listAdminComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') return next(forbidden('Admin authorization required'));

    if (liveRequest(req)) {
      const status = req.query.status as ComplaintStatus | undefined;
      const category = req.query.category as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
      let query = supabaseAdmin.from('complaints').select('*', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (category) query = query.eq('category', category);
      const { data, count, error } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw error;
      return res.status(200).json({ data: await mapLiveComplaints(data || []), meta: { page, pageSize, total: count || 0 } });
    }

    const statusFilter = req.query.status as ComplaintStatus;
    const categoryFilter = req.query.category as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;

    let list = [...mockDb.complaints];
    if (statusFilter) {
      list = list.filter(c => c.status === statusFilter);
    }
    if (categoryFilter) {
      list = list.filter(c => c.category === categoryFilter);
    }

    const total = list.length;
    const paginated = list.slice((page - 1) * pageSize, page * pageSize);

    return res.status(200).json({
      data: paginated,
      meta: { page, pageSize, total }
    });
  } catch (err) {
    next(err);
  }
};

export const respondComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') return next(forbidden('Admin authorization required'));

    const { id } = req.params;
    const { status, adminResponse } = req.body as { status: ComplaintStatus; adminResponse: string };

    if (liveRequest(req)) {
      if ((status === 'resolved' || status === 'rejected') && (!adminResponse || !adminResponse.trim())) {
        return next(unprocessable('An official administrative response is mandatory when resolving or rejecting a grievance ticket.'));
      }
      const { data, error } = await supabaseAdmin.from('complaints').update({ status, admin_response: adminResponse, resolved_by: user.id, updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      if (!data) return next(notFound('Complaint ticket not found'));
      const [complaint] = await mapLiveComplaints([data]);
      return res.status(200).json({ data: complaint });
    }

    const complaint = mockDb.complaints.find(c => c.id === id);
    if (!complaint) return next(notFound('Complaint ticket not found'));

    // Rule: Resolving without response is rejected (422)
    if ((status === 'resolved' || status === 'rejected') && (!adminResponse || adminResponse.trim().length === 0)) {
      return next(unprocessable('An official administrative response is mandatory when resolving or rejecting a grievance ticket.'));
    }

    complaint.status = status;
    complaint.adminResponse = adminResponse;
    complaint.resolvedBy = user.id;
    complaint.updatedAt = new Date().toISOString();

    return res.status(200).json({
      data: complaint
    });
  } catch (err) {
    next(err);
  }
};
