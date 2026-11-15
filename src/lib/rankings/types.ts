import type {
  ChallengeProgressState,
  ChallengeRule,
  LocalLegendResult,
  LocalLegendTarget,
  PeakBaggingSummary,
  PeerComparisonResult,
  PeriodLeaderboardResult,
  TrophyShowcase,
} from '@/features/rankings/types';

/** Options de cible exposées par l'API Local Legends (aucune coordonnée GPS). */
export interface LegendTargetOption extends LocalLegendTarget {
  /** Nombre de passages retenus dans la fenêtre, pour trier les cibles. */
  effortCount: number;
}

export interface RankingsMeta {
  generatedAt: string;
  /** Le contrat G03 est fail-closed : les exclusions sont comptées, jamais devinées. */
  privacy: 'fail_closed';
}

export interface LeaderboardPayload {
  result: PeriodLeaderboardResult;
  meta: RankingsMeta;
}

export interface LocalLegendsPayload {
  targets: LegendTargetOption[];
  result: LocalLegendResult | null;
  meta: RankingsMeta;
}

export interface PeaksPayload {
  summary: PeakBaggingSummary | null;
  meta: RankingsMeta;
}

export interface ChallengeItem {
  rule: ChallengeRule;
  /** false quand la base ne fournit pas la donnée nécessaire au suivi. */
  trackable: boolean;
  /** null si le challenge n'est pas suivable (jamais un zéro inventé). */
  progress: ChallengeProgressState | null;
  leaderboard: PeriodLeaderboardResult['entries'] | null;
}

export interface ChallengesPayload {
  items: ChallengeItem[];
  meta: RankingsMeta;
}

export interface TrophiesPayload {
  showcase: TrophyShowcase;
  meta: RankingsMeta;
}

export interface PeersPayload {
  result: PeerComparisonResult;
  meta: RankingsMeta;
}

export interface RankingsApiEnvelope<T> {
  success: true;
  data: T;
}

export interface RankingsApiError {
  success: false;
  error: string;
  code?: string;
}
