/**
 * Démarrer l'activité depuis la version (9.8). L'itinéraire écrit sur l'appareil quelle version est suivie et quel
 * sac est emporté ; le cockpit de randonnée (`/randonnee-active?tripId=`, suivi en direct et contact de sécurité
 * existants) les joint à l'enregistrement de la sortie (`POST /api/hike-sessions`, colonnes `route_workspace_id`,
 * `route_revision_id`, `kit_snapshot`). La passation est liée au voyage et expire : une sortie sans lien avec la
 * version suivie n'hérite jamais d'une passation ancienne.
 */
import type { CollaborativeKitItem, RouteRevisionSnapshot } from '../types';

export const HANDOFF_KEY = 'lkdv:route-collab:activity-handoff:v1';
export const HANDOFF_MAX_AGE_MS = 72 * 3600 * 1000;
export const MAX_SNAPSHOT_ITEMS = 200;

export interface HandoffKitItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly weightGrams: number | null;
  readonly quantity: number;
  readonly shared: boolean;
  readonly assigneeUserId: string | null;
}

export interface ActivityHandoff {
  readonly tripId: string;
  readonly workspaceId: string;
  readonly revisionId: string;
  readonly revisionNo: number;
  readonly kitSnapshot: readonly HandoffKitItem[];
  readonly startedAt: string;
}

export function kitSnapshotOf(items: readonly CollaborativeKitItem[]): HandoffKitItem[] {
  return items.slice(0, MAX_SNAPSHOT_ITEMS).map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    weightGrams: i.weightGrams,
    quantity: i.quantity,
    shared: i.shared,
    assigneeUserId: i.assigneeUserId,
  }));
}

export function handoffFromRevision(tripId: string, revision: RouteRevisionSnapshot, nowIso: string): ActivityHandoff {
  return {
    tripId,
    workspaceId: revision.workspaceId,
    revisionId: revision.id,
    revisionNo: revision.revisionNo,
    kitSnapshot: kitSnapshotOf(revision.kitSnapshot),
    startedAt: nowIso,
  };
}

export function writeHandoff(h: ActivityHandoff, storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(HANDOFF_KEY, JSON.stringify(h));
    return true;
  } catch {
    return false;
  }
}

/** Forme d'une passation (stockage local ou brouillon de sortie) ; `null` si elle est inexploitable. */
export function parseHandoff(raw: unknown): ActivityHandoff | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Partial<ActivityHandoff>;
  if (typeof h.tripId !== 'string' || typeof h.workspaceId !== 'string' || typeof h.revisionId !== 'string' || typeof h.startedAt !== 'string') return null;
  if (!h.tripId || !h.workspaceId || !h.revisionId) return null;
  return {
    tripId: h.tripId,
    workspaceId: h.workspaceId,
    revisionId: h.revisionId,
    revisionNo: typeof h.revisionNo === 'number' && Number.isFinite(h.revisionNo) ? h.revisionNo : 0,
    kitSnapshot: Array.isArray(h.kitSnapshot) ? (h.kitSnapshot as HandoffKitItem[]).slice(0, MAX_SNAPSHOT_ITEMS) : [],
    startedAt: h.startedAt,
  };
}

export function readHandoffFor(
  tripId: string,
  nowMs: number = Date.now(),
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): ActivityHandoff | null {
  if (!storage || !tripId) return null;
  try {
    const raw = storage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const h = parseHandoff(JSON.parse(raw));
    if (!h || h.tripId !== tripId) return null;
    const at = Date.parse(h.startedAt);
    if (!Number.isFinite(at) || nowMs - at > HANDOFF_MAX_AGE_MS || at - nowMs > 3600_000) return null;
    return h;
  } catch {
    return null;
  }
}

/** Texte du cockpit : la version d'itinéraire suivie (9.8), avec le sac emporté s'il est connu. */
export function followedVersionLabel(h: Pick<ActivityHandoff, 'revisionNo' | 'kitSnapshot'> | null): string | null {
  if (!h) return null;
  const version = h.revisionNo > 0 ? `Version v${h.revisionNo} suivie` : 'Version publiée suivie';
  const n = h.kitSnapshot.length;
  return n > 0 ? `${version} · ${n} objet${n > 1 ? 's' : ''} du sac` : version;
}

export function clearHandoff(storage: Pick<Storage, 'removeItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  try {
    storage?.removeItem(HANDOFF_KEY);
  } catch {
    /* stockage indisponible */
  }
}

/** Champs ajoutés au corps de `POST /api/hike-sessions` ; absents quand rien n'est suivi (rétrocompatible). */
export function handoffBody(h: ActivityHandoff | null): { routeWorkspaceId: string; routeRevisionId: string; kitSnapshot: readonly HandoffKitItem[] } | Record<string, never> {
  return h ? { routeWorkspaceId: h.workspaceId, routeRevisionId: h.revisionId, kitSnapshot: h.kitSnapshot } : {};
}

/** Lien du cockpit : le voyage seul (le reste voyage par la passation locale). */
export function cockpitHref(tripId: string): string {
  return `/randonnee-active?tripId=${encodeURIComponent(tripId)}`;
}
