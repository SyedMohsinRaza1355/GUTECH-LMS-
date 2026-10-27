import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CheckCircle2, Clock3, FileText, RotateCw } from 'lucide-react';
import { Card, Button, EmptyState } from '../../components/ui/index.js';
import { api } from '../../lib/api.js';
import { PendingTask } from '../../types/index.js';
import { formatDateTime } from '../../lib/utils.js';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      setTasks(await api.getPendingTasks());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your pending work.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTasks(); }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-enter" aria-busy={loading}>
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"><Clock3 className="h-4 w-4" aria-hidden="true" /> Student workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950 sm:text-3xl">Pending work</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Assignments you have not submitted yet. Open a task to jump directly to its course and submission form.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-navy-50 px-4 py-3 text-center"><span className="block text-2xl font-extrabold tabular-nums text-navy-900">{loading ? '—' : tasks.length}</span><span className="text-xs font-semibold text-slate-500">to complete</span></span>
          <Button variant="outline" size="sm" leftIcon={<RotateCw className="h-4 w-4" aria-hidden="true" />} onClick={() => void loadTasks()} disabled={loading}>Refresh</Button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3" role="status" aria-live="polite"><span className="sr-only">Loading your tasks…</span>{[0, 1, 2].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50/50" role="alert"><p className="font-bold text-rose-900">Tasks could not load</p><p className="mt-1 text-sm text-rose-800">{error}</p><Button className="mt-4" size="sm" onClick={() => void loadTasks()}>Try again</Button></Card>
      ) : tasks.length === 0 ? (
        <Card><EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="You’re all caught up" description="There are no unsubmitted assignments in your courses right now." /></Card>
      ) : (
        <section aria-label="Assignments to complete" className="space-y-3">
          {tasks.map(task => (
            <Card key={task.id} className={`group transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-lg ${task.isOverdue ? 'border-rose-200' : ''}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${task.isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}><FileText className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-navy-50 px-2 py-0.5 font-mono text-xs font-bold text-navy-800">{task.courseCode}</span>
                      {task.isOverdue ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">Overdue</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Pending</span>}
                    </div>
                    <h2 className="truncate text-base font-bold text-navy-950">{task.title}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />{task.courseTitle}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{task.instructions}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <div className="text-left sm:text-right"><p className={`text-xs font-semibold ${task.isOverdue ? 'text-rose-700' : 'text-slate-600'}`}>Due {formatDateTime(task.dueAt)}</p><p className="mt-1 text-xs text-slate-500">{task.maxMarks} marks{task.allowLate ? ' · late work accepted' : ''}</p></div>
                  <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 py-2 text-sm font-bold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2" to={`/courses/${task.courseId}?tab=assignments&assignmentId=${task.id}`}>
                    Open task <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};
