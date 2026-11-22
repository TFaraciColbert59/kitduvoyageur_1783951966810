/**
 * Phrase libre du premier écran (1.4) : lue par le moteur du Compas (`understandRequest`, qui s'appuie sur
 * `parseIntentRules`), jamais par un second analyseur. On en tire un lieu, une distance visée, une activité
 * (donc un profil de routage) et, si la phrase le dit en toutes lettres, la forme (boucle, aller-retour).
 * Le moteur n'a pas d'action « forme » : ce repère est un simple pré-choix, visible et modifiable.
 * Rien n'est inventé : aucun lieu n'est posé avant d'avoir été retrouvé sur la carte et confirmé (1.5).
 */
import { parseIntentRules, type CompasActivity } from '@/features/compas/engine/intent';
import { understandRequest, type RequestLine } from '@/features/compas/engine/request';
import { routeSportForActivity, type RouteSport } from '@/features/adventure-prep/routeProfiles';
import type { RouteShapeMode } from './types';

export interface StartIntent {
  /** Lieu lu (destination), sinon départ dit ; `null` si la phrase n'en contient pas. */
  readonly place: string | null;
  readonly distanceKm: number | null;
  /** Activité lue ; `null` si la phrase n'en dit aucune (le voyage ou le choix de la personne prévaut). */
  readonly activity: CompasActivity | null;
  readonly sport: RouteSport | null;
  readonly shape: RouteShapeMode | null;
  /** « Voici ce que j'ai compris », tel que le Compas l'affiche. */
  readonly lines: readonly RequestLine[];
  readonly empty: boolean;
}

const MAX_PHRASE = 240;

function shapeHint(phrase: string): RouteShapeMode | null {
  const plain = phrase.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\baller[\s-]?retour\b/.test(plain)) return 'out_and_back';
  if (/\bboucle\b/.test(plain)) return 'loop';
  return null;
}

export function readStartPhrase(text: string, today: string): StartIntent {
  const phrase = text.replace(/\s+/g, ' ').trim().slice(0, MAX_PHRASE);
  if (!phrase) {
    return { place: null, distanceKm: null, activity: null, sport: null, shape: null, lines: [], empty: true };
  }
  const understood = understandRequest(phrase, today, {}, 'fr');
  const actions = parseIntentRules(phrase, today, 'fr', {});
  const dest = actions.find((a) => a.type === 'set_destination');
  const origin = actions.find((a) => a.type === 'set_origin');
  const dist = actions.find((a) => a.type === 'set_distance');
  const act = actions.find((a) => a.type === 'set_activity');
  const place = (dest && dest.type === 'set_destination' ? dest.place : null) ?? (origin && origin.type === 'set_origin' ? origin.place : null);
  const activity = act && act.type === 'set_activity' ? act.activity : null;
  return {
    place: place?.trim() || null,
    distanceKm: dist && dist.type === 'set_distance' ? dist.km : null,
    activity,
    sport: activity ? routeSportForActivity(activity) : null,
    shape: shapeHint(phrase),
    lines: understood.lines,
    empty: false,
  };
}

/** Un lieu retrouvé, tel que `/api/geocode` le rend (sous-ensemble utile). */
export interface PlaceMatch {
  readonly id: string;
  readonly name: string;
  readonly context: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision: 'commune' | 'inexact';
}

/** « Annecy · Haute-Savoie · France » : le pays y est toujours, c'est lui qu'on confirme. */
export function placeLabel(m: Pick<PlaceMatch, 'name' | 'context' | 'country'>): string {
  const parts = [m.name, m.context, m.country].map((s) => (s ?? '').trim()).filter(Boolean);
  const seen = new Set<string>();
  return parts.filter((p) => (seen.has(p.toLowerCase()) ? false : (seen.add(p.toLowerCase()), true))).join(' · ');
}

/** Lit la réponse de `/api/geocode` ; une entrée sans coordonnée valide est écartée, jamais complétée. */
export function readGeocodeMatches(payload: unknown): PlaceMatch[] {
  if (!payload || typeof payload !== 'object') return [];
  const raw = (payload as { matches?: unknown }).matches;
  if (!Array.isArray(raw)) return [];
  const out: PlaceMatch[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const r = m as Record<string, unknown>;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (r.lat == null || r.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    if (typeof r.name !== 'string' || !r.name.trim()) continue;
    out.push({
      id: typeof r.id === 'string' ? r.id : `${lat.toFixed(4)},${lon.toFixed(4)}`,
      name: r.name,
      context: typeof r.context === 'string' ? r.context : '',
      country: typeof r.country === 'string' ? r.country : '',
      lat,
      lon,
      precision: r.precision === 'inexact' ? 'inexact' : 'commune',
    });
    if (out.length >= 5) break;
  }
  return out;
}
