/**
 * A5 — Détection automatique Terrain Live (shadow uniquement).
 *
 * Signaux collectifs : ralentissement ≥ 1,6× la médiane attendue, demi-tours
 * répétés, sorties de trace répétées, contournements ralentis. Le moteur est
 * **toujours shadow** : il produit des candidats `source_type = 'auto'` jamais
 * publiés (flag `terrain_auto_detection_shadow`, ADR-AI-008), à journaliser
 * pour comparaison. Aucune I/O, aucune identité.
 */
import {
  normalizedSlowdown,
  percentile,
  type CollectivePassage,
} from './collectiveIntelligence';
import type { TerrainReportCategory } from '../schemas/live.schema';

/** Garde-fou normatif : aucune détection automatique n'est publiée. */
export const AUTO_DETECTION_SHADOW = true;

/** Seuil de ralentissement collectif (ratio observé/attendu). */
export const AUTO_SLOWDOWN_THRESHOLD = 1.6;
/** Passages valides minimum pour parler de ralentissement collectif. */
export const AUTO_MIN_COLLECTIVE_PASSAGES = 3;
/** Demi-tours minimum pour suspecter une fermeture. */
export const AUTO_MIN_UTURNS = 3;
/** Sorties de trace minimum pour suspecter un balisage manquant. */
export const AUTO_MIN_OFF_ROUTE = 3;
/** Ralentissement minimum d'un contournement. */
export const AUTO_BYPASS_SLOWDOWN_THRESHOLD = 1.3;
/** Contournements minimum pour suspecter un obstacle. */
export const AUTO_MIN_BYPASSES = 3;

export interface TerrainAutoCandidate {
  category: TerrainReportCategory;
  segmentId: number;
  reason: string;
  confidence: number;
  /** Toujours `auto` : jamais un signalement utilisateur. */
  sourceType: 'auto';
  /** Toujours `true` : candidat non publié (shadow mode). */
  shadow: true;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatRatio(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function hasUsableDurations(passage: CollectivePassage): boolean {
  return (
    Number.isFinite(passage.observedDurationS) &&
    passage.observedDurationS > 0 &&
    Number.isFinite(passage.expectedDurationS) &&
    passage.expectedDurationS > 0
  );
}

/**
 * Détecte les candidats automatiques par segment. Sortie déterministe (triée
 * par segment puis catégorie), raisons explicites et chiffrées. Aucun candidat
 * n'est publié : tous portent `shadow: true` et `sourceType: 'auto'`.
 */
export function detectAutoCandidates(input: {
  passages: CollectivePassage[];
}): TerrainAutoCandidate[] {
  const groups = new Map<number, CollectivePassage[]>();
  for (const passage of input.passages) {
    if (!Number.isFinite(passage.segmentId)) continue;
    const bucket = groups.get(passage.segmentId);
    if (bucket) bucket.push(passage);
    else groups.set(passage.segmentId, [passage]);
  }

  const candidates = new Map<string, TerrainAutoCandidate>();
  const addCandidate = (
    segmentId: number,
    category: TerrainReportCategory,
    reason: string,
    confidence: number
  ): void => {
    const key = `${segmentId}::${category}`;
    const existing = candidates.get(key);
    if (existing) {
      existing.reason = `${existing.reason}; ${reason}`;
      existing.confidence = clampScore(Math.max(existing.confidence, confidence));
      return;
    }
    candidates.set(key, {
      category,
      segmentId,
      reason,
      confidence: clampScore(confidence),
      sourceType: 'auto',
      shadow: true,
    });
  };

  for (const [segmentId, passages] of groups) {
    const ratios = passages
      .filter(hasUsableDurations)
      .map((passage) => normalizedSlowdown(passage.observedDurationS, passage.expectedDurationS));

    if (ratios.length >= AUTO_MIN_COLLECTIVE_PASSAGES) {
      const median = percentile(ratios, 0.5);
      if (median !== null && median >= AUTO_SLOWDOWN_THRESHOLD) {
        addCandidate(
          segmentId,
          'obstacle',
          `ralentissement_collectif_x${formatRatio(median)}`,
          0.4 +
            (median - AUTO_SLOWDOWN_THRESHOLD) * 0.3 +
            Math.min(1, ratios.length / 10) * 0.2
        );
      }
    }

    const uturns = passages.filter((passage) => passage.uturnDetected === true).length;
    if (uturns >= AUTO_MIN_UTURNS) {
      addCandidate(segmentId, 'closure', `demi_tours_repetes_${uturns}`, 0.35 + uturns * 0.08);
    }

    const offRouteCount = passages.filter((passage) => passage.offRoute === true).length;
    if (offRouteCount >= AUTO_MIN_OFF_ROUTE) {
      addCandidate(
        segmentId,
        'marking',
        `sorties_de_trace_repetees_${offRouteCount}`,
        0.3 + offRouteCount * 0.07
      );
    }

    const bypasses = passages.filter(
      (passage) =>
        passage.offRoute === true &&
        passage.uturnDetected !== true &&
        hasUsableDurations(passage) &&
        normalizedSlowdown(passage.observedDurationS, passage.expectedDurationS) >=
          AUTO_BYPASS_SLOWDOWN_THRESHOLD
    ).length;
    if (bypasses >= AUTO_MIN_BYPASSES) {
      addCandidate(
        segmentId,
        'obstacle',
        `contournements_repetes_${bypasses}`,
        0.3 + bypasses * 0.07
      );
    }
  }

  return [...candidates.values()].sort((a, b) => {
    if (a.segmentId !== b.segmentId) return a.segmentId - b.segmentId;
    if (a.category === b.category) return 0;
    return a.category < b.category ? -1 : 1;
  });
}
