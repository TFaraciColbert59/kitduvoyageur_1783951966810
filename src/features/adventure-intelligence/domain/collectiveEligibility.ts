/**
 * A4 — Éligibilité collective d'un passage (moteur pur).
 *
 * Un passage ne rejoint l'agrégat collectif que si l'utilisateur y a consenti,
 * que la session est terminée, que la qualité GPS / map-matching / passage est
 * suffisante et que le déplacement est plausible. Chaque refus produit une
 * raison explicite, sans jamais exposer d'identité.
 */
export interface EligibilityInput {
  consentCollective: boolean;
  sessionFinished: boolean;
  gpsQuality: number;
  mapMatchQuality: number;
  plausibleMovement: boolean;
  passageQuality: number;
}

/** Seuils normatifs d'éligibilité (spec A4). */
export const ELIGIBILITY_THRESHOLDS = {
  gpsQuality: 0.6,
  mapMatchQuality: 0.6,
  passageQuality: 0.5,
} as const;

/** Raisons de refus, stables et ordonnées. */
export const ELIGIBILITY_REASONS = {
  consent: 'consentement_collectif_absent',
  session: 'session_non_terminee',
  gps: 'qualite_gps_insuffisante',
  mapMatch: 'qualite_map_matching_insuffisante',
  movement: 'mouvement_non_plausible',
  passage: 'qualite_passage_insuffisante',
} as const;

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

function belowThreshold(value: number, threshold: number): boolean {
  return !Number.isFinite(value) || value < threshold;
}

/** Évalue l'éligibilité collective d'un passage et explique chaque refus. */
export function collectiveEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: string[] = [];

  if (!input.consentCollective) reasons.push(ELIGIBILITY_REASONS.consent);
  if (!input.sessionFinished) reasons.push(ELIGIBILITY_REASONS.session);
  if (belowThreshold(input.gpsQuality, ELIGIBILITY_THRESHOLDS.gpsQuality)) {
    reasons.push(ELIGIBILITY_REASONS.gps);
  }
  if (belowThreshold(input.mapMatchQuality, ELIGIBILITY_THRESHOLDS.mapMatchQuality)) {
    reasons.push(ELIGIBILITY_REASONS.mapMatch);
  }
  if (!input.plausibleMovement) reasons.push(ELIGIBILITY_REASONS.movement);
  if (belowThreshold(input.passageQuality, ELIGIBILITY_THRESHOLDS.passageQuality)) {
    reasons.push(ELIGIBILITY_REASONS.passage);
  }

  return { eligible: reasons.length === 0, reasons };
}
