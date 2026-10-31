// ==============================================================================
// GUTech Internal LMS - Comprehensive Course Detail & Academic Hub
// Hosts Resources, Assignments, Quizzes, Chat, Announcements, Gradebook & Students
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  BookOpen,
  FileText,
  HelpCircle,
  MessageSquare,
  Bell,
  Award,
  Users,
  Download,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Send,
  Sparkles,
  Timer,
  ChevronRight,
  ExternalLink,
  Pencil,
  ClipboardCheck
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadError } from '../../components/ui/index.js';
import {
  Course,
  Resource,
  Assignment,
  Quiz,
  Announcement,
  ChatMessage
} from '../../types/index.js';
import { api } from '../../lib/api.js';
import { GradingDesk } from '../grading/GradingDesk.js';
import { QuizResultsModal } from '../quizzes/QuizResultsModal.js';
import { QuizBuilderModal } from '../quizzes/QuizBuilderModal.js';
import { GradebookPanel } from './GradebookPanel.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';
import {
  formatDate,
  formatDateTime,
  describeDue,
  formatRelativeTime,
  formatBytes,
  getFileExtension,
  isDeadlinePassed
} from '../../lib/utils.js';

type CourseTab = 'overview' | 'resources' | 'assignments' | 'quizzes' | 'chat' | 'announcements' | 'gradebook' | 'students';

