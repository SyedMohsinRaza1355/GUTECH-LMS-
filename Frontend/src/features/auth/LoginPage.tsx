// ==============================================================================
// GUTech Internal LMS - Login Page
// Non-negotiable Spec Rule: No sign-up page or link. Internal access only.
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { demoAccounts } from '../../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button, Input, Modal } from '../../components/ui/index.js';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide your GUTech email address and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotModalOpen(false);
      setForgotSuccess(false);
      setForgotEmail('');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* GUTech Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-gold-500 to-gold-400 text-navy-950 shadow-gold-glow mb-4">
            <GraduationCap className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            GUTech <span className="text-gold-400">LMS Portal</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            German University of Technology in Oman · Internal Academic Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 font-medium">
                <p className="font-bold">Authentication Failed</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username or Institutional Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. fatima.student"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                  required
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs font-semibold text-navy-700 hover:text-navy-900 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your secret password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-2.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-md"
              isLoading={loading}
            >
              Sign In to GUTech LMS
            </Button>
          </form>

          {/* Demo account information */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">Demo accounts available</p>
            <p className="mt-2 text-center text-xs text-slate-600">Admin · Teacher · Student</p>
            <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-3 py-2 text-center text-xs font-semibold text-navy-800">Show sample usernames and passwords</summary>
              <div className="max-h-44 overflow-y-auto border-t border-slate-200 divide-y divide-slate-200">
                {demoAccounts.map(({ profile, password }) => (
                  <div key={profile.email} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
                    <span className="min-w-0 truncate text-slate-700"><span className="font-semibold capitalize">{profile.role}</span> · {profile.email.split('@')[0]}</span>
                    <code className="shrink-0 text-slate-500">{password}</code>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Explicit Notice: No public registration */}
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Internal System · Public registration is disabled</span>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 German University of Technology. All rights reserved.
        </p>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Reset Password"
        subtitle="Provide your registered institutional email to request a reset link"
      >
        {forgotSuccess ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium text-center">
            <p className="font-bold">Password Reset Dispatched</p>
            <p className="mt-1">If an account exists with this email address, a password reset link has been dispatched.</p>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <Input
              label="GUTech Email"
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="name@gutech.edu.om"
              required
            />
            <Button type="submit" variant="primary" className="w-full">
              Send Reset Instructions
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
};
