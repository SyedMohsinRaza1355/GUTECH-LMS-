// ==============================================================================
// GUTech Internal LMS - Admin User Directory & Management
// Fulfills Feature 1 Admin User Management (No public sign-up)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  KeyRound,
  Filter
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, RoleBadge, EmptyState } from '../../components/ui/index.js';
import { UserProfile, UserRole } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/utils.js';
import { demoAccounts } from '../../context/AuthContext.js';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Create User Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [rollNo, setRollNo] = useState('');
  const [tempPassword, setTempPassword] = useState('GUTech@2026!');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsersAdmin(roleFilter || undefined, search || undefined);
      setUsers(data);
    } catch {
      const fallback = demoAccounts.map(({ profile }) => profile);
      setUsers(fallback.filter(profile => (!roleFilter || profile.role === roleFilter) &&
        (!search || `${profile.fullName} ${profile.email}`.toLowerCase().includes(search.toLowerCase()))));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const created = await api.createUserAdmin({
        fullName,
        email,
        role: newUserRole,
        rollNo: newUserRole === 'student' ? rollNo : undefined,
        tempPassword
      });

      setUsers([created, ...users]);
      setModalOpen(false);
      setFullName('');
      setEmail('');
      setRollNo('');
    } catch (err: unknown) {
      setCreateError((err as Error)?.message || 'Failed to create user account');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    const updated = await api.patchUserAdmin(user.id, { isActive: !user.isActive });
    setUsers(users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
  };

  const handleResetPassword = async (user: UserProfile) => {
    await api.resetUserPasswordAdmin(user.id);
    alert(`Temporary password reset triggered for ${user.email}. User will be forced to choose a new password upon login.`);
  };

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.rollNo && u.rollNo.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">Institutional User Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal user account provisioning, role allocation, and security access controls
          </p>
        </div>

        <Button
          variant="gold"
          size="sm"
          leftIcon={<UserPlus className="w-4 h-4" />}
          onClick={() => setModalOpen(true)}
        >
          Provision User Account
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, institutional email, or roll no..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        {/* Role Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold overflow-x-auto">
          {[
            { id: '', label: 'All Users' },
            { id: 'student', label: 'Students' },
            { id: 'teacher', label: 'Faculty' },
            { id: 'admin', label: 'Admins' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === f.id
                  ? 'bg-white text-navy-950 shadow-sm'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-navy-900 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-6">Full Name & Email</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Identifier / Roll No</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created Date</th>
                <th className="p-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(userItem => (
                <tr key={userItem.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 pl-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={userItem.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userItem.fullName)}`}
                        alt={userItem.fullName}
                        className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <p className="font-bold text-navy-900">{userItem.fullName}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{userItem.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <RoleBadge role={userItem.role} />
                  </td>

                  <td className="p-3.5 font-mono text-xs font-semibold text-slate-700">
                    {userItem.rollNo || '—'}
                  </td>

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
                        onClick={() => handleResetPassword(userItem)}
                        className="p-1.5 text-slate-400 hover:text-gold-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Trigger Password Reset"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <Button
                        size="sm"
                        variant={userItem.isActive ? 'outline' : 'primary'}
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
      </Card>

      {/* Admin Create User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Provision Institutional Account"
        subtitle="Accounts are pre-created by administration (public sign-up is disabled)"
      >
        {createError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {createError}
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Legal Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="e.g. Salim Al-Maskari"
            required
          />

          <Input
            label="Institutional Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="salim.maskari@gutech.edu.om"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Account Role
            </label>
            <select
              value={newUserRole}
              onChange={e => setNewUserRole(e.target.value as UserRole)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-navy-600 font-bold"
            >
              <option value="student">🎓 Student</option>
              <option value="teacher">👨‍🏫 Faculty / Teacher</option>
              <option value="admin">🛡️ Administrator</option>
            </select>
          </div>

          {newUserRole === 'student' && (
            <Input
              label="Student Roll No / Matriculation"
              value={rollNo}
              onChange={e => setRollNo(e.target.value)}
              placeholder="GUT-2026-0501"
            />
          )}

          <Input
            label="Temporary Initial Password"
            value={tempPassword}
            onChange={e => setTempPassword(e.target.value)}
            helperText="User will be prompted to change this on initial login"
            required
          />

          <Button type="submit" variant="gold" className="w-full font-bold" isLoading={createLoading}>
            Provision User
          </Button>
        </form>
      </Modal>
    </div>
  );
};
