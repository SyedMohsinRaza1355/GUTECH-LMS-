// Landing page for the emailed password-reset link (/reset-password#access_token=...&type=recovery).
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../../components/ui/index.js';
import { api } from '../../lib/api.js';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('access_token');
    return fromHash || searchParams.get('token') || '';
  }, [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least 10 characters with a letter and a number.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError((err as Error)?.message || 'The password could not be reset. Request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-gold-500 to-gold-300 text-navy-950"><GraduationCap className="h-8 w-8" /></div>
          <h1 className="text-xl font-extrabold text-navy-950">Choose a new password</h1>
          <p className="mt-1 text-xs text-slate-500">Ghazali University of Technology</p>
        </div>

        {!token ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" /> This reset link is incomplete</p>
            <p className="mt-1 text-xs">Open the link from your email again, or request a new one from the sign-in page.</p>
            <Link to="/login" className="mt-3 inline-block text-xs font-bold text-navy-800 underline">Back to sign in</Link>
          </div>
        ) : done ? (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Password updated</p>
            <p className="mt-1 text-xs">Taking you to the sign-in page…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
            <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} helperText="At least 10 characters, with a letter and a number" required />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            <Button type="submit" variant="gold" className="w-full font-bold" isLoading={loading}>Update password</Button>
            <Link to="/login" className="block text-center text-xs font-semibold text-navy-700 hover:text-navy-900">Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
};
