// ==============================================================================
// GUTech Internal LMS - Grievance & Complaints Portal
// Fulfills Feature 9: Register, track, and resolve academic/facility complaints
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  LifeBuoy,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldAlert,
  Send,
  Building
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Textarea, ComplaintBadge, EmptyState } from '../../components/ui/index.js';
import { LoadError } from '../../components/ui/index.js';
import { errorMessage } from '../../components/ui/Toast.js';
import { Complaint, ComplaintStatus } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, formatDateTime } from '../../lib/utils.js';

export const ComplaintsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // User Submission Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [category, setCategory] = useState<'academic' | 'technical' | 'facility' | 'conduct' | 'other'>('academic');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [courseChoice, setCourseChoice] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Admin Response Modal
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [adminStatus, setAdminStatus] = useState<ComplaintStatus>('resolved');
  const [adminResponseText, setAdminResponseText] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const fetchComplaints = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = role === 'admin' ? await api.getAdminComplaints() : await api.getMyComplaints();
      setComplaints(data);
    } catch (err) {
      setLoadError(errorMessage(err, 'Your complaints could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [role]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (description.trim().length < 15) {
      setCreateError('Please provide at least 15 characters describing the issue in detail.');
      return;
    }

    setCreateLoading(true);
    try {
      const created = await api.createComplaint({
        category,
        subject,
        description,
        courseId: courseChoice || null
      });

      setComplaints([created, ...complaints]);
      setCreateModalOpen(false);
      setSubject('');
      setDescription('');
    } catch (err: unknown) {
      setCreateError((err as Error)?.message || 'Failed to submit complaint');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAdminRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setAdminError(null);

    if ((adminStatus === 'resolved' || adminStatus === 'rejected') && !adminResponseText.trim()) {
      setAdminError('An official administrative response is mandatory when resolving or rejecting a ticket.');
      return;
    }

    setAdminLoading(true);
    try {
      const updated = await api.respondComplaint(selectedComplaint.id, adminStatus, adminResponseText);
      setComplaints(complaints.map(c => c.id === selectedComplaint.id ? updated : c));
      setAdminModalOpen(false);
      setSelectedComplaint(null);
    } catch (err: unknown) {
      setAdminError((err as Error)?.message || 'Failed to update ticket');
    } finally {
      setAdminLoading(false);
    }
  };

  if (loadError) {
    return <LoadError title="Complaints could not be loaded" message={loadError} onRetry={() => void fetchComplaints()} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
            {role === 'admin' ? 'University Grievance Resolution Desk' : 'Student & Faculty Grievance Desk'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit formal inquiries, academic appeals, or campus technical issues
          </p>
        </div>

        {role !== 'admin' && (
          <Button
            variant="gold"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Register Complaint
          </Button>
        )}
      </div>

      {/* Complaints List */}
      {complaints.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="w-6 h-6" />}
          title="No grievances on record"
          description="You currently have no active or historical complaints lodged in the system."
        />
      ) : (
        <div className="space-y-4">
          {complaints.map(c => (
            <Card key={c.id} className="hover:border-navy-300 transition-all space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ComplaintBadge status={c.status} />
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                    {c.category}
                  </span>
                  {c.courseTitle && (
                    <span className="text-xs text-slate-500 font-medium">· {c.courseTitle}</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">Filed {formatDate(c.createdAt)}</span>
                  {role === 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedComplaint(c);
                        setAdminStatus(c.status);
                        setAdminResponseText(c.adminResponse || '');
                        setAdminModalOpen(true);
                      }}
                    >
                      Process Ticket
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-navy-950">{c.subject}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.description}</p>
              </div>

              {/* Administrative Response Drawer */}
              {c.adminResponse && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Official University Response:</span>
                  </div>
                  <p className="text-emerald-900 leading-relaxed pl-5">{c.adminResponse}</p>
                  <p className="text-[10px] text-emerald-700/80 pl-5 pt-1">
                    Resolved by Office of Student Affairs on {formatDate(c.updatedAt)}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Student/Teacher Create Complaint Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="File Formal Grievance"
        subtitle="Submit your issue directly to University Administration"
      >
        {createError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {createError}
          </div>
        )}

        <form onSubmit={handleCreateComplaint} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Grievance Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-navy-600"
            >
              <option value="academic">Academic (Grading, Curriculum, Extensions)</option>
              <option value="technical">Technical (Portal, Network, Software)</option>
              <option value="facility">Facility (Classrooms, Labs, Hardware)</option>
              <option value="conduct">Conduct & Student Life</option>
              <option value="other">General Other</option>
            </select>
          </div>

          <Input
            label="Subject Summary"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Request for lab projector repair"
            required
          />

          <Textarea
            label="Detailed Description (min 15 characters)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Provide context, dates, and relevant details..."
            required
          />

          <Button type="submit" variant="gold" className="w-full font-bold" isLoading={createLoading}>
            Submit Grievance Ticket
          </Button>
        </form>
      </Modal>

      {/* Admin Review & Response Modal */}
      <Modal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        title={`Process Ticket: ${selectedComplaint?.subject}`}
        subtitle={`Submitted by ${selectedComplaint?.raisedByName || 'Student'}`}
      >
        {adminError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {adminError}
          </div>
        )}

        <form onSubmit={handleAdminRespond} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Updated Status
            </label>
            <select
              value={adminStatus}
              onChange={e => setAdminStatus(e.target.value as ComplaintStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-navy-600 font-bold"
            >
              <option value="open">🟡 Open</option>
              <option value="in_review">🔵 In Review</option>
              <option value="resolved">🟢 Resolved</option>
              <option value="rejected">🔴 Rejected</option>
            </select>
          </div>

          <Textarea
            label="Official Response (Required when resolving or rejecting)"
            value={adminResponseText}
            onChange={e => setAdminResponseText(e.target.value)}
            placeholder="Document administrative findings, actions taken, or reason for denial..."
            required={adminStatus === 'resolved' || adminStatus === 'rejected'}
          />

          <Button type="submit" variant="primary" className="w-full font-bold" isLoading={adminLoading}>
            Save Official Resolution
          </Button>
        </form>
      </Modal>
    </div>
  );
};
