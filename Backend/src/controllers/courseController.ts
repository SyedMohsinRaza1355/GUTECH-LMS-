// ==============================================================================
// GUTech Internal LMS - Course & Enrollment Controller
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { mockDb } from '../repositories/mockDb.js';
import { notFound, conflict, forbidden, badRequest } from '../utils/errors.js';
import { Course } from '../types/index.js';
import { isSupabaseConfigured, supabaseAdmin } from '../config/index.js';

const liveRequest = (req: Request) => isSupabaseConfigured() && req.user?.isDemoUser !== true;
const courseFromRow = (row: any): Course => ({
  id: row.id, code: row.code, title: row.title, description: row.description,
  isArchived: row.is_archived, createdAt: row.created_at, updatedAt: row.updated_at
});

async function enrichLiveCourses(rows: any[]) {
  const ids = rows.map(row => row.id);
  if (!ids.length) return [];
  const [{ data: teacherRows, error: teacherError }, { data: enrollmentRows, error: enrollmentError }] = await Promise.all([
    supabaseAdmin.from('course_teachers').select('course_id,teacher_id,profiles(*)').in('course_id', ids),
    supabaseAdmin.from('enrollments').select('course_id').in('course_id', ids)
  ]);
  if (teacherError) throw teacherError;
  if (enrollmentError) throw enrollmentError;
  return rows.map(row => ({
    ...courseFromRow(row),
    teachers: (teacherRows || []).filter(link => link.course_id === row.id).map(link => {
      const profile = link.profiles as any;
      return profile ? { id: profile.id, fullName: profile.full_name, email: profile.email, role: profile.role, rollNo: profile.roll_no, avatarUrl: profile.avatar_url, isActive: profile.is_active, mustChangePassword: profile.must_change_password, createdAt: profile.created_at, updatedAt: profile.updated_at } : null;
    }).filter(Boolean),
    studentsCount: (enrollmentRows || []).filter(link => link.course_id === row.id).length
  }));
}

export const listAllCoursesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;

    if (liveRequest(req)) {
      const from = (page - 1) * pageSize;
      const { data, count, error } = await supabaseAdmin.from('courses').select('*', { count: 'exact' }).range(from, from + pageSize - 1).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ data: await enrichLiveCourses(data || []), meta: { page, pageSize, total: count || 0 } });
    }

    const list = mockDb.courses.map(c => {
      const teacherIds = mockDb.courseTeachers.filter(ct => ct.courseId === c.id).map(ct => ct.teacherId);
      const teachers = mockDb.profiles.filter(p => teacherIds.includes(p.id));
      const studentsCount = mockDb.enrollments.filter(e => e.courseId === c.id).length;
      return {
        ...c,
        teachers,
        studentsCount
      };
    });

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

export const createCourseAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, title, description } = req.body;

    if (liveRequest(req)) {
      const { data, error } = await supabaseAdmin.from('courses').insert({ code: code.toUpperCase(), title, description: description || '', is_archived: false }).select().single();
      if (error?.code === '23505') return next(conflict(`Course with code "${code}" already exists.`));
      if (error) throw error;
      return res.status(201).json({ data: courseFromRow(data) });
    }

    const exists = mockDb.courses.some(c => c.code.toUpperCase() === code.toUpperCase());
    if (exists) {
      return next(conflict(`Course with code "${code}" already exists.`));
    }

    const newCourse: Course = {
      id: `c-${Date.now()}`,
      code: code.toUpperCase(),
      title,
      description: description || '',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockDb.courses.unshift(newCourse);

    return res.status(201).json({ data: newCourse });
  } catch (err) {
    next(err);
  }
};

export const patchCourseAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, title, description, isArchived } = req.body;

    if (liveRequest(req)) {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (code !== undefined) update.code = code.toUpperCase();
      if (title !== undefined) update.title = title;
      if (description !== undefined) update.description = description;
      if (isArchived !== undefined) update.is_archived = isArchived;
      const { data, error } = await supabaseAdmin.from('courses').update(update).eq('id', id).select().maybeSingle();
      if (error?.code === '23505') return next(conflict('A course with this code already exists.'));
      if (error) throw error;
      if (!data) return next(notFound('Course not found'));
      return res.status(200).json({ data: courseFromRow(data) });
    }

    const course = mockDb.courses.find(c => c.id === id);
    if (!course) {
      return next(notFound('Course not found'));
    }

    if (code) course.code = code.toUpperCase();
    if (title) course.title = title;
    if (description !== undefined) course.description = description;
    if (isArchived !== undefined) course.isArchived = isArchived;
    course.updatedAt = new Date().toISOString();

    return res.status(200).json({ data: course });
  } catch (err) {
    next(err);
  }
};

