# GUTech LMS - Architecture & Build Assumptions

This document records architectural decisions, assumptions, and conventions adopted during the implementation of the internal GUTech Learning Management System (LMS) in accordance with the specification.

---

### 1. Project Organization
- **FR (Frontend)** is situated in `./Frontend/` using React 18 + Vite + TypeScript + Tailwind CSS.
- **BE (Backend)** is situated in `./Backend/` using Node 20 + Express + TypeScript + Supabase client.
- Database migrations, RLS policies, and seed scripts reside in `./Backend/supabase/`.

### 2. Authentication & Sign-Up Policy
- In compliance with Non-Negotiable Rule 6, **public registration is completely disabled**.
- Visiting `/signup` returns an explicit HTTP 404 response.
- User accounts are created exclusively by administrative staff via the Admin User Directory.
- For immediate offline/pre-credential testing, a built-in session state with seeded demo profiles for Student, Teacher, and Administrator is integrated. Once the live Supabase credentials are provided, live Supabase Auth and database operations are enabled.

### 3. Quiz Grading & Lateness
- Server auto-grades MCQ (single/multi) and True/False assessments against the isolated `quiz_answers` store.
- Correct answers are stored strictly in a protected table/store and are **never** delivered to client devices in quiz attempt responses.
- Lateness for assignment submissions is evaluated on the server using `now() > due_at` rather than client clocks. If `allow_late` is false, submissions post-deadline are rejected with a 409 Conflict status.
- Resubmission of an assignment clears any prior grade, returning the submission status to pending until re-evaluated.

### 4. Marks & Unified Gradebook View
- Assignment marks and quiz scores are unified via `v_student_marks`.
- Overall percentages count only items that have been evaluated. Ungraded or pending items are displayed with a "Pending" status and are excluded from the calculated weighted percentage.
- The teacher gradebook CSV export prepends the UTF-8 Byte Order Mark (`\uFEFF`) to guarantee proper UTF-8 display in Microsoft Excel.

### 5. File Storage & Uploads
- Max file size limits: 25 MB for course resources, 10 MB for complaint attachments.
- Files uploaded in course resources generate 60-second expiring signed URLs to safeguard proprietary academic assets.
