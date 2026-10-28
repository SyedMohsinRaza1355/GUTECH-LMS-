# Feature walkthrough video (3-5 minutes)

Aim for about 4 minutes 30 seconds. Record the **live** site (https://gutech-lms.vercel.app) with a screen recorder such as Loom, then upload to YouTube (unlisted), Loom or Google Drive and put the link in the README. Keep the Supabase dashboard, `.env` files and the credentials CSV off screen.

## Run of show

| Time | Show | What to say |
| --- | --- | --- |
| 0:00-0:25 | Login page | "This is the GU TECH learning portal for Ghazali University of Technology: React and TypeScript on the front end, a Node and Express API, and Supabase for authentication, database and file storage. There is no public sign-up; admins create accounts." |
| 0:25-1:15 | Sign in as `ayesha.siddiqui` (tap the row, press Sign in) | Student dashboard: every tile links to its page. Open **Pending work**, open a task, submit an answer and show the success message. Show the dated, colour-coded due labels. Take the timed quiz (point out the multi-select question), submit, and show the score. Open **Marks**. |
| 1:15-2:15 | Sign out, sign in as `imran.teacher` | Dashboard tile **To Grade** -> **Grading queue** -> **Grade now**: the grading desk opens for that assignment. Enter marks above the maximum to show validation, then save a valid grade and show the confirmation. Create an assignment, upload a PDF resource, post a class announcement. |
| 2:15-3:15 | Sign out, sign in as `nadeem.admin` | **User Directory**: search, filter, then **Add new user** (name -> suggested username, roll number, generated password, tick courses) -> create and show the credentials card. Deactivate the test account, then **Audit history** to show who changed what. Create a temporary course, edit it, delete it. |
| 3:15-3:50 | Persistence proof | Refresh the page and show the data is still there. Open the Supabase **Table editor** (profiles, assignments, submissions: no secrets visible) and the API health URL `/api/health`. Mention row-level security and that every route checks the role on the server. |
| 3:50-4:30 | AI-assisted workflow | See the narration below. Show a short example of a prompt and the resulting change or test run. |

## Recording checklist

- Use the seeded demo accounts from the login page, not personal credentials.
- Sign in to each account once before recording so nothing is slow on camera.
- Show at least one saved change and reload the page to prove it persists in the database.
- Show a phone-width view for about 5 seconds (browser dev tools) to demonstrate responsiveness.
- End with the GitHub URL and live URL on screen or in the video description.

## Narration for the AI workflow section

"I built this with AI pair programming, first ChatGPT/Codex and then Claude Code. I gave the tools the course requirements and the existing project, and worked in loops: describe a change, review the generated code, run the tests and the browser, and fix what broke. The AI helped with role-based flows, the Supabase integration, the grading queue and admin provisioning, the logo theme, and a full tester pass that found real bugs, for example quizzes that could not score multi-answer questions and password changes that never saved. I reviewed every change, kept secrets out of the repository, and checked the results against the live Supabase data before deploying."
