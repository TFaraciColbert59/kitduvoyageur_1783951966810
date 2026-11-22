import type { CollaborativeStage } from '../types';
import { projectOnTrack, round1, stageLegs, trackVertices, type RouteGraph } from './shared';

export interface BailoutCandidate {
  readonly id: string;
  readonly name: string;
  readonly kind: 'road' | 'transport_stop';
  readonly lat: number;
  readonly lon: number;
}

export interface BailoutHit {
  readonly candidate: BailoutCandidate;
  /** Distance à vol d'oiseau jusqu'au tracé de l'étape (km), pas un temps de marche. */
  readonly distanceKm: number;
  /** Position du point du tracé le plus proche, depuis le début de l'étape (km). */
  readonly alongKm: number;
}

export interface BailoutResult {
  readonly nearest: BailoutHit | null;
  readonly nearestByKind: Readonly<Partial<Record<BailoutCandidate['kind'], BailoutHit>>>;
  /** Pourquoi il n'y a pas de résultat (aucun candidat fourni, tracé vide). */
  readonly reason: string | null;
  readonly method: string;
}

export const BAILOUT_METHOD = 'Distance à vol d’oiseau entre le lieu fourni et le point le plus proche du tracé de l’étape';

export function nearestBailout(
  stagePolyline: readonly (readonly [number, number])[],
  candidates: readonly BailoutCandidate[],
): BailoutResult {
  const empty = (reason: string): BailoutResult => ({ nearest: null, nearestByKind: {}, reason, method: BAILOUT_METHOD });
  if (stagePolyline.length < 2) return empty('tracé de l’étape inconnu');
  if (candidates.length === 0) return empty('aucune route ni arrêt de transport fourni');
  let km = 0;
  const verts = stagePolyline.map(([lon, lat], i) => {
    if (i > 0) {
      const [plon, plat] = stagePolyline[i - 1];
      const dy = (lat - plat) * 110.574;
      const dx = (lon - plon) * Math.cos((lat * Math.PI) / 180) * 111.32;
      km += Math.sqrt(dx * dx + dy * dy);
    }
    return { lat, lon, km };
  });
  let nearest: BailoutHit | null = null;
  const byKind: Partial<Record<BailoutCandidate['kind'], BailoutHit>> = {};
  for (const c of candidates) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const p = projectOnTrack(verts, c.lat, c.lon);
    if (!p) continue;
    const hit: BailoutHit = { candidate: c, distanceKm: Math.round(p.offsetKm * 100) / 100, alongKm: round1(p.alongKm) };
    if (!nearest || hit.distanceKm < nearest.distanceKm) nearest = hit;
    const cur = byKind[c.kind];
    if (!cur || hit.distanceKm < cur.distanceKm) byKind[c.kind] = hit;
  }
  return { nearest, nearestByKind: byKind, reason: nearest ? null : 'aucun candidat exploitable', method: BAILOUT_METHOD };
}

export function bailoutsByStage(
  graph: RouteGraph & { readonly stages: readonly CollaborativeStage[] },
  candidates: readonly BailoutCandidate[],
): { readonly stageId: string; readonly dayNumber: number; readonly result: BailoutResult }[] {
  return graph.stages
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((s) => ({
      stageId: s.id,
      dayNumber: s.dayNumber,
      result: nearestBailout(
        trackVertices(stageLegs(graph, s)).map((v) => [v.lon, v.lat] as const),
        candidates,
      ),
    }));
}
