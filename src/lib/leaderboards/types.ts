import type {
  EffortRejectionReason,
  LeaderboardFilterCapabilities,
  LocalLegendResult,
  SanitizedLeaderboardEntry,
  SegmentDefinition,
  SegmentEffortInput,
  SegmentLeaderboardResult,
} from '@/features/leaderboards';

/**
 * Vue serveur d'un segment de classement : le contrat S02 ne transporte que
 * l'identité sportive, le nom et la région restent des métadonnées d'écran.
 */
export interface LeaderboardSegmentView extends SegmentDefinition {
  name: string;
  region: string | null;
  surface: string | null;
  createdAt: string | null;
}

export interface LeaderboardClubOption {
  id: string;
  name: string;
}

export interface LeaderboardViewerRelations {
  userId: string;
  friendIds: string[];
  clubIds: string[];
  blockedUserIds: string[];
  blockedByUserIds: string[];
  mutedUserIds: string[];
}

export type AntiCheatCategory = 'anti_cheat' | 'privacy' | 'period';

export interface AntiCheatReasonCount {
  reason: EffortRejectionReason;
  category: AntiCheatCategory;
  label: string;
  count: number;
}

export interface AntiCheatCheck {
  id: string;
  label: string;
  detail: string;
  enforced: true;
}

/**
 * Agrégat anti-triche exposé par l'API : uniquement des compteurs et des
 * règles. Aucun `userId`, `effortId` ni diagnostic nominatif ne sort.
 */
export interface AntiCheatSummary {
  rejectedCount: number;
  antiCheatRejectedCount: number;
  privacyRejectedCount: number;
  periodRejectedCount: number;
  reasons: AntiCheatReasonCount[];
  checks: AntiCheatCheck[];
  computedAt: string;
}

export interface SegmentLeaderboardSummary {
  segment: LeaderboardSegmentView;
  totalEntries: number;
  rejectedCount: number;
  topEntries: SanitizedLeaderboardEntry[];
  titles: {
    kom: SanitizedLeaderboardEntry | null;
    qom: SanitizedLeaderboardEntry | null;
    cr: SanitizedLeaderboardEntry | null;
  };
  localLegend: {
    displayName: string;
    effortCount: number;
  } | null;
  computedAt: string;
}

export interface LeaderboardStoreSnapshot {
  segments: LeaderboardSegmentView[];
  efforts: SegmentEffortInput[];
}

export interface SegmentLeaderboardResponse {
  success: true;
  segment: LeaderboardSegmentView;
  leaderboard: SegmentLeaderboardResult;
  antiCheat: AntiCheatSummary;
}

export interface LocalLegendResponse {
  success: true;
  segment: LeaderboardSegmentView;
  localLegend: LocalLegendResult;
}

export interface SegmentsResponse {
  success: true;
  segments: SegmentLeaderboardSummary[];
  total: number;
}

export interface FiltersResponse {
  success: true;
  capabilities: LeaderboardFilterCapabilities;
  clubOptions: LeaderboardClubOption[];
}

export interface AntiCheatResponse {
  success: true;
  segment: LeaderboardSegmentView;
  antiCheat: AntiCheatSummary;
}
