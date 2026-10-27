// GUTech LMS authentication and per-profile demo sessions.
import React, { createContext, useContext, useState } from 'react';
import { UserProfile } from '../types/index.js';
import { api } from '../lib/api.js';

interface AuthContextType {
  user: UserProfile | null;
  role: UserProfile['role'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => void;
}

export const demoAccounts: Array<{ profile: UserProfile; password: string }> = [
  { profile: { id: 'a0000000-0000-0000-0000-000000000001', fullName: 'Dr. Farooq Al-Balushi', email: 'farooq.admin@gutech.edu.om', role: 'admin', isActive: true, mustChangePassword: false, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' }, password: 'Admin@123' },
  { profile: { id: 'a0000000-0000-0000-0000-000000000002', fullName: 'Ms. Hana Al-Rawahi', email: 'hana.admin@gutech.edu.om', role: 'admin', isActive: true, mustChangePassword: false, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' }, password: 'Admin@456' },
  { profile: { id: 't0000000-0000-0000-0000-000000000001', fullName: 'Prof. Tariq Al-Hinai', email: 'tariq.teacher@gutech.edu.om', role: 'teacher', isActive: true, mustChangePassword: false, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' }, password: 'Teach@123' },
  { profile: { id: 't0000000-0000-0000-0000-000000000002', fullName: 'Dr. Sarah Mitchell', email: 'sarah.teacher@gutech.edu.om', role: 'teacher', isActive: true, mustChangePassword: false, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' }, password: 'Teach@456' },
  { profile: { id: 't0000000-0000-0000-0000-000000000003', fullName: 'Dr. Khalid Al-Amri', email: 'khalid.teacher@gutech.edu.om', role: 'teacher', isActive: true, mustChangePassword: false, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' }, password: 'Teach@789' },
  ...[
    ['Fatima Al-Zadjali', 'fatima.student', '0101', 'Student@101'], ['Ali Al-Lawati', 'ali.student', '0102', 'Student@102'],
    ['Maryam Al-Kiyumi', 'maryam.student', '0103', 'Student@103'], ['Hamad Al-Busaidi', 'hamad.student', '0104', 'Student@104'],
    ['Noor Al-Rashdi', 'noor.student', '0105', 'Student@105'], ['Omar Al-Siyabi', 'omar.student', '0106', 'Student@106'],
    ['Layla Al-Harthi', 'layla.student', '0107', 'Student@107']
  ].map(([fullName, username, roll, password], index) => ({
    profile: { id: `s0000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`, fullName, email: `${username}@gutech.edu.om`, role: 'student' as const, rollNo: `GUT-2023-${roll}`, isActive: true, mustChangePassword: false, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z' }, password
  }))
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('gutech_lms_user');
      const token = localStorage.getItem('gutech_lms_token');
      const profile = saved ? JSON.parse(saved) as UserProfile : null;
      if (profile && token && (!token.startsWith('demo-token-') || token === `demo-token-${profile.id}`)) return profile;
    } catch { /* Discard invalid or obsolete local sessions. */ }
    localStorage.removeItem('gutech_lms_user');
    localStorage.removeItem('gutech_lms_token');
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    const normalized = username.trim().toLowerCase();
    const email = normalized.includes('@') ? normalized : `${normalized}@gutech.edu.om`;
    try {
      try {
        const response = await api.login(email, password);
        setUser(response.profile);
        localStorage.setItem('gutech_lms_user', JSON.stringify(response.profile));
        return response.profile;
      } catch (error) {
        // Keep the standalone frontend demo usable, but never bypass a rejected password.
        if ((error as Error).message === 'Invalid email or password' || (error as Error).message.includes('deactivated')) throw error;
        const account = demoAccounts.find(entry => entry.profile.email === email && entry.password === password);
        if (!account) throw new Error('Invalid email or password');
        localStorage.setItem('gutech_lms_token', `demo-token-${account.profile.id}`);
        localStorage.setItem('gutech_lms_user', JSON.stringify(account.profile));
        setUser(account.profile);
        return account.profile;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* Clear local session even if the API is offline. */ }
    localStorage.removeItem('gutech_lms_user');
    api.clearToken();
    setUser(null);
  };

  const updateUserProfile = (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem('gutech_lms_user', JSON.stringify(updated));
    setUser(updated);
  };

  return <AuthContext.Provider value={{ user, role: user?.role ?? null, isAuthenticated: !!user, isLoading, login, logout, updateUserProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
