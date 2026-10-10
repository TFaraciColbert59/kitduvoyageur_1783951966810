/**
 * LKDV Social — Collaborative Reputation & Adventure Streaks Domain Service
 * Milestone 4 (R4) Canonical Domain Implementation
 * File: src/features/messaging/services/domain/reputationService.ts
 */

import type {
  AdventureStreak,
  ExpeditionRecord,
  ReputationTier,
  UserReputation,
  UtilityEvent,
} from '../../types/reputation.types';
import {
  getTierForPoints,
  UTILITY_POINT_VALUES,
} from '../../types/reputation.types';

// ============================================================================
// 1. RECIPROCAL UTILITY REPUTATION POINTS ENGINE
// ============================================================================

export class ReciprocalReputationEngine {
  private userPoints: Map<string, number> = new Map();
  private processedEventIds: Set<string> = new Set();
  private userEventCounts: Map<string, number> = new Map();

  awardPointsForEvent(
    event: UtilityEvent
  ): { awardedPoints: number; totalPoints: number; isDuplicate: boolean } {
    if (this.processedEventIds.has(event.id)) {
      const current = this.userPoints.get(event.userId) || 0;
      return { awardedPoints: 0, totalPoints: current, isDuplicate: true };
    }

    this.processedEventIds.add(event.id);
    const pts = UTILITY_POINT_VALUES[event.type] || 0;

    const current = this.userPoints.get(event.userId) || 0;
    const updated = current + pts;
    this.userPoints.set(event.userId, updated);

    const count = (this.userEventCounts.get(event.userId) || 0) + 1;
    this.userEventCounts.set(event.userId, count);

    return { awardedPoints: pts, totalPoints: updated, isDuplicate: false };
  }

  static getTierForPoints(points: number): ReputationTier {
    return getTierForPoints(points);
  }

  getUserReputation(userId: string): UserReputation {
    const totalPoints = this.userPoints.get(userId) || 0;
    return {
      userId,
      totalPoints,
      tier: ReciprocalReputationEngine.getTierForPoints(totalPoints),
      eventCount: this.userEventCounts.get(userId) || 0,
    };
  }
}

// ============================================================================
// 2. COLLECTIVE ADVENTURE STREAKS ENGINE
// ============================================================================

export class CollectiveAdventureStreaksEngine {
  static calculateTeamStreak(
    teamMemberIds: string[],
    expeditions: ExpeditionRecord[],
    currentDate: Date = new Date('2026-10-04T12:00:00Z')
  ): AdventureStreak {
    const teamKey = [...teamMemberIds].sort().join(':');

    // Joint outings require at least 2 members
    if (teamMemberIds.length < 2) {
      return {
        teamKey,
        currentStreak: 0,
        longestStreak: 0,
        lastExpeditionDate: null,
        isActive: false,
        daysUntilStreakExpires: 0,
      };
    }

    // Filter expeditions: completed status and all team members participating
    const qualifying = expeditions
      .filter((e) => e.status === 'completed')
      .filter((e) => teamMemberIds.every((mId) => e.participantIds.includes(mId)))
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

    if (qualifying.length === 0) {
      return {
        teamKey,
        currentStreak: 0,
        longestStreak: 0,
        lastExpeditionDate: null,
        isActive: false,
        daysUntilStreakExpires: 0,
      };
    }

    // Maximum allowed interval between outings: 45 days (grace window for monthly cadence)
    const MAX_DAYS_INTERVAL = 45;
    let currentStreak = 1;
    let longestStreak = 1;

    for (let i = 1; i < qualifying.length; i++) {
      const prev = new Date(qualifying[i - 1].completedAt).getTime();
      const curr = new Date(qualifying[i].completedAt).getTime();
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

      if (diffDays <= MAX_DAYS_INTERVAL) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 1; // reset streak run
      }
    }

    const lastExp = qualifying[qualifying.length - 1];
    const lastDate = new Date(lastExp.completedAt);
    const daysSinceLast = (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    const isActive = daysSinceLast <= MAX_DAYS_INTERVAL;
    const daysUntilStreakExpires = Math.max(0, Math.ceil(MAX_DAYS_INTERVAL - daysSinceLast));

    return {
      teamKey,
      currentStreak: isActive ? currentStreak : 0,
      longestStreak,
      lastExpeditionDate: lastExp.completedAt,
      isActive,
      daysUntilStreakExpires,
    };
  }
}

// ============================================================================
// 3. UNIFIED REPUTATION DOMAIN FACADE
// ============================================================================

export class ReputationService {
  readonly pointsEngine: ReciprocalReputationEngine;
  readonly streaksEngine: typeof CollectiveAdventureStreaksEngine;

  constructor() {
    this.pointsEngine = new ReciprocalReputationEngine();
    this.streaksEngine = CollectiveAdventureStreaksEngine;
  }
}

export const reputationService = new ReputationService();