export const deleteCourseAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (liveRequest(req)) {
      const { data, error } = await supabaseAdmin.from('courses').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) return next(notFound('Course not found'));
      return res.status(200).json({ data: { message: 'Course and its dependent course records were deleted.' } });
    }

    const index = mockDb.courses.findIndex(course => course.id === id);
    if (index < 0) return next(notFound('Course not found'));
    mockDb.courses.splice(index, 1);
    mockDb.courseTeachers = mockDb.courseTeachers.filter(row => row.courseId !== id);
    mockDb.enrollments = mockDb.enrollments.filter(row => row.courseId !== id);
    mockDb.resources = mockDb.resources.filter(row => row.courseId !== id);
    const assignmentIds = mockDb.assignments.filter(row => row.courseId === id).map(row => row.id);
    mockDb.assignments = mockDb.assignments.filter(row => row.courseId !== id);
    mockDb.submissions = mockDb.submissions.filter(row => !assignmentIds.includes(row.assignmentId));
    mockDb.quizzes = mockDb.quizzes.filter(row => row.courseId !== id);
    mockDb.announcements = mockDb.announcements.filter(row => row.courseId !== id);
    mockDb.chatMessages = mockDb.chatMessages.filter(row => row.courseId !== id);
    return res.status(200).json({ data: { message: 'Course and its dependent course records were deleted.' } });
  } catch (err) {
    next(err);
  }
};

export const setCourseTeachers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { teacherIds } = req.body as { teacherIds: string[] };

    if (liveRequest(req)) {
      const { data: course, error: courseError } = await supabaseAdmin.from('courses').select('id').eq('id', id).maybeSingle();
      if (courseError) throw courseError;
      if (!course) return next(notFound('Course not found'));
      if (teacherIds.length) {
        const { data: teachers, error } = await supabaseAdmin.from('profiles').select('id').in('id', teacherIds).eq('role', 'teacher').eq('is_active', true);
        if (error) throw error;
        if ((teachers || []).length !== new Set(teacherIds).size) return next(badRequest('Every instructor must be an active teacher profile.'));
      }
      const { error: deleteError } = await supabaseAdmin.from('course_teachers').delete().eq('course_id', id);
      if (deleteError) throw deleteError;
      if (teacherIds.length) {
        const { error } = await supabaseAdmin.from('course_teachers').insert(teacherIds.map(teacherId => ({ course_id: id, teacher_id: teacherId })));
        if (error) throw error;
      }
      return res.status(200).json({ data: { message: 'Course instructors updated successfully', teacherIds } });
    }

    const course = mockDb.courses.find(c => c.id === id);
    if (!course) {
      return next(notFound('Course not found'));
    }

    // Replace teacher set
    mockDb.courseTeachers = mockDb.courseTeachers.filter(ct => ct.courseId !== id);
    for (const tId of teacherIds) {
      mockDb.courseTeachers.push({ courseId: id, teacherId: tId });
    }

    return res.status(200).json({
      data: { message: 'Course instructors updated successfully', teacherIds }
    });
  } catch (err) {
    next(err);
  }
};

