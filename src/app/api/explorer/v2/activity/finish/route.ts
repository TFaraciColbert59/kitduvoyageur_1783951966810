import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
      }
      const result = payload as {
        status?: string;
        summaryId?: string | null;
        reason?: string;
      };
      if (
        result.status !== 'applied' &&
        result.status !== 'duplicate' &&
        result.status !== 'already_finished' &&
        result.status !== 'conflict'
      ) {
        return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
      }
      if (result.status === 'conflict') {
        const summaryConflict = result.reason === 'summary_not_owned';
        return NextResponse.json(
          {
            error: summaryConflict
              ? 'le résumé lié à cette clé n’appartient pas à cette séance'
              : 'clé d’idempotence déjà liée à une autre séance',
            code: summaryConflict ? 'summary_conflict' : 'idempotency_conflict',
          },
          { status: 409 }
        );
      }

      const summaryId = result.summaryId;
      const validSummary = typeof summaryId === 'string' && UUID_PATTERN.test(summaryId);
      if (result.status === 'already_finished') {
        // `already_finished` peut porter un résumé retrouvé (fin directe ou
        // ligne historique) ou null quand le serveur n'en connaît aucun.
        if (summaryId !== null && summaryId !== undefined && !validSummary) {
          return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
        }
        return NextResponse.json({
          status: 'already_finished',
          summaryId: validSummary ? summaryId : null,
        });
      }
      if (!validSummary) {
        return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
      }
      return NextResponse.json({
        status: result.status === 'duplicate' ? 'duplicate' : 'saved',
        summaryId,
      });
    }
    // RPC historique sans clé : un UUID désigne un résumé créé, `null` signifie
    // que la séance était déjà close. Ne jamais annoncer « saved » avec null.
    if (payload === null) {
      return NextResponse.json({ status: 'already_finished', summaryId: null });
    }
    if (typeof payload !== 'string' || !UUID_PATTERN.test(payload)) {
      return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
    }
    return NextResponse.json({ status: 'saved', summaryId: payload });
  } catch (error) {
    console.error('[explorer-v2] finish', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
