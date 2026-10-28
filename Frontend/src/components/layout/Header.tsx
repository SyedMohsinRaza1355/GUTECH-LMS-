// ==============================================================================
// GUTech Internal LMS - Top Header Bar
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Menu,
  LogOut,
  User,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, role, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Logo / Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-navy-900 to-navy-700 flex items-center justify-center text-gold-400 shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-navy-950">GUTech</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gold-400 text-navy-950 uppercase tracking-widest">LMS</span>
              </div>
              <p className="hidden sm:block text-[10px] font-medium text-slate-400">Ghazali University of Technology</p>
            </div>
          </Link>
        </div>

        {/* Right Controls: Notifications + Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Announcements Notification Bell */}
          <Link
            to="/announcements"
            className="relative p-2 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors"
            title="View Announcements"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold-500 ring-2 ring-white animate-pulse" />
          </Link>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <img
                src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.fullName || 'User')}`}
                alt={user?.fullName || 'Avatar'}
                className="w-8 h-8 rounded-xl object-cover ring-2 ring-slate-200"
              />
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-navy-900 leading-tight">{user?.fullName}</p>
                <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
              </div>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 modal-pop">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-navy-900">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    {user?.rollNo && (
                      <p className="text-[10px] font-mono font-semibold text-gold-600 mt-0.5">
                        {user.rollNo}
                      </p>
                    )}
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    User Profile & Security
                  </Link>

                  {role === 'admin' && (
                    <Link
                      to="/admin/users"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      Admin Control Panel
                    </Link>
                  )}

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
