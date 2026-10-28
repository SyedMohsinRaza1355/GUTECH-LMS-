// Teacher / admin work queue: every assignment with submissions waiting to be graded,
// each with a button that jumps straight into the grading desk for that assignment.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, ClipboardCheck, RotateCw, Search, Users, Clock3 } from 'lucide-react';
import { Card, Button, EmptyState } from '../../components/ui/index.js';
import { api } from '../../lib/api.js';
import { GradingQueue } from '../../types/index.js';
import { describeDue, formatRelativeTime } from '../../lib/utils.js';

export const GradingQueuePage: React.FC = () => {
  const [queue, setQueue] = useState<GradingQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setQueue(await api.getGradingQueue());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your grading queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const courses = useMemo(() => [...new Set((queue?.items || []).map(item => item.courseCode))].sort(), [queue]);
  const items = useMemo(() => (queue?.items || []).filter(item =>
    (!course || item.courseCode === course) &&
    (!search.trim() || `${item.title} ${item.courseCode} ${item.courseTitle}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [queue, search, course]);

  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy={loading}>
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"><ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Faculty workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950 sm:text-3xl">Grading queue</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Submissions waiting for marks, oldest first. Open an assignment to jump straight into its grading desk.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-amber-50 px-4 py-3 text-center"><span className="block text-2xl font-extrabold tabular-nums text-amber-700">{loading ? '—' : queue?.summary.ungradedTotal ?? 0}</span><span className="text-xs font-semibold text-slate-500">to grade</span></span>
          <Button variant="outline" size="sm" leftIcon={<RotateCw className="h-4 w-4" aria-hidden="true" />} onClick={() => void load()} disabled={loading}>Refresh</Button>
        </div>
      </header>

      {!loading && !error && (queue?.items.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md">
            <label htmlFor="queue-search" className="sr-only">Search the grading queue</label>
            <input id="queue-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments or courses..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs shadow-sm placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100" />
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <label className="sr-only" htmlFor="queue-course">Filter by course</label>
          <select id="queue-course" value={course} onChange={e => setCourse(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-navy-600 focus:outline-none">
            <option value="">All courses</option>
            {courses.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" role="status" aria-live="polite"><span className="sr-only">Loading your grading queue…</span>{[0, 1, 2].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50/50" role="alert"><p className="font-bold text-rose-900">The grading queue could not load</p><p className="mt-1 text-sm text-rose-800">{error}</p><Button className="mt-4" size="sm" onClick={() => void load()}>Try again</Button></Card>
      ) : (queue?.items.length ?? 0) === 0 ? (
        <Card><EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="You're all caught up" description="Every submitted assignment has been graded. New submissions will appear here." action={<Link to="/courses"><Button size="sm" variant="outline">Go to my classes</Button></Link>} /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<Search className="h-6 w-6" />} title="Nothing matches" description="Try a different search or course filter." action={<Button size="sm" variant="outline" onClick={() => { setSearch(''); setCourse(''); }}>Clear filters</Button>} /></Card>
      ) : (
        <section aria-label="Assignments to grade" className="stagger space-y-3">
          {items.map(item => {
            const due = describeDue(item.dueAt);
            return (
              <Card key={item.assignmentId}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-navy-50 px-2 py-0.5 font-mono text-xs font-bold text-navy-800">{item.courseCode}</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">{item.ungradedCount} to grade</span>
                      {item.lateCount > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">{item.lateCount} late</span>}
                    </div>
                    <h2 className="truncate text-base font-bold text-navy-950">{item.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{item.courseTitle}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{item.gradedCount + item.ungradedCount} of {item.totalStudents} submitted · {item.gradedCount} graded</span>
                      {item.oldestSubmittedAt && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Oldest waiting {formatRelativeTime(item.oldestSubmittedAt)}</span>}
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${due.className}`}>{due.label}</span>
                    </p>
                  </div>
                  <Link
                    to={`/courses/${item.courseId}?tab=assignments&assignmentId=${item.assignmentId}&grade=1`}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2 text-sm font-bold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2"
                  >
                    Grade now <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
};
