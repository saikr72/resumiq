import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { apiFetch, AuthUser } from '../api';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_BUTTON_MAX_WIDTH = 400; // Google's limit

interface LoginPageProps {
  notice?: string;
  success?: string;
  onSignedIn: (user: AuthUser) => void;
}

const inputClass =
  'w-full bg-[#0e1726] border border-[#34435b] rounded-lg p-3 text-sm text-slate-200 focus:border-[#9078f0] outline-none transition-colors';
const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1';

export default function LoginPage({ notice, success, onSignedIn }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [resetRequestedFor, setResetRequestedFor] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showIncomingMessage, setShowIncomingMessage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const postAuth = async (path: string, body: object, fallbackError: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || fallbackError);
        return;
      }
      onSignedIn(data.user);
    } catch (err) {
      console.error('Sign-in error:', err);
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestPasswordReset = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Failed to request a password reset');
        return;
      }
      setResetRequestedFor(email);
    } catch (err) {
      console.error('Password reset request error:', err);
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowIncomingMessage(false);
    if (mode === 'forgot') {
      requestPasswordReset();
    } else if (mode === 'signin') {
      postAuth('/auth/login', { email, password }, 'Failed to sign in');
    } else {
      postAuth('/auth/register', { email, password, fullName }, 'Failed to create account');
    }
  };

  useEffect(() => {
    apiFetch('/auth/config')
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => setGoogleClientId(config?.googleClientId ?? null))
      .catch((err) => console.error('Error loading sign-in options:', err));
  }, []);

  useEffect(() => {
    if (!googleClientId) return;

    let cancelled = false;
    const renderButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (result: { credential: string }) =>
          postAuth('/auth/google', { credential: result.credential }, 'Google sign-in failed'),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: Math.min(googleButtonRef.current.offsetWidth, GOOGLE_BUTTON_MAX_WIDTH),
      });
    };

    if (window.google) {
      renderButton();
    } else {
      const script = document.createElement('script');
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.onload = renderButton;
      script.onerror = () => setError("Google sign-in couldn't be loaded. You can still use your email and password.");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  const switchMode = (next: 'signin' | 'register' | 'forgot') => {
    setMode(next);
    setError('');
    setShowIncomingMessage(false);
    setResetRequestedFor('');
  };

  return (
    <main className="min-h-screen bg-[#090d18] text-[#eef3ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111a29] border border-[#263248] rounded-[11px] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div>
          <h1><img className="brand-logo" src="/logo-riq.jpg" alt="resumIQ" width={501} height={161} /></h1>
          <p className="text-xs text-slate-400 mt-3">
            {mode === 'signin' ? 'Sign in to your account' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        {success && showIncomingMessage && (
          <div role="status" className="flex items-start space-x-3 border border-emerald-800 bg-emerald-900/30 rounded-xl p-3 text-sm text-emerald-200">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {(error || (notice && showIncomingMessage)) && (
          <div role="alert" className="flex items-start space-x-3 border border-amber-800 bg-amber-900/30 rounded-xl p-3 text-sm text-amber-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <span>{error || notice}</span>
          </div>
        )}

        {/* Hidden rather than removed, so Google's button doesn't need rendering again */}
        {googleClientId && (
          <div className={mode === 'forgot' ? 'hidden' : 'space-y-6'}>
            {/* Google's iframe page is light, and a dark color-scheme here would paint it an opaque white background */}
            <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" style={{ colorScheme: 'light' }} />
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <div className="flex-1 border-t border-slate-800" />
              <span>or</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>
          </div>
        )}

        {resetRequestedFor && (
          <div role="status" className="flex items-start space-x-3 border border-emerald-800 bg-emerald-900/30 rounded-xl p-3 text-sm text-emerald-200">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <span>If an account exists for {resetRequestedFor}, we've sent a link to reset the password. It expires in 1 hour.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="fullName" className={labelClass}>Name</label>
              <input
                id="fullName"
                value={fullName}
                maxLength={100}
                autoComplete="name"
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          {mode !== 'forgot' && (
          <div>
            <div className="flex justify-between items-baseline">
              <label htmlFor="password" className={labelClass}>Password</label>
              {mode === 'signin' && (
                <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-[#b7a5ff] hover:text-[#d6ccff] font-medium">
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={200}
              value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {mode === 'register' && <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>}
          </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#8068e7] to-[#987ff4] hover:brightness-110 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all shadow-lg"
          >
            {isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <p className="text-sm text-slate-400 text-center">
          {mode === 'signin' ? "Don't have an account?" : mode === 'register' ? 'Already have an account?' : 'Remembered it?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'register' : 'signin')}
            className="text-[#b7a5ff] hover:text-[#d6ccff] font-medium"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}
