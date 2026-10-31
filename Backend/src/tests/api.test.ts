// ==============================================================================
// GUTech Internal LMS - Vitest & Supertest API Tests
// Tests happy paths and permission-denied cases per Section 1 Rule 9
// ==============================================================================

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('GUTech LMS Security & Authorization Tests', () => {
  it('Non-negotiable: /signup must return 404 with sign-up disabled message', async () => {
    const res = await request(app).get('/signup');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('Happy Path: Health check endpoint returns 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('Permission Denied: Accessing protected /api/me/courses without token returns 401', async () => {
    const res = await request(app).get('/api/me/courses');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Happy Path: User login with seeded student account returns token and profile', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ayesha.siddiqui@gutech.edu.pk',
        password: 'Student@101'
      });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.profile.role).toBe('student');
  });

  it('Negative Path: Invalid login credentials returns generic error (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent.user@gutech.edu.pk',
        password: 'wrongpassword'
      });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('Permission Denied: Student cannot create a course (requires admin)', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', 'Bearer demo-token-s0000000-0000-0000-0000-000000000001')
      .send({
        code: 'HACK101',
        title: 'Unauthorized Course'
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Happy Path: Admin can list system users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer demo-token-a0000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('Happy Path: Student can fetch their own marks from unified view', async () => {
    const res = await request(app)
      .get('/api/me/marks')
      .set('Authorization', 'Bearer demo-token-s0000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
  });
});

const ADMIN = 'Bearer demo-token-a0000000-0000-0000-0000-000000000001';
const TEACHER_WEB = 'Bearer demo-token-t0000000-0000-0000-0000-000000000001';
const TEACHER_OTHER = 'Bearer demo-token-t0000000-0000-0000-0000-000000000003';
const STUDENT = 'Bearer demo-token-s0000000-0000-0000-0000-000000000001';
const SUBMISSION = 'sub00000-0000-0000-0000-000000000002';

describe('Roster', () => {
  it('has 2 admins, 3 teachers and 50 students with unique logins and no Arabic-style names', async () => {
    const res = await request(app).get('/api/admin/users?pageSize=500').set('Authorization', ADMIN);
    const users = res.body.data as Array<{ role: string; email: string; fullName: string }>;
    expect(users.filter(u => u.role === 'student')).toHaveLength(50);
    expect(users.filter(u => u.role === 'teacher')).toHaveLength(3);
    expect(users.filter(u => u.role === 'admin')).toHaveLength(2);
    expect(new Set(users.map(u => u.email)).size).toBe(users.length);
    expect(users.some(u => /\bAl-/.test(u.fullName))).toBe(false);
  });
});

describe('Grading', () => {
  it('lets the course teacher grade a submission and records an audit entry', async () => {
    const res = await request(app).patch(`/api/submissions/${SUBMISSION}/grade`).set('Authorization', TEACHER_WEB).send({ marks: 91, feedback: 'Well done' });
    expect(res.status).toBe(200);
    expect(res.body.data.marksObtained).toBe(91);
    const audit = await request(app).get('/api/admin/audit').set('Authorization', ADMIN);
    expect(audit.body.data.some((row: { action: string }) => row.action === 'grade.save')).toBe(true);
  });

  it('rejects marks above the assignment maximum', async () => {
    const res = await request(app).patch(`/api/submissions/${SUBMISSION}/grade`).set('Authorization', TEACHER_WEB).send({ marks: 101 });
    expect(res.status).toBe(422);
  });

  it('rejects negative and non-numeric marks', async () => {
    const negative = await request(app).patch(`/api/submissions/${SUBMISSION}/grade`).set('Authorization', TEACHER_WEB).send({ marks: -1 });
    const text = await request(app).patch(`/api/submissions/${SUBMISSION}/grade`).set('Authorization', TEACHER_WEB).send({ marks: 'abc' });
    expect(negative.status).toBeGreaterThanOrEqual(400);
    expect(text.status).toBeGreaterThanOrEqual(400);
  });

  it('forbids students and teachers of other courses from grading', async () => {
    const asStudent = await request(app).patch(`/api/submissions/${SUBMISSION}/grade`).set('Authorization', STUDENT).send({ marks: 100 });
    const asOtherTeacher = await request(app).patch(`/api/submissions/${SUBMISSION}/grade`).set('Authorization', TEACHER_OTHER).send({ marks: 100 });
    expect(asStudent.status).toBe(403);
    expect(asOtherTeacher.status).toBe(403);
  });
});

describe('Admin provisioning', () => {
  it('creates a student with an automatic roll number and enrols them in the chosen courses', async () => {
    const courseId = 'c0000000-0000-0000-0000-000000000001';
    const res = await request(app).post('/api/admin/users').set('Authorization', ADMIN).send({
      fullName: 'Test Student', email: 'test.student@gutech.edu.pk', role: 'student', tempPassword: 'Welcome@2026', courseIds: [courseId]
    });
    expect(res.status).toBe(201);
    expect(res.body.data.rollNo).toMatch(/^GUT-\d{4}-\d{4}$/);
    expect(res.body.data.enrolledCourseCount).toBe(1);

    const login = await request(app).post('/api/auth/login').send({ email: 'test.student', password: 'Welcome@2026' });
    expect(login.status).toBe(200);
    expect(login.body.data.profile.role).toBe('student');

    const courses = await request(app).get('/api/me/courses').set('Authorization', `Bearer demo-token-${res.body.data.id}`);
    expect(courses.status).toBe(200);
    expect(courses.body.data.map((c: { id: string }) => c.id)).toContain(courseId);
  });

  it('rejects duplicate emails and weak passwords, and non-admin callers', async () => {
    const duplicate = await request(app).post('/api/admin/users').set('Authorization', ADMIN).send({ fullName: 'Dup', email: 'ayesha.siddiqui@gutech.edu.pk', role: 'student', tempPassword: 'Welcome@2026' });
    const weak = await request(app).post('/api/admin/users').set('Authorization', ADMIN).send({ fullName: 'Weak Pw', email: 'weak.pw@gutech.edu.pk', role: 'student', tempPassword: 'password' });
    const forbidden = await request(app).post('/api/admin/users').set('Authorization', TEACHER_WEB).send({ fullName: 'Nope', email: 'nope@gutech.edu.pk', role: 'student', tempPassword: 'Welcome@2026' });
    expect(duplicate.status).toBe(409);
    expect(weak.status).toBe(422);
    expect(forbidden.status).toBe(403);
  });

  it('prevents an admin from deactivating their own account', async () => {
    const res = await request(app).patch('/api/admin/users/a0000000-0000-0000-0000-000000000001').set('Authorization', ADMIN).send({ isActive: false });
    expect(res.status).toBe(422);
  });
});

describe('Work queues and quiz attempts', () => {
  it('gives a teacher a grading queue with jump targets and keeps it away from students', async () => {
    const res = await request(app).get('/api/me/grading-queue').set('Authorization', TEACHER_WEB);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.ungradedTotal).toBeGreaterThan(0);
    const first = res.body.data.items[0];
    expect(first.assignmentId).toBeDefined();
    expect(first.courseId).toBeDefined();
    expect(first.ungradedCount).toBeGreaterThan(0);
    const asStudent = await request(app).get('/api/me/grading-queue').set('Authorization', STUDENT);
    expect(asStudent.status).toBe(403);
  });

  it('only lists a teacher\'s own courses in the grading queue', async () => {
    const res = await request(app).get('/api/me/grading-queue').set('Authorization', TEACHER_OTHER);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('lets a student resume an unfinished quiz after a refresh, but not retake a finished one', async () => {
    const student = 'Bearer demo-token-s0000000-0000-0000-0000-000000000007';
    const quiz = 'q0000000-0000-0000-0000-000000000001';
    const first = await request(app).post(`/api/quizzes/${quiz}/attempt`).set('Authorization', student);
    expect(first.status).toBe(200);
    const resumed = await request(app).post(`/api/quizzes/${quiz}/attempt`).set('Authorization', student);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.attemptId).toBe(first.body.data.attemptId);
    expect(JSON.stringify(resumed.body)).not.toContain('correctOptionIds');
    const done = await request(app).post(`/api/quizzes/${quiz}/attempt/submit`).set('Authorization', student).send({ answers: {} });
    expect(done.status).toBe(200);
    const retake = await request(app).post(`/api/quizzes/${quiz}/attempt`).set('Authorization', student);
    expect(retake.status).toBe(409);
  });
});

describe('Password change', () => {
  const user = 'Bearer demo-token-s0000000-0000-0000-0000-000000000010';
  it('rejects a wrong current password and accepts the right one, then the new password logs in', async () => {
    const wrong = await request(app).post('/api/auth/change-password').set('Authorization', user).send({ currentPassword: 'Wrong@12345', newPassword: 'Brand-New-Pass1' });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.message).toMatch(/incorrect/i);
    const same = await request(app).post('/api/auth/change-password').set('Authorization', user).send({ currentPassword: 'Student@110', newPassword: 'Student@110' });
    expect(same.status).toBe(422);
    const ok = await request(app).post('/api/auth/change-password').set('Authorization', user).send({ currentPassword: 'Student@110', newPassword: 'Brand-New-Pass1' });
    expect(ok.status).toBe(200);
    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'shahzaib.hussain', password: 'Student@110' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: 'shahzaib.hussain', password: 'Brand-New-Pass1' });
    expect(newLogin.status).toBe(200);
  });
});

