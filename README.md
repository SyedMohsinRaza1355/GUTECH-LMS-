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

## Live deployment: Vercel frontend + API

The production app is deployed to Vercel as two projects from this repository:

| Project | Vercel root directory | Production URL |
| --- | --- | --- |
| React frontend (`gutech-lms`) | `Frontend` | [gutech-lms.vercel.app](https://gutech-lms.vercel.app) |
| Express API (`gutech-lms-api`) | `Backend` | [gutech-lms-api.vercel.app](https://gutech-lms-api.vercel.app) |

The API health endpoint is [gutech-lms-api.vercel.app/api/health](https://gutech-lms-api.vercel.app/api/health). Both projects are connected to the public GitHub repository and deploy from `main`: [SyedMohsinRaza1355/GUTECH-LMS-](https://github.com/SyedMohsinRaza1355/GUTECH-LMS-).

Vercel production environment variables are configured in the dashboards. The API keeps `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` server-side as secrets. The frontend uses `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`; the anon key is public by design and database access must remain constrained by RLS. Do not put the service-role key in any `VITE_` variable or commit `.env` files.

The live Supabase database has 12 demo users (2 admins, 3 teachers, 7 students), three courses, teacher assignments, and student enrollments. To initialize a different Supabase project, confirm it is the intended project, apply migrations, then run the seed script from `Backend`:

```bash
npm run db:migrate
npm run db:seed-demo
```

For local development, run the backend and frontend in separate terminals as described in [Local setup](#local-setup). The deployed API runs on Vercel, so a local backend process is not needed for the production site.

Do not claim a live deployment unless the provider dashboards show successful deployments and the browser demo uses the public URLs above.

## Submission materials

- [Architecture and assumptions](docs/ASSUMPTIONS.md)
- [Timed feature walkthrough plan](docs/DEMO_WALKTHROUGH.md)
- [AI-assisted workflow summary](docs/AI_ASSISTED_WORKFLOW.md)

| Deliverable | Link |
| --- | --- |
| Public GitHub repository | [SyedMohsinRaza1355/GUTECH-LMS-](https://github.com/SyedMohsinRaza1355/GUTECH-LMS-) |
| Live portal | [gutech-lms.vercel.app](https://gutech-lms.vercel.app) |
| Hosted feature walkthrough | Record and upload a 3–5 minute video to YouTube, Loom, or Google Drive, then add its share link here. |

## Security notes

- Public signup is disabled; admin provisioning is the account creation flow.
- Passwords are handled by Supabase Auth, which stores password hashes; this app does not provide a way to retrieve a user's password.
- Keep service-role credentials server-side. Apply least-privilege RLS policies and use non-production demo data for presentations.
- A public repository must not contain project credentials, `.env` files, or the local plaintext demo credential spreadsheet.
