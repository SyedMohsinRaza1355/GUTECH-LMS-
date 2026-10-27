-- ==============================================================================
-- GUTech Internal LMS - Row Level Security (RLS) & Helper Functions
-- 0002_rls_policies.sql
-- ==============================================================================

-- 1. Helper Functions (SECURITY DEFINER to avoid infinite loops)
BEGIN;
CREATE OR REPLACE FUNCTION public.is_enrolled(c_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments
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
    SELECT 1 FROM course_teachers
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
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- 2. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Reapply this policy set atomically on installations with a partial LMS policy set.
DO $$
DECLARE existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'courses', 'course_teachers', 'enrollments', 'resources',
        'assignments', 'submissions', 'quizzes', 'quiz_questions', 'quiz_answers',
        'quiz_attempts', 'announcements', 'announcement_reads', 'audit_log',
        'chat_messages', 'complaints'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  END LOOP;
END $$;

-- 3. Profiles Policies
CREATE POLICY "Profiles are viewable by authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Courses Policies
CREATE POLICY "Courses viewable by enrolled students, assigned teachers, and admins"
ON courses FOR SELECT
TO authenticated
USING (
  is_admin() OR
  teaches(id) OR
  (is_enrolled(id) AND NOT is_archived)
);

CREATE POLICY "Admins have full CRUD on courses"
ON courses FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 5. Course Teachers Policies
CREATE POLICY "Course teachers viewable by members and admin"
ON course_teachers FOR SELECT
TO authenticated
USING (is_admin() OR teaches(course_id) OR is_enrolled(course_id));

CREATE POLICY "Admins manage course teachers"
ON course_teachers FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 6. Enrollments Policies
CREATE POLICY "Enrollments viewable by student, teachers, and admins"
ON enrollments FOR SELECT
TO authenticated
USING (
  is_admin() OR
  teaches(course_id) OR
  student_id = auth.uid()
);

CREATE POLICY "Admins manage enrollments"
ON enrollments FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 7. Resources Policies
CREATE POLICY "Resources viewable by course members"
ON resources FOR SELECT
TO authenticated
USING (is_admin() OR teaches(course_id) OR is_enrolled(course_id));

CREATE POLICY "Teachers can upload resources to their courses"
ON resources FOR INSERT
TO authenticated
WITH CHECK (is_admin() OR teaches(course_id));

CREATE POLICY "Teachers can delete their course resources"
ON resources FOR DELETE
TO authenticated
USING (is_admin() OR teaches(course_id));

-- 8. Assignments Policies
CREATE POLICY "Assignments viewable by course members"
ON assignments FOR SELECT
TO authenticated
USING (is_admin() OR teaches(course_id) OR is_enrolled(course_id));

CREATE POLICY "Teachers create and manage assignments"
ON assignments FOR ALL
TO authenticated
USING (is_admin() OR teaches(course_id))
WITH CHECK (is_admin() OR teaches(course_id));

-- 9. Submissions Policies
CREATE POLICY "Students can view their own submissions; teachers can view course submissions"
ON submissions FOR SELECT
TO authenticated
USING (
  is_admin() OR
  student_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = submissions.assignment_id AND teaches(a.course_id)
  )
);

CREATE POLICY "Students can submit or update their own submission"
ON submissions FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own submission before grading"
ON submissions FOR UPDATE
TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = submissions.assignment_id AND (teaches(a.course_id) OR is_admin())
  )
);

-- 10. Quizzes & Questions Policies
CREATE POLICY "Quizzes viewable by course members"
ON quizzes FOR SELECT
TO authenticated
USING (
  is_admin() OR
  teaches(course_id) OR
  (is_enrolled(course_id) AND is_published)
);

CREATE POLICY "Teachers manage quizzes"
ON quizzes FOR ALL
TO authenticated
USING (is_admin() OR teaches(course_id))
WITH CHECK (is_admin() OR teaches(course_id));

CREATE POLICY "Quiz questions viewable by course members"
ON quiz_questions FOR SELECT
TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = quiz_questions.quiz_id AND (teaches(q.course_id) OR is_enrolled(q.course_id))
  )
);

CREATE POLICY "Teachers manage quiz questions"
ON quiz_questions FOR ALL
TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = quiz_questions.quiz_id AND teaches(q.course_id)
  )
);

-- Quiz Answers: TEACHERS AND ADMINS ONLY! Students cannot read quiz_answers.
CREATE POLICY "Only teachers and admins can view quiz answers"
ON quiz_answers FOR ALL
TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM quiz_questions qq
    JOIN quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = quiz_answers.question_id AND teaches(q.course_id)
  )
);

-- 11. Quiz Attempts Policies
CREATE POLICY "Students view own attempts; teachers view course attempts"
ON quiz_attempts FOR SELECT
TO authenticated
USING (
  is_admin() OR
  student_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.id = quiz_attempts.quiz_id AND teaches(q.course_id)
  )
);

CREATE POLICY "Students can insert own quiz attempt"
ON quiz_attempts FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own attempt answers"
ON quiz_attempts FOR UPDATE
TO authenticated
USING (student_id = auth.uid());

-- 12. Announcements Policies
CREATE POLICY "Announcements viewable by target audience"
ON announcements FOR SELECT
TO authenticated
USING (
  is_admin() OR
  course_id IS NULL OR
  teaches(course_id) OR
  is_enrolled(course_id)
);

CREATE POLICY "Teachers and admins can post announcements"
ON announcements FOR INSERT
TO authenticated
WITH CHECK (
  is_admin() OR
  (course_id IS NOT NULL AND teaches(course_id))
);

CREATE POLICY "Authors or admins can edit/delete announcements"
ON announcements FOR ALL
TO authenticated
USING (is_admin() OR author_id = auth.uid());

-- Announcement Reads
CREATE POLICY "Users manage their own read flags"
ON announcement_reads FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 13. Chat Messages Policies
CREATE POLICY "Chat messages viewable by course members"
ON chat_messages FOR SELECT
TO authenticated
USING (
  is_admin() OR
  teaches(course_id) OR
  is_enrolled(course_id)
);

CREATE POLICY "Course members can send chat messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  (is_admin() OR teaches(course_id) OR is_enrolled(course_id))
);

CREATE POLICY "Senders or course teachers can soft-delete messages"
ON chat_messages FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid() OR
  teaches(course_id) OR
  is_admin()
);

-- 14. Complaints Policies
CREATE POLICY "Complaints viewable by complainant or admin"
ON complaints FOR SELECT
TO authenticated
USING (
  is_admin() OR
  raised_by = auth.uid()
);

CREATE POLICY "Users can create complaints"
ON complaints FOR INSERT
TO authenticated
WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Admins can update complaints"
ON complaints FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 15. Audit Log
CREATE POLICY "Admins view audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (is_admin());

-- Backend writes use the service role; authenticated clients cannot forge audit entries.

-- Prevent self-escalation or grade and quiz-score edits through direct client access.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;
REVOKE UPDATE ON public.submissions FROM authenticated;
GRANT UPDATE (text_answer, file_path) ON public.submissions TO authenticated;
REVOKE UPDATE ON public.quiz_attempts FROM authenticated;
GRANT UPDATE (answers, submitted_at) ON public.quiz_attempts TO authenticated;
REVOKE UPDATE ON public.chat_messages FROM authenticated;
GRANT UPDATE (deleted_at) ON public.chat_messages TO authenticated;

COMMIT;
