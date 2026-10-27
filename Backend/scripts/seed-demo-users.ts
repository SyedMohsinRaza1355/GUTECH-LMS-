import { supabaseAdmin } from '../src/config/index.js';
import { mockDb } from '../src/repositories/mockDb.js';

const profilesByMockId = new Map<string, string>();
const profilesByEmail = new Map<string, string>();
const coursesByCode = new Map<string, string>();
const courseIndex = new Map<string, number>();

async function ensureDemoUsers() {
  const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existingUsers = new Map(authUsers.users.map(user => [user.email?.toLowerCase() || '', user]));

  for (const profile of mockDb.profiles) {
    const credentials = mockDb.credentials.find(item => item.email.toLowerCase() === profile.email.toLowerCase());
    if (!credentials) throw new Error(`Missing demo password for ${profile.email}`);

    let authUser = existingUsers.get(profile.email.toLowerCase());
    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: profile.email,
        password: credentials.password,
        email_confirm: true,
        user_metadata: { full_name: profile.fullName, role: profile.role }
      });
      if (error) throw error;
      authUser = data.user;
      existingUsers.set(profile.email.toLowerCase(), authUser);
    }

    const row = {
      id: authUser.id,
      full_name: profile.fullName,
      email: profile.email,
      role: profile.role,
      roll_no: profile.rollNo || null,
      avatar_url: profile.avatarUrl || null,
      is_active: profile.isActive,
      must_change_password: false
    };
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(row, { onConflict: 'id' });
    if (profileError) throw profileError;

    profilesByMockId.set(profile.id, authUser.id);
    profilesByEmail.set(profile.email.toLowerCase(), authUser.id);
  }
}

async function ensureDemoCourses() {
  for (const [index, course] of mockDb.courses.entries()) {
    const { data, error } = await supabaseAdmin.from('courses').upsert({
      code: course.code,
      title: course.title,
      description: course.description,
      is_archived: course.isArchived
    }, { onConflict: 'code' }).select('id, code').single();
    if (error) throw error;
    coursesByCode.set(data.code, data.id);
    courseIndex.set(data.code, index + 1);
  }

  const teacherRows = mockDb.courseTeachers.map(({ courseId, teacherId }) => ({
    course_id: coursesByCode.get(mockDb.courses.find(course => course.id === courseId)?.code || '')!,
    teacher_id: profilesByMockId.get(teacherId)!
  }));
  const { error: teacherError } = await supabaseAdmin.from('course_teachers').upsert(teacherRows, { onConflict: 'course_id,teacher_id' });
  if (teacherError) throw teacherError;

  const students = mockDb.profiles.filter(profile => profile.role === 'student');
  const enrollmentRows = students.flatMap(student => mockDb.courses.map(course => ({
    course_id: coursesByCode.get(course.code)!,
    student_id: profilesByMockId.get(student.id)!
  })));
  const { error: enrollmentError } = await supabaseAdmin.from('enrollments').upsert(enrollmentRows, { onConflict: 'course_id,student_id' });
  if (enrollmentError) throw enrollmentError;
}

