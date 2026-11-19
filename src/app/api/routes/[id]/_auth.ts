import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export interface AuthenticatedRouteActor {
  readonly userId: string;
  readonly displayName: string;
}

const SIGNED_SESSION_COOKIE = 'lkdv_collab_session';

function verifySignedLocalSessionCookie(raw: string | undefined): AuthenticatedRouteActor | null {
  const secret = process.env.LKDV_COLLAB_SESSION_SECRET?.trim();
  if (!secret || !raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = raw.slice(0, dot);
  const sigHex = raw.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  const a = Buffer.from(sigHex, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: unknown;
      name?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.sub !== 'string' || !parsed.sub.trim()) return null;
    if (typeof parsed.exp === 'number' && parsed.exp * 1000 <= Date.now()) return null;
    return {
      userId: parsed.sub.trim(),
      displayName:
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim()
          : `Voyageur ${parsed.sub.slice(0, 6)}`,
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedRouteActor(): Promise<AuthenticatedRouteActor | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const displayName =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        user.email?.split('@')[0] ||
        `Voyageur ${user.id.slice(0, 6)}`;
      return { userId: user.id, displayName };
    }
  } catch {
    /* fallback below only when LKDV_COLLAB_SESSION_SECRET is explicitly set */
  }

  try {
    const cookieStore = await cookies();
    const signed = verifySignedLocalSessionCookie(cookieStore.get(SIGNED_SESSION_COOKIE)?.value);
    if (signed) return signed;
  } catch {
    /* ignore */
  }

  return null;
}
