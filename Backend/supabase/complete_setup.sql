-- ==============================================================================
-- GUTech Internal LMS - Complete Database Setup Script
-- Copy and paste this entire script into your Supabase SQL Editor and click "Run"
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumeration Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE question_type AS ENUM ('mcq_single', 'mcq_multi', 'true_false');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('open', 'in_review', 'resolved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  roll_no TEXT UNIQUE,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Course Teachers (Many-to-Many: course <-> teachers)
CREATE TABLE IF NOT EXISTS public.course_teachers (
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, teacher_id)
);

-- 6. Enrollments (Many-to-Many: course <-> students)
CREATE TABLE IF NOT EXISTS public.enrollments (
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, student_id)
);

-- 7. Course Resources Table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  max_marks NUMERIC(6, 2) NOT NULL CHECK (max_marks > 0),
  due_at TIMESTAMPTZ NOT NULL,
  allow_late BOOLEAN NOT NULL DEFAULT false,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text_answer TEXT,
  file_path TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT false,
  marks_obtained NUMERIC(6, 2),
  feedback TEXT,
  graded_by UUID REFERENCES public.profiles(id),
  graded_at TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

-- 10. Quizzes Table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INT NOT NULL CHECK (time_limit_minutes > 0),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

-- 11. Quiz Questions Table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  type question_type NOT NULL,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  marks NUMERIC(5, 2) NOT NULL DEFAULT 1
);

-- 12. Quiz Answers Table (Protected from students)
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  question_id UUID PRIMARY KEY REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  correct_option_ids TEXT[] NOT NULL
);

-- 13. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  answers JSONB NOT NULL DEFAULT '{}',
  score NUMERIC(6, 2),
  UNIQUE (quiz_id, student_id)
);

-- 14. Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Announcement Reads Table
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- 16. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Classroom Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 18. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID REFERENCES public.courses(id),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_path TEXT,
  status complaint_status NOT NULL DEFAULT 'open',
  admin_response TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher ON public.course_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_resources_course ON public.resources(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id, due_at);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_announcements_course ON public.announcements(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_course ON public.chat_messages(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status, created_at DESC);

-- 20. Unified Student Marks View (v_student_marks)
CREATE OR REPLACE VIEW public.v_student_marks AS
SELECT
  s.student_id,
  a.course_id,
  'assignment' AS kind,
  a.id AS item_id,
  a.title,
  s.marks_obtained AS obtained,
  a.max_marks AS max,
  s.graded_at
FROM public.submissions s
JOIN public.assignments a ON a.id = s.assignment_id

UNION ALL

SELECT
  qa.student_id,
  q.course_id,
  'quiz' AS kind,
  q.id AS item_id,
  q.title,
  qa.score AS obtained,
  (
    SELECT COALESCE(SUM(qq.marks), 0)
    FROM public.quiz_questions qq
    WHERE qq.quiz_id = q.id
  ) AS max,
  qa.submitted_at AS graded_at
FROM public.quiz_attempts qa
JOIN public.quizzes q ON q.id = qa.quiz_id;

-- 21. Row-Level Security Helper Functions
CREATE OR REPLACE FUNCTION public.is_enrolled(c_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = c_id
      AND student_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.teaches(c_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_teachers
    WHERE course_id = c_id
      AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- 22. Enable Row-Level Security (RLS) on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- 23. RLS Security Policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Courses viewable by members" ON public.courses;
CREATE POLICY "Courses viewable by members"
ON public.courses FOR SELECT TO authenticated USING (is_admin() OR teaches(id) OR (is_enrolled(id) AND NOT is_archived));

DROP POLICY IF EXISTS "Admins have full CRUD on courses" ON public.courses;
CREATE POLICY "Admins have full CRUD on courses"
ON public.courses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Resources viewable by course members" ON public.resources;
CREATE POLICY "Resources viewable by course members"
ON public.resources FOR SELECT TO authenticated USING (is_admin() OR teaches(course_id) OR is_enrolled(course_id));

DROP POLICY IF EXISTS "Teachers can upload resources" ON public.resources;
CREATE POLICY "Teachers can upload resources"
ON public.resources FOR INSERT TO authenticated WITH CHECK (is_admin() OR teaches(course_id));

DROP POLICY IF EXISTS "Assignments viewable by course members" ON public.assignments;
CREATE POLICY "Assignments viewable by course members"
ON public.assignments FOR SELECT TO authenticated USING (is_admin() OR teaches(course_id) OR is_enrolled(course_id));

DROP POLICY IF EXISTS "Teachers create and manage assignments" ON public.assignments;
CREATE POLICY "Teachers create and manage assignments"
ON public.assignments FOR ALL TO authenticated USING (is_admin() OR teaches(course_id)) WITH CHECK (is_admin() OR teaches(course_id));

DROP POLICY IF EXISTS "Students view own submissions; teachers view course submissions" ON public.submissions;
CREATE POLICY "Students view own submissions; teachers view course submissions"
ON public.submissions FOR SELECT TO authenticated USING (
  is_admin() OR student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = submissions.assignment_id AND teaches(a.course_id))
);

DROP POLICY IF EXISTS "Students submit work" ON public.submissions;
CREATE POLICY "Students submit work"
ON public.submissions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Quizzes viewable by course members" ON public.quizzes;
CREATE POLICY "Quizzes viewable by course members"
ON public.quizzes FOR SELECT TO authenticated USING (is_admin() OR teaches(course_id) OR (is_enrolled(course_id) AND is_published));

DROP POLICY IF EXISTS "Only teachers and admins can view quiz answers" ON public.quiz_answers;
CREATE POLICY "Only teachers and admins can view quiz answers"
ON public.quiz_answers FOR ALL TO authenticated USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = quiz_answers.question_id AND teaches(q.course_id)
  )
);

DROP POLICY IF EXISTS "Announcements viewable by target audience" ON public.announcements;
CREATE POLICY "Announcements viewable by target audience"
ON public.announcements FOR SELECT TO authenticated USING (
  is_admin() OR course_id IS NULL OR teaches(course_id) OR is_enrolled(course_id)
);

DROP POLICY IF EXISTS "Chat messages viewable by course members" ON public.chat_messages;
CREATE POLICY "Chat messages viewable by course members"
ON public.chat_messages FOR SELECT TO authenticated USING (is_admin() OR teaches(course_id) OR is_enrolled(course_id));

DROP POLICY IF EXISTS "Complaints viewable by complainant or admin" ON public.complaints;
CREATE POLICY "Complaints viewable by complainant or admin"
ON public.complaints FOR SELECT TO authenticated USING (is_admin() OR raised_by = auth.uid());
