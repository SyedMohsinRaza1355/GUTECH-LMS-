// ==============================================================================
// GUTech Internal LMS - Role-Aware Main Dashboard
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Award,
  Clock,
  Bell,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  LifeBuoy,
  Sparkles,
  FileText
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui/index.js';
import { Course, Announcement } from '../../types/index.js';
import { API_BASE_URL, api } from '../../lib/api.js';
import { formatDate, formatRelativeTime } from '../../lib/utils.js';

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [adminStats, setAdminStats] = useState<{ users: number | null; grievances: number | null; connected: boolean }>({ users: null, grievances: null, connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        if (role === 'admin') {
          const [usersResult, grievancesResult, health] = await Promise.allSettled([
            api.getUsersAdmin(),
            api.getAdminComplaints('open'),
            fetch(`${API_BASE_URL}/health`).then(response => response.ok)
          ]);
          setAdminStats({
            users: usersResult.status === 'fulfilled' ? usersResult.value.length : null,
            grievances: grievancesResult.status === 'fulfilled' ? grievancesResult.value.length : null,
            connected: health.status === 'fulfilled' && health.value
          });
        }
        const [myCourses, annList] = await Promise.all([
          (role === 'admin' ? api.getAllCoursesAdmin() : api.getMyCourses()).catch(() => [
            {
              id: 'c0000000-0000-0000-0000-000000000002',
              code: 'WEB302',
              title: 'Modern Web Technologies',
              description: 'Full-stack application architecture using React, Node.js, and Supabase.',
              isArchived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              studentsCount: 4
            },
            {
              id: 'c0000000-0000-0000-0000-000000000001',
              code: 'CS101',
              title: 'Introduction to Computer Science',
              description: 'Foundations of computing, data structures, and algorithmic problem solving.',
              isArchived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              studentsCount: 3
            }
          ]),
          api.getAnnouncements().catch(() => [
            {
              id: 'ann-1',
              authorId: 'a1',
              title: 'Welcome to GUTech Fall 2026 Academic Term',
              body: 'Please ensure your profile is verified and check upcoming deadlines.',
              isPinned: true,
              authorName: 'Dr. Farooq Al-Balushi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ])
        ]);

        setCourses(myCourses);
        setAnnouncements(annList.slice(0, 4));
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [role]);

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-navy-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-gold-400 uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-gold-400/10 border border-gold-400/20">
                {role} portal
              </span>
              <span className="text-xs text-slate-400">· Fall Semester 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="text-gold-400">{user?.fullName}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              German University of Technology internal learning and course management environment.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {role === 'admin' ? (
              <Link to="/courses">
                <Button variant="gold" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Create Course
                </Button>
              </Link>
            ) : role === 'student' ? (
              <Link to="/marks">
                <Button variant="gold" size="sm" leftIcon={<Award className="w-4 h-4" />}>
                  View My Marks
                </Button>
              </Link>
            ) : (
              <Link to="/courses">
                <Button variant="gold" size="sm" leftIcon={<BookOpen className="w-4 h-4" />}>
                  My Classes
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'student' ? (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Enrolled Courses</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">{courses.length}</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Pending Tasks</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">1</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Current Average</p>
                <p className="text-xl font-extrabold text-emerald-600 mt-0.5">92.4%</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Announcements</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">{announcements.length}</p>
              </div>
            </Card>
          </>
        ) : role === 'teacher' ? (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Assigned Classes</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">{courses.length}</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">To Grade</p>
                <p className="text-xl font-extrabold text-amber-600 mt-0.5">2 Submissions</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Students</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">14 Enrolled</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Department Status</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">Active</p>
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Active Accounts</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">{adminStats.users ?? '—'} Users</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gold-50 text-gold-700 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Courses</p>
                <p className="text-xl font-extrabold text-navy-950 mt-0.5">{courses.filter(course => !course.isArchived).length} Active</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Open Grievances</p>
                <p className="text-xl font-extrabold text-rose-600 mt-0.5">{adminStats.grievances ?? '—'} Tickets</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">System Health</p>
                <p className={`text-xl font-extrabold mt-0.5 ${adminStats.connected ? 'text-emerald-600' : 'text-amber-600'}`}>{adminStats.connected ? 'Connected' : 'Unavailable'}</p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Main Content Layout: Left Course Cards, Right Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Courses Grid (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-navy-950 tracking-tight">
              {role === 'teacher' ? 'My Teaching Classes' : role === 'admin' ? 'University Courses' : 'My Enrolled Courses'}
            </h2>
            <Link to="/courses" className="text-xs font-bold text-navy-700 hover:text-navy-950 flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.map(course => (
              <Card key={course.id} className="hover:border-navy-300 hover:shadow-premium-lg transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-navy-100 text-navy-800">
                      {course.code}
                    </span>
                    <Badge variant="navy">Fall 2026</Badge>
                  </div>
                  <h3 className="text-base font-bold text-navy-900 line-clamp-1">{course.title}</h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                    {course.description || 'Comprehensive curriculum with practical coursework, quizzes, and resources.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{course.studentsCount || 4} students</span>
                  </div>
                  <Link to={`/courses/${course.id}`}>
                    <Button size="sm" variant="outline" className="font-semibold text-xs">
                      Enter Class
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Notices & Upcoming (1/3 width) */}
        <div className="space-y-6">
          {/* Upcoming Deadlines Widget for Students / Teachers */}
          <Card>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">Upcoming Deadlines</h3>
              </div>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-900">Assignment 1: RESTful API</span>
                  <Badge variant="warning" size="sm">7 Days</Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">WEB302 · Express & Supabase</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-900">Quiz 1: HTTP Protocols</span>
                  <Badge variant="success" size="sm">Available</Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">15 Minutes timed assessment</p>
              </div>
            </div>
          </Card>

          {/* Announcements Feed */}
          <Card>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-navy-800" />
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">Campus Notices</h3>
              </div>
              <Link to="/announcements" className="text-[11px] font-bold text-navy-700 hover:text-navy-950">
                All
              </Link>
            </div>

            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/60 transition-colors">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-navy-950 line-clamp-1">{ann.title}</p>
                    {ann.isPinned && <span className="text-[10px] text-gold-600 font-bold">📌 Pinned</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ann.body}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{formatRelativeTime(ann.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
