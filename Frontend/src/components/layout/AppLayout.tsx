// ==============================================================================
// GUTech Internal LMS - Responsive Application Layout
// ==============================================================================

import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  ListChecks,
  MessageSquare,
  Users,
  User,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col antialiased">
      {/* Top Header */}
      <Header onToggleSidebar={() => setSidebarOpen(true)} />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile Slide-Over Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 drawer-slide">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-navy-900 tracking-wider">NAVIGATION</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar onCloseMobile={() => setSidebarOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 lg:pb-8">
          <div key={location.pathname} className="page-enter"><Outlet /></div>
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation Bar (< lg screens) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around z-30 shadow-lg">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
              isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            )
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/courses"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
              isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            )
          }
        >
          <BookOpen className="w-5 h-5" />
          <span>Courses</span>
        </NavLink>

        {role === 'student' ? (
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
                isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            <ListChecks className="w-5 h-5" />
            <span>Tasks</span>
          </NavLink>
        ) : null}

        {role === 'student' ? (
          <NavLink
            to="/marks"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
                isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            <Award className="w-5 h-5" />
            <span>Marks</span>
          </NavLink>
        ) : role === 'teacher' ? (
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
                isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chat</span>
          </NavLink>
        ) : (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
                isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            <Users className="w-5 h-5" />
            <span>Users</span>
          </NavLink>
        )}

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors',
              isActive ? 'text-navy-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            )
          }
        >
          <User className="w-5 h-5" />
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
};
