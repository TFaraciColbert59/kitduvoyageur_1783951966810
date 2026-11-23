// Sorties enregistrées qui ont suivi une version de cet itinéraire (9.8, 9.9) : pour le carnet « plan contre
// réel ». Lecture seule, propriétaire seulement (`user_id = auth.uid()`), entrée validée par zod. RGPD : les points
// GPS ne se lisent plus sur la table brute (`positions_*` retirés au rôle authenticated) mais sur la vue
// `hike_sessions_participant`. Les
// colonnes `route_workspace_id`, `route_revision_id`, `kit_snapshot` viennent de la migration route-collab : si
// elles n'existent pas encore, la réponse est `unavailable` (liste vide), jamais une trace inventée.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { recordedSessionOf, type HikeSessionRow } from '@/features/route-collab/depart/sessionTrack';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ workspaceId: z.string().uuid() }).strict();
const MAX_SESSIONS = 5;

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = querySchema.safeParse({ workspaceId: request.nextUrl.searchParams.get('workspaceId') ?? undefined });
  if (!parsed.success) return fail('bad_request', 'workspaceId_invalide');

  const { data, error } = await auth.supabase
    .from('hike_sessions_participant')
    .select('id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, positions_timed, positions_geojson, route_revision_id, kit_snapshot')
    .eq('user_id', auth.user.id)
    .eq('route_workspace_id', parsed.data.workspaceId)
    .order('started_at', { ascending: false })
    .limit(MAX_SESSIONS);
  if (error) {
    return ok({ status: 'unavailable', sessions: [], fetchedAt: new Date().toISOString(), reason: 'Sorties liées à l’itinéraire non lisibles pour l’instant.' });
  }
  return ok({
    status: 'ok',
    fetchedAt: new Date().toISOString(),
    sessions: ((data ?? []) as unknown as HikeSessionRow[]).map(recordedSessionOf),
  });
}