const stableId = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeDemoPdf(title: string, body: string) {
  const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, ' ').replace(/[\\()]/g, '\\$&');
  const stream = `BT /F1 18 Tf 54 740 Td (${safe(title)}) Tj /F1 11 Tf 0 -32 Td (${safe(body)}) Tj 0 -24 Td (GUTech LMS Fall 2026 demo resource) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

async function ensureSemesterActivity() {
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket('resources');
  if (bucketError || !bucket) {
    const { error } = await supabaseAdmin.storage.createBucket('resources', { public: false, fileSizeLimit: '5MB', allowedMimeTypes: ['application/pdf'] });
    if (error && !String(error.message).toLowerCase().includes('already exists')) throw error;
  }
  const students = mockDb.profiles.filter(profile => profile.role === 'student');
  for (const course of mockDb.courses) {
    const index = courseIndex.get(course.code)!;
    const courseId = coursesByCode.get(course.code)!;
    const teacherMockId = mockDb.courseTeachers.find(link => link.courseId === course.id)?.teacherId;
    const teacherId = profilesByMockId.get(teacherMockId || '');
    if (!teacherId) throw new Error(`No instructor assigned for ${course.code}`);

    const base = index * 1000;
    const assignmentTitles = [
      `Week 3: ${course.code} Foundations`,
      `Week 6: ${course.code} Applied Practice`,
      `Week 8: ${course.code} Progress Check`,
      `Week 10: ${course.code} Project Milestone`,
      `Week 12: ${course.code} Final Review`
    ];
    const assignments = assignmentTitles.map((title, i) => ({
      id: stableId(base + i + 1), course_id: courseId, created_by: teacherId, title,
      instructions: `Complete the ${course.title} coursework, show your working, and submit your response through the portal.`,
      max_marks: [20, 25, 15, 30, 20][i],
      due_at: ['2026-09-22T18:00:00Z', '2026-10-06T18:00:00Z', '2026-10-20T18:00:00Z', '2026-11-05T18:00:00Z', '2026-11-19T18:00:00Z'][i],
      allow_late: i === 3, attachment_path: null, created_at: ['2026-09-08T08:00:00Z', '2026-09-22T08:00:00Z', '2026-10-06T08:00:00Z', '2026-10-20T08:00:00Z', '2026-11-03T08:00:00Z'][i], updated_at: '2026-10-20T08:00:00Z'
    }));
    const { error: assignmentError } = await supabaseAdmin.from('assignments').upsert(assignments, { onConflict: 'id' });
    if (assignmentError) throw assignmentError;

    const submissions = students.flatMap((student, studentIndex) => {
      const studentId = profilesByMockId.get(student.id)!;
      return [0, 1, 2].map((assignmentIndex) => {
        const score = Math.max(5, Math.round(assignments[assignmentIndex].max_marks * (0.72 + ((studentIndex + assignmentIndex) % 7) * 0.04)));
        const submittedAt = ['2026-09-20T14:00:00Z', '2026-10-04T14:00:00Z', '2026-10-18T14:00:00Z'][assignmentIndex];
        const gradedAt = assignmentIndex < 2 ? new Date(Date.parse(submittedAt) + 86400000).toISOString() : null;
        const globalIndex = base + 100 + assignmentIndex * students.length + studentIndex + 1;
        return {
          id: stableId(globalIndex), assignment_id: assignments[assignmentIndex].id, student_id: studentId,
          text_answer: `Demo semester submission for ${student.fullName}. Work submitted through the student portal.`,
          file_path: null, submitted_at: submittedAt, is_late: false,
          marks_obtained: gradedAt ? score : null,
          feedback: gradedAt ? (score / assignments[assignmentIndex].max_marks >= 0.85 ? 'Strong work. Clear reasoning and a complete submission.' : 'Good progress. Review the instructor notes and keep practicing.') : null,
          graded_by: gradedAt ? teacherId : null, graded_at: gradedAt
        };
      });
    });
    const { error: submissionError } = await supabaseAdmin.from('submissions').upsert(submissions, { onConflict: 'assignment_id,student_id' });
    if (submissionError) throw submissionError;

    const quizRows = [
      { id: stableId(base + 200), course_id: courseId, created_by: teacherId, title: `${course.code} Quiz 1: Core Concepts`, description: 'Completed mid-semester quiz. Results are available in your grade summary.', time_limit_minutes: 20, opens_at: '2026-10-12T08:00:00Z', closes_at: '2026-10-19T18:00:00Z', is_published: true, created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z' },
      { id: stableId(base + 201), course_id: courseId, created_by: teacherId, title: `${course.code} Quiz 2: Semester Review`, description: 'Upcoming quiz covering recent lectures and lab work.', time_limit_minutes: 25, opens_at: '2026-11-09T08:00:00Z', closes_at: '2026-11-16T18:00:00Z', is_published: true, created_at: '2026-10-21T08:00:00Z', updated_at: '2026-10-21T08:00:00Z' }
    ];
    const { error: quizError } = await supabaseAdmin.from('quizzes').upsert(quizRows, { onConflict: 'id' });
    if (quizError) throw quizError;

    const questionRows = quizRows.flatMap((quiz, qIndex) => [
      { id: stableId(base + 210 + qIndex * 3), quiz_id: quiz.id, position: 1, type: 'mcq_single', prompt: `Which option best describes a core ${course.code} principle?`, options: [{ id: 'a', text: 'A structured, evidence-based approach' }, { id: 'b', text: 'Skipping analysis and testing' }, { id: 'c', text: 'Ignoring requirements' }, { id: 'd', text: 'Duplicating work' }], marks: 5 },
      { id: stableId(base + 211 + qIndex * 3), quiz_id: quiz.id, position: 2, type: 'true_false', prompt: `Good ${course.title} practice includes checking the result against requirements.`, options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }], marks: 5 },
      { id: stableId(base + 212 + qIndex * 3), quiz_id: quiz.id, position: 3, type: 'mcq_single', prompt: 'Which is the best next step when a result does not meet the expected outcome?', options: [{ id: 'a', text: 'Review the method and correct the issue' }, { id: 'b', text: 'Hide the result' }, { id: 'c', text: 'Stop recording progress' }, { id: 'd', text: 'Remove the requirements' }], marks: 5 }
    ]);
    const { error: questionError } = await supabaseAdmin.from('quiz_questions').upsert(questionRows, { onConflict: 'id' });
    if (questionError) throw questionError;
    const answerRows = questionRows.filter(question => question.position < 4).map(question => ({ question_id: question.id, correct_option_ids: [question.position === 2 ? 'true' : 'a'] }));
    const { error: answerError } = await supabaseAdmin.from('quiz_answers').upsert(answerRows, { onConflict: 'question_id' });
    if (answerError) throw answerError;

    const attemptedQuestions = questionRows.filter(question => question.quiz_id === quizRows[0].id);
    const attemptRows = students.map((student, studentIndex) => {
      const studentId = profilesByMockId.get(student.id)!;
      const correctCount = 1 + ((studentIndex + index) % 3);
      const answers: Record<string, string[]> = {};
      attemptedQuestions.forEach((question, questionIndex) => { answers[question.id] = [questionIndex < correctCount ? (question.position === 2 ? 'true' : 'a') : 'b']; });
      return { id: stableId(base + 300 + studentIndex), quiz_id: quizRows[0].id, student_id: studentId, started_at: '2026-10-16T09:00:00Z', submitted_at: '2026-10-16T09:18:00Z', answers, score: correctCount * 5 };
    });
    const { error: attemptError } = await supabaseAdmin.from('quiz_attempts').upsert(attemptRows, { onConflict: 'quiz_id,student_id' });
    if (attemptError) throw attemptError;

    const resourceSpecs = [
      ['Week 1 Lecture Notes', 'Course introduction and essential vocabulary.', 'week-01-notes.pdf', '2026-09-08T08:00:00Z'],
      ['Week 4 Lecture Slides', 'Lecture slides and worked examples for the first unit.', 'week-04-slides.pdf', '2026-09-29T08:00:00Z'],
      ['Lab Practice Pack', 'Guided practical exercises with review questions.', 'lab-practice.pdf', '2026-10-13T08:00:00Z'],
      ['Mid-Semester Revision Guide', 'Revision checklist and sample questions for the upcoming assessment.', 'revision-guide.pdf', '2026-10-22T08:00:00Z']
    ];
    const resourceRows = resourceSpecs.map(([title, description, fileName, createdAt], i) => ({
      id: stableId(base + 400 + i), course_id: courseId, uploaded_by: teacherId,
      title: `${course.code}: ${title}`, description,
      file_path: `demo/${course.code.toLowerCase()}/${fileName}`, file_name: fileName,
      mime_type: 'application/pdf', size_bytes: 384000 + i * 120000, created_at: createdAt
    }));
    for (const [title, description, fileName] of resourceSpecs) {
      const path = `demo/${course.code.toLowerCase()}/${fileName}`;
      const { error } = await supabaseAdmin.storage.from('resources').upload(path, makeDemoPdf(`${course.code}: ${title}`, description), { contentType: 'application/pdf', upsert: true });
      if (error) throw error;
    }
    const { error: resourceError } = await supabaseAdmin.from('resources').upsert(resourceRows, { onConflict: 'id' });
    if (resourceError) throw resourceError;
  }
}

async function main() {
  await ensureDemoUsers();
  await ensureDemoCourses();
  await ensureSemesterActivity();
  console.log(`Seeded ${profilesByEmail.size} Supabase Auth users and profiles, ${coursesByCode.size} courses, five enrollments per student, and semester assignments, submissions, quizzes, results, and resources.`);
  console.log('Passwords remain in Supabase Auth only; no plaintext password column is created.');
}

main().catch(error => {
  console.error('Demo seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
