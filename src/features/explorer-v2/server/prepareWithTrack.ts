import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireEditor } from '@/features/compas/server/compasServer';
import { compasCreateTripAction } from '@/features/compas/server/compasActions';
import { parseRouteDraft, writeTripRouteDraft } from '@/features/compas/server/routeDraftWrite';
import { buildItineraryHref } from '@/features/route-collab/insights/deepLinks';
import { buildExplorerRouteDraft } from '../prepareWithTrackDraft';

/**
 * 10.4 « Préparer avec ce tracé » : de l'Explorer vers /compas/itineraire, rattaché à un voyage.
 *
 *  1. le tracé réel est relu côté serveur (`hiking_routes` + `get_route_geojson`), jamais reçu du client ;
 *  2. sans voyage fourni, un brouillon est créé par `compasCreateTripAction` (même chemin que le Compas) ;
 *     avec un voyage fourni, `requireEditor` (RLS + `can_edit_trip`) décide ;
 *  3. le tracé devient le `routeDraft` du voyage par l'écrivain unique `writeTripRouteDraft`, provenance
 *     `explorer_route` (id et nom du sentier, jamais de coordonnée) ;
 *  4. l'atelier s'ouvre sur `?trip=<id>` : il reprend ce routeDraft (`compasDraft.ts`).
 *
 * Un voyage qui a déjà une version publiée de l'itinéraire n'est pas écrasé : la version publiée gagne
 * (règle de vérité 10.1) ; on renvoie alors `published_exists` et le lien vers l'atelier.
 */

export type PrepareWithTrackResult =
  | { status: 'ok'; tripId: string; href: string; created: boolean }
  | { status: 'published_exists'; tripId: string; href: string }
  | { status: 'unauthenticated' | 'forbidden' | 'not_found' | 'no_geometry' | 'error' };

function parseGeojson(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw ?? null;
}

export async function prepareTripWithExplorerRoute(input: {
  routeId: number;
  tripId?: string;
}): Promise<PrepareWithTrackResult> {
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { status: 'unauthenticated' };

    const { data: row, error: routeError } = await supabase
      .from('hiking_routes')
      .select('id, name, distance_km')
      .eq('id', input.routeId)
      .maybeSingle();
    if (routeError || !row) return { status: 'not_found' };
    const route = row as { id: number; name: string | null; distance_km: number | string | null };
    const { data: geo, error: geoError } = await supabase.rpc('get_route_geojson', { p_route_id: input.routeId });
    if (geoError) return { status: 'error' };

    const distance = route.distance_km == null ? null : Number(route.distance_km);
    const built = buildExplorerRouteDraft({
      routeId: input.routeId,
      name: route.name,
      geojson: parseGeojson(geo),
      distanceKm: distance != null && Number.isFinite(distance) ? distance : null,
    });
    if (!built) return { status: 'no_geometry' };

    let tripId = input.tripId;
    let created = false;
    if (tripId) {
      const editor = await requireEditor(tripId);
      if ('error' in editor) return { status: 'forbidden' };
      // 10.1 : la version publiée de l'itinéraire gagne, on ne la remplace pas par un tracé de catalogue.
      const { data: published } = await editor.supabase
        .from('route_workspaces')
        .select('id')
        .eq('trip_id', tripId)
        .not('published_revision_no', 'is', null)
        .limit(1);
      if (Array.isArray(published) && published.length > 0) {
        return { status: 'published_exists', tripId, href: buildItineraryHref({ tripId }) };
      }
    } else {
      const made = await compasCreateTripAction({ activity: 'hiking' });
      if (!made.success || !made.slug) return { status: 'error' };
      const { data: trip } = await supabase.from('trips').select('id').eq('slug', made.slug).maybeSingle();
      tripId = (trip as { id?: string } | null)?.id;
      if (!tripId) return { status: 'error' };
      created = true;
    }

    const draft = parseRouteDraft({ ...built.draft, id: `draft-${tripId}`.slice(0, 80) });
    if (!draft) return { status: 'no_geometry' };
    const editor = await requireEditor(tripId);
    if ('error' in editor) return { status: 'forbidden' };
    const written = await writeTripRouteDraft(editor.supabase, tripId, draft, {
      kind: 'explorer_route',
      id: String(input.routeId),
      name: built.name,
    });
    if (written.error) return { status: 'error' };
    return { status: 'ok', tripId, href: buildItineraryHref({ tripId }), created };
  } catch {
    return { status: 'error' };
  }
}