export const CourseDetailPage: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const toast = useToast();
  const [courseError, setCourseError] = useState<string | null>(null);
  const [roster, setRoster] = useState<Array<{ id: string; fullName: string; email: string; rollNo: string | null; isActive: boolean }>>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterReload, setRosterReload] = useState(0);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const requestedTab = searchParams.get('tab');
  const selectedAssignmentId = searchParams.get('assignmentId');
  const [activeTab, setActiveTab] = useState<CourseTab>(() => requestedTab && ['overview', 'resources', 'assignments', 'quizzes', 'chat', 'announcements', 'gradebook', 'students'].includes(requestedTab) ? requestedTab as CourseTab : 'overview');
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  // Resources state
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDesc, setResourceDesc] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [savingResource, setSavingResource] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInst, setAssignInst] = useState('');
  const [assignMarks, setAssignMarks] = useState(100);
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignAllowLate, setAssignAllowLate] = useState(false);

  // Student Assignment Submission state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [studentTextAnswer, setStudentTextAnswer] = useState('');

  // Teacher tools
  const [gradingAssignment, setGradingAssignment] = useState<Assignment | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false);
  const [resultsQuiz, setResultsQuiz] = useState<Quiz | null>(null);
  const [gradebookReload, setGradebookReload] = useState(0);

  // Quizzes state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuizAttempt, setActiveQuizAttempt] = useState<any | null>(null);
  const [quizTimerSeconds, setQuizTimerSeconds] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({});
  const [quizResultScore, setQuizResultScore] = useState<number | null>(null);
  const [quizResultTotal, setQuizResultTotal] = useState<number | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Announcements state
  const [courseAnnouncements, setCourseAnnouncements] = useState<Announcement[]>([]);

  // Gradebook state

  // Students & CSV state
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [csvEnrollModalOpen, setCsvEnrollModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [csvResult, setCsvResult] = useState<any | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (requestedTab && ['overview', 'resources', 'assignments', 'quizzes', 'chat', 'announcements', 'gradebook', 'students'].includes(requestedTab)) setActiveTab(requestedTab as CourseTab);
  }, [requestedTab]);

  useEffect(() => {
    if (activeTab !== 'assignments' || !selectedAssignmentId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`assignment-${selectedAssignmentId}`);
      if (target) {
        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, assignments, selectedAssignmentId]);

  // Deep link from the grading queue / dashboard: ?tab=assignments&assignmentId=X&grade=1 opens that grading desk.
  const autoGradeOpened = useRef<string | null>(null);
  useEffect(() => {
    if (searchParams.get('grade') !== '1' || !selectedAssignmentId || (role !== 'teacher' && role !== 'admin')) return;
    if (autoGradeOpened.current === selectedAssignmentId) return;
    const target = assignments.find(item => item.id === selectedAssignmentId);
    if (!target) return;
    autoGradeOpened.current = selectedAssignmentId;
    setGradingAssignment(target);
  }, [assignments, selectedAssignmentId, role, searchParams]);

  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      setLoading(true);
      setCourseError(null);
      setPartialErrors([]);
      const [detailResult, resourceResult, assignmentResult, quizResult, announcementResult] = await Promise.allSettled([
        api.getCourseDetail(courseId),
        api.getCourseResources(courseId),
        api.getCourseAssignments(courseId),
        api.getCourseQuizzes(courseId),
        api.getAnnouncements(courseId)
      ]);

      if (detailResult.status === 'rejected') {
        setCourse(null);
        setCourseError(errorMessage(detailResult.reason, 'This course could not be loaded.'));
        setLoading(false);
        return;
      }

      const failed: string[] = [];
      const pick = <T,>(result: PromiseSettledResult<T>, label: string, fallback: T): T => {
        if (result.status === 'fulfilled') return result.value;
        failed.push(label);
        return fallback;
      };
      setCourse(detailResult.value);
      setResources(pick(resourceResult, 'resources', []));
      setAssignments(pick(assignmentResult, 'assignments', []));
      setQuizzes(pick(quizResult, 'quizzes', []));
      setCourseAnnouncements(pick(announcementResult, 'announcements', []));
      setPartialErrors(failed);
      setLoading(false);
    };

    void loadData();
  }, [courseId, role, reloadKey]);

  useEffect(() => {
    if (!courseId || activeTab !== 'chat') return;
    api.getChatMessages(courseId).then(setChatMessages).catch(() => setChatMessages([]));
  }, [courseId, activeTab]);

  useEffect(() => {
    if (!courseId || activeTab !== 'students' || (role !== 'teacher' && role !== 'admin')) return;
    let current = true;
    setRosterLoading(true);
    setRosterError(null);
    api.getCourseStudents(courseId)
      .then(list => { if (current) setRoster(list); })
      .catch(error => { if (current) setRosterError(errorMessage(error, 'The roster could not be loaded.')); })
      .finally(() => { if (current) setRosterLoading(false); });
    return () => { current = false; };
  }, [courseId, activeTab, role, rosterReload]);

  const handleUnenroll = async (student: { id: string; fullName: string }) => {
    if (!courseId) return;
    if (!window.confirm(`Unenroll ${student.fullName} from this course? They will lose access to its work and chat.`)) return;
    try {
      await api.unenrollStudent(courseId, student.id);
      setRoster(current => current.filter(item => item.id !== student.id));
      toast.success(`${student.fullName} unenrolled`);
    } catch (error) {
      toast.error('Could not unenroll the student', errorMessage(error));
    }
  };

  // Quiz Timer Countdown effect
  useEffect(() => {
    if (!activeQuizAttempt || quizTimerSeconds <= 0) return;

    const interval = setInterval(() => {
      setQuizTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleQuizAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuizAttempt, quizTimerSeconds]);

  // Handlers for Resources
  const handleUploadResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    if (!resourceFile) {
      toast.error('Choose a file to upload');
      return;
    }
    if (resourceFile.size > 25 * 1024 * 1024) {
      toast.error('File is too large', 'The limit is 25 MB.');
      return;
    }
    setSavingResource(true);
    try {
      const newRes = await api.createResource(courseId, { title: resourceTitle.trim(), description: resourceDesc.trim(), file: resourceFile });
      setResources([newRes, ...resources]);
      setResourceModalOpen(false);
      setResourceTitle('');
      setResourceDesc('');
      setResourceFile(null);
      toast.success('Resource uploaded', newRes.title + ' is available to enrolled students.');
    } catch (error) {
      // Keep the dialog open so the title and file do not have to be chosen again.
      toast.error('Upload failed', errorMessage(error));
    } finally {
      setSavingResource(false);
    }
  };

  const handleDownloadResource = async (resId: string) => {
    try {
      const { downloadUrl } = await api.getResourceDownloadUrl(resId);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch (error) {
      toast.error('Download failed', errorMessage(error));
    }
  };

  const handleDeleteResource = async (resId: string) => {
    if (!window.confirm('Delete this resource? Students will lose access immediately.')) return;
    try {
      await api.deleteResource(resId);
      setResources(resources.filter(r => r.id !== resId));
      toast.success('Resource deleted');
    } catch (error) {
      toast.error('Could not delete the resource', errorMessage(error));
    }
  };

  // Handlers for Assignments
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    if (!(Number(assignMarks) > 0)) {
      toast.error('Maximum marks must be greater than zero');
      return;
    }
    setSavingAssignment(true);
    try {
      const payload = {
        title: assignTitle.trim(),
        instructions: assignInst.trim(),
        maxMarks: Number(assignMarks),
        dueAt: assignDueDate ? new Date(assignDueDate).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
        allowLate: assignAllowLate
      };
      if (editingAssignment) {
        const saved = await api.patchAssignment(editingAssignment.id, payload);
        setAssignments(current => current.map(item => item.id === editingAssignment.id ? { ...item, ...saved } : item));
        toast.success('Assignment updated', 'Students see the new details straight away.');
      } else {
        const created = await api.createAssignment(courseId, payload);
        setAssignments([created, ...assignments]);
        toast.success('Assignment published', created.title + ' is now visible to enrolled students.');
      }
      setAssignModalOpen(false);
      setEditingAssignment(null);
    } catch (error) {
      // Keep the form open with the teacher's input intact so nothing has to be retyped.
      toast.error(editingAssignment ? 'Changes were not saved' : 'Assignment was not saved', errorMessage(error));
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment) return;

    if (!studentTextAnswer.trim()) {
      toast.error('Write your answer before submitting');
      return;
    }
    try {
      const sub = await api.submitAssignment(submittingAssignment.id, studentTextAnswer.trim());
      setAssignments(assignments.map(a => a.id === submittingAssignment.id ? { ...a, mySubmission: sub } : a));
      setSubmitModalOpen(false);
      setStudentTextAnswer('');
      setSubmittingAssignment(null);
      toast.success('Submission received', sub.isLate ? 'It was marked late.' : 'Your teacher can now review it.');
    } catch (error) {
      toast.error('Submission failed', errorMessage(error) + ' Your answer is still in the form.');
    }
  };

  const refreshAssignments = async () => {
    if (!courseId) return;
    try {
      setAssignments(await api.getCourseAssignments(courseId));
    } catch {
      /* counts refresh on the next visit */
    }
  };

  const refreshQuizzes = async () => {
    if (!courseId) return;
    try {
      setQuizzes(await api.getCourseQuizzes(courseId));
    } catch {
      /* counts refresh on the next visit */
    }
  };

  const toLocalInput = (iso: string) => {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const openCreateAssignment = () => {
    setEditingAssignment(null);
    setAssignTitle(''); setAssignInst(''); setAssignMarks(100); setAssignDueDate(''); setAssignAllowLate(false);
    setAssignModalOpen(true);
  };

  const openEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setAssignTitle(assignment.title);
    setAssignInst(assignment.instructions);
    setAssignMarks(assignment.maxMarks);
    setAssignDueDate(toLocalInput(assignment.dueAt));
    setAssignAllowLate(assignment.allowLate);
    setAssignModalOpen(true);
  };

  const handleDeleteAssignment = async (assignment: Assignment) => {
    const submitted = assignment.submissionsCount ?? 0;
    if (!window.confirm(`Delete "${assignment.title}"?${submitted ? ` ${submitted} submission${submitted === 1 ? '' : 's'} and their grades will be permanently removed.` : ''}`)) return;
    try {
      await api.deleteAssignment(assignment.id);
      setAssignments(current => current.filter(item => item.id !== assignment.id));
      toast.success('Assignment deleted');
    } catch (error) {
      toast.error('Could not delete the assignment', errorMessage(error));
    }
  };

  const handleToggleQuizPublished = async (quiz: Quiz) => {
    try {
      const updated = await api.patchQuiz(quiz.id, { isPublished: !quiz.isPublished });
      setQuizzes(current => current.map(item => item.id === quiz.id ? { ...item, isPublished: updated.isPublished } : item));
      toast.success(updated.isPublished ? 'Quiz published' : 'Quiz moved to drafts', updated.isPublished ? 'Students can see it.' : 'Students no longer see it.');
    } catch (error) {
      toast.error('Could not change the quiz', errorMessage(error));
    }
  };

  // Handlers for Quizzes
  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      const attempt = await api.startQuizAttempt(quiz.id);
      setActiveQuizAttempt({ quiz, ...attempt });
      setQuizTimerSeconds(attempt.expiresAt ? Math.max(1, Math.round((Date.parse(attempt.expiresAt) - Date.now()) / 1000)) : attempt.timeLimitMinutes * 60);
      setQuizAnswers({});
      setQuizResultScore(null);
      setQuizResultTotal(null);
    } catch (error) {
      toast.error('Could not start the quiz', errorMessage(error));
    }
  };

  const handleQuizAutoSubmit = async () => {
    if (!activeQuizAttempt) return;
    try {
      const res = await api.submitQuizAttempt(activeQuizAttempt.quiz.id, quizAnswers);
      setQuizResultScore(res.score);
      setQuizResultTotal(res.totalMarks ?? null);
    } catch (error) {
      toast.error('Your quiz could not be submitted', errorMessage(error) + ' Try submitting again.');
    }
  };

  // Handlers for Chat
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !chatInput.trim()) return;

    try {
      const sent = await api.sendChatMessage(courseId, chatInput.trim());
      setChatMessages(current => [...current, sent]);
      setChatInput('');
    } catch (error) {
      // The text stays in the box so it can be sent again.
      toast.error('Message not sent', errorMessage(error));
    }
  };

  // Handlers for Bulk Enrollment
  const handleCsvEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    if (!csvInput.trim()) {
      toast.error('Paste at least one email address');
      return;
    }
    try {
      const res = await api.enrollStudents(courseId, undefined, csvInput);
      setCsvResult(res);
      setRosterReload(key => key + 1);
      toast.success('Enrolment processed', `${res.matched?.length ?? 0} enrolled, ${res.duplicates?.length ?? 0} already enrolled, ${res.unknown?.length ?? 0} unknown.`);
    } catch (error) {
      toast.error('Enrolment failed', errorMessage(error));
    }
  };

  if (courseError) {
    return (
      <div className="space-y-4">
        <Link to="/courses" className="text-xs font-bold text-navy-700 hover:text-navy-950">← Back to courses</Link>
        <LoadError title="This course could not be loaded" message={courseError} onRetry={() => setReloadKey(key => key + 1)} />
      </div>
    );
  }

  if (!course) {
    return <div className="space-y-4" role="status" aria-live="polite"><span className="sr-only">Loading course…</span><div className="skeleton h-40 rounded-3xl" /><div className="skeleton h-64 rounded-2xl" /></div>;
  }

  return (
    <div className="space-y-6">
      {partialErrors.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-amber-900">Some sections could not load: {partialErrors.join(', ')}. What you see may be incomplete.</p>
          <Button size="sm" variant="outline" onClick={() => setReloadKey(key => key + 1)}>Retry</Button>
        </div>
      )}
      {/* Course Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-navy-950 to-navy-800 p-6 sm:p-8 text-white shadow-xl border border-navy-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gold-400 text-navy-950">
                {course.code}
              </span>
              <span className="text-xs text-slate-300">· Academic Term 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{course.title}</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">{course.description}</p>
          </div>

          {/* Quick Chat Shortcut */}
          <button
            onClick={() => setActiveTab('chat')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-gold-400" />
            <span>Classroom Channel</span>
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 sm:gap-2 mt-8 pt-4 border-t border-white/10 overflow-x-auto text-xs font-bold scrollbar-none">
          {[
            { id: 'overview', label: 'Overview', icon: BookOpen },
            { id: 'resources', label: `Resources (${resources.length})`, icon: FileText },
            { id: 'assignments', label: `Assignments (${assignments.length})`, icon: Award },
            { id: 'quizzes', label: `Quizzes (${quizzes.length})`, icon: HelpCircle },
            { id: 'chat', label: 'Class Chat', icon: MessageSquare },
            { id: 'announcements', label: `Notices (${courseAnnouncements.length})`, icon: Bell },
            ...(role === 'teacher' || role === 'admin'
              ? [
                  { id: 'gradebook', label: 'Gradebook', icon: Award },
                  { id: 'students', label: 'Students & Enrollment', icon: Users }
                ]
              : [])
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as CourseTab)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gold-400 text-navy-950 font-extrabold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Curriculum & Course Syllabus</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Welcome to {course.code} ({course.title}). This course follows an industry-aligned curriculum emphasizing modern architecture, security standards, and scalable distributed systems.
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Key Learning Objectives</h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Server-Side Architecture: Layered controllers, services, and repositories</li>
                <li>Database Schema & PostgreSQL Row-Level Security (RLS) enforcement</li>
                <li>Authentication mechanics: JWT tokens, httpOnly sessions, and RBAC</li>
                <li>Real-time event subscriptions and instant notifications</li>
              </ul>
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="text-base font-bold text-navy-900">Instructors</h3>
            <div className="space-y-3">
              {(course.teachers && course.teachers.length > 0) ? course.teachers.map(teacher => (
                <div key={teacher.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <img
                    src={teacher.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(teacher.fullName)}&backgroundColor=4A0F16&textColor=F8B4B8`}
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover ring-2 ring-slate-200"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-navy-900">{teacher.fullName}</p>
                    <p className="truncate text-[11px] text-slate-500">{teacher.email}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500">No instructor has been assigned to this course yet.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: RESOURCES */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-navy-950">Course Lectures & Files</h3>
              <p className="text-xs text-slate-500">Download slides, notes, and datasets</p>
            </div>
            {(role === 'teacher' || role === 'admin') && (
              <Button
                variant="gold"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setResourceModalOpen(true)}
              >
                Upload Resource
              </Button>
            )}
          </div>

          {resources.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="No resources uploaded yet"
              description="Course instructors will publish lecture materials and slides here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources.map(res => (
                <Card key={res.id} className="flex items-start justify-between gap-4 hover:border-navy-300 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                      {getFileExtension(res.fileName)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-navy-900">{res.title}</h4>
                      {res.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{res.description}</p>}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                        <span>{formatBytes(res.sizeBytes)}</span>
                        <span>·</span>
                        <span>{formatDate(res.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadResource(res.id)}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Download
                    </Button>
                    {(role === 'teacher' || role === 'admin') && (
                      <button
                        onClick={() => handleDeleteResource(res.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Delete resource"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-navy-950">Academic Assignments</h3>
              <p className="text-xs text-slate-500">Submit coursework and review evaluation grades</p>
            </div>
            {(role === 'teacher' || role === 'admin') && (
              <Button
                variant="gold"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={openCreateAssignment}
              >
                Create Assignment
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {assignments.map(a => {
              const isPastDue = isDeadlinePassed(a.dueAt);
              const sub = a.mySubmission;
              const isGraded = sub && sub.marksObtained !== null && sub.marksObtained !== undefined;

              return (
                  <Card id={`assignment-${a.id}`} key={a.id} tabIndex={selectedAssignmentId === a.id ? -1 : undefined} className={`scroll-mt-24 transition-[border-color,box-shadow] duration-200 ${selectedAssignmentId === a.id ? 'border-gold-400 ring-2 ring-gold-300 shadow-lg' : 'hover:border-navy-300'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-navy-900">{a.title}</span>
                        {a.allowLate ? (
                          <Badge variant="warning" size="sm">Late Allowed</Badge>
                        ) : (
                          <Badge variant="default" size="sm">Strict Deadline</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{a.instructions}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {role === 'student' ? (
                        sub ? (
                          isGraded ? (
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-emerald-600">
                                {sub.marksObtained} / {a.maxMarks} Marks
                              </span>
                              <Badge variant="success" size="sm" className="ml-2">Graded</Badge>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="navy" size="sm">Submitted (Pending Grade)</Badge>
                              {(!isPastDue || a.allowLate) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSubmittingAssignment(a);
                                    setStudentTextAnswer(sub.textAnswer || '');
                                    setSubmitModalOpen(true);
                                  }}
                                >
                                  Edit submission
                                </Button>
                              )}
                            </div>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant={isPastDue && !a.allowLate ? 'secondary' : 'gold'}
                            disabled={isPastDue && !a.allowLate}
                            onClick={() => {
                              setSubmittingAssignment(a);
                              setSubmitModalOpen(true);
                            }}
                          >
                            {isPastDue && !a.allowLate ? 'Deadline Passed' : 'Submit Work'}
                          </Button>
                        )
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button size="sm" variant="gold" leftIcon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => setGradingAssignment(a)}>
                            {(a.ungradedCount ?? 0) > 0 ? `Grade · ${a.ungradedCount} to do` : `Grade (${a.submissionsCount ?? 0})`}
                          </Button>
                          <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} aria-label={`Edit ${a.title}`} onClick={() => openEditAssignment(a)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" leftIcon={<Trash2 className="h-3.5 w-3.5" />} aria-label={`Delete ${a.title}`} onClick={() => void handleDeleteAssignment(a)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 text-[11px] text-slate-500">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${describeDue(a.dueAt, Boolean(sub)).className}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {describeDue(a.dueAt, Boolean(sub)).label}
                    </span>
                    <span className="font-bold text-navy-900">Total Marks: {a.maxMarks}</span>
                  </div>

                  {sub?.feedback && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                      <span className="font-bold text-navy-900">Instructor Feedback: </span>
                      <span className="text-slate-600">{sub.feedback}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: QUIZZES */}
      {activeTab === 'quizzes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-navy-950">Course Quizzes & Assessments</h3>
              <p className="text-xs text-slate-500">Timed assessments with server-side auto grading</p>
            </div>
            {(role === 'teacher' || role === 'admin') && (
              <Button variant="gold" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setQuizBuilderOpen(true)}>Create quiz</Button>
            )}
          </div>

          {quizzes.length === 0 && (
            <EmptyState icon={<HelpCircle className="h-6 w-6" />} title="No quizzes yet" description={role === 'student' ? 'Quizzes your teacher publishes will appear here.' : 'Create the first quiz for this class.'} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map(q => {
              const myAttempt = q.myAttempt;
              return (
                <Card key={q.id} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-xs font-bold text-navy-900">{q.title}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {role !== 'student' && <Badge variant={q.isPublished ? 'success' : 'warning'} size="sm">{q.isPublished ? 'Published' : 'Draft'}</Badge>}
                        <Badge variant="navy">{q.timeLimitMinutes} Mins</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{q.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {role !== 'student' ? (
                        <span className="text-xs font-semibold text-slate-500">{q.attemptsCount ?? 0} attempt{(q.attemptsCount ?? 0) === 1 ? '' : 's'} · {q.totalMarks ?? 0} marks</span>
                      ) : myAttempt ? (
                        <div className="text-xs font-bold text-emerald-600">
                          Score: {myAttempt.score}{q.totalMarks ? ` / ${q.totalMarks}` : ''} pts (Completed)
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">1 Attempt Allowed</span>
                      )}
                    </div>

                    {role !== 'student' && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => void handleToggleQuizPublished(q)}>{q.isPublished ? 'Unpublish' : 'Publish'}</Button>
                        <Button size="sm" variant="gold" leftIcon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => setResultsQuiz(q)}>Results &amp; marks</Button>
                      </div>
                    )}

                    {role === 'student' && (
                      <Button
                        size="sm"
                        variant={myAttempt ? 'secondary' : 'gold'}
                        disabled={!!myAttempt}
                        onClick={() => handleStartQuiz(q)}
                      >
                        {myAttempt ? 'Attempted' : 'Start Quiz'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: CLASSROOM CHAT */}
      {activeTab === 'chat' && (
        <Card className="p-0 overflow-hidden flex flex-col h-[600px]">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">Class Discussion Feed</h3>
              <p className="text-[10px] text-slate-500">Real-time messaging for students and faculty</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              🟢 Live Channel
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map(msg => {
              const isMine = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
                >
                  <img
                    src={msg.senderAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`}
                    alt={msg.senderName}
                    className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 flex-shrink-0"
                  />
                  <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs shadow-sm ${
                    isMine
                      ? 'bg-navy-900 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold ${isMine ? 'text-gold-400' : 'text-navy-900'}`}>{msg.senderName}</span>
                      <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                        isMine ? 'bg-navy-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {msg.senderRole}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <span className={`block text-[9px] mt-1.5 text-right ${isMine ? 'text-slate-400' : 'text-slate-400'}`}>
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSendChatMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Post a question or comment to the course..."
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
            <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />}>
              Send
            </Button>
          </form>
        </Card>
      )}

      {/* TAB 6: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-navy-950">Course Notices & Announcements</h3>
          <div className="space-y-3">
            {courseAnnouncements.map(ann => (
              <Card key={ann.id} className="hover:border-navy-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-navy-900">{ann.title}</h4>
                  {ann.isPinned && <Badge variant="gold" size="sm">📌 Pinned</Badge>}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{ann.body}</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Posted by: {ann.authorName}</span>
                  <span>{formatDate(ann.createdAt)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: GRADEBOOK (Teacher/Admin only) */}
      {activeTab === 'gradebook' && (role === 'teacher' || role === 'admin') && courseId && (
        <GradebookPanel
          courseId={courseId}
          reloadKey={gradebookReload}
          onOpenColumn={column => {
            if (column.kind === 'quiz') setResultsQuiz(quizzes.find(item => item.id === column.id) || null);
            else setGradingAssignment(assignments.find(item => item.id === column.id) || null);
          }}
        />
      )}

      {/* TAB 8: STUDENTS & ENROLLMENT (Teacher/Admin only) */}
      {activeTab === 'students' && (role === 'teacher' || role === 'admin') && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-950">Course Student Roster</h3>
              <p className="text-xs text-slate-500">Manage enrolled student memberships</p>
            </div>
            {role === 'admin' && (
              <Button
                size="sm"
                variant="gold"
                leftIcon={<FileUp className="w-3.5 h-3.5" />}
                onClick={() => setCsvEnrollModalOpen(true)}
              >
                Bulk CSV Enroll
              </Button>
            )}
          </div>

          {rosterLoading ? (
            <div className="space-y-2" role="status" aria-live="polite"><span className="sr-only">Loading the class roster…</span>{[0, 1, 2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          ) : rosterError ? (
            <LoadError title="The roster could not be loaded" message={rosterError} onRetry={() => setRosterReload(key => key + 1)} />
          ) : roster.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No students enrolled yet" description={role === 'admin' ? 'Use Bulk CSV Enroll to add students by email address.' : 'The administration enrols students into your class.'} />
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">{roster.length} student{roster.length === 1 ? '' : 's'} enrolled</p>
                <div>
                  <label htmlFor="roster-search" className="sr-only">Search the roster</label>
                  <input id="roster-search" type="search" value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Search by name, email or roll number…" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-navy-600 focus:outline-none sm:w-72" />
                </div>
              </div>
              <div className="space-y-2">
                {roster.filter(st => !rosterSearch.trim() || `${st.fullName} ${st.email} ${st.rollNo || ''}`.toLowerCase().includes(rosterSearch.trim().toLowerCase())).map(st => (
                  <div key={st.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-navy-900">{st.fullName}{!st.isActive && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Deactivated</span>}</p>
                      <p className="truncate text-[11px] text-slate-500">{st.email} · <span className="font-mono font-bold text-gold-600">{st.rollNo || '—'}</span></p>
                    </div>
                    {role === 'admin' && (
                      <Button size="sm" variant="ghost" className="shrink-0 text-rose-600 hover:bg-rose-50" aria-label={`Unenroll ${st.fullName}`} onClick={() => handleUnenroll(st)}>
                        Unenroll
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* QUIZ RUNNER MODAL */}
      <Modal
        isOpen={!!activeQuizAttempt}
        onClose={() => {
          if (quizResultScore === null && !window.confirm('Leave this quiz? Your timer keeps running. You can reopen it from the Quizzes tab until time runs out, but your selected answers are not saved.')) return;
          setActiveQuizAttempt(null);
        }}
        title={activeQuizAttempt?.quiz?.title || 'Timed Quiz'}
        maxWidth="xl"
      >
        {activeQuizAttempt && (
          <div className="space-y-6">
            {quizResultScore !== null ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-extrabold text-navy-900">Quiz Submitted & Auto-Graded!</h3>
                <p className="text-sm font-semibold text-slate-600">
                  Your Score: <span className="text-emerald-600 text-lg font-bold">{quizResultScore}{quizResultTotal !== null ? ` / ${quizResultTotal}` : ''} Points</span>
                </p>
                <Button variant="primary" onClick={() => setActiveQuizAttempt(null)}>
                  Close Review
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-amber-700" />
                    <span>Time Remaining:</span>
                  </div>
                  <span className="font-mono text-base text-amber-800">
                    {Math.floor(quizTimerSeconds / 60)}:{(quizTimerSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="space-y-6">
                  {activeQuizAttempt.questions?.map((q: any, idx: number) => (
                    <div key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-extrabold text-navy-900 mb-2">
                        Question {idx + 1} ({q.marks} pts): {q.prompt}
                      </p>
                      {q.type === 'mcq_multi' && <p className="mb-2 text-[11px] font-semibold text-amber-700">Select all that apply</p>}
                      <div className="space-y-2">
                        {q.options?.map((opt: any) => {
                          const selected = quizAnswers[q.id]?.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={Boolean(selected)}
                              onClick={() => {
                                setQuizAnswers(current => {
                                  const chosen = current[q.id] || [];
                                  if (q.type === 'mcq_multi') {
                                    return { ...current, [q.id]: chosen.includes(opt.id) ? chosen.filter(id => id !== opt.id) : [...chosen, opt.id] };
                                  }
                                  return { ...current, [q.id]: [opt.id] };
                                });
                              }}
                              className={`w-full text-left p-3 rounded-xl text-xs font-medium border transition-all ${
                                selected
                                  ? 'bg-navy-900 text-white border-navy-900 font-bold'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {opt.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="gold" className="w-full font-bold" onClick={handleQuizAutoSubmit}>
                  Confirm & Submit Quiz
                </Button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* STUDENT SUBMISSION MODAL */}
      <Modal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title={`Submit: ${submittingAssignment?.title}`}
        subtitle="Submit your coursework solution text or upload archive"
      >
        <form onSubmit={handleStudentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Text Response / Repository Link
            </label>
            <textarea
              value={studentTextAnswer}
              onChange={e => setStudentTextAnswer(e.target.value)}
              placeholder="Paste code summary, explanations, or GitHub repository URL..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs min-h-[120px] focus:outline-none focus:border-navy-600"
              required
            />
          </div>

          <Button type="submit" variant="gold" className="w-full font-bold">
            Submit Assignment
          </Button>
        </form>
      </Modal>

      {/* CREATE ASSIGNMENT MODAL */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={editingAssignment ? 'Edit assignment' : 'Create assignment'}
        subtitle={editingAssignment ? 'Changes apply to everyone immediately. Marks already given are kept.' : 'Enrolled students see it immediately and can submit until the due date'}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <Input label="Title" value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="e.g. Assignment 3: Database design" minLength={3} required />
          <Textarea label="Instructions" value={assignInst} onChange={e => setAssignInst(e.target.value)} placeholder="What should students submit, and how will it be marked?" minLength={5} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Maximum marks" type="number" min={1} step="0.5" value={assignMarks} onChange={e => setAssignMarks(Number(e.target.value))} required />
            <Input label="Due date and time" type="datetime-local" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} helperText="Leave empty for one week from now" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={assignAllowLate} onChange={e => setAssignAllowLate(e.target.checked)} />
            Accept late submissions (they are marked late)
          </label>
          <Button type="submit" variant="gold" className="w-full font-bold" isLoading={savingAssignment}>{editingAssignment ? 'Save changes' : 'Publish assignment'}</Button>
        </form>
      </Modal>

      {/* UPLOAD RESOURCE MODAL */}
      <Modal
        isOpen={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        title="Upload resource"
        subtitle="PDF, Word, PowerPoint, images or ZIP, up to 25 MB"
      >
        <form onSubmit={handleUploadResource} className="space-y-4">
          <Input label="Title" value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} placeholder="e.g. Week 5 lecture slides" minLength={2} required />
          <Textarea label="Description (optional)" value={resourceDesc} onChange={e => setResourceDesc(e.target.value)} placeholder="What is in this file?" />
          <div>
            <label htmlFor="resource-file" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">File</label>
            <input
              id="resource-file"
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
              onChange={e => setResourceFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-slate-200 bg-white text-xs file:mr-3 file:rounded-l-xl file:border-0 file:bg-navy-900 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white"
              required
            />
            {resourceFile && <p className="mt-1 text-xs text-slate-500">{resourceFile.name} · {formatBytes(resourceFile.size)}</p>}
          </div>
          <Button type="submit" variant="gold" className="w-full font-bold" isLoading={savingResource}>Upload</Button>
        </form>
      </Modal>

      {/* TEACHER GRADING DESK */}
      <GradingDesk assignment={gradingAssignment} onClose={() => setGradingAssignment(null)} onGraded={() => { void refreshAssignments(); setGradebookReload(key => key + 1); }} />

      {/* QUIZ TOOLS (teacher) */}
      <QuizBuilderModal isOpen={quizBuilderOpen} courseId={courseId || ''} onClose={() => setQuizBuilderOpen(false)} onCreated={() => void refreshQuizzes()} />
      <QuizResultsModal quiz={resultsQuiz} onClose={() => setResultsQuiz(null)} onChanged={() => { void refreshQuizzes(); setGradebookReload(key => key + 1); }} />

      {/* CSV ENROLL MODAL */}
      <Modal
        isOpen={csvEnrollModalOpen}
        onClose={() => setCsvEnrollModalOpen(false)}
        title="Bulk Student Enrollment via CSV"
        subtitle="Paste a list of student email addresses separated by commas or line breaks"
      >
        <form onSubmit={handleCsvEnroll} className="space-y-4">
          <textarea
            value={csvInput}
            onChange={e => setCsvInput(e.target.value)}
            placeholder="ayesha.siddiqui@gutech.edu.pk&#10;usman.ghani@gutech.edu.pk&#10;hira.malik@gutech.edu.pk"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs min-h-[120px] font-mono focus:outline-none focus:border-navy-600"
            required
          />

          {csvResult && (
            <div className="p-3 rounded-xl bg-slate-100 text-xs space-y-1">
              <p className="font-bold text-navy-900">Enrollment Result:</p>
              <p className="text-emerald-700">Enrolled: {csvResult.matched?.length} students</p>
              {csvResult.duplicates?.length > 0 && <p className="text-amber-700">Already Enrolled: {csvResult.duplicates.length}</p>}
              {csvResult.unknown?.length > 0 && <p className="text-rose-700">Unknown Emails: {csvResult.unknown.length}</p>}
            </div>
          )}

          <Button type="submit" variant="gold" className="w-full font-bold">
            Execute Bulk Enrollment
          </Button>
        </form>
      </Modal>
    </div>
  );
};
