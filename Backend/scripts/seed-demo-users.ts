import { supabaseAdmin } from '../src/config/index.js';
import { mockDb } from '../src/repositories/mockDb.js';

const profilesByMockId = new Map<string, string>();
const profilesByEmail = new Map<string, string>();
const coursesByCode = new Map<string, string>();

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
  for (const course of mockDb.courses) {
    const { data, error } = await supabaseAdmin.from('courses').upsert({
      code: course.code,
      title: course.title,
      description: course.description,
      is_archived: course.isArchived
    }, { onConflict: 'code' }).select('id, code').single();
    if (error) throw error;
    coursesByCode.set(data.code, data.id);
  }

  const teacherRows = mockDb.courseTeachers.map(({ courseId, teacherId }) => ({
    course_id: coursesByCode.get(mockDb.courses.find(course => course.id === courseId)?.code || '')!,
    teacher_id: profilesByMockId.get(teacherId)!
  }));
  const { error: teacherError } = await supabaseAdmin.from('course_teachers').upsert(teacherRows, { onConflict: 'course_id,teacher_id' });
  if (teacherError) throw teacherError;

  const enrollmentRows = mockDb.enrollments.map(({ courseId, studentId }) => ({
    course_id: coursesByCode.get(mockDb.courses.find(course => course.id === courseId)?.code || '')!,
    student_id: profilesByMockId.get(studentId)!
  }));
  const { error: enrollmentError } = await supabaseAdmin.from('enrollments').upsert(enrollmentRows, { onConflict: 'course_id,student_id' });
  if (enrollmentError) throw enrollmentError;
}

async function main() {
  await ensureDemoUsers();
  await ensureDemoCourses();
  console.log(`Seeded ${profilesByEmail.size} Supabase Auth users and profiles, ${coursesByCode.size} courses, course instructors, and enrollments.`);
  console.log('Passwords remain in Supabase Auth only; no plaintext password column is created.');
}

main().catch(error => {
  console.error('Demo seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