describe('Class roster', () => {
  const WEB = 'c0000000-0000-0000-0000-000000000002';
  it('shows the real enrolled students to the course teacher and admin only', async () => {
    const teacher = await request(app).get(`/api/courses/${WEB}/students`).set('Authorization', TEACHER_WEB);
    expect(teacher.status).toBe(200);
    expect(teacher.body.data.length).toBeGreaterThanOrEqual(50);
    expect(teacher.body.data[0]).toMatchObject({ fullName: expect.any(String), email: expect.stringContaining('@gutech.edu.pk') });
    expect((await request(app).get(`/api/courses/${WEB}/students`).set('Authorization', ADMIN)).status).toBe(200);
    expect((await request(app).get(`/api/courses/${WEB}/students`).set('Authorization', TEACHER_OTHER)).status).toBe(403);
    expect((await request(app).get(`/api/courses/${WEB}/students`).set('Authorization', STUDENT)).status).toBe(403);
  });

  it('lets an admin unenroll a student, who then disappears from the roster', async () => {
    const target = 's0000000-0000-0000-0000-000000000020';
    const res = await request(app).delete(`/api/admin/courses/${WEB}/enrollments/${target}`).set('Authorization', ADMIN);
    expect(res.status).toBe(200);
    const after = await request(app).get(`/api/courses/${WEB}/students`).set('Authorization', TEACHER_WEB);
    expect(after.body.data.some((s: { id: string }) => s.id === target)).toBe(false);
  });
});

