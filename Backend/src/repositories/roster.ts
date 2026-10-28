// ==============================================================================
// Ghazali University of Technology (GUTech) - Demo Roster (single source of truth)
// 2 admins, 3 teachers and 50 students with Pakistani names.
// Used by the in-memory store, the Supabase seed script and the credentials export.
// Passwords are demo-only. Never reuse them for real accounts.
// ==============================================================================

export const EMAIL_DOMAIN = 'gutech.edu.pk';
export const UNIVERSITY_NAME = 'Ghazali University of Technology';

export interface RosterEntry {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  rollNo: string | null;
  password: string;
}

const entry = (
  id: string,
  fullName: string,
  username: string,
  role: RosterEntry['role'],
  password: string,
  rollNo: string | null = null
): RosterEntry => ({ id, fullName, username, email: `${username}@${EMAIL_DOMAIN}`, role, rollNo, password });

const uuid = (prefix: string, n: number) => `${prefix}0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const admins: RosterEntry[] = [
  entry(uuid('a', 1), 'Dr. Nadeem Chishti', 'nadeem.admin', 'admin', 'Admin@123'),
  entry(uuid('a', 2), 'Ms. Farah Naz', 'farah.admin', 'admin', 'Admin@456')
];

const teachers: RosterEntry[] = [
  entry(uuid('t', 1), 'Prof. Imran Hanif', 'imran.teacher', 'teacher', 'Teach@123'),
  entry(uuid('t', 2), 'Dr. Sadia Rauf', 'sadia.teacher', 'teacher', 'Teach@456'),
  entry(uuid('t', 3), 'Dr. Khurram Shahzad', 'khurram.teacher', 'teacher', 'Teach@789')
];

// Alternating female / male so any prefix of the list is a balanced mix.
const studentNames: Array<[string, string]> = [
  ['Ayesha', 'Siddiqui'], ['Usman', 'Ghani'], ['Hira', 'Malik'], ['Bilal', 'Ahmed'], ['Sana', 'Chaudhry'],
  ['Faizan', 'Raza'], ['Mehwish', 'Butt'], ['Arslan', 'Mehmood'], ['Iqra', 'Ansari'], ['Shahzaib', 'Hussain'],
  ['Areeba', 'Sheikh'], ['Talha', 'Saeed'], ['Anum', 'Mirza'], ['Hassan', 'Nawaz'], ['Rabia', 'Bhatti'],
  ['Zeeshan', 'Akram'], ['Saima', 'Rana'], ['Kamran', 'Shah'], ['Kinza', 'Awan'], ['Adeel', 'Anjum'],
  ['Mahnoor', 'Gill'], ['Danish', 'Rehman'], ['Hina', 'Baig'], ['Fahad', 'Mushtaq'], ['Sidra', 'Hashmi'],
  ['Junaid', 'Jamil'], ['Laiba', 'Rizvi'], ['Haris', 'Sohail'], ['Nimra', 'Zaidi'], ['Rehan', 'Aslam'],
  ['Bushra', 'Abbasi'], ['Saad', 'Pervaiz'], ['Aiman', 'Javed'], ['Waqas', 'Latif'], ['Komal', 'Iqbal'],
  ['Naveed', 'Akhtar'], ['Fiza', 'Khan'], ['Sheharyar', 'Dar'], ['Ramsha', 'Qureshi'], ['Umair', 'Niazi'],
  ['Dua', 'Farooqi'], ['Affan', 'Sethi'], ['Zoya', 'Naqvi'], ['Haider', 'Bukhari'], ['Alishba', 'Lodhi'],
  ['Moiz', 'Yousaf'], ['Maham', 'Cheema'], ['Taimoor', 'Lashari'], ['Tehreem', 'Warraich'], ['Rizwan', 'Gondal']
];

const students: RosterEntry[] = studentNames.map(([first, last], index) => {
  const n = index + 1;
  return entry(
    uuid('s', n),
    `${first} ${last}`,
    `${first}.${last}`.toLowerCase(),
    'student',
    `Student@${100 + n}`,
    `GUT-2024-${String(100 + n).padStart(4, '0')}`
  );
});

export const roster: RosterEntry[] = [...admins, ...teachers, ...students];
export const rosterStudents = students;
export const rosterTeachers = teachers;
export const rosterAdmins = admins;

/** Accounts shown on the sign-in page: 1 admin, every teacher, 5 students. */
export const loginPanelAccounts: RosterEntry[] = [admins[0], ...teachers, ...students.slice(0, 5)];

export const avatarFor = (entryItem: Pick<RosterEntry, 'fullName' | 'role'>) => {
  const seed = encodeURIComponent(entryItem.fullName.replace(/^(Dr\.|Prof\.|Ms\.|Mr\.)\s+/, '').split(' ')[0]);
  const style = entryItem.role === 'student' ? 'backgroundColor=F59E0B&textColor=0A1628'
    : entryItem.role === 'teacher' ? 'backgroundColor=0F2137&textColor=FBBF24'
    : 'backgroundColor=1E3A5F&textColor=F59E0B';
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&${style}`;
};
