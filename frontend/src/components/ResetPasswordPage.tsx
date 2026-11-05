import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../api';

interface ResetPasswordPageProps {
  token: string;
  onDone: (result: { success?: string }) => void;
}

const inputClass =
  'w-full bg-[#0e1726] border border-[#34435b] rounded-lg p-3 text-sm text-slate-200 focus:border-[#9078f0] outline-none transition-colors';
const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1';

export default function ResetPasswordPage({ token, onDone }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmation) {
      setError('The passwords do not match');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Failed to reset your password');
        return;
      }
      onDone({ success: 'Your password has been updated. Sign in with your new password.' });
    } catch (err) {
      console.error('Reset password error:', err);
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090d18] text-[#eef3ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111a29] border border-[#263248] rounded-[11px] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <img className="brand-icon" src="/favicon-riq.jpg" alt="" width={173} height={170} />
          <h1 className="text-lg font-bold text-white">Choose a new password</h1>
        </div>

        {error && (
          <div role="alert" className="flex items-start space-x-3 border border-amber-800 bg-amber-900/30 rounded-xl p-3 text-sm text-amber-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className={labelClass}>New password</label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className={labelClass}>Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              maxLength={200}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#8068e7] to-[#987ff4] hover:brightness-110 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all shadow-lg"
          >
            {isSubmitting ? 'Please wait...' : 'Update password'}
          </button>
        </form>

        <p className="text-sm text-slate-400 text-center">
          Changed your mind?{' '}
          <button type="button" onClick={() => onDone({})} className="text-[#b7a5ff] hover:text-[#d6ccff] font-medium">
            Back to sign in
          </button>
        </p>
      </div>
    </main>
  );
}
