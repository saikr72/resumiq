import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
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
  onSignedIn: (user: AuthUser) => void;
}

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors';
const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1';

export default function LoginPage({ notice, onSignedIn }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
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

  const switchMode = () => {
    setMode(mode === 'signin' ? 'register' : 'signin');
    setError('');
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Resume Intelligence Platform</h1>
            <p className="text-xs text-slate-400">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>
        </div>

        {(error || notice) && (
          <div role="alert" className="flex items-start space-x-3 border border-amber-800 bg-amber-900/30 rounded-xl p-3 text-sm text-amber-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <span>{error || notice}</span>
          </div>
        )}

        {googleClientId && (
          <>
            <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" />
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <div className="flex-1 border-t border-slate-800" />
              <span>or</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>
          </>
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
          <div>
            <label htmlFor="password" className={labelClass}>Password</label>
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
          >
            {isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-slate-400 text-center">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={switchMode} className="text-indigo-400 hover:text-indigo-300 font-medium">
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}