describe('Profile and recovery', () => {
  it('saves a changed full name on the server, validates it, and rejects anonymous calls', async () => {
    const me = 'Bearer demo-token-s0000000-0000-0000-0000-000000000030';
    const ok = await request(app).patch('/api/auth/me').set('Authorization', me).send({ fullName: '  Updated   Name ' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.fullName).toBe('Updated Name');
    const users = await request(app).get('/api/admin/users?search=Updated%20Name').set('Authorization', ADMIN);
    expect(users.body.data.some((u: { fullName: string }) => u.fullName === 'Updated Name')).toBe(true);
    expect((await request(app).patch('/api/auth/me').set('Authorization', me).send({ fullName: 'A' })).status).toBe(422);
    expect((await request(app).patch('/api/auth/me').send({ fullName: 'Nope Nope' })).status).toBe(401);
  });

  it('answers forgot-password identically for any address and refuses a bogus reset token', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'ayesha.siddiqui@gutech.edu.pk' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    const reset = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', newPassword: 'Another-Pass-123' });
    expect(reset.status).toBe(422);
  });
});

describe('Teacher quiz review and mark editing', () => {
  const QUIZ = 'q0000000-0000-0000-0000-000000000001';
  const ATTEMPT = 'qa000000-0000-0000-0000-000000000001';
  const WEB = 'c0000000-0000-0000-0000-000000000002';

  it('shows the course teacher each attempt with the answer key and the student\'s answers', async () => {
    const res = await request(app).get(`/api/quizzes/${QUIZ}/results`).set('Authorization', TEACHER_WEB);
    expect(res.status).toBe(200);
    expect(res.body.data.questions).toHaveLength(3);
    expect(res.body.data.questions[0].correctOptionIds.length).toBeGreaterThan(0);
    expect(res.body.data.results[0].answers).toBeDefined();
    const list = await request(app).get(`/api/courses/${WEB}/quizzes`).set('Authorization', TEACHER_WEB);
    expect(list.body.data[0].attemptsCount).toBeGreaterThanOrEqual(1);
    // students must never receive the answer key
    const asStudent = await request(app).get(`/api/quizzes/${QUIZ}/results`).set('Authorization', STUDENT);
    expect(asStudent.status).toBe(403);
  });

  it('lets the teacher edit a quiz score within 0..total, records it, and rejects bad scores and outsiders', async () => {
    const ok = await request(app).patch(`/api/quizzes/${QUIZ}/attempts/${ATTEMPT}`).set('Authorization', TEACHER_WEB).send({ score: 15, note: 'partial credit' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ score: 15, totalMarks: 20 });
    const after = await request(app).get(`/api/quizzes/${QUIZ}/results`).set('Authorization', TEACHER_WEB);
    expect(after.body.data.results.find((r: { attemptId: string }) => r.attemptId === ATTEMPT).score).toBe(15);
    const audit = await request(app).get('/api/admin/audit').set('Authorization', ADMIN);
    expect(audit.body.data.some((row: { action: string }) => row.action === 'grade.quiz')).toBe(true);
    expect((await request(app).patch(`/api/quizzes/${QUIZ}/attempts/${ATTEMPT}`).set('Authorization', TEACHER_WEB).send({ score: 21 })).status).toBe(422);
    expect((await request(app).patch(`/api/quizzes/${QUIZ}/attempts/${ATTEMPT}`).set('Authorization', TEACHER_WEB).send({ score: -1 })).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).patch(`/api/quizzes/${QUIZ}/attempts/${ATTEMPT}`).set('Authorization', TEACHER_OTHER).send({ score: 10 })).status).toBe(403);
    expect((await request(app).patch(`/api/quizzes/${QUIZ}/attempts/${ATTEMPT}`).set('Authorization', STUDENT).send({ score: 20 })).status).toBe(403);
    expect((await request(app).patch(`/api/quizzes/${QUIZ}/attempts/nope`).set('Authorization', TEACHER_WEB).send({ score: 5 })).status).toBe(404);
  });

  it('keeps assignment edits consistent with marks already awarded', async () => {
    const A1 = 'a1000000-0000-0000-0000-000000000001';
    const tooLow = await request(app).patch(`/api/assignments/${A1}`).set('Authorization', TEACHER_WEB).send({ maxMarks: 50 });
    expect(tooLow.status).toBe(422);
    expect(tooLow.body.error.message).toMatch(/highest mark/i);
    const fine = await request(app).patch(`/api/assignments/${A1}`).set('Authorization', TEACHER_WEB).send({ title: 'Assignment 1: RESTful API Design (revised)', maxMarks: 100 });
    expect(fine.status).toBe(200);
    expect((await request(app).patch(`/api/assignments/${A1}`).set('Authorization', TEACHER_OTHER).send({ title: 'Hijack attempt' })).status).toBe(403);
  });
});

