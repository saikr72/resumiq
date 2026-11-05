import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { PoolClient } from 'pg';
import pool, { query } from './db';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified: boolean;
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

const VERIFY_EMAIL = 'verify_email';
const RESET_PASSWORD = 'reset_password';
const VERIFY_TOKEN_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_MS = 60 * 60 * 1000;
const EMAIL_THROTTLE_SECONDS = 60;
const INVALID_LINK = 'This link is invalid or has expired. Please request a new one.';

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
    // Secure by default in production, because a session cookie must not travel over plain HTTP
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
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

function toAuthUser(row: { id: string; email: string; full_name: string | null; email_verified_at: Date | null }): AuthUser {
  return { id: row.id, email: row.email, fullName: row.full_name, emailVerified: row.email_verified_at !== null };
}

// Replaces any earlier link for this purpose, so only the newest one works
async function issueEmailToken(userId: string, purpose: string, lifetimeMs: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await query('DELETE FROM email_tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  await query('INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [
    userId,
    purpose,
    hashToken(token),
    new Date(Date.now() + lifetimeMs),
  ]);
  return token;
}

// Limits how often one mailbox can be emailed, whoever is making the requests
async function wasEmailedRecently(userId: string, purpose: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM email_tokens
     WHERE user_id = $1 AND purpose = $2 AND created_at > CURRENT_TIMESTAMP - make_interval(secs => $3)`,
    [userId, purpose, EMAIL_THROTTLE_SECONDS]
  );
  return (result.rowCount ?? 0) > 0;
}

async function sendVerification(userId: string, email: string): Promise<void> {
  await sendVerificationEmail(email, await issueEmailToken(userId, VERIFY_EMAIL, VERIFY_TOKEN_MS));
}

async function sendPasswordReset(email: string): Promise<void> {
  const result = await query('SELECT id FROM users WHERE email = $1', [email]);
  const userId = result.rows[0]?.id;
  if (!userId || (await wasEmailedRecently(userId, RESET_PASSWORD))) return;
  await sendPasswordResetEmail(email, await issueEmailToken(userId, RESET_PASSWORD, RESET_TOKEN_MS));
}

function validatePassword(password: unknown): string | null {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH
    ? null
    : `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`;
}

async function getSessionUser(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || !token) return null;

  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.email_verified_at
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

export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({ error: 'Please verify your email address', code: 'EMAIL_NOT_VERIFIED' });
  }
  next();
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

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
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
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }
    if (name && name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
    }

    const result = await query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, full_name, email_verified_at`,
      [email, await hashPassword(password), name]
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    }

    await startSession(res, result.rows[0].id);
    res.status(201).json({ user: toAuthUser(result.rows[0]) });

    // Sent after responding, because a slow mail server shouldn't delay sign-up
    sendVerification(result.rows[0].id, email).catch((error) => console.error('Verification Email Error:', error.message));
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

    const result = await query('SELECT id, email, full_name, email_verified_at, password_hash FROM users WHERE email = $1', [email]);
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
 * An unverified password account with this email may have been created by
 * someone other than the real owner. Google has verified the owner, so linking
 * removes that password and ends its sessions. An account whose email was
 * already verified keeps both, because its owner has proved control of the email.
 */
async function resolveGoogleUser(googleId: string, email: string, name: string | null): Promise<AuthUser | 'conflict'> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const byGoogle = await client.query('SELECT id, email, full_name, email_verified_at FROM users WHERE google_id = $1', [googleId]);
    let row = byGoogle.rows[0];

    if (!row) {
      const byEmail = await client.query('SELECT id, google_id, email_verified_at FROM users WHERE email = $1 FOR UPDATE', [email]);
      const existing = byEmail.rows[0];

      if (existing?.google_id) {
        await client.query('ROLLBACK');
        return 'conflict';
      }

      if (existing) {
        const wasVerified = existing.email_verified_at !== null;
        const linked = await client.query(
          `UPDATE users
           SET google_id = $1,
               password_hash = CASE WHEN $4 THEN password_hash ELSE NULL END,
               email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
               full_name = COALESCE(full_name, $2),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING id, email, full_name, email_verified_at`,
          [googleId, name, existing.id, wasVerified]
        );
        if (!wasVerified) {
          await client.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
        }
        row = linked.rows[0];
      } else {
        const created = await client.query(
          `INSERT INTO users (email, google_id, full_name, email_verified_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           RETURNING id, email, full_name, email_verified_at`,
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

authRouter.post('/resend-verification', emailLimiter, requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (user.emailVerified) {
      return res.json({ success: true });
    }
    if (await wasEmailedRecently(user.id, VERIFY_EMAIL)) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another email' });
    }
    await sendVerification(user.id, user.email);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Resend Verification Error:', error.message);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// A POST, so mail scanners that open links can't use up the token
authRouter.post('/verify-email', signInLimiter, async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: INVALID_LINK });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const used = await client.query(
      `DELETE FROM email_tokens
       WHERE token_hash = $1 AND purpose = $2 AND expires_at > CURRENT_TIMESTAMP
       RETURNING user_id`,
      [hashToken(token), VERIFY_EMAIL]
    );
    if (used.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: INVALID_LINK });
    }
    await client.query(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [used.rows[0].user_id]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Verify Email Error:', error.message);
    res.status(500).json({ error: 'Failed to verify email' });
  } finally {
    client?.release();
  }
});

