# GUTECH Student and Faculty Portal

A role-based LMS prototype for German University of Technology in Oman. It uses React, TypeScript, Vite, Node.js, Express, and Supabase Auth/Postgres.

## What it includes

- Credential login with separate admin, teacher, and student views and protected routes.
- Admin user directory and account provisioning, course management, and enrollment workflows.
- Course pages, assignments, quizzes, marks/gradebook, announcements, chat, and complaints interfaces.
- Supabase schema migrations, row-level security policies, sample-account seeding, and backend request validation.
- Responsive layouts for desktop and mobile.

### Data and persistence status

Live Supabase Auth and database CRUD are implemented for authentication, profiles/user administration, courses/enrollments, and complaints. The assignment, quiz, marks, chat, and announcement controllers still use in-memory demo data in parts of their workflows. Treat those features as prototype demonstrations; they are not yet end-to-end persisted in Supabase. The app may show fallback demo content if its API is unreachable, so confirm the backend health check and database-backed directory/course data during the demo.

The local demo accounts are listed in `Demo Login Credentials.csv` (ignored by Git) and in the login page's sample-account panel. Passwords are never stored as plaintext in Supabase Auth. Do not use these sample passwords for real accounts.

## Project structure

```text
Frontend/                  React 18 + Vite + TypeScript SPA
  src/components/          Shared UI and navigation
  src/context/             Authentication/session state
  src/features/            Login, dashboards, courses, marks, chat, etc.
  src/lib/                 API client and utilities
Backend/                   Express + TypeScript REST API
  src/controllers/         API handlers
  src/middleware/          Authentication, authorization, validation, errors
  src/routes/              REST route definitions
  scripts/                 Migration and demo-account seed scripts
  supabase/migrations/      Postgres schema and RLS policies
docs/                      Architecture, deployment, workflow, walkthrough
```

## Requirements

- Node.js 20 or later and npm.
- A Supabase project for live authentication and persistence.

## Local setup

1. Install backend packages and configure its environment:

   ```bash
   cd Backend
   npm ci
   copy .env.example .env
   ```

   Fill `Backend/.env` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and a strong `JWT_SECRET`. The service-role key is server-only. Never put it in a `VITE_` variable or commit `.env`.

2. Apply the database schema and seed the 12 demo users, three courses, teachers, and enrollments:

   ```bash
   npm run db:migrate
   npm run db:seed-demo
   ```

   These commands modify the configured Supabase project. Run them only against the intended project. The seed script creates confirmed demo Auth users and matching profiles.

3. Start the API in that `Backend` terminal:

   ```bash
   npm run dev
   ```

   The default API is `http://localhost:4000/api`; health check: `http://localhost:4000/api/health`.

4. In a second terminal, configure and start the frontend:

   ```bash
   cd Frontend
   npm ci
   copy .env.example .env
   npm run dev
   ```

   Set `VITE_API_URL=http://localhost:4000/api` in `Frontend/.env`, then open `http://localhost:5173`.

If port 4000 is already in use, the API is likely still running in another terminal. Use that running server or stop it before starting another copy.

## Roles and sample accounts

There are 2 admins, 3 teachers, and 7 students. The login accepts either a username or full email. For username/password pairs, open the local `Demo Login Credentials.csv` or the login page's **Sample accounts** section. Primary demo accounts:

| Role | Username | Demo password | Walkthrough focus |
| --- | --- | --- | --- |
| Admin | `farooq.admin` | `Admin@123` | User directory, provisioning, course and enrollment management |
| Teacher | `tariq.teacher` | `Teach@123` | Assigned classes and faculty view |
| Student | `fatima.student` | `Student@101` | Student dashboard, course access, marks and student navigation |

Other sample accounts are listed locally. This is a demo-only credential list; do not use it for real accounts.

## Verify locally

```bash
cd Backend
npm test
npm run build
cd ../Frontend
npm run build
```

## Deployment: Vercel frontend + Render API

Deployment files are included: `Frontend/vercel.json` for SPA routing and root `render.yaml` for the Express API. These configure deploys; they do not create accounts, publish the app, or supply credentials.

1. Push this project to a GitHub repository. Confirm `git status` does not list `.env` files, `SUPABASE CREDS.txt`, or `Demo Login Credentials.csv`.
2. In Render, create a Blueprint from the repo and deploy the `gutech-lms-api` web service. Add the Supabase environment variables and a strong `JWT_SECRET` in Render. Set `CLIENT_ORIGIN` to the eventual Vercel production origin.
3. In Vercel, import the repo and set **Root Directory** to `Frontend`. Set `VITE_API_URL` to `https://<your-render-service>.onrender.com/api`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only if a frontend feature requires them; the anon key is public by design, and access must be constrained by RLS.
4. Apply migrations and seed demo accounts against the target Supabase project from a trusted local terminal, not during every web-service startup. Confirm the database project, then run `npm run db:migrate` and `npm run db:seed-demo` in `Backend` with the appropriate local environment.
5. Add the Vercel production origin to Supabase Auth's allowed redirect/site URLs. Confirm it exactly matches Render's `CLIENT_ORIGIN`, redeploy both services, and check the Render `/api/health` endpoint.
6. Test real login, admin user listing, a reversible course create/update/delete, and a student request to an admin-only endpoint. Confirm the last returns `403` and no service-role key is exposed in the Vercel build.

Do not claim a live deployment until the provider dashboards show successful deployments and the browser demo is using those public URLs.

## Submission materials

- [Architecture and assumptions](docs/ASSUMPTIONS.md)
- [Timed feature walkthrough plan](docs/DEMO_WALKTHROUGH.md)
- [AI-assisted workflow summary](docs/AI_ASSISTED_WORKFLOW.md)

The repository URL, deployed URL, and hosted walkthrough video are external deliverables. Add the final links here after publishing them.

## Security notes

- Public signup is disabled; admin provisioning is the account creation flow.
- Passwords are handled by Supabase Auth, which stores password hashes; this app does not provide a way to retrieve a user's password.
- Keep service-role credentials server-side. Apply least-privilege RLS policies and use non-production demo data for presentations.
- A public repository must not contain project credentials, `.env` files, or the local plaintext demo credential spreadsheet.
