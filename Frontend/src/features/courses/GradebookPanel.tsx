// Real gradebook for a course: every enrolled student against every assignment and quiz.
// Column headers and "needs grading" cells jump straight to the grading desk / quiz results.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Button, Card, EmptyState, LoadError } from '../../components/ui/index.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';
import { api } from '../../lib/api.js';

interface Column { id: string; title: string; kind: 'assignment' | 'quiz' | string; maxMarks: number }
interface Grade { obtained: number | null; max: number; status: 'graded' | 'submitted' | 'attempted' | 'pending' | string }
interface Row { studentId: string; studentName: string; studentRollNo: string | null; grades: Record<string, Grade>; totalObtained: number; totalMax: number; percentage: number }

const tone = (percent: number) => percent >= 80 ? 'text-emerald-600' : percent >= 60 ? 'text-amber-600' : 'text-rose-600';

export const GradebookPanel: React.FC<{
  courseId: string;
  reloadKey: number;
  onOpenColumn: (column: Column) => void;
}> = ({ courseId, reloadKey, onOpenColumn }) => {
  const toast = useToast();
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCourseGradebook(courseId);
      setColumns(data.columns as Column[]);
      setRows(data.rows as Row[]);
    } catch (reason) {
      setError(errorMessage(reason, 'The gradebook could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => !term || `${row.studentName} ${row.studentRollNo || ''}`.toLowerCase().includes(term));
  }, [rows, search]);

  const download = async () => {
    setDownloading(true);
    try {
      await api.downloadGradebookCsv(courseId);
      toast.success('Gradebook downloaded', 'Open the CSV in Excel.');
    } catch (reason) {
      toast.error('Download failed', errorMessage(reason));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-navy-950">Gradebook</h3>
          <p className="text-xs text-slate-500">Select a column title or a "needs grading" cell to open it. Only graded work counts towards the percentage.</p>
        </div>
        <Button size="sm" variant="outline" leftIcon={<Download className="h-3.5 w-3.5" />} isLoading={downloading} onClick={() => void download()} disabled={loading || rows.length === 0}>Export CSV (Excel)</Button>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite"><span className="sr-only">Loading the gradebook…</span>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
      ) : error ? (
        <LoadError title="The gradebook could not load" message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No students enrolled yet" description="The gradebook fills in once students are enrolled in this class." />
      ) : columns.length === 0 ? (
        <EmptyState title="Nothing to grade yet" description="Create an assignment or a quiz and it appears here as a column." />
      ) : (
        <>
          <div className="relative max-w-xs">
            <label htmlFor="gradebook-search" className="sr-only">Search students</label>
            <input id="gradebook-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or roll no…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100" />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          </div>

          <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
                <tr className="font-bold text-navy-950">
                  <th className="sticky left-0 z-20 min-w-[11rem] bg-slate-50 p-3">Student</th>
                  {columns.map(column => (
                    <th key={column.id} className="min-w-[8rem] p-3">
                      <button type="button" onClick={() => onOpenColumn(column)} className="text-left font-bold text-navy-800 underline-offset-2 hover:underline" title={column.kind === 'quiz' ? 'Open quiz results' : 'Open the grading desk'}>
                        {column.title}
                      </button>
                      <span className="block text-[10px] font-semibold text-slate-400">{column.kind === 'quiz' ? 'Quiz' : 'Assignment'} · {column.maxMarks}</span>
                    </th>
                  ))}
                  <th className="min-w-[6rem] p-3">Total</th>
                  <th className="min-w-[6rem] p-3">Percent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(row => (
                  <tr key={row.studentId} className="hover:bg-slate-50/60">
                    <td className="sticky left-0 z-[1] bg-white p-3"><p className="font-semibold text-navy-900">{row.studentName}</p><p className="font-mono text-[10px] text-slate-400">{row.studentRollNo || '—'}</p></td>
                    {columns.map(column => {
                      const grade = row.grades[column.id];
                      if (grade && grade.obtained !== null) {
                        return <td key={column.id} className={`p-3 font-bold ${tone((grade.obtained / (grade.max || 1)) * 100)}`}>{grade.obtained}</td>;
                      }
                      if (grade && (grade.status === 'submitted' || grade.status === 'attempted')) {
                        return <td key={column.id} className="p-3"><button type="button" onClick={() => onOpenColumn(column)} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-200">Needs grading</button></td>;
                      }
                      return <td key={column.id} className="p-3 text-slate-300">—</td>;
                    })}
                    <td className="p-3 font-extrabold text-navy-900">{row.totalMax ? `${row.totalObtained} / ${row.totalMax}` : '—'}</td>
                    <td className={`p-3 font-extrabold ${row.totalMax ? tone(row.percentage) : 'text-slate-300'}`}>{row.totalMax ? `${row.percentage.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No student matches "{search}".</p>}
          </div>
        </>
      )}
    </Card>
  );
};
