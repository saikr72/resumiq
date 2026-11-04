import React, { useEffect, useState } from 'react';
import App from '../App';
import { apiFetch, AuthUser, SESSION_EXPIRED_EVENT } from '../api';
import LoginPage from './LoginPage';

type AuthState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'signed-out'; notice?: string }
  | { status: 'signed-in'; user: AuthUser };

export default function AuthGate() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  const loadSession = async () => {
    setAuth({ status: 'loading' });
    try {
      const response = await apiFetch('/auth/me');
      if (!response.ok) throw new Error('Failed to check session');
      const { user } = await response.json();
      setAuth(user ? { status: 'signed-in', user } : { status: 'signed-out' });
    } catch (error) {
      console.error('Error checking session:', error);
      setAuth({ status: 'error' });
    }
  };

  useEffect(() => {
    loadSession();

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

  if (auth.status === 'signed-in') {
    return <App user={auth.user} onLogout={handleLogout} />;
  }
  if (auth.status === 'signed-out') {
    return <LoginPage notice={auth.notice} onSignedIn={(user) => setAuth({ status: 'signed-in', user })} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col items-center justify-center space-y-4 p-4 text-center">
      {auth.status === 'loading' ? (
        <p>Loading...</p>
      ) : (
        <>
          <p>We couldn't reach the server.</p>
          <button onClick={loadSession} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition-all">
            Try again
          </button>
        </>
      )}
    </div>
  );
}
