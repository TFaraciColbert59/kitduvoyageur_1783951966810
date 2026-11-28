import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function bearerToken(header: string | null): string {
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match?.[1] ?? '';
}

/**
 * Abandon / suppression serveur idempotente d'une séance écartée par l'utilisateur
 * depuis le résumé (`onDiscard`). La RPC `discard_activity_session` vérifie
 * `auth.uid()`, marque la séance `abandoned` et supprime tout brouillon associé.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return json({ error: 'authentification requise' }, 401);

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-activity-discard',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'sessionId invalide' }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return json({ error: 'configuration absente' }, 503);

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/discard_activity_session`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_session: parsed.data.sessionId }),
    });

    if (!res.ok) {
      const status = res.status === 401 ? 401 : res.status === 403 ? 403 : res.status === 404 ? 404 : 503;
      return json({ error: 'suppression refusée' }, status);
    }

    const payload = await res.json().catch(() => ({ discarded: true }));
    return json(payload, 200);
  } catch (error) {
    console.error('[explorer-v2] activity/discard', error);
    return json({ error: 'indisponible' }, 503);
  }
}
