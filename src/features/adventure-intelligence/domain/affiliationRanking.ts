/**
 * A8 — Classement d'affiliation transparent (domaine pur).
 *
 * Le classement est d'abord fondé sur la pertinence pour le voyageur
 * (équipement manquant, budget restant, disponibilité). La commission
 * n'est **jamais** lue : deux offres identiques à la commission près
 * gardent exactement le même score et le même ordre.
 */
import { clamp01 } from './confidence';

export interface AffiliationOffer {
  id: string;
  title: string;
  category: 'gear' | 'stay' | 'activity' | 'transport' | 'rental';
  relevanceScore: number;
  commissionPct: number;
  priceEur: number;
  availability: 'available' | 'unknown' | 'unavailable';
}

export interface AffiliationContext {
  missingGearCategories: string[];
  budgetRemainingEur: number | null;
}

export interface RankedAffiliationOffer {
  offerId: string;
  score: number;
  reasons: string[];
}

/** Amplitude maximale des ajustements de contexte (la pertinence reste reine). */
export const MAX_CONTEXT_BOOST = 0.05;

/** Bonus/malus de contexte, volontairement petits devant la pertinence. */
export const MISSING_GEAR_BOOST = 0.03;
export const BUDGET_FIT_BOOST = 0.02;
export const BUDGET_OVER_PENALTY = -0.04;
export const UNKNOWN_AVAILABILITY_PENALTY = -0.02;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

function scoreOffer(offer: AffiliationOffer, context: AffiliationContext): RankedAffiliationOffer {
  const relevance = clamp01(offer.relevanceScore);
  const reasons: string[] = [`Pertinence ${Math.round(relevance * 100)}/100.`];
  let boost = 0;

  if (context.missingGearCategories.length > 0 && offer.category === 'gear') {
    boost += MISSING_GEAR_BOOST;
    reasons.push('Équipement manquant priorisé.');
  }

  if (context.budgetRemainingEur != null) {
    if (offer.priceEur > context.budgetRemainingEur) {
      boost += BUDGET_OVER_PENALTY;
      reasons.push('Dépasse le budget restant — à arbitrer.');
    } else {
      boost += BUDGET_FIT_BOOST;
      reasons.push('Dans le budget restant.');
    }
  }

  if (offer.availability === 'unknown') {
    boost += UNKNOWN_AVAILABILITY_PENALTY;
    reasons.push('Disponibilité à confirmer.');
  } else if (offer.availability === 'available') {
    reasons.push('Disponibilité confirmée.');
  }

  const score = clamp01(relevance + clamp(boost, -MAX_CONTEXT_BOOST, MAX_CONTEXT_BOOST));
  return { offerId: offer.id, score, reasons };
}

/**
 * Classe les offres par pertinence contextualisée, du meilleur au moins bon.
 * Les offres indisponibles sont exclues. `commissionPct` n'est jamais lu :
 * le tri est stable, donc des scores égaux conservent l'ordre d'entrée.
 */
export function rankAffiliationOffers(
  offers: AffiliationOffer[],
  context: AffiliationContext
): RankedAffiliationOffer[] {
  return offers
    .filter((offer) => offer.availability !== 'unavailable')
    .map((offer) => scoreOffer(offer, context))
    .sort((a, b) => b.score - a.score);
}
