// ==============================================================================
// Ghazali University of Technology (GUTech) LMS - Admin User Directory & Management
// Admin-only provisioning (no public sign-up): search, role filters, paging,
// a guided new-student form that also enrols the student in courses,
// and an audit history of account and grade changes.
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Wand2,
  Copy,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button, Card, Modal, Input, RoleBadge, EmptyState } from '../../components/ui/index.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';
import { UserProfile, UserRole, Course } from '../../types/index.js';
import { api, AuditEntry } from '../../lib/api.js';
import { formatDate, formatDateTime } from '../../lib/utils.js';
import { demoAccounts, useAuth } from '../../context/AuthContext.js';
import { EMAIL_DOMAIN } from '../../lib/demoRoster.js';

const PAGE_SIZE = 15;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z\s.]/g, '').trim().split(/\s+/).filter(Boolean);
const suggestUsername = (fullName: string) => {
  const parts = slug(fullName.replace(/^(dr|prof|ms|mr|mrs)\.?\s+/i, ''));
  return parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || '';
};
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(8));
  return `${Array.from(bytes, n => chars[n % chars.length]).join('')}@${10 + (bytes[0] % 90)}`;
};

const actionLabels: Record<string, string> = {
  'user.create': 'Account created',
  'user.update': 'Account edited',
  'user.activate': 'Account activated',
  'user.deactivate': 'Account deactivated',
  'user.reset-password': 'Password reset requested',
  'user.change-password': 'Password changed',
  'course.unenroll': 'Student unenrolled from a course',
  'grade.save': 'Grade saved',
  'grade.quiz': 'Quiz score changed',
  'assignment.update': 'Assignment edited',
  'assignment.delete': 'Assignment deleted'
};

