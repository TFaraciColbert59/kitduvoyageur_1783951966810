/**
 * Conservation & confiance (chantier lignées, Lot 4).
 *
 * Ce module contient la logique de DÉCISION et d'AFFICHAGE qui entoure les vues
 * matérialisées SQL (`kit_item_survival`, `kit_trust_scores`) : plancher de
 * crédibilité, vocabulaire public, décroissance temporelle (miroir exact du
 * SQL), seuils de découverte. Les calculs lourds vivent en base ; ici, ce qui
 * est testable sans PostgreSQL.
 */

/** Plancher de crédibilité : sous ce nombre de sessions terrain, aucun score. */
export const FIELD_PROOF_FLOOR_SESSIONS = 5;

/** Seuil de découverte : pas de classement régional sous 20 lignées publiques. */
export const DISCOVERY_REGION_MIN_LINEAGES = 20;

/** Taux de conservation 0..1 — null si aucune donnée (pas de score sur du vide). */
export function survivalRate(kept: number, dropped: number): number | null {
  const total = kept + dropped;
  if (total <= 0) return null;
  return Math.round((kept / total) * 1000) / 1000;
}

/** Plancher de crédibilité : sous 5 sessions prouvées, aucun score affiché. */
export function shouldDisplayScore(sessions: number): boolean {
  return sessions >= FIELD_PROOF_FLOOR_SESSIONS;
}

export type ScoreStatus = 'none' | 'young' | 'proven';

/** « pas encore éprouvé » / « lignée jeune » / « éprouvé » — vocabulaire public. */
export function scoreStatus(sessions: number): {
  status: ScoreStatus;
  label: string;
  displayScore: boolean;
} {
  if (sessions <= 0) return { status: 'none', label: 'pas encore éprouvé', displayScore: false };
  if (sessions < FIELD_PROOF_FLOOR_SESSIONS) {
    return { status: 'young', label: 'lignée jeune', displayScore: false };
  }
  return { status: 'proven', label: 'éprouvé', displayScore: true };
}

/**
 * Décroissance temporelle d'un fork de la lignée (miroir du SQL) :
 * 1 / pow(age_heures + 2, 1.5) — évite la fossilisation des vieilles lignées.
 */
export function descendanceDecay(ageHours: number): number {
  return 1 / Math.pow(Math.max(0, ageHours) + 2, 1.5);
}

/** « gardé par 7 voyageurs sur 10 » — métrique fondatrice, jamais de vocabulaire génétique. */
export function conservationPhrase(rate: number): string {
  const perTen = Math.round(rate * 10);
  return `gardé par ${perTen} voyageur${perTen > 1 ? 's' : ''} sur 10`;
}

/** Seuil anti-plateforme-vide : pas de classement régional sous 20 lignées publiques. */
export function shouldShowRegionRanking(publicLineagesInRegion: number): boolean {
  return publicLineagesInRegion >= DISCOVERY_REGION_MIN_LINEAGES;
}