export const enrollStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { studentIds, csvContent } = req.body;

    if (liveRequest(req)) {
      const { data: course, error: courseError } = await supabaseAdmin.from('courses').select('id').eq('id', id).maybeSingle();
      if (courseError) throw courseError;
      if (!course) return next(notFound('Course not found'));
      const requested = new Set<string>(Array.isArray(studentIds) ? studentIds : []);
      if (typeof csvContent === 'string' && csvContent.trim()) {
        const emails = csvContent.split(/[\r\n,]+/).map((value: string) => value.trim().toLowerCase()).filter(Boolean);
        const { data: matching, error } = await supabaseAdmin.from('profiles').select('id,email').in('email', emails).eq('role', 'student').eq('is_active', true);
        if (error) throw error;
        for (const profile of matching || []) requested.add(profile.id);
      }
      const ids = [...requested];
      const { data: valid, error: validError } = ids.length ? await supabaseAdmin.from('profiles').select('id,email').in('id', ids).eq('role', 'student').eq('is_active', true) : { data: [], error: null };
      if (validError) throw validError;
      const validById = new Map((valid || []).map(profile => [profile.id, profile]));
      const { data: current, error: currentError } = await supabaseAdmin.from('enrollments').select('student_id').eq('course_id', id);
      if (currentError) throw currentError;
      const already = new Set((current || []).map(row => row.student_id));
      const additions = [...validById.keys()].filter(studentId => !already.has(studentId));
      if (additions.length) {
        const { error } = await supabaseAdmin.from('enrollments').insert(additions.map(studentId => ({ course_id: id, student_id: studentId })));
        if (error) throw error;
      }
      const matched = additions.map(studentId => validById.get(studentId)!.email);
      const duplicates = [...validById.keys()].filter(studentId => already.has(studentId)).map(studentId => validById.get(studentId)!.email);
      const unknown = ids.filter(studentId => !validById.has(studentId));
      return res.status(200).json({ data: { enrolledCount: matched.length, matched, duplicates, unknown } });
    }

    const course = mockDb.courses.find(c => c.id === id);
    if (!course) {
      return next(notFound('Course not found'));
    }

    const matched: string[] = [];
    const duplicates: string[] = [];
    const unknown: string[] = [];

    // Process Direct studentIds
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      for (const sId of studentIds) {
        const student = mockDb.profiles.find(p => p.id === sId && p.role === 'student');
        if (!student) {
          unknown.push(sId);
          continue;
        }
        const already = mockDb.enrollments.some(e => e.courseId === id && e.studentId === sId);
        if (already) {
          duplicates.push(student.email);
        } else {
          mockDb.enrollments.push({ courseId: id, studentId: sId });
          matched.push(student.email);
        }
      }
    }

    // Process CSV Content if provided (e.g. emails separated by commas or newlines)
    if (csvContent && typeof csvContent === 'string') {
      const emails = csvContent
        .split(/[\r\n,]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);

      for (const email of emails) {
        const student = mockDb.profiles.find(p => p.email.toLowerCase() === email && p.role === 'student');
        if (!student) {
          unknown.push(email);
          continue;
        }
        const already = mockDb.enrollments.some(e => e.courseId === id && e.studentId === student.id);
        if (already) {
          duplicates.push(email);
        } else {
          mockDb.enrollments.push({ courseId: id, studentId: student.id });
          matched.push(email);
        }
      }
    }

    return res.status(200).json({
      data: {
        enrolledCount: matched.length,
        matched,
        duplicates,
        unknown
      }
    });
  } catch (err) {
    next(err);
  }
};

export const unenrollStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, studentId } = req.params;

    if (liveRequest(req)) {
      const { data, error } = await supabaseAdmin.from('enrollments').delete().eq('course_id', id).eq('student_id', studentId).select('student_id');
      if (error) throw error;
      if (!data?.length) return next(notFound('Student was not enrolled in this course'));
      return res.status(200).json({ data: { message: 'Student successfully unenrolled from course' } });
    }

    const initialLength = mockDb.enrollments.length;
    mockDb.enrollments = mockDb.enrollments.filter(e => !(e.courseId === id && e.studentId === studentId));

    if (mockDb.enrollments.length === initialLength) {
      return next(notFound('Student was not enrolled in this course'));
    }

    return res.status(200).json({
      data: { message: 'Student successfully unenrolled from course' }
    });
  } catch (err) {
    next(err);
  }
};

