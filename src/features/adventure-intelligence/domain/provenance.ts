/**
 * Provenance des données — taxonomie alignée sur
 * `src/features/trips/schemas/autoGen.schema.ts` (ProvenanceTypeEnum).
 *
 * Parité garantie par le type (aucun import runtime) et vérifiée par le test
 * TEST-A1-PROV-01 entre `PROVENANCE_SOURCES` et `ProvenanceTypeEnum.options`.
 */
import type { ProvenanceType } from '@/features/trips/schemas/autoGen.schema';

export type ProvenanceSource = ProvenanceType;

export interface DataProvenance {
  source: ProvenanceSource;
  sourceRef?: string;
  observedAt?: string;
  freshnessSeconds?: number;
  notes?: string;
}

/** Liste normative des sources, dans l'ordre de la taxonomie existante. */
export const PROVENANCE_SOURCES = [
  'measured',
  'official',
  'community',
  'computed',
  'estimated',
  'suggested',
] as const satisfies readonly ProvenanceSource[];

/** Sources qui engagent une résolution vérifiable (référence ou observation). */
export const REQUIRES_RESOLUTION_SOURCES = ['measured', 'official', 'community'] as const;

export function isResolvableProvenance(provenance: DataProvenance): boolean {
  if (!(REQUIRES_RESOLUTION_SOURCES as readonly string[]).includes(provenance.source)) {
    return true;
  }
  return Boolean(provenance.sourceRef || provenance.observedAt);
}

/**
 * Une provenance est périmée si son horodatage d'observation dépasse
 * `maxAgeSeconds`, ou si aucun horodatage exploitable n'est présent
 * (fraîcheur indéterminable ⇒ prudence).
 */
export function isStale(provenance: DataProvenance, nowIso: string, maxAgeSeconds: number): boolean {
  if (!provenance.observedAt) return true;
  const observedMs = Date.parse(provenance.observedAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(observedMs) || Number.isNaN(nowMs)) return true;
  return (nowMs - observedMs) / 1000 > maxAgeSeconds;
}
