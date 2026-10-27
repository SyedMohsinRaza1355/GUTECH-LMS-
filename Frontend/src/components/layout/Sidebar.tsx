// ==============================================================================
// GUTech Internal LMS - Sidebar Navigation
// ==============================================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  ListChecks,
  MessageSquare,
  Bell,
  LifeBuoy,
  Users,
  ShieldCheck,
  User,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { role, user } = useAuth();

  // Navigation Items by Role
  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'teacher', 'student']
    },
    {
      to: '/courses',
      label: role === 'teacher' ? 'My Classes' : role === 'admin' ? 'Manage Courses' : 'My Courses',
      icon: BookOpen,
      roles: ['admin', 'teacher', 'student']
    },
    {
      to: '/marks',
      label: 'My Marks & GPA',
      icon: Award,
      roles: ['student']
    },
    {
      to: '/tasks',
      label: 'Pending Work',
      icon: ListChecks,
      roles: ['student']
    },
    {
      to: '/chat',
      label: 'Classroom Chat',
      icon: MessageSquare,
      roles: ['teacher', 'student']
    },
    {
      to: '/announcements',
      label: 'Announcements',
      icon: Bell,
      roles: ['admin', 'teacher', 'student']
    },
    {
      to: '/complaints',
      label: role === 'admin' ? 'Review Complaints' : 'Grievance / Helpdesk',
      icon: LifeBuoy,
      roles: ['admin', 'teacher', 'student']
    },
    {
      to: '/admin/users',
      label: 'User Directory',
      icon: Users,
      roles: ['admin']
    },
    {
      to: '/profile',
      label: 'My Profile',
      icon: User,
      roles: ['admin', 'teacher', 'student']
    }
  ];

  const filteredItems = navItems.filter(item => (role ? item.roles.includes(role) : true));

  return (
    <aside className="w-64 h-full flex flex-col justify-between bg-white border-r border-slate-200/80 p-4 select-none">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {role ? `${role.toUpperCase()} PORTAL` : 'PORTAL'}
          </div>
          <nav className="space-y-1">
            {filteredItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                      isActive
                        ? 'bg-navy-900 text-white shadow-md shadow-navy-900/10'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
                    )
                  }
                >
                  <Icon className="w-4 h-4 opacity-80" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom User Card in Sidebar */}
      <div className="pt-4 border-t border-slate-100">
        <NavLink
          to="/profile"
          onClick={onCloseMobile}
          className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200/60"
        >
          <img
            src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.fullName || 'User')}`}
            alt={user?.fullName}
            className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-300"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-navy-950 truncate">{user?.fullName}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role} Portal</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </NavLink>
      </div>
    </aside>
  );
};
