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
import { Announcement } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, formatDateTime, formatRelativeTime } from '../../lib/utils.js';

export const AnnouncementsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const focusAnnouncementId = searchParams.get('announcementId');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [targetType, setTargetType] = useState<'global' | 'course'>('global');

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await api.getAnnouncements();
      setAnnouncements(data);
    } catch {
      setAnnouncements([
        {
          id: 'ann-1',
          courseId: null,
          authorId: 'a1',
          title: 'Welcome to GUTech Fall 2026 Academic Term',
          body: 'Welcome students and faculty members. Please ensure you have verified your student credentials and checked course syllabi on the portal.',
          isPinned: true,
          authorName: 'Dr. Farooq Al-Balushi (Administration)',
          courseTitle: 'Global University Notice',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRead: true
        },
        {
          id: 'ann-2',
          courseId: 'c1',
          authorId: 't1',
          title: 'Lab Session 3 Relocated to Room B-204',
          body: 'The upcoming hands-on session on Friday will be held in computer lab B-204 due to server maintenance in Hall A.',
          isPinned: false,
          authorName: 'Prof. Tariq Al-Hinai',
          courseTitle: 'WEB302: Modern Web Technologies',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          isRead: false
        }
      ]);
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

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAnn = await api.createAnnouncement({
      courseId: targetType === 'course' ? 'c0000000-0000-0000-0000-000000000002' : null,
      title,
      body,
      isPinned
    });

    setAnnouncements([newAnn, ...announcements]);
    setModalOpen(false);
    setTitle('');
    setBody('');
    setIsPinned(false);
  };

  const handleMarkRead = async (id: string) => {
    await api.markAnnouncementRead(id);
    setAnnouncements(announcements.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const filtered = announcements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.body.toLowerCase().includes(search.toLowerCase())
  );

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
            onClick={() => setModalOpen(true)}
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
                📚 Course-Specific (WEB302)
              </button>
            </div>
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
