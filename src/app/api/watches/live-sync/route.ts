import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  applyWatchLiveFrame,
  buildWatchLiveFrame,
  getWatchLiveSyncState,
  handoffWatchSource,
  setWatchFieldLayout,
} from '@/features/compte/server/watches';
import {
  WatchLiveSyncActionSchema,
  WatchLiveSyncFrameSchema,
} from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/watches/live-sync?sessionId= — source active et champs suivis. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return rejected('missing_session_id', 'Identifiant de séance requis.');
  }
  try {
    return ok(getWatchLiveSyncState(auth.user.id, sessionId));
  } catch (error) {
    return handleWatchError(error);
  }
}

/**
 * POST /api/watches/live-sync
 *
 * Actions : `build_frame` (par défaut si `metrics` est fourni), `set_layout`,
 * `handoff` et `apply_frame` (la montre rejette toute trame obsolète).
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const raw = await readJson(request);
  if (!raw || typeof raw !== 'object') {
    return rejected('invalid_live_sync', 'Trame Live Sync invalide.');
  }
  const candidate = { ...(raw as Record<string, unknown>) };
  if (typeof candidate.action !== 'string') {
    if ('metrics' in candidate) candidate.action = 'build_frame';
    else if ('config' in candidate) candidate.action = 'set_layout';
  }

  const parsed = WatchLiveSyncActionSchema.safeParse(candidate);
  if (!parsed.success) {
    return rejected(
      'invalid_live_sync',
      parsed.error.issues[0]?.message ?? 'Trame Live Sync invalide.',
    );
  }

  try {
    switch (parsed.data.action) {
      case 'build_frame':
        return ok({
          frame: buildWatchLiveFrame(auth.user.id, {
            sessionId: parsed.data.sessionId,
            routeId: parsed.data.routeId ?? null,
            metrics: parsed.data.metrics,
            pois: parsed.data.pois,
            nextManeuver: parsed.data.nextManeuver,
            nowUtcMs: parsed.data.nowUtcMs,
          }),
        });
      case 'set_layout':
        return ok({ layout: setWatchFieldLayout(auth.user.id, parsed.data.config) });
      case 'handoff':
        return ok({
          handoff: handoffWatchSource(
            auth.user.id,
            parsed.data.sessionId,
            parsed.data.toSource,
            parsed.data.lastAcceptedSeq,
            parsed.data.nowUtcMs,
          ),
        });
      case 'apply_frame': {
        const frame = WatchLiveSyncFrameSchema.parse(parsed.data.frame);
        const applied = applyWatchLiveFrame(auth.user.id, frame);
        return ok({ accepted: applied.accepted, frame: applied.currentFrame });
      }
    }
  } catch (error) {
    return handleWatchError(error);
  }
}
