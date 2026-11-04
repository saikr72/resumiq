export const API_BASE = 'http://localhost:5000/api';

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
}

// Sends the session cookie on every request, and reports when the session has ended
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  if (response.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return response;
}
