/**
 * LKDV Social — Collaborative Reputation & Adventure Streaks Types
 * Milestone 4 (R4) Canonical Domain Types
 * File: src/features/messaging/types/reputation.types.ts
 */

// ============================================================================
// 1. UTILITY EVENT TYPES & POINT WEIGHT MATRIX
// ============================================================================

export type UtilityEventType =
  | 'CHAT_MESSAGE'
  | 'GPX_TRACK_SHARED'
  | 'CHECKLIST_ITEM_COMPLETED'
  | 'PACK_MERGE_CONFIRMED'
  | 'FIELD_CHECKIN_SUBMITTED'
  | 'SAFETY_ALERT_VERIFIED'
  | 'COMPLETED_COLLECTIVE_EXPEDITION';

/**
 * Reciprocal Utility Point Values (R4 Anti-Spam Baseline)
 * Raw chat messages yield strictly 0 points.
 */
export const UTILITY_POINT_VALUES: Record<UtilityEventType, number> = {
  CHAT_MESSAGE: 0,
  GPX_TRACK_SHARED: 25,
  CHECKLIST_ITEM_COMPLETED: 10,
  PACK_MERGE_CONFIRMED: 15,
  FIELD_CHECKIN_SUBMITTED: 15,
  SAFETY_ALERT_VERIFIED: 30,
  COMPLETED_COLLECTIVE_EXPEDITION: 50,
};

// ============================================================================
// 2. REPUTATION TIERS
// ============================================================================

export type ReputationTier =
  | 'Explorer'
  | 'Trailblazer'
  | 'Pathfinder'
  | 'Expedition Master';

/**
 * Resolves contributor reputation tier based on cumulative utility points.
 */
export function getTierForPoints(points: number): ReputationTier {
  const pts = Math.max(0, points);
  if (pts >= 500) return 'Expedition Master';
  if (pts >= 250) return 'Pathfinder';
  if (pts >= 100) return 'Trailblazer';
  return 'Explorer';
}

// ============================================================================
// 3. UTILITY EVENT & USER REPUTATION MODELS
// ============================================================================

export interface UtilityEvent {
  id: string;
  userId: string;
  conversationId: string;
  type: UtilityEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface UserReputation {
  userId: string;
  totalPoints: number;
  tier: ReputationTier;
  eventCount: number;
}

// ============================================================================
// 4. COLLECTIVE ADVENTURE EXPEDITIONS & STREAKS
// ============================================================================

export interface ExpeditionRecord {
  id: string;
  title: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  participantIds: string[];
  completedAt: string;
}

export interface AdventureStreak {
  teamKey: string;
  currentStreak: number;
  longestStreak: number;
  lastExpeditionDate: string | null;
  isActive: boolean;
  daysUntilStreakExpires: number;
}
