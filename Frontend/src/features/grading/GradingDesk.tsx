// Teacher grading desk for one assignment.
// Each student's marks form opens inline under their own row (never off-screen), with
// filters and search for large classes and "Save & next" to move through ungraded work.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, Search, Users } from 'lucide-react';
import { Button, Modal, EmptyState, LoadError } from '../../components/ui/index.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';
import { api } from '../../lib/api.js';
import { Assignment, Submission } from '../../types/index.js';
import { formatDateTime } from '../../lib/utils.js';

interface Row {
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRollNo: string;
  isSubmitted: boolean;
  submission: Submission | null;
}

type Filter = 'needs' | 'graded' | 'missing' | 'all';

interface Props {
  assignment: Assignment | null;
  onClose: () => void;
  /** Called after any grade is saved so the course page can refresh its counts. */
  onGraded?: () => void;
}

const hasMarks = (row: Row) => row.submission?.marksObtained !== null && row.submission?.marksObtained !== undefined;

export const GradingDesk: React.FC<Props> = ({ assignment, onClose, onGraded }) => {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('needs');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const max = assignment?.maxMarks ?? 0;

  const load = useCallback(async () => {
    if (!assignment) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAssignmentSubmissions(assignment.id);
      setRows(data.submissions as Row[]);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not load student submissions.'));
    } finally {
      setLoading(false);
    }
  }, [assignment]);

  useEffect(() => {
    setRows([]);
    setOpenId(null);
    setFilter('needs');
    setSearch('');
    if (assignment) void load();
  }, [assignment?.id, load]);

  const counts = useMemo(() => ({
    submitted: rows.filter(r => r.isSubmitted).length,
    needs: rows.filter(r => r.isSubmitted && !hasMarks(r)).length,
    graded: rows.filter(r => r.isSubmitted && hasMarks(r)).length,
    missing: rows.filter(r => !r.isSubmitted).length
  }), [rows]);

  // Default to whatever is useful: if nothing needs grading, show the graded work instead of an empty list.
  useEffect(() => {
    if (!loading && rows.length && filter === 'needs' && counts.needs === 0) setFilter(counts.graded ? 'graded' : 'all');
  }, [loading, rows.length, counts.needs, counts.graded]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'needs' && !(r.isSubmitted && !hasMarks(r))) return false;
      if (filter === 'graded' && !(r.isSubmitted && hasMarks(r))) return false;
      if (filter === 'missing' && r.isSubmitted) return false;
      return !term || `${r.studentName} ${r.studentRollNo} ${r.studentEmail}`.toLowerCase().includes(term);
    });
  }, [rows, filter, search]);

  const openRow = (row: Row) => {
    if (openId === row.studentId) {
      setOpenId(null);
      return;
    }
    setOpenId(row.studentId);
    setMarks(hasMarks(row) ? String(row.submission?.marksObtained) : '');
    setFeedback(row.submission?.feedback || '');
    setFieldError('');
    window.requestAnimationFrame(() => rowRefs.current[row.studentId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  const save = async (row: Row, thenNext: boolean) => {
    if (!row.submission) return;
    const value = Number(marks);
    if (marks.trim() === '' || Number.isNaN(value) || value < 0 || value > max) {
      setFieldError(`Enter marks between 0 and ${max}.`);
      return;
    }
    setFieldError('');
    setSaving(true);
    try {
      const updated = await api.gradeSubmission(row.submission.id, value, feedback.trim());
      const nextRows = rows.map(r => r.studentId === row.studentId ? { ...r, submission: { ...(r.submission as Submission), ...updated } } : r);
      setRows(nextRows);
      toast.success(`${row.studentName}: ${value} / ${max} saved`, 'Visible to the student now.');
      onGraded?.();
      if (thenNext) {
        const next = nextRows.find(r => r.isSubmitted && !hasMarks(r) && r.studentId !== row.studentId);
        if (next) {
          setFilter('needs');
          openRow({ ...next });
          return;
        }
        toast.info('All submissions are graded');
      }
      setOpenId(null);
    } catch (reason) {
      // Marks and feedback stay in the form so the teacher can retry.
      setFieldError(errorMessage(reason));
      toast.error('Grade was not saved', errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const tab = (id: Filter, label: string, n: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={filter === id}
      onClick={() => setFilter(id)}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filter === id ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:text-navy-900'}`}
    >
      {label} <span className={filter === id ? 'text-navy-700' : 'text-slate-400'}>{n}</span>
    </button>
  );

  return (
    <Modal
      isOpen={Boolean(assignment)}
      onClose={onClose}
      title={assignment ? `Grading: ${assignment.title}` : 'Grading'}
      subtitle={assignment ? `Out of ${max} marks` : undefined}
      maxWidth="2xl"
    >
      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite"><span className="sr-only">Loading enrolled students…</span>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : error ? (
        <LoadError title="Submissions could not load" message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-lg font-extrabold text-navy-900">{counts.submitted}<span className="text-xs font-semibold text-slate-400"> / {rows.length}</span></p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Submitted</p></div>
            <div className="rounded-xl bg-amber-50 p-2.5"><p className="text-lg font-extrabold text-amber-700">{counts.needs}</p><p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Need grading</p></div>
            <div className="rounded-xl bg-emerald-50 p-2.5"><p className="text-lg font-extrabold text-emerald-700">{counts.graded}</p><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Graded</p></div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Filter submissions" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
              {tab('needs', 'Need grading', counts.needs)}
              {tab('graded', 'Graded', counts.graded)}
              {tab('missing', 'Not submitted', counts.missing)}
              {tab('all', 'All', rows.length)}
            </div>
            <div className="relative sm:w-56">
              <label htmlFor="grading-search" className="sr-only">Search students</label>
              <input id="grading-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or roll no…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100" />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={filter === 'needs' ? <CheckCircle2 className="h-6 w-6" /> : <Users className="h-6 w-6" />}
              title={filter === 'needs' ? 'Nothing left to grade' : 'No students here'}
              description={search ? `No student matches "${search}".` : filter === 'needs' ? 'Every submitted piece of work has marks.' : 'Try another filter.'}
            />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {visible.map(row => {
                const open = openId === row.studentId;
                const graded = hasMarks(row);
                return (
                  <li key={row.studentId} ref={el => { rowRefs.current[row.studentId] = el as HTMLDivElement | null; }} className={open ? 'bg-gold-50/40' : ''}>
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-navy-900">{row.studentName}</p>
                        <p className="truncate font-mono text-[10px] text-slate-400">{row.studentRollNo}{row.submission?.isLate ? ' · late' : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!row.isSubmitted ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Not submitted</span>
                        ) : graded ? (
                          <span className="text-xs font-extrabold text-emerald-600">{row.submission?.marksObtained} / {max}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-600"><Clock3 className="h-3 w-3" aria-hidden="true" />Needs grading</span>
                        )}
                        {row.isSubmitted && (
                          <Button size="sm" variant={graded ? 'outline' : 'gold'} aria-expanded={open} onClick={() => openRow(row)} leftIcon={open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}>
                            {open ? 'Close' : graded ? 'Edit' : 'Grade'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {open && row.submission && (
                      <form
                        className="space-y-3 border-t border-slate-200/70 bg-white p-4"
                        onSubmit={e => { e.preventDefault(); void save(row, false); }}
                      >
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Submitted {formatDateTime(row.submission.submittedAt)}{row.submission.isLate ? ' · LATE' : ''}</p>
                          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap">{row.submission.textAnswer || 'No written answer was provided.'}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[9rem,1fr]">
                          <div>
                            <label htmlFor={`marks-${row.studentId}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Marks (0 – {max})</label>
                            <input
                              id={`marks-${row.studentId}`}
                              type="number" inputMode="decimal" min={0} max={max} step="0.5" autoFocus
                              value={marks}
                              onChange={e => { setMarks(e.target.value); setFieldError(''); }}
                              aria-invalid={Boolean(fieldError)}
                              className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${fieldError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-navy-600 focus:ring-navy-100'}`}
                            />
                            <div className="mt-1.5 flex gap-1.5">
                              <button type="button" onClick={() => { setMarks(String(max)); setFieldError(''); }} className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Full</button>
                              <button type="button" onClick={() => { setMarks('0'); setFieldError(''); }} className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Zero</button>
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`feedback-${row.studentId}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Feedback for the student</label>
                            <textarea
                              id={`feedback-${row.studentId}`} rows={3} maxLength={1000} value={feedback} onChange={e => setFeedback(e.target.value)}
                              placeholder="What went well, what to improve…"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100"
                            />
                          </div>
                        </div>
                        {fieldError && <p role="alert" className="text-xs font-semibold text-rose-700">{fieldError}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="submit" size="sm" variant="primary" isLoading={saving}>Save grade</Button>
                          {!graded || counts.needs > 1 ? (
                            <Button type="button" size="sm" variant="gold" disabled={saving} onClick={() => void save(row, true)}>Save &amp; next</Button>
                          ) : null}
                          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setOpenId(null)}>Cancel</Button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
};
