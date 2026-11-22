import type { WaterObservation } from '../types';
import { orderedLegs, projectOnTrack, round1, trackVertices, type RouteGraph } from './shared';

export interface WaterGap {
  readonly status: 'known' | 'no_water_data' | 'no_track';
  /** Plus longue distance sans point d'eau connu ; `null` si aucun point d'eau n'est connu (≠ 0). */
  readonly gapKm: number | null;
  readonly fromKm: number | null;
  readonly toKm: number | null;
  readonly fromLabel: string | null;
  readonly toLabel: string | null;
  readonly trackKm: number | null;
  readonly waterPointCount: number;
  readonly method: string;
}

export interface WaterGapOptions {
  /** Écart maximal au tracé pour qu'un point compte « le long du tracé » (km). */
  readonly maxOffsetKm?: number;
}

/**
 * Plus longue distance sans point d'eau le long du tracé. Les points signalés à sec sont écartés.
 * Un point d'eau absent des données n'est pas un point sans eau : aucune donnée donne `no_water_data`.
 */
export function longestWaterGap(
  graph: RouteGraph,
  observations: readonly WaterObservation[],
  options: WaterGapOptions = {},
): WaterGap {
  const maxOffset = options.maxOffsetKm ?? 0.5;
  const method = `Distance entre points d'eau connus (cartographiés ou déclarés, hors points à sec) à moins de ${maxOffset} km du tracé`;
  const vertices = trackVertices(orderedLegs(graph));
  if (vertices.length < 2) {
    return { status: 'no_track', gapKm: null, fromKm: null, toKm: null, fromLabel: null, toLabel: null, trackKm: null, waterPointCount: 0, method };
  }
  const total = vertices[vertices.length - 1].km;
  const marks: { km: number; label: string }[] = [];
  for (const o of observations) {
    if (o.status === 'dry') continue;
    const proj = projectOnTrack(vertices, o.lat, o.lon);
    if (proj && proj.offsetKm <= maxOffset) marks.push({ km: proj.alongKm, label: o.name });
  }
  if (marks.length === 0) {
    return { status: 'no_water_data', gapKm: null, fromKm: null, toKm: null, fromLabel: null, toLabel: null, trackKm: round1(total), waterPointCount: 0, method };
  }
  marks.sort((a, b) => a.km - b.km);
  const chain = [{ km: 0, label: 'départ' }, ...marks, { km: total, label: 'arrivée' }];
  let best = { gap: -1, i: 0 };
  for (let i = 1; i < chain.length; i += 1) {
    const g = chain[i].km - chain[i - 1].km;
    if (g > best.gap) best = { gap: g, i };
  }
  return {
    status: 'known',
    gapKm: round1(best.gap),
    fromKm: round1(chain[best.i - 1].km),
    toKm: round1(chain[best.i].km),
    fromLabel: chain[best.i - 1].label,
    toLabel: chain[best.i].label,
    trackKm: round1(total),
    waterPointCount: marks.length,
    method,
  };
}

/* ---------- 7.5 Niveau de preuve ---------- */

export type WaterEvidenceLevel = 'mapped' | 'potability_declared' | 'confirmed_recent';

export interface WaterEvidence {
  readonly level: WaterEvidenceLevel;
  readonly label: string;
  /** Une observation récente signale le point à sec. */
  readonly reportedDry: boolean;
  readonly ageDays: number | null;
}

export interface WaterEvidenceOptions {
  readonly now: Date;
  /** Au-delà, une observation n'est plus « récente » (défaut 14 jours). */
  readonly freshnessDays?: number;
}

const LABELS: Record<WaterEvidenceLevel, string> = {
  mapped: 'Cartographiée',
  potability_declared: 'Potabilité déclarée',
  confirmed_recent: 'Confirmée récemment',
};

/** Trois niveaux, jamais « disponible » : une source cartographique seule ne prouve pas que l'eau coule. */
export function waterEvidenceLevel(obs: WaterObservation, options: WaterEvidenceOptions): WaterEvidence {
  const fresh = options.freshnessDays ?? 14;
  const t = obs.observedAt ? Date.parse(obs.observedAt) : NaN;
  const ageDays = Number.isFinite(t) ? Math.max(0, Math.floor((options.now.getTime() - t) / 86400000)) : null;
  const recent = ageDays !== null && ageDays <= fresh;
  const humanSource = obs.source !== 'osm';
  let level: WaterEvidenceLevel = 'mapped';
  if (recent && humanSource && obs.status === 'flowing') level = 'confirmed_recent';
  else if (obs.potableClaim === 'yes') level = 'potability_declared';
  return { level, label: LABELS[level], reportedDry: recent && obs.status === 'dry', ageDays };
}
