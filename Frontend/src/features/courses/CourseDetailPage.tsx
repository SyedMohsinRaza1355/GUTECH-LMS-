// ==============================================================================
// GUTech Internal LMS - Comprehensive Course Detail & Academic Hub
// Hosts Resources, Assignments, Quizzes, Chat, Announcements, Gradebook & Students
// ==============================================================================

import React, { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, EmptyState } from '../../components/ui/index.js';
import {
  Course,
  Resource,
  Assignment,
  Quiz,
  Announcement,
  ChatMessage
} from '../../types/index.js';
import { api } from '../../lib/api.js';
import {
  formatDate,
  formatDateTime,
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

  // Teacher Grading Desk state
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [activeAssignmentForGrading, setActiveAssignmentForGrading] = useState<Assignment | null>(null);
  const [gradingSubmissions, setGradingSubmissions] = useState<any[]>([]);
  const [loadingGradingAssignmentId, setLoadingGradingAssignmentId] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState('');
  const [selectedSubForGrading, setSelectedSubForGrading] = useState<any | null>(null);
  const [gradingMarksInput, setGradingMarksInput] = useState<number>(0);
  const [gradingFeedbackInput, setGradingFeedbackInput] = useState<string>('');

  // Quizzes state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuizAttempt, setActiveQuizAttempt] = useState<any | null>(null);
  const [quizTimerSeconds, setQuizTimerSeconds] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({});
  const [quizResultScore, setQuizResultScore] = useState<number | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Announcements state
  const [courseAnnouncements, setCourseAnnouncements] = useState<Announcement[]>([]);

  // Gradebook state
  const [gradebookData, setGradebookData] = useState<{ columns: any[]; rows: any[] } | null>(null);

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

  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [cDetail, rList, aList, qList, annList] = await Promise.all([
          api.getCourseDetail(courseId).catch(() => ({
            id: courseId,
            code: 'WEB302',
            title: 'Modern Web Technologies',
            description: 'Full-stack application architecture using React, Node.js, and Supabase.',
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            studentsCount: 4
          })),
          api.getCourseResources(courseId).catch(() => []),
          api.getCourseAssignments(courseId).catch(() => []),
          api.getCourseQuizzes(courseId).catch(() => []),
          api.getAnnouncements(courseId).catch(() => [])
        ]);

        setCourse(cDetail);
        setResources(rList);
        setAssignments(aList);
        setQuizzes(qList);
        setCourseAnnouncements(annList);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [courseId, role]);

  useEffect(() => {
    if (!courseId || activeTab !== 'chat') return;
    api.getChatMessages(courseId).then(setChatMessages).catch(() => setChatMessages([]));
  }, [courseId, activeTab]);

  useEffect(() => {
    if (!courseId || activeTab !== 'gradebook' || (role !== 'teacher' && role !== 'admin')) return;
    api.getCourseGradebook(courseId).then(setGradebookData).catch(() => setGradebookData(null));
  }, [courseId, activeTab, role]);

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

    const newRes = await api.createResource(courseId, {
      title: resourceTitle,
      description: resourceDesc,
      fileName: 'lecture_notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2500000
    });

    setResources([newRes, ...resources]);
    setResourceModalOpen(false);
    setResourceTitle('');
    setResourceDesc('');
  };

  const handleDownloadResource = async (resId: string) => {
    const { downloadUrl } = await api.getResourceDownloadUrl(resId);
    window.open(downloadUrl, '_blank');
  };

  const handleDeleteResource = async (resId: string) => {
    await api.deleteResource(resId);
    setResources(resources.filter(r => r.id !== resId));
  };

  // Handlers for Assignments
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    const newAssign = await api.createAssignment(courseId, {
      title: assignTitle,
      instructions: assignInst,
      maxMarks: Number(assignMarks),
      dueAt: assignDueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      allowLate: assignAllowLate
    });

    setAssignments([newAssign, ...assignments]);
    setAssignModalOpen(false);
    setAssignTitle('');
    setAssignInst('');
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment) return;

    const sub = await api.submitAssignment(submittingAssignment.id, studentTextAnswer, 'submissions/student_work.pdf');
    setAssignments(assignments.map(a => a.id === submittingAssignment.id ? { ...a, mySubmission: sub } : a));
    setSubmitModalOpen(false);
    setStudentTextAnswer('');
    setSubmittingAssignment(null);
  };

  const handleOpenGradingDesk = async (assign: Assignment) => {
    setActiveAssignmentForGrading(assign);
    setGradeModalOpen(true);
    setGradingError('');
    setGradingSubmissions([]);
    setLoadingGradingAssignmentId(assign.id);
    try {
      const data = await api.getAssignmentSubmissions(assign.id);
      setGradingSubmissions(data.submissions);
    } catch (error) {
      setGradingError(error instanceof Error ? error.message : 'Could not load student submissions.');
    } finally {
      setLoadingGradingAssignmentId(null);
    }
  };

  const handleSaveGrade = async (subId: string) => {
    const updated = await api.gradeSubmission(subId, gradingMarksInput, gradingFeedbackInput);
    setGradingSubmissions(gradingSubmissions.map(s => s.submission?.id === subId ? { ...s, submission: updated } : s));
    setSelectedSubForGrading(null);
  };

  // Handlers for Quizzes
  const handleStartQuiz = async (quiz: Quiz) => {
    const attempt = await api.startQuizAttempt(quiz.id);
    setActiveQuizAttempt({ quiz, ...attempt });
    setQuizTimerSeconds(attempt.timeLimitMinutes * 60);
    setQuizAnswers({});
    setQuizResultScore(null);
  };

  const handleQuizAutoSubmit = async () => {
    if (!activeQuizAttempt) return;
    const res = await api.submitQuizAttempt(activeQuizAttempt.quiz.id, quizAnswers);
    setQuizResultScore(res.score);
  };

  // Handlers for Chat
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !chatInput.trim()) return;

    const sent = await api.sendChatMessage(courseId, chatInput.trim());
    setChatMessages([...chatMessages, sent]);
    setChatInput('');
  };

  // Handlers for Bulk Enrollment
  const handleCsvEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    const res = await api.enrollStudents(courseId, undefined, csvInput);
    setCsvResult(res);
  };

  if (!course) return null;

  return (
    <div className="space-y-6">
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
            <h3 className="text-base font-bold text-navy-900">Instructors & Office Hours</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
                  alt="Faculty"
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-200"
                />
                <div>
                  <p className="text-xs font-bold text-navy-900">Prof. Tariq Al-Hinai</p>
                  <p className="text-[11px] text-slate-500">Department of Computer Science</p>
                </div>
              </div>
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
                onClick={() => setAssignModalOpen(true)}
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
                            <Badge variant="navy" size="sm">Submitted (Pending Grade)</Badge>
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingGradingAssignmentId !== null}
                          onClick={() => handleOpenGradingDesk(a)}
                        >
                          {loadingGradingAssignmentId === a.id ? 'Loading submissions…' : `Grading Desk (${a.submissionsCount ?? 0})`}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Due: {formatDateTime(a.dueAt)}
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map(q => {
              const myAttempt = q.myAttempt;
              return (
                <Card key={q.id} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-navy-900">{q.title}</span>
                      <Badge variant="navy">{q.timeLimitMinutes} Mins</Badge>
                    </div>
                    <p className="text-xs text-slate-500">{q.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {myAttempt ? (
                        <div className="text-xs font-bold text-emerald-600">
                          Score: {myAttempt.score} pts (Completed)
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">1 Attempt Allowed</span>
                      )}
                    </div>

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
      {activeTab === 'gradebook' && (role === 'teacher' || role === 'admin') && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-navy-950">Official Assessment Gradebook</h3>
              <p className="text-xs text-slate-500">Student matrix with calculated totals and percentages</p>
            </div>
            <a
              href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/courses/${courseId}/gradebook.csv`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV (Excel)</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-navy-950 font-bold">
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Roll No</th>
                  <th className="p-3">Assignment 1 (100)</th>
                  <th className="p-3">Quiz 1 (20)</th>
                  <th className="p-3">Total / 120</th>
                  <th className="p-3">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/60">
                  <td className="p-3 font-semibold text-navy-900">Fatima Al-Zadjali</td>
                  <td className="p-3 font-mono text-slate-500">GUT-2023-0142</td>
                  <td className="p-3 font-bold text-emerald-600">95.00</td>
                  <td className="p-3 font-bold text-emerald-600">20.00</td>
                  <td className="p-3 font-extrabold text-navy-900">115.00</td>
                  <td className="p-3 font-extrabold text-emerald-600">95.83%</td>
                </tr>
                <tr className="hover:bg-slate-50/60">
                  <td className="p-3 font-semibold text-navy-900">Fatima Al-Zadjali</td>
                  <td className="p-3 font-mono text-slate-500">GUT-2023-0189</td>
                  <td className="p-3 font-bold text-emerald-600">88.00</td>
                  <td className="p-3 text-slate-400">Pending</td>
                  <td className="p-3 font-extrabold text-navy-900">88.00</td>
                  <td className="p-3 font-extrabold text-navy-900">88.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
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

          <div className="space-y-2">
            {[
              { id: '1', name: 'Fatima Al-Zadjali', email: 'fatima.student@gutech.edu.om', roll: 'GUT-2023-0101' },
              { id: '2', name: 'Fatima Al-Zadjali', email: 'fatima.zadjali@gutech.edu.om', roll: 'GUT-2023-0189' },
              { id: '3', name: 'Ali Al-Lawati', email: 'ali.lawati@gutech.edu.om', roll: 'GUT-2023-0205' },
              { id: '4', name: 'Maryam Al-Kiyumi', email: 'maryam.kiyumi@gutech.edu.om', roll: 'GUT-2023-0311' }
            ].map(st => (
              <div key={st.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-navy-900">{st.name}</p>
                  <p className="text-[11px] text-slate-500">{st.email} · <span className="font-mono text-gold-600 font-bold">{st.roll}</span></p>
                </div>
                {role === 'admin' && (
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50">
                    Unenroll
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* QUIZ RUNNER MODAL */}
      <Modal
        isOpen={!!activeQuizAttempt}
        onClose={() => setActiveQuizAttempt(null)}
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
                  Your Score: <span className="text-emerald-600 text-lg font-bold">{quizResultScore} Points</span>
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
                      <div className="space-y-2">
                        {q.options?.map((opt: any) => {
                          const selected = quizAnswers[q.id]?.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setQuizAnswers({
                                  ...quizAnswers,
                                  [q.id]: [opt.id]
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

      {/* TEACHER GRADING DESK MODAL */}
      <Modal
        isOpen={gradeModalOpen}
        onClose={() => setGradeModalOpen(false)}
        title={`Grading Desk: ${activeAssignmentForGrading?.title}`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Student submissions awaiting review and marking:</p>
          {loadingGradingAssignmentId ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600" role="status" aria-live="polite">Loading enrolled student submissions…</div>
          ) : gradingError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert"><p className="text-sm font-semibold text-rose-900">Submissions could not load</p><p className="mt-1 text-xs text-rose-800">{gradingError}</p><Button size="sm" className="mt-3" onClick={() => activeAssignmentForGrading && void handleOpenGradingDesk(activeAssignmentForGrading)}>Try again</Button></div>
          ) : gradingSubmissions.filter(st => st.isSubmitted && st.submission).length === 0 ? (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="No submissions yet" description="Students have not submitted work for this assignment." />
          ) : (
          <div className="divide-y divide-slate-100">
            {gradingSubmissions.filter(st => st.isSubmitted && st.submission).map(st => (
              <div key={st.studentId} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-navy-900">{st.studentName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{st.studentRollNo}</p>
                  {st.submission?.textAnswer && (
                    <p className="text-[11px] text-slate-600 mt-1 italic line-clamp-1">"{st.submission.textAnswer}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {st.submission?.marksObtained !== null && st.submission?.marksObtained !== undefined ? (
                    <span className="text-xs font-bold text-emerald-600">{st.submission.marksObtained} pts</span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedSubForGrading(st.submission);
                      setGradingMarksInput(st.submission?.marksObtained || 90);
                      setGradingFeedbackInput(st.submission?.feedback || 'Good work!');
                    }}
                  >
                    Grade
                  </Button>
                </div>
              </div>
            ))}
          </div>
          )}

          {selectedSubForGrading && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 mt-4">
              <h4 className="text-xs font-bold text-navy-900 uppercase">Award Marks</h4>
              <Input
                label={`Marks (0 - ${activeAssignmentForGrading?.maxMarks})`}
                type="number"
                value={gradingMarksInput}
                onChange={e => setGradingMarksInput(Number(e.target.value))}
              />
              <Input
                label="Instructor Feedback"
                value={gradingFeedbackInput}
                onChange={e => setGradingFeedbackInput(e.target.value)}
              />
              <Button size="sm" variant="gold" onClick={() => handleSaveGrade(selectedSubForGrading.id)}>
                Save Grade & Feedback
              </Button>
            </div>
          )}
        </div>
      </Modal>

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
            placeholder="fatima.student@gutech.edu.om&#10;ali.student@gutech.edu.om&#10;maryam.student@gutech.edu.om"
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
