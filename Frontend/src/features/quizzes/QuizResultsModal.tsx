// Teacher view of a quiz: every attempt with its score, the answer key against the student's
// answers, and the ability to correct a score (partial credit, appeals, mistakes).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Button, Modal, EmptyState, LoadError } from '../../components/ui/index.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';
import { api } from '../../lib/api.js';
import { Quiz } from '../../types/index.js';
import { formatDateTime } from '../../lib/utils.js';

interface ReviewQuestion {
  id: string;
  position: number;
  type: 'mcq_single' | 'mcq_multi' | 'true_false';
  prompt: string;
  options: Array<{ id: string; text: string }>;
  marks: number;
  correctOptionIds: string[];
}

interface Attempt {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  score: number | null;
  totalMarks: number;
  submittedAt?: string | null;
  answers: Record<string, string[]>;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(item => b.includes(item));

export const QuizResultsModal: React.FC<{ quiz: Quiz | null; onClose: () => void; onChanged?: () => void }> = ({ quiz, onClose, onChanged }) => {
  const toast = useToast();
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!quiz) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await api.getQuizResults(quiz.id)) as unknown as { questions: ReviewQuestion[]; results: Attempt[] };
      setQuestions(data.questions || []);
      setAttempts((data.results || []).filter(result => result.submittedAt));
    } catch (reason) {
      setError(errorMessage(reason, 'Quiz results could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [quiz]);

  useEffect(() => {
    setOpenId(null);
    setSearch('');
    setAttempts([]);
    if (quiz) void load();
  }, [quiz?.id, load]);

  const total = useMemo(() => questions.reduce((sum, q) => sum + q.marks, 0), [questions]);
  const autoScore = (attempt: Attempt) => questions.reduce((sum, q) => sum + (sameSet(attempt.answers?.[q.id] || [], q.correctOptionIds) ? q.marks : 0), 0);
  const stats = useMemo(() => {
    const scored = attempts.filter(a => a.score !== null).map(a => a.score as number);
    return { count: attempts.length, average: scored.length ? scored.reduce((s, v) => s + v, 0) / scored.length : null, high: scored.length ? Math.max(...scored) : null, low: scored.length ? Math.min(...scored) : null };
  }, [attempts]);
  const visible = attempts.filter(a => !search.trim() || `${a.studentName} ${a.studentRollNo}`.toLowerCase().includes(search.trim().toLowerCase()));

  const open = (attempt: Attempt) => {
    if (openId === attempt.attemptId) { setOpenId(null); return; }
    setOpenId(attempt.attemptId);
    setScore(attempt.score === null ? '' : String(attempt.score));
    setNote('');
    setFieldError('');
  };

  const save = async (attempt: Attempt) => {
    const value = Number(score);
    if (score.trim() === '' || Number.isNaN(value) || value < 0 || value > total) {
      setFieldError(`Enter a score between 0 and ${total}.`);
      return;
    }
    setSaving(true);
    try {
      await api.updateQuizAttemptScore(quiz!.id, attempt.attemptId, value, note.trim() || undefined);
      setAttempts(current => current.map(a => a.attemptId === attempt.attemptId ? { ...a, score: value } : a));
      toast.success(`${attempt.studentName}: ${value} / ${total} saved`, 'The student sees the updated score.');
      setOpenId(null);
      onChanged?.();
    } catch (reason) {
      setFieldError(errorMessage(reason));
      toast.error('Score was not saved', errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(quiz)} onClose={onClose} title={quiz ? `Results: ${quiz.title}` : 'Results'} subtitle={quiz ? `Out of ${total || quiz.totalMarks || 0} marks` : undefined} maxWidth="2xl">
      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite"><span className="sr-only">Loading results…</span>{[0, 1, 2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : error ? (
        <LoadError title="Results could not load" message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['Attempts', String(stats.count)], ['Average', stats.average === null ? '—' : stats.average.toFixed(1)], ['Highest', stats.high === null ? '—' : String(stats.high)], ['Lowest', stats.low === null ? '—' : String(stats.low)]].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-2.5"><p className="text-lg font-extrabold text-navy-900">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p></div>
            ))}
          </div>

          {attempts.length > 6 && (
            <div className="relative">
              <label htmlFor="quiz-results-search" className="sr-only">Search students</label>
              <input id="quiz-results-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or roll no…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100" />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </div>
          )}

          {attempts.length === 0 ? (
            <EmptyState title="No attempts yet" description="Scores appear here as students submit the quiz." />
          ) : visible.length === 0 ? (
            <EmptyState title="No student matches" description={`Nothing matches "${search}".`} />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {visible.map(attempt => {
                const isOpen = openId === attempt.attemptId;
                const auto = autoScore(attempt);
                return (
                  <li key={attempt.attemptId} className={isOpen ? 'bg-gold-50/40' : ''}>
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-navy-900">{attempt.studentName}</p>
                        <p className="truncate font-mono text-[10px] text-slate-400">{attempt.studentRollNo}{attempt.submittedAt ? ` · ${formatDateTime(attempt.submittedAt)}` : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-extrabold text-emerald-600">{attempt.score ?? '—'} / {total}</span>
                        {attempt.score !== null && attempt.score !== auto && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" title={`Auto-graded score was ${auto}`}>edited</span>}
                        <Button size="sm" variant="outline" aria-expanded={isOpen} onClick={() => open(attempt)} leftIcon={isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}>
                          {isOpen ? 'Close' : 'Review & edit'}
                        </Button>
                      </div>
                    </div>

                    {isOpen && (
                      <form className="space-y-4 border-t border-slate-200/70 bg-white p-4" onSubmit={e => { e.preventDefault(); void save(attempt); }}>
                        <div className="space-y-3">
                          {questions.map((q, index) => {
                            const chosen = attempt.answers?.[q.id] || [];
                            const right = sameSet(chosen, q.correctOptionIds);
                            return (
                              <div key={q.id} className="rounded-xl border border-slate-200 p-3">
                                <p className="mb-2 flex items-start justify-between gap-2 text-xs font-bold text-navy-900">
                                  <span>{index + 1}. {q.prompt}</span>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${right ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{right ? q.marks : 0} / {q.marks}</span>
                                </p>
                                <ul className="space-y-1">
                                  {q.options.map(option => {
                                    const isRight = q.correctOptionIds.includes(option.id);
                                    const picked = chosen.includes(option.id);
                                    return (
                                      <li key={option.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${isRight ? 'bg-emerald-50 text-emerald-900' : picked ? 'bg-rose-50 text-rose-900' : 'text-slate-600'}`}>
                                        {isRight ? <Check className="h-3.5 w-3.5 shrink-0" aria-label="Correct answer" /> : picked ? <X className="h-3.5 w-3.5 shrink-0" aria-label="Wrong answer chosen" /> : <span className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="flex-1">{option.text}</span>
                                        {picked && <span className="text-[10px] font-bold uppercase tracking-wide">student</span>}
                                      </li>
                                    );
                                  })}
                                </ul>
                                {chosen.length === 0 && <p className="mt-1 text-[11px] font-semibold text-slate-400">No answer given</p>}
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[9rem,1fr]">
                          <div>
                            <label htmlFor={`score-${attempt.attemptId}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Score (0 – {total})</label>
                            <input id={`score-${attempt.attemptId}`} type="number" inputMode="decimal" min={0} max={total} step="0.5" autoFocus value={score} onChange={e => { setScore(e.target.value); setFieldError(''); }} aria-invalid={Boolean(fieldError)} className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${fieldError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-navy-600 focus:ring-navy-100'}`} />
                            <button type="button" onClick={() => { setScore(String(auto)); setFieldError(''); }} className="mt-1.5 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Use auto score ({auto})</button>
                          </div>
                          <div>
                            <label htmlFor={`note-${attempt.attemptId}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">Reason (kept in the audit history)</label>
                            <input id={`note-${attempt.attemptId}`} type="text" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. partial credit for question 3" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100" />
                          </div>
                        </div>
                        {fieldError && <p role="alert" className="text-xs font-semibold text-rose-700">{fieldError}</p>}
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" variant="primary" isLoading={saving}>Save score</Button>
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
