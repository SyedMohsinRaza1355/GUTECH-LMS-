// Ghazali University of Technology LMS authentication and per-profile demo sessions.
import React, { createContext, useContext, useState } from 'react';
import { UserProfile } from '../types/index.js';
import { api } from '../lib/api.js';
import { demoRoster, loginPanelUsernames, EMAIL_DOMAIN } from '../lib/demoRoster.js';

interface AuthContextType {
  user: UserProfile | null;
  role: UserProfile['role'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => void;
}

const demoTimestamp = '2026-09-01T08:00:00Z';

/** Offline-demo fallback accounts: the full 55-person roster (see lib/demoRoster.ts). */
export const demoAccounts: Array<{ profile: UserProfile; password: string }> = demoRoster.map(person => ({
  profile: {
    id: person.id, fullName: person.fullName, email: `${person.username}@${EMAIL_DOMAIN}`, role: person.role,
    ...(person.rollNo ? { rollNo: person.rollNo } : {}), isActive: true, mustChangePassword: false,
    createdAt: demoTimestamp, updatedAt: demoTimestamp
  },
  password: person.password
}));

/** The short list shown on the sign-in page: 1 admin, all teachers, 5 students. */
export const loginPanelAccounts = loginPanelUsernames
  .map(username => demoAccounts.find(account => account.profile.email === `${username}@${EMAIL_DOMAIN}`))
  .filter((account): account is { profile: UserProfile; password: string } => Boolean(account));

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
    const email = normalized.includes('@') ? normalized : `${normalized}@${EMAIL_DOMAIN}`;
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