export const UsersPage: React.FC = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // Create User Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [rollNo, setRollNo] = useState('');
  const [tempPassword, setTempPassword] = useState(() => generatePassword());
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string; rollNo?: string | null; courses: number } | null>(null);

  // Audit history modal
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getUsersAdmin(roleFilter || undefined);
      setUsers(data);
      setOffline(false);
    } catch (error) {
      // Offline demo fallback: the roster shipped with the app, read-only.
      setUsers(demoAccounts.map(({ profile }) => profile).filter(profile => !roleFilter || profile.role === roleFilter));
      setOffline(true);
      setLoadError(errorMessage(error, 'The server could not be reached.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUsers(); }, [roleFilter]);
  useEffect(() => { setPage(1); }, [search, roleFilter]);

  const openCreateModal = async () => {
    setCreateError(null);
    setCreatedCredentials(null);
    setModalOpen(true);
    if (!courses.length) {
      try { setCourses((await api.getAllCoursesAdmin()).filter(course => !course.isArchived)); } catch { /* enrolment is optional */ }
    }
  };

  const email = `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
  const emailTaken = users.some(u => u.email.toLowerCase() === email);

  const resetForm = () => {
    setFullName(''); setUsername(''); setUsernameTouched(false); setRollNo('');
    setTempPassword(generatePassword()); setSelectedCourseIds([]); setNewUserRole('student');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!/^[a-z0-9._-]{3,40}$/i.test(username.trim())) {
      setCreateError('Username must be 3-40 characters: letters, numbers, dots, dashes or underscores.');
      return;
    }
    if (emailTaken) {
      setCreateError(`${email} already exists. Choose a different username.`);
      return;
    }
    setCreateLoading(true);
    try {
      const created = await api.createUserAdmin({
        fullName: fullName.trim(),
        email,
        role: newUserRole,
        rollNo: newUserRole === 'student' && rollNo.trim() ? rollNo.trim() : undefined,
        courseIds: newUserRole === 'student' ? selectedCourseIds : undefined,
        tempPassword
      });
      setUsers(current => [created, ...current]);
      setCreatedCredentials({ name: created.fullName, email: created.email, password: tempPassword, rollNo: created.rollNo, courses: selectedCourseIds.length });
      toast.success(`${created.fullName} added`, newUserRole === 'student' ? 'Their student portal is ready to use.' : 'The account is ready to sign in.');
      resetForm();
    } catch (err) {
      // Form values are kept so the admin can correct and resubmit.
      setCreateError(errorMessage(err, 'Failed to create user account'));
      toast.error('Account was not created', errorMessage(err));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleActive = async (target: UserProfile) => {
    const action = target.isActive ? 'deactivate' : 'activate';
    if (target.isActive && !window.confirm(`Deactivate ${target.fullName}? They will be signed out and unable to log in until reactivated.`)) return;
    try {
      await api.patchUserAdmin(target.id, { isActive: !target.isActive });
      setUsers(current => current.map(u => u.id === target.id ? { ...u, isActive: !u.isActive } : u));
      toast.success(`${target.fullName} ${action}d`, target.isActive ? 'You can reactivate them at any time.' : undefined);
    } catch (error) {
      toast.error(`Could not ${action} ${target.fullName}`, errorMessage(error));
    }
  };

  const handleResetPassword = async (target: UserProfile) => {
    if (!window.confirm(`Send a password reset for ${target.email}?`)) return;
    try {
      const result = await api.resetUserPasswordAdmin(target.id);
      toast.success('Password reset requested', result.message);
    } catch (error) {
      toast.error('Could not reset the password', errorMessage(error));
    }
  };

  const openAudit = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditError(null);
    try {
      setAuditRows(await api.getAuditTrail());
    } catch (error) {
      setAuditError(errorMessage(error, 'Audit history could not be loaded.'));
    } finally {
      setAuditLoading(false);
    }
  };

  const copyCredentials = async () => {
    if (!createdCredentials) return;
    const text = `Ghazali University of Technology LMS\nUsername: ${createdCredentials.email.split('@')[0]}\nPassword: ${createdCredentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Credentials copied');
    } catch {
      toast.error('Copy failed', 'Select the credentials and copy them manually.');
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(u => !term ||
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.rollNo && u.rollNo.toLowerCase().includes(term)));
  }, [users, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleCourse = (id: string) => setSelectedCourseIds(current => current.includes(id) ? current.filter(c => c !== id) : [...current, id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">Institutional User Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {users.length} accounts · provisioning, role allocation and access controls
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<History className="w-4 h-4" />} onClick={openAudit}>
            Audit history
          </Button>
          <Button variant="gold" size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={openCreateModal} disabled={offline}>
            Add new user
          </Button>
        </div>
      </div>

      {offline && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-900">Showing the offline demo roster</p>
            <p className="text-xs text-amber-800">{loadError} Account changes are disabled until the server is reachable.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void fetchUsers()}>Retry</Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <label htmlFor="user-search" className="sr-only">Search users</label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or roll number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" aria-hidden="true" />
        </div>

        {/* Role Pills */}
        <div role="group" aria-label="Filter by role" className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold overflow-x-auto">
          {[
            { id: '', label: 'All Users' },
            { id: 'student', label: 'Students' },
            { id: 'teacher', label: 'Faculty' },
            { id: 'admin', label: 'Admins' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={roleFilter === f.id}
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === f.id ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6" role="status" aria-live="polite" aria-label="Loading users">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No users match"
            description={search ? `Nothing matches "${search}". Try a different name, email or roll number.` : 'There are no accounts for this role yet.'}
            action={search ? <Button size="sm" variant="outline" onClick={() => setSearch('')}>Clear search</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-navy-900 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3.5 pl-6">Full Name & Email</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Roll No</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created</th>
                  <th className="p-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(userItem => (
                  <tr key={userItem.id} className="hover:bg-gold-50/40 transition-colors">
                    <td className="p-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={userItem.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userItem.fullName)}`}
                          alt=""
                          className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <p className="font-bold text-navy-900">{userItem.fullName}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{userItem.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5"><RoleBadge role={userItem.role} /></td>
                    <td className="p-3.5 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{userItem.rollNo || '—'}</td>
                    <td className="p-3.5">
                      {userItem.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <XCircle className="w-3 h-3" /> Deactivated
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-400">{formatDate(userItem.createdAt)}</td>
                    <td className="p-3.5 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleResetPassword(userItem)}
                          disabled={offline}
                          className="p-1.5 text-slate-400 hover:text-gold-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
                          title="Request password reset"
                          aria-label={`Request password reset for ${userItem.fullName}`}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <Button
                          size="sm"
                          variant={userItem.isActive ? 'outline' : 'primary'}
                          disabled={offline || userItem.id === currentUser?.id}
                          title={userItem.id === currentUser?.id ? 'You cannot deactivate your own account' : undefined}
                          onClick={() => handleToggleActive(userItem)}
                        >
                          {userItem.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
            <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-2 font-semibold text-navy-900">Page {page} / {pageCount}</span>
              <Button size="sm" variant="ghost" disabled={page === pageCount} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Admin Create User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={createdCredentials ? 'Account ready' : 'Add a new user'}
        subtitle={createdCredentials ? 'Share these credentials securely with the user' : 'Creates the login, profile and portal in one step (public sign-up is disabled)'}
        maxWidth="lg"
      >
        {createdCredentials ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-bold">{createdCredentials.name} can sign in now.</p>
              <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-xs">
                <dt className="font-semibold">Username</dt><dd className="font-mono">{createdCredentials.email.split('@')[0]}</dd>
                <dt className="font-semibold">Email</dt><dd className="font-mono">{createdCredentials.email}</dd>
                <dt className="font-semibold">Temporary password</dt><dd className="font-mono">{createdCredentials.password}</dd>
                {createdCredentials.rollNo && (<><dt className="font-semibold">Roll number</dt><dd className="font-mono">{createdCredentials.rollNo}</dd></>)}
                {createdCredentials.courses > 0 && (<><dt className="font-semibold">Enrolled in</dt><dd>{createdCredentials.courses} course{createdCredentials.courses === 1 ? '' : 's'}</dd></>)}
              </dl>
              <p className="mt-3 text-[11px] text-emerald-800">The password is shown only now. The user will be asked to change it after first sign-in.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" leftIcon={<Copy className="h-4 w-4" />} onClick={copyCredentials}>Copy credentials</Button>
              <Button variant="gold" className="flex-1" onClick={() => setCreatedCredentials(null)}>Add another</Button>
            </div>
          </div>
        ) : (
          <>
            {createError && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider" htmlFor="new-user-role">Account type</label>
                <select
                  id="new-user-role"
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-navy-600 font-semibold"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Faculty / Teacher</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <Input
                label="Full name"
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value);
                  if (!usernameTouched) setUsername(suggestUsername(e.target.value));
                }}
                placeholder="e.g. Ayesha Siddiqui"
                autoComplete="off"
                required
              />

              <Input
                label="Username"
                value={username}
                onChange={e => { setUsername(e.target.value); setUsernameTouched(true); }}
                placeholder="ayesha.siddiqui"
                autoComplete="off"
                error={username && emailTaken ? 'This username is already taken.' : undefined}
                helperText={username && !emailTaken ? `Signs in as ${username.trim().toLowerCase()} · ${email}` : 'Suggested from the name; you can edit it.'}
                required
              />

              {newUserRole === 'student' && (
                <>
                  <Input
                    label="Roll number"
                    value={rollNo}
                    onChange={e => setRollNo(e.target.value)}
                    placeholder="Leave blank to assign the next number automatically"
                    autoComplete="off"
                  />

                  <fieldset>
                    <legend className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Enrol in courses</legend>
                    {courses.length === 0 ? (
                      <p className="text-xs text-slate-500">No active courses found. You can enrol the student later from the course page.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {courses.map(course => (
                          <label key={course.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition-colors ${selectedCourseIds.includes(course.id) ? 'border-gold-400 bg-gold-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="checkbox" className="mt-0.5" checked={selectedCourseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} />
                            <span><span className="font-bold text-navy-900">{course.code}</span><span className="block text-slate-500">{course.title}</span></span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </>
              )}

              <div>
                <Input
                  label="Temporary password"
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  helperText="At least 8 characters with a letter and a number. The user must change it after first sign-in."
                  required
                />
                <button type="button" onClick={() => setTempPassword(generatePassword())} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-navy-900">
                  <Wand2 className="h-3.5 w-3.5" /> Generate a secure password
                </button>
              </div>

              <Button type="submit" variant="gold" className="w-full font-bold" isLoading={createLoading}>
                {newUserRole === 'student' ? 'Create student & portal' : 'Create account'}
              </Button>
            </form>
          </>
        )}
      </Modal>

      {/* Audit history */}
      <Modal isOpen={auditOpen} onClose={() => setAuditOpen(false)} title="Audit history" subtitle="Who changed what, and when (grades and account actions)" maxWidth="2xl">
        {auditLoading ? (
          <div className="space-y-2" role="status" aria-live="polite">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>
        ) : auditError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">{auditError}</p>
            <Button size="sm" className="mt-3" onClick={openAudit}>Try again</Button>
          </div>
        ) : auditRows.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="No activity recorded yet" description="Grade changes and account actions will appear here as they happen." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {auditRows.map(row => {
              const meta = (row.metadata || {}) as Record<string, unknown>;
              const detail = row.action === 'grade.save'
                ? `${meta.assignment ?? 'Assignment'}: ${meta.previousMarks ?? '—'} → ${meta.marks ?? '—'} / ${meta.maxMarks ?? '—'}`
                : row.action === 'grade.quiz'
                  ? `${meta.quiz ?? 'Quiz'}: ${meta.previousScore ?? '—'} → ${meta.score ?? '—'} / ${meta.totalMarks ?? '—'}${meta.note ? ` (${meta.note})` : ''}`
                  : row.action.startsWith('assignment.')
                    ? String(meta.title ?? '')
                    : String(meta.email ?? '');
              return (
                <li key={row.id} className="flex flex-col gap-0.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-navy-900">{actionLabels[row.action] || row.action}</p>
                    <p className="text-slate-500">{row.actorName}{detail ? ` · ${detail}` : ''}</p>
                  </div>
                  <time className="text-slate-400" dateTime={row.at}>{formatDateTime(row.at)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
};
