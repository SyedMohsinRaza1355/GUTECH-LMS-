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
        email: 'fatima.student@gutech.edu.om',
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
        email: 'nonexistent.user@gutech.edu.om',
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
