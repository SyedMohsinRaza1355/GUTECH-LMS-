// ==============================================================================
// GUTech Internal LMS - Announcements Feed & Broadcasts
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  Bell,
  Plus,
  Pin,
  CheckCircle,
  Calendar,
  Sparkles,
  Search
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState } from '../../components/ui/index.js';
import { LoadError } from '../../components/ui/index.js';
import { errorMessage, useToast } from '../../components/ui/Toast.js';
import { Announcement, Course } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, formatDateTime, formatRelativeTime } from '../../lib/utils.js';

export const AnnouncementsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const focusAnnouncementId = searchParams.get('announcementId');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const toast = useToast();
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [targetCourseId, setTargetCourseId] = useState('');
  const [posting, setPosting] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [targetType, setTargetType] = useState<'global' | 'course'>(role === 'admin' ? 'global' : 'course');

  const fetchAnnouncements = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setLoadError(errorMessage(err, 'Announcements could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (loading || !focusAnnouncementId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`announcement-${focusAnnouncementId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, announcements, focusAnnouncementId]);

  const openPostModal = async () => {
    setModalOpen(true);
    if (myCourses.length) return;
    try {
      const list = role === 'admin' ? await api.getAllCoursesAdmin() : await api.getMyCourses();
      const active = list.filter(course => !course.isArchived);
      setMyCourses(active);
      if (active.length) setTargetCourseId(current => current || active[0].id);
    } catch (error) {
      toast.error('Your classes could not be loaded', errorMessage(error));
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === 'course' && !targetCourseId) {
      toast.error('Choose a class for this announcement');
      return;
    }
    setPosting(true);
    try {
      const newAnn = await api.createAnnouncement({
        courseId: targetType === 'course' ? targetCourseId : null,
        title,
        body,
        isPinned
      });
      const targetCourse = myCourses.find(course => course.id === targetCourseId);
      setAnnouncements([{ ...newAnn, courseTitle: newAnn.courseTitle || (targetType === 'course' && targetCourse ? `${targetCourse.code}: ${targetCourse.title}` : null), isRead: true } as Announcement, ...announcements]);
      setModalOpen(false);
      setTitle('');
      setBody('');
      setIsPinned(false);
      toast.success('Announcement posted');
    } catch (error) {
      // Keep the form open and filled in so the author can retry.
      toast.error('Announcement was not posted', errorMessage(error));
    } finally {
      setPosting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markAnnouncementRead(id);
      setAnnouncements(announcements.map(a => a.id === id ? { ...a, isRead: true } : a));
    } catch (error) {
      toast.error('Could not mark as read', errorMessage(error));
    }
  };

  const filtered = announcements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.body.toLowerCase().includes(search.toLowerCase())
  );

  if (loadError) {
    return <LoadError title="Announcements could not be loaded" message={loadError} onRetry={() => void fetchAnnouncements()} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">University Announcements</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Campus bulletins, schedule alterations, and official course notices
          </p>
        </div>

        {(role === 'admin' || role === 'teacher') && (
          <Button
            variant="gold"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => void openPostModal()}
          >
            Post Announcement
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notices..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100 shadow-sm"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
      </div>

      {/* Announcements Feed */}
      {loading ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <span className="sr-only">Loading announcements…</span>
          {[0, 1].map(item => <Card key={item} className="space-y-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" /><div className="h-16 animate-pulse rounded bg-slate-50" /></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="No notices found"
          description="All clear! No announcements match your current filter."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map(ann => (
            <Card
              key={ann.id}
              id={`announcement-${ann.id}`}
              tabIndex={focusAnnouncementId === ann.id ? -1 : undefined}
              className={`transition-[border-color,box-shadow] hover:border-navy-300 hover:shadow-md ${focusAnnouncementId === ann.id ? 'border-gold-400 ring-2 ring-gold-300/70' : ''} ${
                ann.isPinned ? 'border-gold-300/80 bg-gradient-to-r from-white via-white to-gold-50/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {ann.isPinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-gold-400 text-navy-950 uppercase tracking-wider">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}
                    <span className="text-xs font-bold text-navy-800">
                      {ann.courseTitle || 'Global Notice'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-navy-950">{ann.title}</h3>
                </div>

                {!ann.isRead && (
                  <button
                    onClick={() => handleMarkRead(ann.id)}
                    className="p-1.5 text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Mark as read"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-600 mt-3 leading-relaxed whitespace-pre-wrap">{ann.body}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>By: <strong className="text-slate-700">{ann.authorName || 'Academic Staff'}</strong></span>
                <span>{formatDateTime(ann.createdAt)} ({formatRelativeTime(ann.createdAt)})</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Post Announcement Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Broadcast Announcement"
        subtitle="Publish a formal notice to student dashboards"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
          <Input
            label="Announcement Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Schedule Update or Exam Guidelines"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Target Audience
            </label>
            <div className="grid grid-cols-2 gap-2">
              {role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setTargetType('global')}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                    targetType === 'global' ? 'bg-navy-900 text-white border-navy-900' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  🌐 Entire University (Global)
                </button>
              )}
              <button
                type="button"
                onClick={() => setTargetType('course')}
                className={`p-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                  targetType === 'course' ? 'bg-navy-900 text-white border-navy-900' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                📚 Specific Class
              </button>
            </div>
            {targetType === 'course' && (
              <div className="mt-2">
                <label htmlFor="announcement-course" className="sr-only">Class</label>
                <select id="announcement-course" value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold focus:border-navy-600 focus:outline-none">
                  {myCourses.length === 0 && <option value="">No classes available</option>}
                  {myCourses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
                </select>
              </div>
            )}
          </div>

          <Textarea
            label="Notice Message Content"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write announcement body..."
            required
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pinToggle"
              checked={isPinned}
              onChange={e => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded text-navy-800 focus:ring-navy-600"
            />
            <label htmlFor="pinToggle" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
              Pin notice to top of feed
            </label>
          </div>

          <Button type="submit" variant="gold" className="w-full font-bold">
            Publish Notice
          </Button>
        </form>
      </Modal>
    </div>
  );
};
