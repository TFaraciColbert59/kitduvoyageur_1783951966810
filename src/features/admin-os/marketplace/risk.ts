/**
 * Seller risk scoring (inspiré Stripe Radar for Platforms) : score 0-100 +
 * indicateurs explicatifs. Gradué, jamais binaire : le score alimente la
 * file de review, la décision reste humaine (restrict ≠ ban).
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SellerSignals {
  accountAgeDays: number;
  completedTx: number;
  disputes: number;
  reports: number;
  activeListings: number;
  /** trust_score vendeur (0-100) si lisible ; atténue le biais historique. */
  trustScore?: number | null;
}

export interface SellerRisk {
  score: number;
  level: RiskLevel;
  indicators: string[];
}

export function scoreSellerRisk(s: SellerSignals): SellerRisk {
  let score = 0;
  const indicators: string[] = [];

  if (s.accountAgeDays < 30) {
    score += 30;
    indicators.push('new_account');
  } else if (s.accountAgeDays < 90) {
    score += 10;
    indicators.push('recent_account');
  }
  if (s.completedTx === 0) {
    score += 15;
    indicators.push('no_history');
  }
  if (s.disputes >= 3) {
    score += 40;
    indicators.push('repeat_disputes');
  } else if (s.disputes >= 1) {
    score += 15;
    indicators.push('past_dispute');
  }
  if (s.reports >= 5) {
    score += 30;
    indicators.push('multiple_reports');
  } else if (s.reports >= 1) {
    score += 10;
    indicators.push('reported');
  }
  if (s.disputes >= 3 && s.reports >= 5) {
    // Combinaison litiges × signalements : schéma de fraude probable.
    score += 15;
    indicators.push('fraud_pattern');
  }
  if (s.activeListings >= 10 && s.completedTx < 5) {
    score += 15;
    indicators.push('high_velocity_no_history');
  }
  if (typeof s.trustScore === 'number' && s.trustScore >= 80) {
    score -= 20;
    indicators.push('trusted_seller');
  }

  const clamped = Math.min(100, Math.max(0, score));
  const level: RiskLevel =
    clamped >= 80 ? 'critical' : clamped >= 50 ? 'high' : clamped >= 30 ? 'medium' : 'low';
  return { score: clamped, level, indicators };
}