describe('Gradebook', () => {
  const WEB = 'c0000000-0000-0000-0000-000000000002';
  it('exports a clean, Excel-ready CSV for the course teacher only', async () => {
    const res = await request(app).get(`/api/courses/${WEB}/gradebook.csv`).set('Authorization', TEACHER_WEB);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const text = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toContain('"Student Name","Roll Number","Email"');
    expect(lines[0]).not.toContain('""Assignment');          // headers must not be double-quoted
    expect(lines.length).toBeGreaterThanOrEqual(46);          // header + the enrolled students
    expect(lines.slice(1).every(line => line.split('","').length >= 6)).toBe(true);
    expect((await request(app).get(`/api/courses/${WEB}/gradebook.csv`).set('Authorization', TEACHER_OTHER)).status).toBe(403);
    expect((await request(app).get(`/api/courses/${WEB}/gradebook.csv`).set('Authorization', STUDENT)).status).toBe(403);
    expect((await request(app).get(`/api/courses/${WEB}/gradebook.csv`)).status).toBe(401);
  });

  it('returns the same gradebook data the screen shows, sorted by name', async () => {
    const res = await request(app).get(`/api/courses/${WEB}/gradebook`).set('Authorization', TEACHER_WEB);
    expect(res.status).toBe(200);
    expect(res.body.data.columns.length).toBeGreaterThanOrEqual(3);
    const names = res.body.data.rows.map((r: { studentName: string }) => r.studentName);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));
  });
});
