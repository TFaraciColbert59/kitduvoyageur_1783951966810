import 'server-only';

import {
  deduplicateAndMergeSegments,
  evaluateSegmentVerification,
  type SegmentDefinition,
} from '@/features/segments';
import {
  listEfforts,
  listSegments,
  replaceAllEfforts,
  upsertSegments,
} from './store';

export interface SegmentMaintenanceResult {
  segments: SegmentDefinition[];
  mergedPairs: Array<{ duplicateId: string; canonicalId: string }>;
  verifiedIds: string[];
}

/**
 * Entretien S4.04 : fusion des doublons puis promotion des segments qui
 * remplissent les critères de vérification. Idempotent.
 */
export function runSegmentMaintenance(): SegmentMaintenanceResult {
  const deduplicated = deduplicateAndMergeSegments(listSegments(), listEfforts());
  replaceAllEfforts(deduplicated.efforts);

  const verifiedIds: string[] = [];
  const segments = deduplicated.segments.map((segment) => {
    if (segment.deletedAt || segment.hazardous || segment.canonicalSegmentId !== null) {
      return segment;
    }
    if (segment.verified) return segment;
    const evaluation = evaluateSegmentVerification(segment, deduplicated.efforts);
    if (!evaluation.eligibleForVerified) return segment;
    verifiedIds.push(segment.id);
    return {
      ...segment,
      verified: true,
      verifiedReason: 'criteria_met',
    };
  });

  upsertSegments(segments);
  return {
    segments,
    mergedPairs: deduplicated.mergedPairs,
    verifiedIds,
  };
}

/** Retrouve un segment après fusion : le demandeur peut viser un doublon absorbé. */
export function resolveCanonicalSegment(segmentId: string): SegmentDefinition | null {
  const all = listSegments();
  const direct = all.find((segment) => segment.id === segmentId);
  if (!direct) return null;
  if (!direct.canonicalSegmentId) return direct;
  return all.find((segment) => segment.id === direct.canonicalSegmentId) ?? direct;
}
