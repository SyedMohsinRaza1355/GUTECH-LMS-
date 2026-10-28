// ==============================================================================
// GUTech Internal LMS - Student "My Marks" Page
// Fulfills Feature 7: Unified student marks from v_student_marks
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  HelpCircle
} from 'lucide-react';
import { Card, Badge, EmptyState } from '../../components/ui/index.js';
import { StudentMarkItem, MarksSummary } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, calculateGradeLetter } from '../../lib/utils.js';
import { errorMessage } from '../../components/ui/Toast.js';
import { LoadError } from '../../components/ui/index.js';

export const MarksPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<StudentMarkItem[]>([]);
  const [summary, setSummary] = useState<MarksSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchMarks = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.getStudentMarks();
        setItems(res.items);
        setSummary(res.summary);
      } catch (err) {
        setLoadError(errorMessage(err, 'Your marks could not be loaded.'));
      } finally {
        setLoading(false);
      }
    };

    fetchMarks();
  }, [user, reloadKey]);

  const gradeInfo = summary && summary.gradedCount > 0 ? calculateGradeLetter(summary.percentage) : { letter: '—', color: 'text-slate-500 bg-slate-50 border-slate-200' };

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">Academic Performance & Gradebook</h1>
        <LoadError title="Your marks could not be loaded" message={loadError} onRetry={() => setReloadKey(key => key + 1)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">Academic Performance & Gradebook</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Unified grade reports for coursework assignments and auto-graded quizzes
        </p>
      </div>

      {/* KPI Overview Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-2xl border ${gradeInfo.color}`}>
              {gradeInfo.letter}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Academic Standing</p>
              <p className="text-xl font-extrabold text-navy-950 mt-0.5">{summary.gradedCount > 0 ? `${summary.percentage}%` : 'No grades yet'}</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Marks Secured</p>
              <p className="text-xl font-extrabold text-navy-950 mt-0.5">
                {summary.totalObtained} <span className="text-xs text-slate-400 font-normal">/ {summary.totalMax}</span>
              </p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Evaluated Items</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{summary.gradedCount} Completed</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Pending Evaluation</p>
              <p className="text-xl font-extrabold text-amber-600 mt-0.5">{summary.pendingCount} Submissions</p>
            </div>
          </Card>
        </div>
      )}

      {/* Progress Bar Visualizer */}
      {summary && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-900">
            <span>Overall Term Completion & Grade Score</span>
            <span className="text-gold-600 font-extrabold">{summary.percentage}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-navy-800 via-navy-700 to-gold-400 transition-all duration-500"
              style={{ width: `${Math.min(summary.percentage, 100)}%` }}
            />
          </div>
        </Card>
      )}

      {/* Itemized Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Itemized Assessment Breakdown</h3>
        </div>

        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Award className="w-6 h-6" />}
              title="No graded assessments available"
              description="Grades will appear here automatically once assignments and quizzes are graded."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-navy-900 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3.5 pl-6">Assessment Title</th>
                  <th className="p-3.5">Course</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Marks Obtained</th>
                  <th className="p-3.5">Maximum</th>
                  <th className="p-3.5">Evaluated Date</th>
                  <th className="p-3.5 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => {
                  const isGraded = item.obtained !== null && item.obtained !== undefined;
                  const itemPct = isGraded ? Math.round((item.obtained! / item.max) * 100) : 0;

                  return (
                    <tr key={`${item.kind}-${item.itemId}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 pl-6 font-bold text-navy-900 flex items-center gap-2.5">
                        {item.kind === 'assignment' ? (
                          <FileText className="w-4 h-4 text-navy-700 flex-shrink-0" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-gold-600 flex-shrink-0" />
                        )}
                        <span>{item.title}</span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-medium">{item.courseTitle || 'WEB302'}</td>
                      <td className="p-3.5 uppercase text-[10px] font-bold text-slate-400">
                        {item.kind}
                      </td>
                      <td className="p-3.5 font-extrabold text-sm">
                        {isGraded ? (
                          <span className="text-emerald-600">{item.obtained}</span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">Pending</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-500 font-semibold">{item.max}</td>
                      <td className="p-3.5 text-slate-400">{formatDate(item.gradedAt)}</td>
                      <td className="p-3.5 pr-6 text-right">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {itemPct}%
                          </span>
                        ) : (
                          <Badge variant="warning" size="sm">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
