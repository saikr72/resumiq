import React, { useEffect, useRef, useState } from 'react';
import App from '../App';
import { apiFetch, AuthUser, SESSION_EXPIRED_EVENT } from '../api';
import LoginPage from './LoginPage';
import ResetPasswordPage from './ResetPasswordPage';
import VerifyEmailPage from './VerifyEmailPage';

type AuthState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'signed-out'; notice?: string; success?: string }
  | { status: 'unverified'; user: AuthUser; notice?: string }
  | { status: 'signed-in'; user: AuthUser }
  | { status: 'reset-password'; token: string };

// Reads an emailed link once at startup, then removes the token from the address bar and history
function takeEmailLink(): { type: 'verify-email' | 'reset-password'; token: string } | null {
  const match = window.location.hash.match(/^#(verify-email|reset-password)=([\w-]+)$/);
  if (!match) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return { type: match[1] as 'verify-email' | 'reset-password', token: match[2] };
}

const emailLink = takeEmailLink();

export default function AuthGate() {
  const [auth, setAuth] = useState<AuthState>(
    emailLink?.type === 'reset-password' ? { status: 'reset-password', token: emailLink.token } : { status: 'loading' }
  );
  const verifyStarted = useRef(false);

  const loadSession = async (messages: { notice?: string; success?: string } = {}) => {
    setAuth({ status: 'loading' });
    try {
      const response = await apiFetch('/auth/me');
      if (!response.ok) throw new Error('Failed to check session');
      const { user } = await response.json();
      if (!user) {
        setAuth({ status: 'signed-out', ...messages });
      } else if (user.emailVerified) {
        setAuth({ status: 'signed-in', user });
      } else {
        setAuth({ status: 'unverified', user, notice: messages.notice });
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setAuth({ status: 'error' });
    }
  };

  const redeemVerifyLink = async (token: string) => {
    let messages: { notice?: string; success?: string };
    try {
      const response = await apiFetch('/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => null);
      messages = response.ok
        ? { success: 'Your email is verified. Sign in to continue.' }
        : { notice: data?.error || 'We could not verify your email.' };
    } catch (error) {
      console.error('Error verifying email:', error);
      messages = { notice: "We couldn't reach the server. Please open the link again." };
    }
    await loadSession(messages);
  };

  useEffect(() => {
    // The token is single-use, and React runs effects twice in development
    if (!verifyStarted.current) {
      verifyStarted.current = true;
      if (emailLink?.type === 'verify-email') {
        redeemVerifyLink(emailLink.token);
      } else if (emailLink?.type !== 'reset-password') {
        loadSession();
      }
    }

    const handleExpired = () => setAuth({ status: 'signed-out', notice: 'Your session has ended. Please sign in again.' });
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const handleLogout = async () => {
    try {
      const response = await apiFetch('/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
      setAuth({ status: 'signed-out' });
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const handleSignedIn = (user: AuthUser) => {
    setAuth(user.emailVerified ? { status: 'signed-in', user } : { status: 'unverified', user });
  };

  if (auth.status === 'signed-in') {
    return <App user={auth.user} onLogout={handleLogout} />;
  }
  if (auth.status === 'unverified') {
    return <VerifyEmailPage user={auth.user} notice={auth.notice} onCheckAgain={() => loadSession()} onLogout={handleLogout} />;
  }
  if (auth.status === 'reset-password') {
    return <ResetPasswordPage token={auth.token} onDone={(result) => loadSession(result)} />;
  }
  if (auth.status === 'signed-out') {
    return <LoginPage notice={auth.notice} success={auth.success} onSignedIn={handleSignedIn} />;
  }

  return (
    <div className="min-h-screen bg-[#090d18] text-[#91a0b7] flex flex-col items-center justify-center space-y-4 p-4 text-center">
      {auth.status === 'loading' ? (
        <p>Loading...</p>
      ) : (
        <>
          <p>We couldn't reach the server.</p>
          <button onClick={() => loadSession()} className="bg-gradient-to-r from-[#8068e7] to-[#987ff4] hover:brightness-110 text-white font-medium px-5 py-2.5 rounded-lg transition-all">
            Try again
          </button>
        </>
      )}
    </div>
  );
}
