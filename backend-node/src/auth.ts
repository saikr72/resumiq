import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import pool, { query } from './db';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SESSION_COOKIE = 'ri_session';
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// OWASP's recommended scrypt cost
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024, keylen: 64 };

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200; // Bounds the work done per hashing request

const INVALID_CREDENTIALS = 'Incorrect email or password';

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N, r, p, maxmem: SCRYPT.maxmem }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !hash) return false;

  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), Number(N), Number(r), Number(p), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  };
}

async function startSession(res: Response, userId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  await query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= CURRENT_TIMESTAMP', [userId]);
  await query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    userId,
    hashToken(token),
    new Date(Date.now() + SESSION_MS),
  ]);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS });
}

function toAuthUser(row: { id: string; email: string; full_name: string | null }): AuthUser {
  return { id: row.id, email: row.email, fullName: row.full_name };
}

async function getSessionUser(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || !token) return null;

  const result = await query(
    `SELECT u.id, u.email, u.full_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)]
  );
  return result.rows[0] ? toAuthUser(result.rows[0]) : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = user;
    next();
  } catch (error: any) {
    console.error('Auth Error:', error.message);
    res.status(500).json({ error: 'Failed to check authentication' });
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

const limitMessage = { error: 'Too many attempts. Please try again later.' };

// Only failed attempts count, so normal sign-ins never lock anyone out
const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage,
});

const authRouter = Router();

authRouter.get('/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Returns 200 when signed out, because that is a normal state for the app to load in
authRouter.get('/me', async (req, res) => {
  try {
    res.json({ user: await getSessionUser(req) });
  } catch (error: any) {
    console.error('Get Session Error:', error.message);
    res.status(500).json({ error: 'Failed to check authentication' });
  }
});

authRouter.post('/register', registerLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password, fullName } = req.body ?? {};
    const name = typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null;

    if (!email) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters` });
    }
    if (name && name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
    }

    const result = await query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, full_name`,
      [email, await hashPassword(password), name]
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    }

    await startSession(res, result.rows[0].id);
    res.status(201).json({ user: toAuthUser(result.rows[0]) });
  } catch (error: any) {
    console.error('Register Error:', error.message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

authRouter.post('/login', signInLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body ?? {};

    if (!email || typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    const result = await query('SELECT id, email, full_name, password_hash FROM users WHERE email = $1', [email]);
    const row = result.rows[0];

    if (!row?.password_hash) {
      // Do the same work as a real check, so timing doesn't reveal which emails exist
      await hashPassword(password);
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }
    if (!(await verifyPassword(password, row.password_hash))) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    await startSession(res, row.id);
    res.json({ user: toAuthUser(row) });
  } catch (error: any) {
    console.error('Login Error:', error.message);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

/**
 * Finds or creates the user for a verified Google identity.
 *
 * Registration does not verify email ownership, so a password account with this
 * email may have been created by someone else ahead of the real owner. Google
 * has verified the owner, so linking removes the password and ends existing
 * sessions, which locks out anyone who pre-registered the address.
 */
async function resolveGoogleUser(googleId: string, email: string, name: string | null): Promise<AuthUser | 'conflict'> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const byGoogle = await client.query('SELECT id, email, full_name FROM users WHERE google_id = $1', [googleId]);
    let row = byGoogle.rows[0];

    if (!row) {
      const byEmail = await client.query('SELECT id, google_id FROM users WHERE email = $1 FOR UPDATE', [email]);
      const existing = byEmail.rows[0];

      if (existing?.google_id) {
        await client.query('ROLLBACK');
        return 'conflict';
      }

      if (existing) {
        const linked = await client.query(
          `UPDATE users
           SET google_id = $1, password_hash = NULL, full_name = COALESCE(full_name, $2), updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING id, email, full_name`,
          [googleId, name, existing.id]
        );
        await client.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
        row = linked.rows[0];
      } else {
        const created = await client.query(
          'INSERT INTO users (email, google_id, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name',
          [email, googleId, name]
        );
        row = created.rows[0];
      }
    }

    await client.query('COMMIT');
    return toAuthUser(row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

authRouter.post('/google', signInLimiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const { credential } = req.body ?? {};
  if (typeof credential !== 'string' || !credential) {
    return res.status(401).json({ error: 'Google sign-in failed' });
  }

  let payload;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Google sign-in failed' });
  }

  const email = normalizeEmail(payload?.email);
  if (!payload?.sub || !email || payload.email_verified !== true) {
    return res.status(401).json({ error: 'Your Google account email must be verified' });
  }

  try {
    const user = await resolveGoogleUser(payload.sub, email, payload.name?.slice(0, 100) ?? null);
    if (user === 'conflict') {
      return res.status(409).json({ error: 'This email is linked to a different Google account' });
    }
    await startSession(res, user.id);
    res.json({ user });
  } catch (error: any) {
    console.error('Google Sign-In Error:', error.message);
    res.status(500).json({ error: 'Failed to sign in with Google' });
  }
});

authRouter.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token) {
      await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ success: true });
  } catch (error: any) {
    console.error('Logout Error:', error.message);
    res.status(500).json({ error: 'Failed to sign out' });
  }
});

export { authRouter };
