import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const pointSchema = z
  .object({
    seq: z.number().int().positive().max(1_000_000_000),
    /** Horodatage de mesure, en millisecondes UTC. */
    t: z.number().int().min(946_684_800_000).max(4_102_444_800_000),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    ele: z.number().min(-1000).max(9000).nullable().optional(),
    acc: z.number().min(0).max(100_000).nullable().optional(),
    speed: z.number().min(0).max(200).nullable().optional(),
  })
  .strict();

const bodySchema = z
  .object({
    sessionId: z.string().uuid(),
    points: z.array(pointSchema).max(200),
    /** Heure réelle du premier point, pour une séance créée hors ligne. */
    startedAt: z.number().int().min(946_684_800_000).max(4_102_444_800_000).nullable().optional(),
    /** Heure réelle de l'arrêt, quand la fin a été jouée hors ligne. */
    endedAt: z.number().int().min(946_684_800_000).max(4_102_444_800_000).nullable().optional(),
    metrics: z
      .object({
        distanceM: z.number().int().min(0).max(100_000_000),
        elevGainM: z.number().int().min(0).max(10_000_000),
        movingS: z.number().int().min(0).max(100_000_000),
        paused: z.boolean(),
      })
      .strict(),
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
 * Progression d'une séance (S1.02/K6.15).
 *
 * Le client pousse uniquement des points **déjà capturés localement**, avec
 * leur séquence stable. La RPC `sync_activity_session` vérifie le propriétaire,
 * ignore les séquences déjà présentes et met à jour les métriques de la séance.
 * Une réponse perdue est donc sans conséquence : le même lot peut être rejoué.
 *
 * Aucun `service_role`, aucun acteur lu dans le corps : le jeton utilisateur
 * est relayé à PostgREST et la RPC applique `auth.uid()`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return json({ error: 'authentification requise' }, 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'progression invalide' }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return json({ error: 'configuration absente' }, 503);

  const points = parsed.data.points.map((point) => ({
    seq: point.seq,
    t: new Date(point.t).toISOString(),
    lat: point.lat,
    lng: point.lng,
    ele: point.ele ?? null,
    acc: point.acc ?? null,
    speed: point.speed ?? null,
  }));

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/sync_activity_session`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_session: parsed.data.sessionId,
        p_points: points,
        p_distance_m: parsed.data.metrics.distanceM,
        p_elev_gain_m: parsed.data.metrics.elevGainM,
        p_moving_s: parsed.data.metrics.movingS,
        p_paused: parsed.data.metrics.paused,
        p_started_at: parsed.data.startedAt
          ? new Date(parsed.data.startedAt).toISOString()
          : null,
        p_ended_at: parsed.data.endedAt
          ? new Date(parsed.data.endedAt).toISOString()
          : null,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      const status =
        res.status === 401
          ? 401
          : res.status === 403
            ? 403
            : detail.includes('séance déjà close') || detail.includes('déjà close')
              ? 409
              : res.status === 400 || res.status === 422
                ? 400
                : 503;
      return json({ error: 'progression refusée', detail }, status);
    }

    const payload = await res.json().catch(() => null);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ error: 'réponse serveur invalide' }, 503);
    }
    const result = payload as {
      inserted?: unknown;
      received?: unknown;
      syncedThroughSeq?: unknown;
    };
    if (
      typeof result.inserted !== 'number' ||
      typeof result.received !== 'number' ||
      (result.syncedThroughSeq !== null && typeof result.syncedThroughSeq !== 'number')
    ) {
      return json({ error: 'réponse serveur invalide' }, 503);
    }
    return json(
      {
        inserted: result.inserted,
        received: result.received,
        syncedThroughSeq: result.syncedThroughSeq ?? 0,
      },
      200,
    );
  } catch (error) {
    console.error('[explorer-v2] activity/points', error);
    return json({ error: 'indisponible' }, 503);
  }
}
