# AI-assisted development workflow

This prototype was built iteratively with ChatGPT/Codex as an AI pair-programming tool. AI assistance supported implementation and review; it did not replace testing or the developer's responsibility for checking security, correctness, and deployment configuration.

## How AI was used

1. **Requirement breakdown:** Turned the LMS brief into user roles, protected pages, API endpoints, database entities, and evaluation evidence.
2. **Repository inspection:** Reviewed the existing React/Vite frontend and Express/TypeScript backend before extending the architecture.
3. **Implementation:** Used coding assistance to build login and role-specific navigation, connect authentication and selected CRUD operations to Supabase, add validation and access checks, and refine responsive UI states.
4. **Database/security work:** Iterated on PostgreSQL schema and RLS policies, and kept password verification in Supabase Auth rather than a plaintext password table.
5. **Review and verification:** Used build output, backend tests, API smoke checks, and browser inspection to find issues such as localhost CORS configuration and stale hardcoded dashboard counts, then corrected or recorded limitations.
6. **Documentation and delivery prep:** Prepared local setup, deployment configuration, this workflow record, and a timed demo plan.

## Example prompts from the workflow

- “Inspect the existing LMS code and tell me which flows are mocked and which use Supabase.”
- “Add login for admin, teacher, and student accounts with protected role-specific routes.”
- “Connect course and user operations to Supabase and enforce access with server-side authorization and RLS.”
- “Review the user flow as a student, teacher, and administrator; identify misleading fallback data and usability problems.”
- “Run the project checks, fix issues revealed by the results, and document what still needs a real deployment.”

## Human review and evidence

- Reviewed generated code and migration effects before applying them to the configured demo project.
- Kept privileged Supabase credentials in backend-only local/deployment environment variables.
- Verified backend tests (24 passing at the last recorded run), TypeScript/production builds, live login, seeded user visibility, course create/update/list/delete, invalid-password rejection, and a student `403` response for an admin endpoint.
- All modules, including announcements and chat, persist in Supabase when the API is configured; without Supabase keys the API serves a built-in demo data set (see the README).

## Second phase: Claude Code (Oct 2026)

The project was extended in a second session with Claude Code, again as a pair programmer with every change reviewed and verified:

- **Roster and branding:** Pakistani names and usernames for 2 admins, 3 teachers and 50 students from one roster file that feeds the API, the Supabase seed script and the credentials export; "Ghazali University of Technology" naming; GU TECH logo and crimson/white theme.
- **Teacher workflow:** grading queue page and API with deep links into the grading desk; dashboard tiles that lead to the work; mark validation and per-action feedback.
- **Admin workflow:** guided new-user form with automatic roll number and course enrolment; audit history for grades and account changes.
- **Tester pass:** drove the app as student, teacher and admin in the browser and through the API. It found, and the work then fixed, dead "Create Assignment" and "Upload Resource" buttons, a hard-coded fake student roster, a change-password endpoint that always reported success, multi-select quiz questions that could never score, silent failures, and announcements and chat that were not stored in Supabase.
- **Verification:** 24 automated API tests, TypeScript and production builds, live API checks against Supabase (login, data, role guards, create/read/update/delete for each module), and browser checks at desktop and phone width.
- **Human decisions:** which features to build, security-sensitive actions (key rotation, deleting accounts, deploys) were approved by the developer, and secrets were never committed.

## Suggested evidence to include with the class submission

- A short screen recording showing the prompt-to-implementation loop, code review, and a verification result. Do not expose secrets or paste private credentials into a public recording.
- The public repository URL, Vercel URL, Vercel API health URL, and walkthrough video URL after each is actually published.
