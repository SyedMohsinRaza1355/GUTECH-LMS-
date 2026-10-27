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
- Verified backend tests (8 passing at the last recorded run), TypeScript/production builds, live login, seeded user visibility, course create/update/list/delete, invalid-password rejection, and a student `403` response for an admin endpoint.
- The current live-persistence boundary is documented in the root README. Assignment, quiz, marks, chat, and announcement flows still contain in-memory demo behavior and need Supabase integration before they can be presented as production-ready CRUD.

## Suggested evidence to include with the class submission

- A short screen recording showing the prompt-to-implementation loop, code review, and a verification result. Do not expose secrets or paste private credentials into a public recording.
- The public repository URL, Vercel URL, Render API health URL, and walkthrough video URL after each is actually published.
