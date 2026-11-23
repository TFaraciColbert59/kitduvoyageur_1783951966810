/**
 * Premier enregistrement d'un itinéraire de départ (1.1, 1.7) : une personne connectée, avec un voyage réel,
 * crée l'espace côté serveur (`POST /api/routes/workspaces`, sous RLS) ; sans voyage ou sans compte, le
 * brouillon reste sur l'appareil (`guestDraft`) et la page le dit. Aucun repli silencieux : l'échec est rendu
 * avec sa raison.
 */
import type { RouteWorkspaceState } from './types';


/** Un identifiant de voyage réel (UUID) : le seul rattachement que le serveur peut accepter. */
export function isRealTripId(tripId: string | null | undefined): boolean {
  return typeof tripId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId);
}

export type PersistResult =
  | { readonly ok: true; readonly workspace: RouteWorkspaceState }
  | { readonly ok: false; readonly reason: string; readonly status: number | null };

export function persistBody(ws: RouteWorkspaceState): Record<string, unknown> {
  return {
    id: ws.id.length >= 3 ? ws.id.slice(0, 80) : undefined,
    tripId: ws.tripId.slice(0, 80),
    title: ws.title.trim().length >= 2 ? ws.title.trim().slice(0, 160) : 'Itinéraire',
    sport: ws.sport,
    workspace: ws,
  };
}

export async function persistWorkspaceToServer(
  ws: RouteWorkspaceState,
  fetchImpl: typeof fetch = fetch,
): Promise<PersistResult> {
  try {
    const res = await fetchImpl('/api/routes/workspaces', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(persistBody(ws)),
    });
    if (res.status === 401) return { ok: false, reason: 'Connexion requise pour enregistrer.', status: 401 };
    if (res.status === 403) return { ok: false, reason: 'Vous ne pouvez pas modifier ce voyage.', status: 403 };
    if (!res.ok) return { ok: false, reason: 'Enregistrement impossible pour l’instant.', status: res.status };
    const data = (await res.json()) as { workspace?: RouteWorkspaceState };
    if (!data.workspace || typeof data.workspace.id !== 'string') {
      return { ok: false, reason: 'Réponse du serveur illisible.', status: res.status };
    }
    return { ok: true, workspace: data.workspace };
  } catch {
    return { ok: false, reason: 'Réseau indisponible : brouillon gardé sur cet appareil.', status: null };
  }
}
