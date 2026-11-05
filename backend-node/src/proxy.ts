// When PROXY_SECRET is set, the API only accepts requests forwarded by the Cloudflare Worker.
// The Worker reports the client's address, because Cloudflare hides it from the backend.
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

function hash(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

export function requireProxySecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.PROXY_SECRET;
  // Render's health check calls the backend directly
  if (!secret || req.path === '/api/health') return next();

  // Hashing gives both values the same length, which the timing-safe comparison requires
  const sent = req.get('x-proxy-secret') ?? '';
  if (!crypto.timingSafeEqual(hash(sent), hash(secret))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// The header is only used when PROXY_SECRET is set, because requireProxySecret has then checked the sender
export function rateLimitKey(req: Request): string {
  const forwarded = process.env.PROXY_SECRET ? req.get('x-client-ip') : undefined;
  return ipKeyGenerator(forwarded || req.ip || '', 56);
}
