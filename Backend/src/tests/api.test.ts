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
