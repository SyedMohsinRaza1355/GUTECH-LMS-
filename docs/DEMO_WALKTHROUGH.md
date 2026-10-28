# Feature walkthrough video (3–5 minutes)

Aim for about 4 minutes. Use the deployed URLs only after verifying that authentication and database-backed pages use the production Supabase project. Keep the Supabase dashboard free of visible secrets; never show `.env`, service-role keys, or the local credential CSV in the recording.

## Suggested run of show

| Time | Show | What to say |
| --- | --- | --- |
| 0:00–0:20 | Portal login page | “This is a role-based student and faculty portal built with React, a Node/Express API, and Supabase.” Mention this is the prototype and name its three roles. |
| 0:20–1:00 | Sign in as `ayesha.siddiqui` | Show the student dashboard and available student navigation. Open a course or marks view. Explain that route and API authorization are role-aware. |
| 1:00–1:40 | Sign out; sign in as `imran.teacher` | Show the teacher portal and assigned class view. Point out the different role navigation and teaching actions. Be clear if any assignment/quiz content shown is demo-only. |
| 1:40–2:45 | Sign out; sign in as `nadeem.admin` | Show the live user directory and role filters. Demonstrate course management and enrollments. If convenient, create a uniquely named temporary course, edit it, then delete it. Do not delete real records. |
| 2:45–3:20 | API/database verification | Show `https://<render-service>/api/health`, then the Supabase table editor with profiles and courses (no credentials or password fields). Explain that Supabase Auth manages passwords and the app never stores plaintext passwords in a table. |
| 3:20–4:00 | AI-assisted workflow and status | Summarize how AI helped turn requirements into role flows, implement screens/API wiring, and review test/build results. State which modules are live and which remain prototype-only. |

## Recording checklist

- Use seeded demo accounts, not personal credentials. The local ignored file `Demo Login Credentials.csv` has usernames/passwords.
- Start with a clean browser tab and verify every sign-in before recording.
- Show at least one persisted action and reload the page to prove it remains in the database.
- Keep tokens, `.env`, database connection strings, and service-role keys off-screen.
- End with the repository URL and deployed URL visible as text or add them to the video description.
- Upload to YouTube as unlisted, Loom, or an accessible Drive link; then add the URL to the README.

## Short narration for the AI workflow section

“I used ChatGPT/Codex as an AI pair programmer. I provided the course requirements, asked it to inspect the existing React and Express project, and iterated on role-based login, Supabase integration, access controls, and the UI. I reviewed the generated changes, ran backend tests and production builds, and manually checked real login, role restrictions, and course CRUD. The AI accelerated implementation and review; I verified the results and documented the remaining demo-only modules.”
