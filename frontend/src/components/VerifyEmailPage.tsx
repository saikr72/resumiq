import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
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
    <main className="min-h-screen bg-[#090d18] text-[#eef3ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111a29] border border-[#263248] rounded-[11px] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <span className="brand-mark">R</span>
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
          <button onClick={onCheckAgain} className="w-full bg-gradient-to-r from-[#8068e7] to-[#987ff4] hover:brightness-110 text-white font-bold py-3 rounded-lg transition-all shadow-lg">
            I've verified my email
          </button>
          <button
            onClick={resend}
            disabled={isSending}
            className="w-full border border-slate-700 hover:border-slate-500 disabled:opacity-50 text-slate-200 font-medium py-3 rounded-lg transition-all"
          >
            {isSending ? 'Sending...' : 'Send a new link'}
          </button>
        </div>

        <p className="text-sm text-slate-400 text-center">
          Wrong account?{' '}
          <button onClick={onLogout} className="text-[#b7a5ff] hover:text-[#d6ccff] font-medium">
            Sign out
          </button>
        </p>
      </div>
    </main>
  );
}