// Responds the same way, and before doing any work, so it can't reveal which emails have accounts
authRouter.post('/forgot-password', emailLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  res.json({ success: true });
  sendPasswordReset(email).catch((error) => console.error('Password Reset Email Error:', error.message));
});

authRouter.post('/reset-password', signInLimiter, async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: INVALID_LINK });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  let client: PoolClient | undefined;
  try {
    const passwordHash = await hashPassword(password);
    client = await pool.connect();
    await client.query('BEGIN');
    const used = await client.query(
      `DELETE FROM email_tokens
       WHERE token_hash = $1 AND purpose = $2 AND expires_at > CURRENT_TIMESTAMP
       RETURNING user_id`,
      [hashToken(token), RESET_PASSWORD]
    );
    if (used.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: INVALID_LINK });
    }

    const userId = used.rows[0].user_id;
    // The link proves control of the mailbox, which also verifies the email
    await client.query(
      `UPDATE users
       SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, userId]
    );
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM email_tokens WHERE user_id = $1', [userId]);
    await client.query('COMMIT');

    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ success: true });
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Reset Password Error:', error.message);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    client?.release();
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

// Everything held about the signed-in user, except credentials
authRouter.get('/account/export', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const all = async (sql: string) => (await query(sql, [userId])).rows;
    const profile = await all('SELECT email, full_name, email_verified_at, google_id IS NOT NULL AS google_linked, created_at FROM users WHERE id = $1');

    res.setHeader('Content-Disposition', 'attachment; filename="resumiq-data-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile: profile[0],
      resumes: await all('SELECT id, title, file_type, raw_text, created_at FROM resumes WHERE user_id = $1 ORDER BY created_at'),
      parsedResumes: await all(
        `SELECT p.resume_id, p.skills, p.created_at FROM parsed_resumes p
         JOIN resumes r ON r.id = p.resume_id WHERE r.user_id = $1 ORDER BY p.created_at`
      ),
      jobDescriptions: await all('SELECT id, job_title, raw_text, created_at FROM job_descriptions WHERE user_id = $1 ORDER BY created_at'),
      analyses: await all(
        `SELECT a.id, a.resume_id, a.job_id, a.overall_match_score, a.keyword_score,
                CASE WHEN a.scoring_version >= 2 THEN a.semantic_score END AS semantic_score,
                CASE WHEN a.scoring_version >= 2 THEN a.experience_score END AS experience_score,
                a.required_years, a.resume_years, a.matched_skills, a.missing_skills, a.improvement_suggestions, a.created_at
         FROM resume_analyses a JOIN resumes r ON r.id = a.resume_id WHERE r.user_id = $1 ORDER BY a.created_at`
      ),
      applications: await all('SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at'),
      interviews: await all(
        `SELECT i.* FROM interview_stages i
         JOIN applications a ON a.id = i.application_id WHERE a.user_id = $1 ORDER BY i.created_at`
      ),
    });
  } catch (error: any) {
    console.error('Export Account Error:', error.message);
    res.status(500).json({ error: 'Failed to export your data' });
  }
});

// Deletes the user. Foreign keys cascade to everything they own, including sessions.
authRouter.delete('/account', signInLimiter, requireAuth, async (req, res) => {
  try {
    const { confirmEmail, password } = req.body ?? {};
    if (normalizeEmail(confirmEmail) !== req.user!.email) {
      return res.status(400).json({ error: 'Type your email address to confirm' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const passwordHash = result.rows[0]?.password_hash;
    if (passwordHash) {
      const valid = typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH && (await verifyPassword(password, passwordHash));
      if (!valid) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    await query('DELETE FROM users WHERE id = $1', [req.user!.id]);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete Account Error:', error.message);
    res.status(500).json({ error: 'Failed to delete your account' });
  }
});

export { authRouter };
