// ==============================================================================
// GUTech Internal LMS - Root React Router & Application Hub
// ==============================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './components/ui/Toast.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { ProfilePage } from './features/profile/ProfilePage.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { CourseListPage } from './features/courses/CourseListPage.js';
import { CourseDetailPage } from './features/courses/CourseDetailPage.js';
import { MarksPage } from './features/marks/MarksPage.js';
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage.js';
import { GlobalChatPage } from './features/chat/GlobalChatPage.js';
import { ComplaintsPage } from './features/complaints/ComplaintsPage.js';
import { UsersPage } from './features/admin/UsersPage.js';
import { TasksPage } from './features/tasks/TasksPage.js';
import { GradingQueuePage } from './features/grading/GradingQueuePage.js';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Admin Guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const RoleRoute: React.FC<{ children: React.ReactNode; roles: Array<'admin' | 'teacher' | 'student'> }> = ({ children, roles }) => {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route (No Sign-up Route per Spec Rule 6) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Explicit 404 for any /signup requests */}
          <Route
            path="/signup"
            element={
              <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <h1 className="text-4xl font-extrabold text-gold-400 mb-2">404 - Not Found</h1>
                <p className="text-sm text-slate-300 max-w-md mb-6">
                  Public sign-up is disabled for the GUTech internal portal. Accounts are created exclusively by the university administration.
                </p>
                <a
                  href="/login"
                  className="px-5 py-2.5 rounded-xl bg-gold-400 text-navy-950 font-bold text-xs hover:bg-gold-500 transition-colors"
                >
                  Return to Portal Login
                </a>
              </div>
            }
          />

          {/* Authenticated Application Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="courses" element={<CourseListPage />} />
            <Route path="courses/:id" element={<CourseDetailPage />} />
            <Route path="marks" element={<RoleRoute roles={['student']}><MarksPage /></RoleRoute>} />
            <Route path="tasks" element={<RoleRoute roles={['student']}><TasksPage /></RoleRoute>} />
            <Route path="grading" element={<RoleRoute roles={['teacher', 'admin']}><GradingQueuePage /></RoleRoute>} />
            <Route path="chat" element={<RoleRoute roles={['student', 'teacher']}><GlobalChatPage /></RoleRoute>} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />

            {/* Admin Exclusive Routes */}
            <Route
              path="admin/users"
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
};
