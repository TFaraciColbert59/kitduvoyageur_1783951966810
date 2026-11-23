/**
 * Cadrage de départ de la carte de l'itinéraire et garde de pose (pur, testé).
 * Une carte vide ne s'ouvre jamais sur un continent : deux touchers y poseraient un tronçon de 300 km que
 * le routeur refuse. Ordre : premier point du tracé, ancre du voyage, dernière position connue, sinon un zoom
 * de randonnée sur un repère neutre, dit comme tel.
 */
import type { CollaborativeRouteSection } from './types';

/** Zoom de randonnée : une commune et ses sentiers tiennent à l'écran. */
export const HIKING_ZOOM = 12;
/** En dessous, un toucher zoome au lieu de poser un point (deux points y seraient à des dizaines de km). */
export const MIN_ADD_ZOOM = 9;
/** Repère neutre (Paris, Notre-Dame) : il n'indique aucune intention, la personne doit se placer. */
export const NEUTRAL_LANDMARK: readonly [number, number] = [2.3499, 48.853];

export type StartKind = 'track' | 'trip' | 'last-known' | 'located' | 'neutral';

export interface StartView {
  readonly center: [number, number];
  readonly zoom: number;
  readonly kind: StartKind;
}

export interface LonLatLike {
  readonly lon: number;
  readonly lat: number;
}

const finite = (p: LonLatLike | null | undefined): p is LonLatLike =>
  p != null && typeof p.lon === 'number' && typeof p.lat === 'number' && Number.isFinite(p.lon) && Number.isFinite(p.lat);

export function startView(input: {
  readonly first?: LonLatLike | null;
  readonly anchor?: LonLatLike | null;
  readonly lastKnown?: LonLatLike | null;
}): StartView {
  if (finite(input.first)) return { center: [input.first.lon, input.first.lat], zoom: HIKING_ZOOM, kind: 'track' };
  if (finite(input.anchor)) return { center: [input.anchor.lon, input.anchor.lat], zoom: HIKING_ZOOM, kind: 'trip' };
  if (finite(input.lastKnown)) return { center: [input.lastKnown.lon, input.lastKnown.lat], zoom: HIKING_ZOOM, kind: 'last-known' };
  return { center: [NEUTRAL_LANDMARK[0], NEUTRAL_LANDMARK[1]], zoom: HIKING_ZOOM, kind: 'neutral' };
}

export type AddGate = { readonly ok: true } | { readonly ok: false; readonly zoomTo: number; readonly message: string };

/** Pose d'un point : refusée en dessous de `MIN_ADD_ZOOM`, la carte zoome sur le toucher à la place. */
export function addPointGate(zoom: number | null | undefined): AddGate {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom >= MIN_ADD_ZOOM) return { ok: true };
  return {
    ok: false,
    zoomTo: HIKING_ZOOM,
    message: 'Carte trop large pour poser un point : zoome sur ton départ (la carte s’est rapprochée), puis touche à nouveau.',
  };
}

/* ---------- Dernière position connue (jamais de demande de permission ici) ---------- */

const LAST_KNOWN_KEY = 'lkdv.routeCollab.lastKnown.v1';

export function readLastKnown(storage: Pick<Storage, 'getItem'> | null | undefined): LonLatLike | null {
  try {
    const raw = storage?.getItem(LAST_KNOWN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { lon?: unknown; lat?: unknown };
    const p = { lon: Number(v.lon), lat: Number(v.lat) };
    return finite(p) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 ? p : null;
  } catch {
    return null;
  }
}

export function writeLastKnown(storage: Pick<Storage, 'setItem'> | null | undefined, p: LonLatLike): void {
  if (!finite(p)) return;
  try {
    storage?.setItem(LAST_KNOWN_KEY, JSON.stringify({ lon: Number(p.lon.toFixed(4)), lat: Number(p.lat.toFixed(4)) }));
  } catch {
    /* stockage plein ou refusé : on ne retient rien, sans bruit */
  }
}

/* ---------- Tronçon non calculé ---------- */

/** Un tronçon posé mais pas encore (ou pas) calculé par le routeur : ligne droite, jamais présentée comme un chemin. */
export function isUnverifiedSection(s: Pick<CollaborativeRouteSection, 'mode' | 'provenance'>): boolean {
  return s.mode === 'routed' && s.provenance.provider == null && s.provenance.confidence !== 'verified';
}

export function countUnverified(sections: ReadonlyArray<Pick<CollaborativeRouteSection, 'mode' | 'provenance'>>): number {
  return sections.reduce((n, s) => n + (isUnverifiedSection(s) ? 1 : 0), 0);
}

export interface RoutingIssue {
  /** Phrase affichée. */
  readonly text: string;
  /** Détail brut renvoyé par le routeur (code HTTP, raison) : l'erreur réelle, non reformulée. */
  readonly detail: string;
}

/** Dit pourquoi le routeur n'a pas calculé le tronçon, d'après ce qu'il a réellement renvoyé. */
export function describeRoutingFailure(input: { readonly status?: number | null; readonly reason?: string | null; readonly network?: boolean }): RoutingIssue {
  if (input.network) {
    return { text: 'Tronçon non calculé : le service de routage est injoignable (réseau).', detail: 'réseau injoignable' };
  }
  const reason = input.reason ?? null;
  const detail = [input.status != null ? `HTTP ${input.status}` : null, reason].filter(Boolean).join(' · ') || 'réponse vide';
  switch (reason) {
    case 'off_network':
      return { text: 'Tronçon non calculé : un des points n’est pas atteignable sur le réseau de chemins.', detail };
    case 'rate_limited':
      return { text: 'Tronçon non calculé : trop de demandes au routeur, réessaie dans une minute.', detail };
    case 'provider_unavailable':
      return {
        text: 'Tronçon non calculé : le routeur n’a pas répondu pour ce trajet (service indisponible ou trajet trop long).',
        detail,
      };
    default:
      return { text: 'Tronçon non calculé : le routeur a refusé la demande.', detail };
  }
}
