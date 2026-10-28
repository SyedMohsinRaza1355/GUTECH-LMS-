# GU TECH Learning Management Portal

A role-based Learning Management System for **Ghazali University of Technology (GUTech)**. Admins provision accounts and courses, teachers publish and grade coursework, and students submit work, take quizzes and track their marks. Built with React, TypeScript, Vite, Node.js, Express and **Supabase** (Auth + Postgres + Storage), and deployed on Vercel.

| | |
| --- | --- |
| Live portal | https://gutech-lms.vercel.app |
| Live API health check | https://gutech-lms-api.vercel.app/api/health |
| Source code | https://github.com/SyedMohsinRaza1355/GUTECH-LMS- |

## Features

**Everyone**
- Sign-in with a username or institutional email (no public sign-up); forgot-password email and reset page; change password (checks the current one); edit your name.
- Role-aware dashboard where every tile links to the page behind the number.
- Announcements (global and per class), classroom chat per class, grievance desk (complaints), search and filters, success and error feedback on every action.
- Crimson and white theme taken from the GU TECH logo; responsive from phone to desktop; keyboard accessible dialogs.

**Students** - enrolled courses, assignments with timezone-aware due labels (overdue / due soon / done), submit and edit a submission before it is graded, timed quizzes (single choice, multi choice, true/false, auto-graded, resumable after a refresh), marks and GPA view, pending-work list.

**Teachers** - assigned classes, **grading queue** with "Grade now" jump links, create assignments, upload resources (PDF, Word, PowerPoint, images, ZIP up to 25 MB), grading desk with marks and feedback, gradebook with CSV export, real class roster, class announcements.

**Admins** - user directory with search, role filters and paging; guided **new user** form (username suggestion, automatic roll number, generated password, course enrolment); activate / deactivate; course create / edit / delete; bulk CSV enrolment and unenrol; complaint resolution; **audit history** of grades and account changes.

## Stack and structure

```text
Frontend/                  React 18 + Vite + TypeScript + Tailwind SPA
  public/                  GU TECH logo files and favicons
  src/components/          Shared UI (buttons, dialogs, toasts, logo) and layout
  src/context/             Authentication / session state
  src/features/            One folder per area: auth, dashboard, courses, grading, marks, ...
  src/lib/                 API client and helpers
Backend/                   Express + TypeScript REST API
  src/controllers/         Request handlers (Supabase when configured, demo data otherwise)
  src/middleware/          Authentication, role checks, validation, rate limiting, errors
  src/routes/              REST routes
  src/schemas/             Zod request validation
  src/tests/               Vitest + Supertest API tests
  scripts/                 Migration, seed and credential-export scripts
  supabase/                SQL schema, row-level-security policies
docs/                      Assumptions, AI-assisted workflow, demo walkthrough plan
```

### Data and persistence

With Supabase configured, **every module is stored in Supabase**: users and profiles, courses, enrolments, assignments, submissions and grades, quizzes and attempts, resources (Storage bucket), announcements, chat, complaints and the audit log. Access is enforced on the server for every protected route (role and course membership), not just by hiding buttons.

Without Supabase keys the API falls back to a built-in demo data set so the project can still be explored offline. That mode keeps data in memory and is for local exploration only.

## Environment setup (`.env` guide)

Never commit real `.env` files; they are git-ignored. Copy the templates and fill them in.

### Backend: `Backend/.env`

```bash
cd Backend
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

| Variable | What it is | Where to get it |
| --- | --- | --- |
| `SUPABASE_URL` | Your project URL, `https://<ref>.supabase.co` | Supabase dashboard -> Project Settings -> API |
| `SUPABASE_ANON_KEY` | Public (publishable) key, used for sign-in | Project Settings -> API Keys -> Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** server key that creates users and bypasses RLS | Project Settings -> API Keys -> Secret keys (`sb_secret_...`). Backend only, never in `VITE_` variables |
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection string, used only by `npm run db:migrate` | Project Settings -> Database -> Connection string |
| `CLIENT_ORIGIN` | Exact URL of the frontend allowed by CORS | `http://localhost:5173` locally; your Vercel URL in production |
| `PASSWORD_RESET_REDIRECT` | Page the reset-password email links to | `http://localhost:5173/reset-password` locally |
| `JWT_SECRET` | Long random string | Generate one, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | API port | `4000` |

