/**
 * Catastrophes mondiales (7.6, hors Europe) : GDACS (Global Disaster Alert and Coordination System, ONU / Commission
 * européenne), flux public sans clé. Module pur, testé sur une réponse réelle du 23/11/2026.
 *
 * Ce que dit la source, et ce qu'elle ne dit pas : un événement est un POINT de référence (épicentre, centre du
 * cyclone, centroïde du feu) avec un niveau d'alerte Orange ou Rouge. Il est rapproché du tracé par la distance au
 * point de tracé le plus proche, dans un rayon propre à chaque type d'aléa ; ce n'est PAS une emprise : le message le
 * dit (« à X km du tracé »). Les sécheresses (centroïde sans sens pour un itinéraire) et le niveau Vert ne sont pas
 * demandés. Un événement échu est écarté. Un flux illisible n'est jamais lu comme « rien à signaler ».
 */
import { haversineKm } from '@/features/adventure-prep/engine/routing';

export const GDACS_SOURCE = 'GDACS (ONU / Commission européenne) · événements Orange et Rouge';
export const GDACS_EVENT_TYPES = ['EQ', 'TC', 'FL', 'VO', 'WF'] as const;
export type GdacsEventType = (typeof GDACS_EVENT_TYPES)[number];

export const GDACS_TYPE_LABEL: Record<GdacsEventType, string> = {
  EQ: 'Séisme',
  TC: 'Cyclone tropical',
  FL: 'Inondation',
  VO: 'Volcan',
  WF: 'Feu de forêt',
};

/** Rayon de rapprochement avec le tracé (km), par type d'aléa. */
export const GDACS_RADIUS_KM: Record<GdacsEventType, number> = { EQ: 150, TC: 300, FL: 100, VO: 100, WF: 50 };

export interface WorldHazardPayload {
  readonly status: 'clear' | 'alerts' | 'unavailable';
  readonly source: string | null;
  readonly retrievedAt: string | null;
  readonly reason: string | null;
  readonly impacts: readonly WorldHazardImpact[];
}

export interface WorldHazardImpact {
  readonly id: string;
  readonly eventType: GdacsEventType;
  readonly level: 'orange' | 'rouge';
  readonly title: string;
  readonly distanceKm: number;
  readonly observedAt: string | null;
  readonly validUntil: string | null;
  readonly url: string | null;
}

export interface GdacsEvent {
  readonly id: string;
  readonly eventType: GdacsEventType;
  readonly level: 'orange' | 'rouge';
  readonly title: string;
  readonly lat: number;
  readonly lon: number;
  readonly observedAt: string | null;
  readonly validUntil: string | null;
  readonly url: string | null;
}

/** GDACS date en UTC sans fuseau (« 2026-11-03T06:00:00 ») : on le dit explicitement. */
function utcIso(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const s = /(Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}Z`;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Réponse GeoJSON de GDACS → événements ; `null` si ce n'est pas un flux d'événements (jamais « aucun »). */
export function parseGdacs(json: unknown): GdacsEvent[] | null {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return null;
  const out: GdacsEvent[] = [];
  for (const f of features) {
    const props = (f as { properties?: Record<string, unknown> })?.properties;
    const coords = (f as { geometry?: { type?: string; coordinates?: unknown } })?.geometry;
    if (!props || coords?.type !== 'Point' || !Array.isArray(coords.coordinates)) continue;
    const [lon, lat] = coords.coordinates as unknown[];
    const type = String(props.eventtype ?? '');
    const level = String(props.alertlevel ?? '').toLowerCase();
    if (!(GDACS_EVENT_TYPES as readonly string[]).includes(type)) continue;
    if (level !== 'orange' && level !== 'red') continue;
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const url = (props.url as { report?: unknown } | undefined)?.report;
    out.push({
      id: `${type}:${String(props.eventid ?? '')}:${String(props.episodeid ?? '')}`,
      eventType: type as GdacsEventType,
      level: level === 'red' ? 'rouge' : 'orange',
      title: String(props.name ?? props.description ?? GDACS_TYPE_LABEL[type as GdacsEventType]).replace(/\s+/g, ' ').trim().slice(0, 160),
      lat,
      lon,
      observedAt: utcIso(props.datemodified) ?? utcIso(props.fromdate),
      validUntil: utcIso(props.todate),
      url: typeof url === 'string' && url.startsWith('https://www.gdacs.org/') ? url : null,
    });
  }
  return out;
}

/** Événements en cours dont le point de référence est à portée du tracé, du plus proche au plus lointain. */
export function gdacsImpactsOnTrack(
  events: readonly GdacsEvent[],
  track: readonly { lat: number; lon: number }[],
  now: Date,
): WorldHazardImpact[] {
  const out: WorldHazardImpact[] = [];
  for (const ev of events) {
    if (ev.validUntil && Date.parse(ev.validUntil) < now.getTime()) continue;
    let nearest = Infinity;
    for (const p of track) nearest = Math.min(nearest, haversineKm(p, { lat: ev.lat, lon: ev.lon }));
    if (!(nearest <= GDACS_RADIUS_KM[ev.eventType])) continue;
    out.push({
      id: ev.id,
      eventType: ev.eventType,
      level: ev.level,
      title: ev.title,
      distanceKm: Math.round(nearest),
      observedAt: ev.observedAt,
      validUntil: ev.validUntil,
      url: ev.url,
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

export function worldHazardPayload(
  events: readonly GdacsEvent[] | null,
  track: readonly { lat: number; lon: number }[],
  retrievedAt: string,
  now: Date,
): WorldHazardPayload {
  if (!events) {
    return { status: 'unavailable', source: null, retrievedAt: null, reason: 'GDACS indisponible ou illisible : aucun « rien à signaler » n’est affiché.', impacts: [] };
  }
  const impacts = gdacsImpactsOnTrack(events, track, now);
  return { status: impacts.length > 0 ? 'alerts' : 'clear', source: GDACS_SOURCE, retrievedAt, reason: null, impacts };
}
