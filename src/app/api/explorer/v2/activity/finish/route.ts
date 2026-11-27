import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const waypointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().trim().max(120).optional(),
  kind: z.string().trim().max(40).optional(),
  ele: z.number().min(-1000).max(9000).nullable().optional(),
  t: z.number().int().optional(),
});

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  /**
   * Clé d'idempotence (P7-21) : présente quand la fin de sortie a été jouée
   * hors ligne. Le rejeu répond `duplicate` sans réécrire la session.
   */
  idempotencyKey: z.string().min(8).max(400).optional(),
  /** Enrichissements optionnels écrits en best-effort sur `hike_sessions`. */
  title: z.string().trim().min(1).max(160).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  kitId: z.string().uuid().nullable().optional(),
  waypoints: z.array(waypointSchema).max(200).nullable().optional(),
});

interface SessionEnrichment {
  title?: string | null;
  notes?: string | null;
  rpe?: number | null;
  kitId?: string | null;
  waypoints?: Array<z.infer<typeof waypointSchema>> | null;
}

function safeUpstreamStatus(status: number): number {
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 409) return 409;
  if (status === 400 || status === 422) return 400;
  return 503;
}

/**
 * Met à jour les champs d'enrichissement sur `hike_sessions` en best-effort.
 * Ignore silencieusement les colonnes absentes avant migration afin de ne
 * jamais faire échouer une clôture de sortie déjà enregistrée.
 */
async function enrichHikeSessionBestEffort(
  baseUrl: string,
  anon: string,
  authorization: string,
  summaryId: string,
  enrichment: SessionEnrichment,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (enrichment.title !== undefined) patch.title = enrichment.title;
  if (enrichment.notes !== undefined) patch.notes = enrichment.notes;
  if (enrichment.rpe !== undefined) patch.rpe = enrichment.rpe;
  if (enrichment.kitId !== undefined) patch.kit_id = enrichment.kitId;
  if (enrichment.waypoints !== undefined) patch.waypoints_json = enrichment.waypoints;

  if (Object.keys(patch).length === 0) return;

  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/hike_sessions?id=eq.${encodeURIComponent(summaryId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: anon,
          Authorization: authorization,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok) {
      // Si la migration ajoutant notes/rpe/kit_id/waypoints_json n'est pas encore
      // appliquée sur la base distante, tenter au moins la sauvegarde de `title`.
      if (enrichment.title !== undefined && Object.keys(patch).length > 1) {
        await fetch(
          `${baseUrl}/rest/v1/hike_sessions?id=eq.${encodeURIComponent(summaryId)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: anon,
              Authorization: authorization,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ title: enrichment.title }),
          },
        ).catch(() => undefined);
      }
      console.warn('[explorer-v2] finish enrichment skipped', res.status);
    }
  } catch (error) {
    console.warn('[explorer-v2] finish enrichment error', error instanceof Error ? error.message : String(error));
  }
}

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

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-activity-finish',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'sessionId invalide' }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const baseUrl = url.replace(/\/$/, '');
  const idempotent = Boolean(parsed.data.idempotencyKey);
  const rpc = idempotent ? 'finish_activity_session_idempotent' : 'finish_activity_session';
  const body = idempotent
    ? { p_session: parsed.data.sessionId, p_idempotency_key: parsed.data.idempotencyKey }
    : { p_session: parsed.data.sessionId };

  const enrichment: SessionEnrichment = {
    title: parsed.data.title,
    notes: parsed.data.notes,
    rpe: parsed.data.rpe,
    kitId: parsed.data.kitId,
    waypoints: parsed.data.waypoints,
  };

  try {
    const res = await fetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[explorer-v2] finish rejected', res.status);
      return NextResponse.json({ error: 'refusé' }, { status: safeUpstreamStatus(res.status) });
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
          { status: 409 },
        );
      }

      const summaryId = result.summaryId;
      const validSummary = typeof summaryId === 'string' && UUID_PATTERN.test(summaryId);
      if (result.status === 'already_finished') {
        if (summaryId !== null && summaryId !== undefined && !validSummary) {
          return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
        }
        if (validSummary) {
          await enrichHikeSessionBestEffort(baseUrl, anon, authorization, summaryId, enrichment);
        }
        return NextResponse.json({
          status: 'already_finished',
          summaryId: validSummary ? summaryId : null,
        });
      }
      if (!validSummary) {
        return NextResponse.json({ error: 'réponse indisponible' }, { status: 503 });
      }
      await enrichHikeSessionBestEffort(baseUrl, anon, authorization, summaryId, enrichment);
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
    await enrichHikeSessionBestEffort(baseUrl, anon, authorization, payload, enrichment);
    return NextResponse.json({ status: 'saved', summaryId: payload });
  } catch (error) {
    console.error('[explorer-v2] finish', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
