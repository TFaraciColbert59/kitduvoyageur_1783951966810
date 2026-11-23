/**
 * Position en direct (2.9) : point bleu, cap et écart au tracé. Pur : le suivi GPS vit dans le composant,
 * ici on lit un relevé. Un cap que le capteur ne donne pas est calculé depuis les deux dernières positions
 * seulement si l'on a vraiment bougé ; sinon il est inconnu, jamais deviné.
 */
import { haversineM, headingLabel, type TrackDeviation } from './mapGeometry';

export interface LiveFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracyM: number | null;
  /** Cap du capteur (degrés depuis le nord), `null` si absent. */
  readonly headingDeg: number | null;
  readonly timestamp: number;
}

/** En dessous, la position bouge de la précision du GPS : aucun cap n'en sort. */
export const MIN_MOVE_FOR_HEADING_M = 8;

export function bearingDeg(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lon - from.lon)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lon - from.lon));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function headingOf(prev: LiveFix | null, cur: LiveFix): number | null {
  if (cur.headingDeg != null && Number.isFinite(cur.headingDeg)) return ((cur.headingDeg % 360) + 360) % 360;
  if (!prev) return null;
  if (haversineM([prev.lon, prev.lat], [cur.lon, cur.lat]) < MIN_MOVE_FOR_HEADING_M) return null;
  return bearingDeg(prev, cur);
}

export interface LiveStatus {
  readonly tone: 'on_track' | 'off_track' | 'unknown';
  readonly text: string;
}

function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;
}

/** « Sur le tracé · km 12,4 », « À 180 m du tracé », ou « Écart inconnu » quand il n'y a pas de tracé. */
export function describeLive(dev: TrackDeviation | null, heading: number | null, accuracyM: number | null): LiveStatus {
  const dir = headingLabel(heading);
  const acc = accuracyM != null && Number.isFinite(accuracyM) ? ` · précision ± ${Math.round(accuracyM)} m` : '';
  if (!dev) return { tone: 'unknown', text: `Écart au tracé inconnu : aucun tracé à comparer${dir ? ` · cap ${dir}` : ''}${acc}` };
  if (dev.offTrack) {
    return { tone: 'off_track', text: `À ${fmtDistance(dev.distanceM)} du tracé${dir ? ` · cap ${dir}` : ''}${acc}` };
  }
  return {
    tone: 'on_track',
    text: `Sur le tracé · km ${dev.alongKm.toLocaleString('fr-FR')}${dir ? ` · cap ${dir}` : ''}${acc}`,
  };
}
