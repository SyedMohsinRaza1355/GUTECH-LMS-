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
  FileText,
  ClipboardCheck
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui/index.js';
import { Course, Announcement, PendingTask, GradingQueue } from '../../types/index.js';
import { API_BASE_URL, api } from '../../lib/api.js';
import { formatDateTime, formatRelativeTime } from '../../lib/utils.js';

type DashboardSnapshot = {
  courses: Course[];
  announcements: Announcement[];
  announcementCount: number;
  pendingTasks: PendingTask[];
  studentAverage: number | null;
  adminStats: { users: number | null; grievances: number | null; connected: boolean };
  gradingQueue: GradingQueue | null;
};

const dashboardCache = new Map<string, DashboardSnapshot>();

/** A KPI tile; when `to` is set the whole tile is a link so every number leads somewhere useful. */
const StatTile: React.FC<{ to?: string; label: string; children: React.ReactNode }> = ({ to, label, children }) => {
  if (!to) return <Card className="flex items-center gap-4">{children}</Card>;
  return (
    <Link to={to} aria-label={label} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2">
      <Card className="flex h-full items-center gap-4">
        {children}
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Card>
    </Link>
  );
};

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [studentAverage, setStudentAverage] = useState<number | null>(null);
  const [adminStats, setAdminStats] = useState<{ users: number | null; grievances: number | null; connected: boolean }>({ users: null, grievances: null, connected: false });
  const [gradingQueue, setGradingQueue] = useState<GradingQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const dashboardCacheKey = `${user?.id || ''}:${role || ''}`;

  useEffect(() => {
    let isCurrent = true;
    const cached = dashboardCache.get(dashboardCacheKey);
    if (cached) {
      setCourses(cached.courses);
      setAnnouncements(cached.announcements);
      setAnnouncementCount(cached.announcementCount);
      setPendingTasks(cached.pendingTasks);
      setStudentAverage(cached.studentAverage);
      setAdminStats(cached.adminStats);
      setGradingQueue(cached.gradingQueue);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const loadDashboardData = async () => {
      const [courseResult, announcementResult, taskResult, marksResult, adminResult, queueResult] = await Promise.allSettled([
        role === 'admin' ? api.getAllCoursesAdmin() : api.getMyCourses(),
        api.getAnnouncements(),
        role === 'student' ? api.getPendingTasks() : Promise.resolve([]),
        role === 'student' ? api.getStudentMarks() : Promise.resolve(null),
        role === 'admin' ? Promise.allSettled([api.getUsersAdmin(), api.getAdminComplaints('open'), fetch(`${API_BASE_URL}/health`).then(response => response.ok)]) : Promise.resolve(null),
        role === 'teacher' ? api.getGradingQueue() : Promise.resolve(null)
      ]);
      if (!isCurrent) return;
      const nextCourses = courseResult.status === 'fulfilled' ? courseResult.value : [];
      const announcementList = announcementResult.status === 'fulfilled' ? announcementResult.value : [];
      const nextTasks = taskResult.status === 'fulfilled' ? taskResult.value : [];
      const nextAverage = marksResult.status === 'fulfilled' && marksResult.value ? marksResult.value.summary.percentage : null;
      let nextAdminStats = adminStats;
      if (role === 'admin' && adminResult.status === 'fulfilled' && adminResult.value) {
        const [usersResult, grievancesResult, health] = adminResult.value;
        nextAdminStats = { users: usersResult.status === 'fulfilled' ? usersResult.value.length : null, grievances: grievancesResult.status === 'fulfilled' ? grievancesResult.value.length : null, connected: health.status === 'fulfilled' && health.value };
      }
      const snapshot: DashboardSnapshot = { courses: nextCourses, announcements: announcementList.slice(0, 4), announcementCount: announcementList.length, pendingTasks: nextTasks, studentAverage: nextAverage, adminStats: nextAdminStats, gradingQueue: queueResult.status === 'fulfilled' ? queueResult.value : null };
      dashboardCache.set(dashboardCacheKey, snapshot);
      setCourses(snapshot.courses);
      setAnnouncements(snapshot.announcements);
      setAnnouncementCount(snapshot.announcementCount);
      setPendingTasks(snapshot.pendingTasks);
      setStudentAverage(snapshot.studentAverage);
      setAdminStats(snapshot.adminStats);
      setGradingQueue(snapshot.gradingQueue);
      setLoading(false);
    };

    void loadDashboardData();
    return () => { isCurrent = false; };
  }, [role, user?.id]);

  return (
    <div className="space-y-6 stagger" aria-busy={loading}>
      {/* Welcome Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 gradient-flow p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-navy-800">
        <div className="aurora-orb absolute -top-16 right-0 w-96 h-96 bg-gold-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="aurora-orb-slow absolute -bottom-24 left-1/4 w-80 h-80 bg-navy-500/30 rounded-full blur-3xl pointer-events-none" />
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
              Ghazali University of Technology internal learning and course management environment.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {role === 'admin' ? (
              <Link to="/courses?new=1">
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

      {/* KPI Stats Strip: every tile leads to the place where that number can be acted on */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {role === 'student' ? (
          <>
            <StatTile to="/courses" label={`Open your ${courses.length} enrolled courses`}>
              <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center font-bold"><BookOpen className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Enrolled Courses</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{loading ? '—' : courses.length}</p></div>
            </StatTile>
            <StatTile to="/tasks" label={`View ${pendingTasks.length} pending assignments`}>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold"><Clock className="w-6 h-6" aria-hidden="true" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Pending Tasks</p><p className="text-xl font-extrabold tabular-nums text-navy-950 mt-0.5">{loading ? '—' : pendingTasks.length}</p></div>
            </StatTile>
            <StatTile to="/marks" label="Open your marks and GPA">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold"><Award className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Current Average</p><p className="text-xl font-extrabold text-emerald-600 mt-0.5">{loading ? '—' : studentAverage === null ? '—' : `${studentAverage}%`}</p></div>
            </StatTile>
            <StatTile to="/announcements" label={`View ${announcementCount} announcements`}>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold"><Bell className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Announcements</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{loading ? '—' : announcementCount}</p></div>
            </StatTile>
          </>
        ) : role === 'teacher' ? (
          <>
            <StatTile to="/courses" label={`Open your ${courses.length} assigned classes`}>
              <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center"><BookOpen className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Assigned Classes</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{loading ? '—' : courses.length}</p></div>
            </StatTile>
            <StatTile to="/grading" label={`Open the grading queue: ${gradingQueue?.summary.ungradedTotal ?? 0} submissions to grade`}>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center"><FileText className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">To Grade</p><p className="text-xl font-extrabold tabular-nums text-amber-600 mt-0.5">{loading ? '—' : gradingQueue ? gradingQueue.summary.ungradedTotal : '—'}</p></div>
            </StatTile>
            <StatTile to="/courses" label="Open your classes to see enrolled students">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Users className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Total Students</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{loading ? '—' : courses.reduce((count, course) => count + (course.studentsCount || 0), 0)}</p></div>
            </StatTile>
            <StatTile to="/announcements" label={`View ${announcementCount} announcements`}>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center"><Bell className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Announcements</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{loading ? '—' : announcementCount}</p></div>
            </StatTile>
          </>
        ) : (
          <>
            <StatTile to="/admin/users" label="Open the user directory">
              <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center"><Users className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Active Accounts</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{adminStats.users ?? '—'} Users</p></div>
            </StatTile>
            <StatTile to="/courses" label="Manage courses">
              <div className="w-12 h-12 rounded-2xl bg-gold-50 text-gold-700 flex items-center justify-center"><BookOpen className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Total Courses</p><p className="text-xl font-extrabold text-navy-950 mt-0.5">{courses.filter(course => !course.isArchived).length} Active</p></div>
            </StatTile>
            <StatTile to="/complaints" label="Review open grievances">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center"><LifeBuoy className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">Open Grievances</p><p className="text-xl font-extrabold text-rose-600 mt-0.5">{adminStats.grievances ?? '—'} Tickets</p></div>
            </StatTile>
            <StatTile label="System health">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>
              <div><p className="text-xs font-semibold text-slate-400">System Health</p><p className={`text-xl font-extrabold mt-0.5 ${adminStats.connected ? 'text-emerald-600' : 'text-amber-600'}`}>{adminStats.connected ? 'Connected' : 'Unavailable'}</p></div>
            </StatTile>
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
            {!loading && courses.length === 0 && (
              <p className="sm:col-span-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
                {role === 'student' ? 'You are not enrolled in any courses yet. Ask the administration to enrol you.' : role === 'teacher' ? 'No classes are assigned to you yet.' : 'There are no courses yet. Create the first one from Manage Courses.'}
              </p>
            )}
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
                    <span>{typeof course.studentsCount === 'number' ? `${course.studentsCount} students` : 'Open to view'}</span>
                  </div>
                  <Link to={`/courses/${course.id}`}>
                    <Button size="sm" variant="outline" className="font-semibold text-xs">
                      {role === 'teacher' ? 'Open Class' : 'Enter Class'}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Notices & Upcoming (1/3 width) */}
        <div className="space-y-6">
          {/* Actionable Student Deadlines */}
          <Card>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">{role === 'student' ? 'Pending Work' : role === 'teacher' ? 'Needs Grading' : 'Get Started'}</h3>
              </div>
              {role === 'student' && <Link to="/tasks" className="text-[11px] font-bold text-navy-700 hover:text-navy-950">View all</Link>}
              {role === 'teacher' && <Link to="/grading" className="text-[11px] font-bold text-navy-700 hover:text-navy-950">View all</Link>}
            </div>

            {role === 'teacher' ? loading ? <div className="space-y-2" role="status" aria-live="polite"><span className="sr-only">Loading your grading queue…</span><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div> : gradingQueue && gradingQueue.items.length ? <div className="space-y-2">{gradingQueue.items.slice(0, 4).map(item => <Link key={item.assignmentId} to={`/courses/${item.courseId}?tab=assignments&assignmentId=${item.assignmentId}&grade=1`} className="group block rounded-xl border border-slate-200/70 bg-slate-50 p-3 transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"><div className="flex items-start justify-between gap-2"><span className="min-w-0 text-xs font-bold text-navy-900 group-hover:text-navy-700">{item.title}</span><Badge variant="warning" size="sm">{item.ungradedCount} to grade</Badge></div><p className="mt-1 text-[11px] text-slate-500">{item.courseCode} · {item.gradedCount + item.ungradedCount} submitted</p></Link>)}{gradingQueue.items.length > 4 && <Link to="/grading" className="block text-center text-[11px] font-bold text-navy-700 hover:text-navy-950">+{gradingQueue.items.length - 4} more assignments</Link>}</div> : <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">You're all caught up. No submissions are waiting for marks.</p> : role === 'student' ? loading ? <div className="space-y-2" role="status" aria-live="polite"><span className="sr-only">Loading pending assignments…</span><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /></div> : pendingTasks.length ? <div className="space-y-2">{pendingTasks.slice(0, 3).map(task => <Link key={task.id} to={`/courses/${task.courseId}?tab=assignments&assignmentId=${task.id}`} className="group block rounded-xl border border-slate-200/70 bg-slate-50 p-3 transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"><div className="flex items-start justify-between gap-2"><span className="min-w-0 text-xs font-bold text-navy-900 group-hover:text-navy-700">{task.title}</span><Badge variant={task.isOverdue ? 'danger' : 'warning'} size="sm">{task.isOverdue ? 'Overdue' : 'Pending'}</Badge></div><p className="mt-1 text-[11px] text-slate-500">{task.courseCode} · Due {formatDateTime(task.dueAt)}</p></Link>)}</div> : <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">You’re all caught up. No assignments are waiting for submission.</p> : <div className="space-y-3"><p className="text-sm text-slate-600">Open a class to review assignments, resources, and announcements.</p><Link to="/courses" className="inline-flex items-center gap-2 text-sm font-bold text-navy-800 hover:text-navy-600">Browse classes <ArrowRight className="h-4 w-4" /></Link></div>}
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
                <Link key={ann.id} to={`/announcements?announcementId=${encodeURIComponent(ann.id)}`} className="group block rounded-xl bg-slate-50 border border-slate-200/60 p-3 transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-navy-200 hover:bg-slate-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-navy-950 line-clamp-1">{ann.title}</p>
                    {ann.isPinned && <span className="text-[10px] text-gold-700 font-bold">Pinned</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ann.body}</p>
                  <p className="text-[10px] text-slate-400 mt-2">{formatRelativeTime(ann.createdAt)}</p>
                </Link>
              ))}
              {!loading && announcements.length === 0 && <p className="text-sm text-slate-500">No announcements have been posted yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
