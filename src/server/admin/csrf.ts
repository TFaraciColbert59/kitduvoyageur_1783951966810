import 'server-only';

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

/**
 * CSRF double-submit pour les mutations `/api/admin/*`.
 * Le token vit dans un cookie lisible JS (`lkdv_admin_csrf`, SameSite=Lax)
 * et doit être renvoyé dans l'en-tête `x-admin-csrf`. Comparaison
 * timing-safe. Les GET restent sans CSRF (lecture seule).
 */

const COOKIE_NAME = 'lkdv_admin_csrf';
const HEADER_NAME = 'x-admin-csrf';

function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export async function getOrIssueCsrfToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 32) return existing;

  const token = randomBytes(32).toString('hex');
  store.set(COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 4 * 60 * 60,
  });
  return token;
}

export async function checkCsrfToken(req: NextRequest): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(COOKIE_NAME)?.value;
  const presented = req.headers.get(HEADER_NAME);
  if (!expected || !presented) return false;
  return tokensEqual(expected, presented);
}

export { COOKIE_NAME as ADMIN_CSRF_COOKIE, HEADER_NAME as ADMIN_CSRF_HEADER };
