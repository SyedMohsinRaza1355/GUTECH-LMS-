-- ==============================================================================
-- GUTech Internal LMS - Database Migration
-- 0001_initial_schema.sql
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enums
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

-- 3. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  roll_no TEXT UNIQUE, -- for students only
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- e.g. CS101, SE302
  title TEXT NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Course Teachers (Many-to-Many: course <-> teachers)
CREATE TABLE IF NOT EXISTS course_teachers (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, teacher_id)
);

-- 6. Enrollments (Many-to-Many: course <-> students)
CREATE TABLE IF NOT EXISTS enrollments (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, student_id)
);

-- 7. Course Resources
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL, -- relative path inside 'resources' bucket
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  max_marks NUMERIC(6, 2) NOT NULL CHECK (max_marks > 0),
  due_at TIMESTAMPTZ NOT NULL,
  allow_late BOOLEAN NOT NULL DEFAULT false,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Assignment Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text_answer TEXT,
  file_path TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT false,
  marks_obtained NUMERIC(6, 2),
  feedback TEXT,
  graded_by UUID REFERENCES profiles(id),
  graded_at TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

-- 10. Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
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

-- 11. Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  type question_type NOT NULL,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL, -- e.g. [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}]
  marks NUMERIC(5, 2) NOT NULL DEFAULT 1
);

-- 12. Quiz Answers (Kept in isolated table to prevent client-side answer sniffing)
CREATE TABLE IF NOT EXISTS quiz_answers (
  question_id UUID PRIMARY KEY REFERENCES quiz_questions(id) ON DELETE CASCADE,
  correct_option_ids TEXT[] NOT NULL
);

-- 13. Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  answers JSONB NOT NULL DEFAULT '{}', -- e.g. {"question_uuid": ["a"]}
  score NUMERIC(6, 2),
  UNIQUE (quiz_id, student_id)
);

-- 14. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE, -- NULL means Global announcement
  author_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Announcement Reads
CREATE TABLE IF NOT EXISTS announcement_reads (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- 16. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Classroom Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 18. Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by UUID NOT NULL REFERENCES profiles(id),
  course_id UUID REFERENCES courses(id),
  category TEXT NOT NULL, -- academic, technical, facility, conduct, other
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_path TEXT,
  status complaint_status NOT NULL DEFAULT 'open',
  admin_response TEXT,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher ON course_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_resources_course ON resources(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id, due_at);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_course ON chat_messages(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status, created_at DESC);

-- 20. Unified Marks View: v_student_marks
CREATE OR REPLACE VIEW v_student_marks AS
SELECT
  s.student_id,
  a.course_id,
  'assignment' AS kind,
  a.id AS item_id,
  a.title,
  s.marks_obtained AS obtained,
  a.max_marks AS max,
  s.graded_at
FROM submissions s
JOIN assignments a ON a.id = s.assignment_id

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
    FROM quiz_questions qq
    WHERE qq.quiz_id = q.id
  ) AS max,
  qa.submitted_at AS graded_at
FROM quiz_attempts qa
JOIN quizzes q ON q.id = qa.quiz_id;
