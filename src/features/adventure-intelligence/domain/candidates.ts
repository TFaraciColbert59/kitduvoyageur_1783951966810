/**
 * A6 — Variantes d'aventure (comfort / balanced / adventure).
 *
 * Construction pure et déterministe : les deltas sont des écarts bornés par
 * rapport à la variante de référence `balanced`, jamais des données inventées.
 * `adventure` pousse l'autonomie et le risque, `comfort` les marges et les
 * pauses, `balanced` reste intermédiaire.
 */

export const CANDIDATE_IDS = ['comfort', 'balanced', 'adventure'] as const;

export type AdventureCandidateId = (typeof CANDIDATE_IDS)[number];

export interface AdventureCandidate {
  id: AdventureCandidateId;
  label: string;
  budgetDeltaPct: number;
  effortDeltaPct: number;
  durationDeltaPct: number;
  comfortScore: number;
  riskScore: number;
  uncertainty: number;
  reasons: string[];
}

export interface BuildCandidatesInput {
  days?: number;
  participantsCount?: number;
  budgetTier?: 'shoestring' | 'moderate' | 'comfort';
  month?: number;
}

type CandidateProfile = Omit<AdventureCandidate, 'reasons' | 'id'> & { reasons: string[] };

const PROFILES: Record<AdventureCandidateId, CandidateProfile> = {
  comfort: {
    label: 'Confort',
    budgetDeltaPct: 18,
    effortDeltaPct: -12,
    durationDeltaPct: 8,
    comfortScore: 0.85,
    riskScore: 0.2,
    uncertainty: 0.15,
    reasons: [
      'Marges quotidiennes augmentées : pauses, récupération et jours tampon.',
      'Hébergement et transferts privilégiés pour réduire l’effort ressenti.',
      'Budget majoré pour absorber les imprévus logistiques.',
    ],
  },
  balanced: {
    label: 'Équilibré',
    budgetDeltaPct: 0,
    effortDeltaPct: 0,
    durationDeltaPct: 0,
    comfortScore: 0.6,
    riskScore: 0.45,
    uncertainty: 0.25,
    reasons: [
      'Compromis effort / confort aligné sur l’intention déclarée.',
      'Budget et durée de référence, sans arbitrage extrême.',
      'Variante recommandée par défaut en cas de doute.',
    ],
  },
  adventure: {
    label: 'Aventure',
    budgetDeltaPct: -12,
    effortDeltaPct: 22,
    durationDeltaPct: -6,
    comfortScore: 0.35,
    riskScore: 0.72,
    uncertainty: 0.4,
    reasons: [
      'Autonomie renforcée : nuits sauvages et ravitaillement espacé.',
      'Effort quotidien majoré et durée compressée.',
      'Risques et incertitude assumés, marge de repli réduite.',
    ],
  },
};

function positiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback;
  return Math.trunc(value);
}

function contextReasons(input: BuildCandidatesInput): string[] {
  const reasons: string[] = [];
  const days = positiveInteger(input.days, 0);
  if (days > 0) reasons.push(`Calibré pour ${days} jour${days > 1 ? 's' : ''}.`);
  const participants = positiveInteger(input.participantsCount, 1);
  if (participants > 1) {
    reasons.push(`Variante groupe (${participants} participants) : logistique partagée.`);
  }
  if (input.budgetTier === 'shoestring') {
    reasons.push('Budget serré : arbitrages économiques prioritaires.');
  } else if (input.budgetTier === 'comfort') {
    reasons.push('Budget confort : arbitrages en faveur de la marge.');
  }
  return reasons;
}

export function buildCandidates(input: BuildCandidatesInput = {}): AdventureCandidate[] {
  const context = contextReasons(input);

  return CANDIDATE_IDS.map((id) => {
    const profile = PROFILES[id];
    return {
      id,
      label: profile.label,
      budgetDeltaPct: profile.budgetDeltaPct,
      effortDeltaPct: profile.effortDeltaPct,
      durationDeltaPct: profile.durationDeltaPct,
      comfortScore: profile.comfortScore,
      riskScore: profile.riskScore,
      uncertainty: profile.uncertainty,
      reasons: [...profile.reasons, ...context],
    };
  });
}