In Supabase also add your frontend URL under Authentication -> URL Configuration so reset emails may redirect to it.

### Frontend: `Frontend/.env`

```bash
cd Frontend
copy .env.example .env
```

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | The API base URL: `http://localhost:4000/api` locally, `https://gutech-lms-api.vercel.app/api` in production |

## Run it locally

Requirements: Node.js 20+ and npm; a Supabase project for the live mode.

1. **Install and configure the backend**

   ```bash
   cd Backend
   npm ci
   copy .env.example .env      # then fill it in as described above
   ```

2. **Create the database and demo data** (modifies the Supabase project in `.env`, so double-check it)

   ```bash
   npm run db:migrate          # tables and row-level-security policies
   npm run db:seed-demo        # accounts, 5 courses, sample coursework, and the private `resources` storage bucket
   ```

3. **Start the API** (health check at http://localhost:4000/api/health)

   ```bash
   npm run dev
   ```

4. **Start the frontend** in a second terminal

   ```bash
   cd Frontend
   npm ci
   copy .env.example .env      # keep VITE_API_URL=http://localhost:4000/api
   npm run dev                 # open http://localhost:5173
   ```

If port 4000 is busy, an earlier API copy is still running; use it or stop it first.

### Verify

```bash
cd Backend && npm test && npm run build     # 24 API tests, type-check and compile
cd ../Frontend && npm run build
```

## Demo accounts

The sign-in page lists them: tap a row to fill the form. The full 55-account list is generated with `npm run export:credentials` (writes `Demo Login Credentials.csv`, which is git-ignored). Demo passwords are for demonstration only.

| Role | Username | Password |
| --- | --- | --- |
| Admin | `nadeem.admin` | `Admin@123` |
| Teacher | `imran.teacher` | `Teach@123` |
| Teacher | `sadia.teacher` | `Teach@456` |
| Teacher | `khurram.teacher` | `Teach@789` |
| Student | `ayesha.siddiqui` | `Student@101` |
| Student | `usman.ghani` | `Student@102` |

Students 101-150 use `Student@101` ... `Student@150` in the order of the roster.

## Live deployment (Vercel + Supabase)

Two Vercel projects deploy from `main` of this repository:

| Project | Vercel root directory | URL |
| --- | --- | --- |
| Frontend `gutech-lms` | `Frontend` | https://gutech-lms.vercel.app |
| API `gutech-lms-api` | `Backend` | https://gutech-lms-api.vercel.app |

Set the variables from the tables above in each project's Environment Variables (API: Supabase keys, `CLIENT_ORIGIN`, `PASSWORD_RESET_REDIRECT`, `JWT_SECRET`; frontend: `VITE_API_URL`). Rotate a key in Supabase, update it in Vercel, then redeploy.

## Submission checklist

| Requirement | Where |
| --- | --- |
| Public GitHub repository, clean organised code, README with overview, `.env` guide and run steps | This repository and README |
| Live deployment on Vercel, connected to a live Supabase instance with working auth and CRUD | https://gutech-lms.vercel.app |
| 3-5 minute walkthrough video (demo, key features, AI-assisted workflow) | Plan: [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md). Add the uploaded video link below. |
| Walkthrough video link | _add the YouTube / Loom / Drive link here after recording_ |

More detail: [assumptions and architecture](docs/ASSUMPTIONS.md), [AI-assisted workflow](docs/AI_ASSISTED_WORKFLOW.md), [video plan](docs/DEMO_WALKTHROUGH.md).

## Security notes

- Public sign-up is disabled; admins create accounts.
- Passwords live only in Supabase Auth (hashed); the app cannot show anyone's password. Changing a password verifies the current one first.
- The service-role key and `JWT_SECRET` stay server-side. Row-level security is enabled on the tables.
- Every protected action is authorised on the server by role and course membership; sensitive changes are written to an audit log.
- Never commit `.env` files or the local credentials spreadsheet.