export const getMyCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return next(forbidden());

    if (liveRequest(req)) {
      let ids: string[] | null = null;
      if (user.role === 'teacher') {
        const { data, error } = await supabaseAdmin.from('course_teachers').select('course_id').eq('teacher_id', user.id);
        if (error) throw error;
        ids = (data || []).map(row => row.course_id);
      } else if (user.role === 'student') {
        const { data, error } = await supabaseAdmin.from('enrollments').select('course_id').eq('student_id', user.id);
        if (error) throw error;
        ids = (data || []).map(row => row.course_id);
      }
      let query = supabaseAdmin.from('courses').select('*').eq('is_archived', false);
      if (ids) query = ids.length ? query.in('id', ids) : query.eq('id', '00000000-0000-0000-0000-000000000000');
      const { data, error } = await query.order('code');
      if (error) throw error;
      return res.status(200).json({ data: await enrichLiveCourses(data || []) });
    }

    let userCourses: Course[] = [];

    if (user.role === 'admin') {
      userCourses = mockDb.courses.filter(c => !c.isArchived);
    } else if (user.role === 'teacher') {
      const assignedIds = mockDb.courseTeachers.filter(ct => ct.teacherId === user.id).map(ct => ct.courseId);
      userCourses = mockDb.courses.filter(c => assignedIds.includes(c.id) && !c.isArchived);
    } else {
      // Student: only enrolled & non-archived courses
      const enrolledIds = mockDb.enrollments.filter(e => e.studentId === user.id).map(e => e.courseId);
      userCourses = mockDb.courses.filter(c => enrolledIds.includes(c.id) && !c.isArchived);
    }

    const enhanced = userCourses.map(c => {
      const teacherIds = mockDb.courseTeachers.filter(ct => ct.courseId === c.id).map(ct => ct.teacherId);
      const teachers = mockDb.profiles.filter(p => teacherIds.includes(p.id));
      const studentsCount = mockDb.enrollments.filter(e => e.courseId === c.id).length;
      return {
        ...c,
        teachers,
        studentsCount
      };
    });

    return res.status(200).json({
      data: enhanced
    });
  } catch (err) {
    next(err);
  }
};

export const getCourseDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return next(forbidden());

    if (liveRequest(req)) {
      const { data: row, error } = await supabaseAdmin.from('courses').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!row) return next(notFound('Course not found'));
      if (row.is_archived && user.role !== 'admin') return next(notFound('Course not found'));
      if (user.role !== 'admin') {
        const membership = user.role === 'teacher'
          ? await supabaseAdmin.from('course_teachers').select('course_id').eq('course_id', id).eq('teacher_id', user.id).maybeSingle()
          : await supabaseAdmin.from('enrollments').select('course_id').eq('course_id', id).eq('student_id', user.id).maybeSingle();
        if (membership.error) throw membership.error;
        if (!membership.data) return next(forbidden('You are not a member of this course'));
      }
      const [enriched] = await enrichLiveCourses([row]);
      let students: unknown;
      if (user.role !== 'student') {
        const { data: enrollmentRows, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('profiles(*)').eq('course_id', id);
        if (enrollmentError) throw enrollmentError;
        students = (enrollmentRows || []).map(link => {
          const profile = link.profiles as any;
          return profile ? { id: profile.id, fullName: profile.full_name, email: profile.email, role: profile.role, rollNo: profile.roll_no, avatarUrl: profile.avatar_url, isActive: profile.is_active, mustChangePassword: profile.must_change_password, createdAt: profile.created_at, updatedAt: profile.updated_at } : null;
        }).filter(Boolean);
      }
      return res.status(200).json({ data: { ...enriched, students, studentsCount: enriched.studentsCount } });
    }

    const course = mockDb.courses.find(c => c.id === id);
    if (!course) return next(notFound('Course not found'));

    // Check membership
    const isTeacher = mockDb.courseTeachers.some(ct => ct.courseId === id && ct.teacherId === user.id);
    const isEnrolled = mockDb.enrollments.some(e => e.courseId === id && e.studentId === user.id);

    if (user.role !== 'admin' && !isTeacher && !isEnrolled) {
      return next(forbidden('You are not a member of this course'));
    }

    const teacherIds = mockDb.courseTeachers.filter(ct => ct.courseId === id).map(ct => ct.teacherId);
    const teachers = mockDb.profiles.filter(p => teacherIds.includes(p.id));
    const studentIds = mockDb.enrollments.filter(e => e.courseId === id).map(e => e.studentId);
    const students = mockDb.profiles.filter(p => studentIds.includes(p.id));

    return res.status(200).json({
      data: {
        ...course,
        teachers,
        students: user.role === 'student' ? undefined : students,
        studentsCount: studentIds.length
      }
    });
  } catch (err) {
    next(err);
  }
};
