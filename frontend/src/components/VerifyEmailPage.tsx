import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { apiFetch, AuthUser } from '../api';

interface VerifyEmailPageProps {
  user: AuthUser;
  notice?: string;
  onCheckAgain: () => void;
  onLogout: () => void;
}

export default function VerifyEmailPage({ user, notice, onCheckAgain, onLogout }: VerifyEmailPageProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const resend = async () => {
    setMessage(null);
    setIsSending(true);
    try {
      const response = await apiFetch('/auth/resend-verification', { method: 'POST' });
      const data = await response.json().catch(() => null);
      setMessage(
        response.ok
          ? { type: 'success', text: `We've sent a new link to ${user.email}.` }
          : { type: 'error', text: data?.error || 'Failed to send the email. Please try again.' }
      );
    } catch (err) {
      console.error('Resend verification error:', err);
      setMessage({ type: 'error', text: "We couldn't reach the server. Please try again." });
    } finally {
      setIsSending(false);
    }
  };

  const error = message ? (message.type === 'error' ? message.text : undefined) : notice;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Verify your email</h1>
        </div>

        <p className="text-sm text-slate-300">
          We sent a link to <span className="font-semibold text-white break-all">{user.email}</span>. Open it to start using your account. It expires in 24 hours.
        </p>

        {message?.type === 'success' && (
          <div role="status" className="flex items-start space-x-3 border border-emerald-800 bg-emerald-900/30 rounded-xl p-3 text-sm text-emerald-200">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <span>{message.text}</span>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start space-x-3 border border-amber-800 bg-amber-900/30 rounded-xl p-3 text-sm text-amber-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <button onClick={onCheckAgain} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
            I've verified my email
          </button>
          <button
            onClick={resend}
            disabled={isSending}
            className="w-full border border-slate-700 hover:border-slate-500 disabled:opacity-50 text-slate-200 font-medium py-3 rounded-xl transition-all"
          >
            {isSending ? 'Sending...' : 'Send a new link'}
          </button>
        </div>

        <p className="text-sm text-slate-400 text-center">
          Wrong account?{' '}
          <button onClick={onLogout} className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign out
          </button>
        </p>
      </div>
    </main>
  );
}
