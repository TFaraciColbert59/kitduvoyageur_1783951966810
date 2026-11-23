import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireEditor } from '@/features/compas/server/compasServer';
import { parseRouteDraft, writeTripRouteDraft } from '@/features/compas/server/routeDraftWrite';
import {
  pickPublishedWorkspaceForTrip,
  summarizePublishedRouteForHub,
  type PublishedRouteHubSummary,
} from '../integrations';
import { planRouteDraftSync } from '../publishedSync';
import { getRouteCollabStore } from '../store';
import type { RouteWorkspaceState } from '../types';

/**
 * Lecture serveur de la version publiée d'un voyage, sous RLS (client Supabase de la personne : un voyage
 * auquel elle n'a pas accès ne renvoie rien). Partagée par le HUB (`/hub/itineraire`, cockpit), le Compas
 * (éditeur de tracé) et la synchronisation du routeDraft.
 */
export async function loadPublishedWorkspaceForTrip(
  tripId: string,
  supabase?: SupabaseClient,
): Promise<RouteWorkspaceState | null> {
  try {
    const client = supabase ?? ((await createClient()) as unknown as SupabaseClient);
    const { data } = await client.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return null;
    const store = await getRouteCollabStore(client);
    if (store.kind === 'supabase') {
      // Requête légère d'abord (sans l'instantané) : la plupart des voyages n'ont aucun espace publié.
      const { data: rows, error } = await client
        .from('route_workspaces')
        .select('id, published_revision_no, updated_at')
        .eq('trip_id', tripId)
        .not('published_revision_no', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error || !rows || rows.length === 0) return null;
      const found: RouteWorkspaceState[] = [];
      for (const row of rows as Array<{ id: string }>) {
        const res = await store.getWorkspaceForActor(row.id, userId);
        if (res.ok) found.push(res.workspace);
      }
      return pickPublishedWorkspaceForTrip(found, tripId);
    }
    return pickPublishedWorkspaceForTrip(await store.listWorkspacesForActor(userId), tripId);
  } catch {
    // Lecture d'agrément : une panne de l'itinéraire ne casse jamais le HUB ni le Compas.
    return null;
  }
}

export async function getPublishedRouteSummaryForTrip(
  tripId: string,
  supabase?: SupabaseClient,
): Promise<PublishedRouteHubSummary | null> {
  const ws = await loadPublishedWorkspaceForTrip(tripId, supabase);
  return ws ? summarizePublishedRouteForHub(ws) : null;
}

export type SyncRouteDraftResult =
  | { status: 'synced'; revisionNo: number; replacedEditorDraft: boolean }
  | { status: 'unchanged' | 'no_published' | 'no_geometry' | 'editor_newer' }
  | { status: 'forbidden' | 'invalid' | 'error' };

/**
 * Met `trips.metadata.compas.routeDraft` à jour depuis la version publiée de l'itinéraire (10.1). Droit
 * d'édition du voyage exigé (`requireEditor`, RLS) ; écriture par l'écrivain unique `writeTripRouteDraft`.
 * Idempotent. À appeler après une publication (`POST /api/itineraire/sync-draft`) et à l'ouverture du Compas.
 */
export async function syncTripRouteDraftFromPublished(tripId: string): Promise<SyncRouteDraftResult> {
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { status: 'forbidden' };
    const published = await loadPublishedWorkspaceForTrip(tripId, auth.supabase as unknown as SupabaseClient);
    const plan = planRouteDraftSync({
      tripId,
      metadata: auth.trip.metadata,
      workspaces: published ? [published] : [],
    });
    if (plan.action === 'none') return { status: plan.reason === 'up_to_date' ? 'unchanged' : plan.reason };
    const draft = parseRouteDraft(plan.draft);
    if (!draft) return { status: 'invalid' };
    const written = await writeTripRouteDraft(auth.supabase, tripId, draft, {
      kind: 'itineraire_publie',
      id: plan.workspaceId,
    });
    if (written.error) return { status: 'error' };
    return { status: 'synced', revisionNo: plan.revisionNo, replacedEditorDraft: plan.replacesEditorDraft };
  } catch {
    return { status: 'error' };
  }
}
