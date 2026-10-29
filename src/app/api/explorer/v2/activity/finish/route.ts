import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  /**
   * Clé d'idempotence (P7-21) : présente quand la fin de sortie a été jouée
   * hors ligne. Le rejeu répond `duplicate` sans réécrire la session.
   */
  idempotencyKey: z.string().min(8).max(400).optional(),
});

/**
 * Fin de sortie : appelle `finish_activity_session_idempotent` (SECURITY
 * DEFINER), qui clôt la session, écrit le résumé compatible dans
 * `hike_sessions` et mémorise la clé d'idempotence dans
 * `offline_sync_operations` (A13). Sans clé, la RPC historique est utilisée.
 * Le jeton de l'utilisateur est relayé tel quel : la RPC vérifie le propriétaire.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'sessionId invalide' }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const idempotent = Boolean(parsed.data.idempotencyKey);
  const rpc = idempotent ? 'finish_activity_session_idempotent' : 'finish_activity_session';
  const body = idempotent
    ? { p_session: parsed.data.sessionId, p_idempotency_key: parsed.data.idempotencyKey }
    : { p_session: parsed.data.sessionId };

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'refusé', detail: (await res.text()).slice(0, 200) }, { status: res.status });
    }
    const payload = await res.json();
    if (idempotent) {
      const result = payload as { status?: string; summaryId?: string };
      return NextResponse.json({
        status: result.status === 'duplicate' ? 'duplicate' : 'saved',
        summaryId: result.summaryId ?? null,
      });
    }
    return NextResponse.json({ status: 'saved', summaryId: payload });
  } catch (error) {
    console.error('[explorer-v2] finish', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
