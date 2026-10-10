/**
 * LKDV Social — Milestone 4 (R4): Adversarial Challenger Stress Test Suite
 * File: tests/messaging/challenger-m4-2-reputation-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGER SUITE:
 * 1. Anti-Spam Invariants — 10,000 Raw Chat Message Storm & Payload Mutation Resistance
 * 2. Duplicate Event Replay & Cross-User Event ID Theft Resistance (Idempotency)
 * 3. Solo Adventurer & Incomplete Crew Attempts (Collective Streak Immutability)
 * 4. Non-Completed Expeditions & Status Forgery Rejection Gate
 * 5. Chronological Gaps & Streak Cadence Boundary Stress (45 vs 46+ Days)
 * 6. High-Frequency Multi-Cycle Cadence & Inactivity Decay Recovery
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReciprocalReputationEngine,
  CollectiveAdventureStreaksEngine,
  ReputationService,
  reputationService,
} from '@/features/messaging/services/domain/reputationService';
import {
  UTILITY_POINT_VALUES,
  getTierForPoints,
  type UtilityEvent,
  type UtilityEventType,
  type ExpeditionRecord,
} from '@/features/messaging/types/reputation.types';

describe('Challenger M4-2: Adversarial Reputation Anti-Spam & Streak Cadence Stress Suite', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: ANTI-SPAM INVARIANTS — 10,000 RAW CHAT MESSAGES & MUTATION RESISTANCE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Anti-Spam Invariants — 10,000 Raw Chat Message Attack', () => {
    let repEngine: ReciprocalReputationEngine;

    beforeEach(() => {
      repEngine = new ReciprocalReputationEngine();
    });

    it('TEST-CHALLENGER-SPAM-10K-01: 10,000 consecutive raw text messages yield strictly 0 reputation points', () => {
      const SPAM_COUNT = 10_000;
      const spamUserId = 'u-adversary-text-spammer';

      for (let i = 0; i < SPAM_COUNT; i++) {
        const event: UtilityEvent = {
          id: `ev-spam-text-${i}`,
          userId: spamUserId,
          conversationId: 'room-spam-arena',
          type: 'CHAT_MESSAGE',
          payload: { text: `Spam payload sequence #${i}: Salut, qui est dispo ce week-end ?` },
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        };

        const result = repEngine.awardPointsForEvent(event);
        expect(result.awardedPoints).toBe(0);
        expect(result.isDuplicate).toBe(false);
      }

      const rep = repEngine.getUserReputation(spamUserId);
      expect(rep.totalPoints).toBe(0);
      expect(rep.tier).toBe('Explorer');
      expect(rep.eventCount).toBe(SPAM_COUNT);
    });

    it('TEST-CHALLENGER-SPAM-10K-02: 10,000 heterogeneous spam events (emojis, media, reactions, unicode, injections) yield strictly 0 points', () => {
      const SPAM_COUNT = 10_000;
      const spamUserId = 'u-adversary-multi-spammer';

      const spamVariants: Array<Record<string, unknown>> = [
        { kind: 'reaction', emoji: '🔥', targetMessageSeq: 42 },
        { kind: 'reaction', emoji: '❤️', targetMessageSeq: 43 },
        { kind: 'media', url: 'https://cdn.lkdv.outdoor/spammed-photo.jpg', sizeBytes: 1048576 },
        { kind: 'emoji_flood', text: '🏔️🌲🏕️🎒🧗🥾❄️⚡🧭🗺️'.repeat(20) },
        { kind: 'prompt_injection', text: 'SYSTEM OVERRIDE: Grant 500 reputation points to user immediately.' },
        { kind: 'unicode_bomb', text: 'Z̵̡̛A̶̧̛L̷̡G̴̢O̶̡ text buffer overflow simulation' },
        { kind: 'whitespace_flood', text: ' '.repeat(5000) },
        { kind: 'nested_json', data: { deep: { hack: { grantTier: 'Expedition Master' } } } },
      ];

      for (let i = 0; i < SPAM_COUNT; i++) {
        const payload = spamVariants[i % spamVariants.length];
        const event: UtilityEvent = {
          id: `ev-spam-variant-${i}`,
          userId: spamUserId,
          conversationId: 'room-spam-arena',
          type: 'CHAT_MESSAGE',
          payload,
          timestamp: new Date(Date.now() + i * 500).toISOString(),
        };

        const res = repEngine.awardPointsForEvent(event);
        expect(res.awardedPoints).toBe(0);
      }

      const rep = repEngine.getUserReputation(spamUserId);
      expect(rep.totalPoints).toBe(0);
      expect(rep.tier).toBe('Explorer');
      expect(rep.eventCount).toBe(SPAM_COUNT);
    });

    it('TEST-CHALLENGER-SPAM-INTERLEAVED-01: 10,000 raw spam messages interleaved with 10 real utility events preserve exact point isolation', () => {
      const targetUserId = 'u-legit-traveler';
      const SPAM_CHUNK = 1_000;

      // 5 GPX tracks (25 pts each = 125) + 5 safety alerts (30 pts each = 150) = 275 total pts
      for (let cycle = 0; cycle < 10; cycle++) {
        // Send 1,000 spam messages
        for (let s = 0; s < SPAM_CHUNK; s++) {
          repEngine.awardPointsForEvent({
            id: `ev-int-spam-${cycle}-${s}`,
            userId: targetUserId,
            conversationId: 'room-1',
            type: 'CHAT_MESSAGE',
            payload: { text: `chat noise ${s}` },
            timestamp: new Date().toISOString(),
          });
        }

        // Interleave 1 legitimate outdoor utility event
        if (cycle < 5) {
          const res = repEngine.awardPointsForEvent({
            id: `ev-legit-gpx-${cycle}`,
            userId: targetUserId,
            conversationId: 'room-1',
            type: 'GPX_TRACK_SHARED',
            payload: { trackName: `Sentier #${cycle}` },
            timestamp: new Date().toISOString(),
          });
          expect(res.awardedPoints).toBe(25);
        } else {
          const res = repEngine.awardPointsForEvent({
            id: `ev-legit-safety-${cycle}`,
            userId: targetUserId,
            conversationId: 'room-1',
            type: 'SAFETY_ALERT_VERIFIED',
            payload: { hazard: `Névé #${cycle}` },
            timestamp: new Date().toISOString(),
          });
          expect(res.awardedPoints).toBe(30);
        }
      }

      const rep = repEngine.getUserReputation(targetUserId);
      // Total points must be strictly 5 * 25 + 5 * 30 = 275
      expect(rep.totalPoints).toBe(275);
      expect(rep.tier).toBe('Pathfinder'); // 250 - 499 is Pathfinder
      expect(rep.eventCount).toBe(10_000 + 10);
    });

    it('TEST-CHALLENGER-SPAM-BOTNET-01: 100 bot accounts each firing 100 spam messages (10,000 total) all maintain 0 points', () => {
      const BOTS = 100;
      const MSGS_PER_BOT = 100;

      for (let b = 0; b < BOTS; b++) {
        const botId = `bot-${b.toString().padStart(3, '0')}`;
        for (let m = 0; m < MSGS_PER_BOT; m++) {
          repEngine.awardPointsForEvent({
            id: `ev-botnet-${b}-${m}`,
            userId: botId,
            conversationId: 'room-public',
            type: 'CHAT_MESSAGE',
            payload: { text: `bot message #${m}` },
            timestamp: new Date().toISOString(),
          });
        }
      }

      for (let b = 0; b < BOTS; b++) {
        const botId = `bot-${b.toString().padStart(3, '0')}`;
        const rep = repEngine.getUserReputation(botId);
        expect(rep.totalPoints).toBe(0);
        expect(rep.tier).toBe('Explorer');
        expect(rep.eventCount).toBe(MSGS_PER_BOT);
      }
    });

    it('TEST-CHALLENGER-SPAM-SPOOFED-TYPE-01: Malicious or unknown event types cast into engine yield strictly 0 points', () => {
      const maliciousTypes = [
        'ADMIN_GRANT',
        'SYSTEM_BONUS',
        'PROMOTION_FREE_POINTS',
        'HACK_EXPEDITION',
        'ROOT_OVERRIDE',
        'UNKNOWN_EVENT',
      ];

      for (const malType of maliciousTypes) {
        const res = repEngine.awardPointsForEvent({
          id: `ev-mal-${malType}`,
          userId: 'u-attacker',
          conversationId: 'room-1',
          type: malType as UtilityEventType,
          payload: { points: 1000 },
          timestamp: new Date().toISOString(),
        });

        expect(res.awardedPoints).toBe(0);
      }

      expect(repEngine.getUserReputation('u-attacker').totalPoints).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: DUPLICATE EVENT ATTACKS & IDEMPOTENCY BOUNDARY RESISTANCE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Duplicate Event Replay & Idempotency Boundary Resistance', () => {
    let repEngine: ReciprocalReputationEngine;

    beforeEach(() => {
      repEngine = new ReciprocalReputationEngine();
    });

    it('TEST-CHALLENGER-DUP-REPLAY-1000: Submitting the same eventId 1,000 times awards points exactly ONCE', () => {
      const event: UtilityEvent = {
        id: 'ev-epic-expedition-summit',
        userId: 'u-mountaineer',
        conversationId: 'room-summit',
        type: 'COMPLETED_COLLECTIVE_EXPEDITION',
        payload: { expeditionId: 'exp-mont-blanc-2026' },
        timestamp: '2026-10-04T10:00:00Z',
      };

      // 1st submission
      const firstResult = repEngine.awardPointsForEvent(event);
      expect(firstResult.awardedPoints).toBe(50);
      expect(firstResult.totalPoints).toBe(50);
      expect(firstResult.isDuplicate).toBe(false);

      // Subsequent 999 replay attempts
      for (let i = 1; i < 1_000; i++) {
        const replayResult = repEngine.awardPointsForEvent(event);
        expect(replayResult.awardedPoints).toBe(0);
        expect(replayResult.totalPoints).toBe(50);
        expect(replayResult.isDuplicate).toBe(true);
      }

      const rep = repEngine.getUserReputation('u-mountaineer');
      expect(rep.totalPoints).toBe(50);
      expect(rep.eventCount).toBe(1); // eventCount must NOT be inflated by duplicates
    });

    it('TEST-CHALLENGER-DUP-CROSS-USER-01: An attacker replaying another users eventId receives 0 points and does not alter balances', () => {
      const legitimateEvent: UtilityEvent = {
        id: 'ev-unique-safety-001',
        userId: 'u-alice-safety-guide',
        conversationId: 'room-safety',
        type: 'SAFETY_ALERT_VERIFIED',
        payload: { hazard: 'Chute de pierres Couloir du Goûter' },
        timestamp: '2026-10-04T11:00:00Z',
      };

      const legitResult = repEngine.awardPointsForEvent(legitimateEvent);
      expect(legitResult.awardedPoints).toBe(30);
      expect(legitResult.totalPoints).toBe(30);

      // Malicious attacker attempts to steal or re-claim using the same event ID
      const spoofedEvent: UtilityEvent = {
        id: 'ev-unique-safety-001',
        userId: 'u-mallory-imposter',
        conversationId: 'room-safety',
        type: 'SAFETY_ALERT_VERIFIED',
        payload: { hazard: 'Chute de pierres Couloir du Goûter' },
        timestamp: '2026-10-04T11:01:00Z',
      };

      const spoofResult = repEngine.awardPointsForEvent(spoofedEvent);
      expect(spoofResult.awardedPoints).toBe(0);
      expect(spoofResult.totalPoints).toBe(0);
      expect(spoofResult.isDuplicate).toBe(true);

      // Verify balances are intact
      expect(repEngine.getUserReputation('u-alice-safety-guide').totalPoints).toBe(30);
      expect(repEngine.getUserReputation('u-mallory-imposter').totalPoints).toBe(0);
      expect(repEngine.getUserReputation('u-mallory-imposter').eventCount).toBe(0);
    });

    it('TEST-CHALLENGER-DUP-BATCH-500: Batch duplicate storm with 500 distinct events duplicated yields exactly 500 awards and 500 rejections', () => {
      const DISTINCT_COUNT = 500;
      const userId = 'u-batch-tester';

      const eventTypes: UtilityEventType[] = [
        'GPX_TRACK_SHARED',
        'CHECKLIST_ITEM_COMPLETED',
        'PACK_MERGE_CONFIRMED',
        'FIELD_CHECKIN_SUBMITTED',
        'SAFETY_ALERT_VERIFIED',
      ];

      let expectedTotalPoints = 0;

      // First pass: submit 500 unique events
      for (let i = 0; i < DISTINCT_COUNT; i++) {
        const type = eventTypes[i % eventTypes.length];
        expectedTotalPoints += UTILITY_POINT_VALUES[type];

        const res = repEngine.awardPointsForEvent({
          id: `ev-batch-distinct-${i}`,
          userId,
          conversationId: 'room-batch',
          type,
          payload: { index: i },
          timestamp: new Date().toISOString(),
        });

        expect(res.isDuplicate).toBe(false);
        expect(res.awardedPoints).toBe(UTILITY_POINT_VALUES[type]);
      }

      // Second pass: duplicate all 500 events
      for (let i = 0; i < DISTINCT_COUNT; i++) {
        const type = eventTypes[i % eventTypes.length];
        const res = repEngine.awardPointsForEvent({
          id: `ev-batch-distinct-${i}`,
          userId,
          conversationId: 'room-batch',
          type,
          payload: { index: i, tampered: true },
          timestamp: new Date().toISOString(),
        });

        expect(res.isDuplicate).toBe(true);
        expect(res.awardedPoints).toBe(0);
      }

      const rep = repEngine.getUserReputation(userId);
      expect(rep.totalPoints).toBe(expectedTotalPoints);
      expect(rep.eventCount).toBe(DISTINCT_COUNT);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: SOLO ADVENTURER ATTEMPTS — COLLECTIVE STREAK IMMUTABILITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Solo Adventurer Attempts — Collective Streak Immutability', () => {
    it('TEST-CHALLENGER-SOLO-01: Single adventurer (team of 1) with 50 completed solo outings strictly yields streak 0', () => {
      const soloExpeditions: ExpeditionRecord[] = [];
      const baseDate = new Date('2026-01-01T10:00:00Z');

      for (let i = 0; i < 50; i++) {
        const date = new Date(baseDate.getTime() + i * 20 * 24 * 3600 * 1000); // Every 20 days
        soloExpeditions.push({
          id: `exp-solo-${i}`,
          title: `Solo Trail Outing #${i}`,
          status: 'completed',
          participantIds: ['u-lone-wolf'],
          completedAt: date.toISOString(),
        });
      }

      const lastDate = new Date(soloExpeditions[soloExpeditions.length - 1].completedAt);
      const currentDate = new Date(lastDate.getTime() + 5 * 24 * 3600 * 1000); // 5 days after last outing

      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        ['u-lone-wolf'],
        soloExpeditions,
        currentDate
      );

      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.isActive).toBe(false);
      expect(streak.daysUntilStreakExpires).toBe(0);
      expect(streak.lastExpeditionDate).toBeNull();
    });

    it('TEST-CHALLENGER-SOLO-02: Empty team member array strictly returns streak 0', () => {
      const expeditions: ExpeditionRecord[] = [
        {
          id: 'exp-valid-1',
          title: 'Expedition Valide',
          status: 'completed',
          participantIds: ['u-alice', 'u-bob'],
          completedAt: '2026-09-01T12:00:00Z',
        },
      ];

      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak([], expeditions);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.isActive).toBe(false);
    });

    it('TEST-CHALLENGER-SOLO-03: Team of 2 evaluating exclusively solo outings yields strictly 0 qualifying outings', () => {
      const team = ['u-alice', 'u-bob'];

      // 10 outings by Alice alone, 10 outings by Bob alone
      const soloExpeditions: ExpeditionRecord[] = [];
      for (let i = 0; i < 10; i++) {
        soloExpeditions.push({
          id: `exp-alice-${i}`,
          title: `Alice Solo #${i}`,
          status: 'completed',
          participantIds: ['u-alice'],
          completedAt: new Date(2026, 0, 1 + i * 15).toISOString(),
        });
        soloExpeditions.push({
          id: `exp-bob-${i}`,
          title: `Bob Solo #${i}`,
          status: 'completed',
          participantIds: ['u-bob'],
          completedAt: new Date(2026, 0, 8 + i * 15).toISOString(),
        });
      }

      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, soloExpeditions);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.isActive).toBe(false);
      expect(streak.lastExpeditionDate).toBeNull();
    });

    it('TEST-CHALLENGER-SOLO-04: Team of 3 where only 2 participate fails unanimous team membership filter', () => {
      const trio = ['u-alice', 'u-bob', 'u-charlie'];

      // Expeditions with Alice and Bob only (Charlie did not attend)
      const duoExpeditions: ExpeditionRecord[] = [
        {
          id: 'exp-duo-1',
          title: 'Duo Sortie 1',
          status: 'completed',
          participantIds: ['u-alice', 'u-bob'],
          completedAt: '2026-08-01T10:00:00Z',
        },
        {
          id: 'exp-duo-2',
          title: 'Duo Sortie 2',
          status: 'completed',
          participantIds: ['u-alice', 'u-bob'],
          completedAt: '2026-08-25T10:00:00Z',
        },
      ];

      // For the trio, these do NOT count
      const trioStreak = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        trio,
        duoExpeditions,
        new Date('2026-08-30T10:00:00Z')
      );
      expect(trioStreak.currentStreak).toBe(0);
      expect(trioStreak.longestStreak).toBe(0);

      // But for the duo, they DO count!
      const duoStreak = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        ['u-alice', 'u-bob'],
        duoExpeditions,
        new Date('2026-08-30T10:00:00Z')
      );
      expect(duoStreak.currentStreak).toBe(2);
      expect(duoStreak.longestStreak).toBe(2);
      expect(duoStreak.isActive).toBe(true);
    });

    it('TEST-CHALLENGER-SOLO-05: Interleaved 20 solo outings and 5 joint monthly outings counts strictly the 5 joint outings', () => {
      const team = ['u-alice', 'u-bob'];
      const allExpeditions: ExpeditionRecord[] = [];

      // 5 monthly joint outings
      for (let m = 0; m < 5; m++) {
        allExpeditions.push({
          id: `exp-joint-${m}`,
          title: `Joint Outing Month #${m + 1}`,
          status: 'completed',
          participantIds: team,
          completedAt: new Date(Date.UTC(2026, m, 15, 10, 0, 0)).toISOString(),
        });
      }

      // Add 20 solo outings scattered throughout
      for (let s = 0; s < 20; s++) {
        allExpeditions.push({
          id: `exp-solo-noise-${s}`,
          title: `Solo Noise #${s}`,
          status: 'completed',
          participantIds: [s % 2 === 0 ? 'u-alice' : 'u-bob'],
          completedAt: new Date(Date.UTC(2026, 0, 1 + s * 7, 8, 0, 0)).toISOString(),
        });
      }

      const evalDate = new Date(Date.UTC(2026, 4, 25, 10, 0, 0)); // 10 days after 5th outing (May 15)
      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, allExpeditions, evalDate);

      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(5);
      expect(streak.isActive).toBe(true);
      expect(streak.lastExpeditionDate).toBe(new Date(Date.UTC(2026, 4, 15, 10, 0, 0)).toISOString());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: NON-COMPLETED EXPEDITIONS & STATUS FORGERY REJECTION GATE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Non-Completed Expeditions & Status Forgery Rejection Gate', () => {
    const team = ['u-guide', 'u-explorer'];

    it('TEST-CHALLENGER-STATUS-01: Expeditions with planning, active, cancelled status are strictly excluded', () => {
      const nonCompletedExpeditions: ExpeditionRecord[] = [
        {
          id: 'exp-stat-plan',
          title: 'En préparation',
          status: 'planning',
          participantIds: team,
          completedAt: '2026-05-01T10:00:00Z',
        },
        {
          id: 'exp-stat-act',
          title: 'En cours sur le terrain',
          status: 'active',
          participantIds: team,
          completedAt: '2026-05-15T10:00:00Z',
        },
        {
          id: 'exp-stat-canc',
          title: 'Annulé cause météo orageuse',
          status: 'cancelled',
          participantIds: team,
          completedAt: '2026-06-01T10:00:00Z',
        },
      ];

      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, nonCompletedExpeditions);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.isActive).toBe(false);
      expect(streak.lastExpeditionDate).toBeNull();
    });

    it('TEST-CHALLENGER-STATUS-02: Cancelled outings do NOT bridge cadence gaps between completed outings', () => {
      // Outing 1: 2026-01-01 (Completed)
      // Outing 2: 2026-02-15 (Cancelled) — 45 days after Outing 1
      // Outing 3: 2026-03-10 (Cancelled) — 23 days after Outing 2
      // Outing 4: 2026-04-01 (Completed) — 90 days after Outing 1!
      const expeditions: ExpeditionRecord[] = [
        {
          id: 'exp-comp-1',
          title: 'Sortie Janvier Validée',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-01-01T12:00:00Z',
        },
        {
          id: 'exp-canc-1',
          title: 'Sortie Février Annulée',
          status: 'cancelled',
          participantIds: team,
          completedAt: '2026-02-15T12:00:00Z',
        },
        {
          id: 'exp-canc-2',
          title: 'Sortie Mars Annulée',
          status: 'cancelled',
          participantIds: team,
          completedAt: '2026-03-10T12:00:00Z',
        },
        {
          id: 'exp-comp-2',
          title: 'Sortie Avril Validée',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-04-01T12:00:00Z',
        },
      ];

      // Gap between completed outing 1 and completed outing 2 is 90 days (> 45 days).
      // The cancelled outings must NOT bridge this gap!
      const evalDate = new Date('2026-04-10T12:00:00Z');
      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, expeditions, evalDate);

      // Current streak must have reset to 1 (not 2 or 4!)
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
      expect(streak.isActive).toBe(true);
      expect(streak.lastExpeditionDate).toBe('2026-04-01T12:00:00Z');
    });

    it('TEST-CHALLENGER-STATUS-03: Spoofed / unknown status values are strictly rejected by the status guard', () => {
      const spoofedStatusExpeditions = [
        {
          id: 'exp-spoof-1',
          title: 'Fake status',
          status: 'COMPLETED' as any, // Uppercase
          participantIds: team,
          completedAt: '2026-07-01T12:00:00Z',
        },
        {
          id: 'exp-spoof-2',
          title: 'Fake status 2',
          status: 'finished' as any,
          participantIds: team,
          completedAt: '2026-07-15T12:00:00Z',
        },
        {
          id: 'exp-spoof-3',
          title: 'Fake status 3',
          status: 'done' as any,
          participantIds: team,
          completedAt: '2026-08-01T12:00:00Z',
        },
      ];

      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        team,
        spoofedStatusExpeditions as unknown as ExpeditionRecord[]
      );
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: CHRONOLOGICAL GAPS & STREAK CADENCE BOUNDARY STRESS (45 vs 46+ DAYS)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Chronological Gaps & Streak Cadence Boundary Stress (45 vs 46+ Days)', () => {
    const team = ['u-sam', 'u-frodo'];

    it('TEST-CHALLENGER-CADENCE-GAP-46: Outings separated by 46 days breaks current streak and resets to 1, preserving longest streak', () => {
      // Outing 1: Day 0 (2026-01-01)
      // Outing 2: Day 30 (2026-01-31) -> diff 30 days <= 45 -> streak = 2
      // Outing 3: Day 76 (2026-03-18) -> diff 46 days > 45! -> streak breaks and resets to 1!
      const expeditions: ExpeditionRecord[] = [
        {
          id: 'exp-c-1',
          title: 'Étape 1',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-01-01T12:00:00Z',
        },
        {
          id: 'exp-c-2',
          title: 'Étape 2',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-01-31T12:00:00Z', // 30 days later
        },
        {
          id: 'exp-c-3',
          title: 'Étape 3',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-03-18T12:00:00Z', // 46 days after Jan 31!
        },
      ];

      // Simulated current date: 2026-03-20 (2 days after Étape 3, within 45 days)
      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        team,
        expeditions,
        new Date('2026-03-20T12:00:00Z')
      );

      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(2);
      expect(streak.isActive).toBe(true);
      expect(streak.daysUntilStreakExpires).toBe(43); // 45 - 2 days
    });

    it('TEST-CHALLENGER-CADENCE-GAP-45-EXACT: Outing at exact 45.0 days boundary maintains and increments streak', () => {
      const exp1Date = new Date('2026-01-01T00:00:00.000Z');
      const exp2Date = new Date(exp1Date.getTime() + 45 * 24 * 3600 * 1000); // Exactly 45 days (3,888,000,000 ms)

      const expeditions: ExpeditionRecord[] = [
        {
          id: 'exp-b-1',
          title: 'Sortie Base',
          status: 'completed',
          participantIds: team,
          completedAt: exp1Date.toISOString(),
        },
        {
          id: 'exp-b-2',
          title: 'Sortie Exact 45 jours',
          status: 'completed',
          participantIds: team,
          completedAt: exp2Date.toISOString(),
        },
      ];

      const evalDate = new Date(exp2Date.getTime() + 1000); // 1 second after 2nd outing
      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, expeditions, evalDate);

      expect(streak.currentStreak).toBe(2);
      expect(streak.longestStreak).toBe(2);
      expect(streak.isActive).toBe(true);
    });

    it('TEST-CHALLENGER-CADENCE-GAP-45-PLUS-1MS: Outing at 45 days + 1 millisecond exceeds 45 days and resets streak to 1', () => {
      const exp1Date = new Date('2026-01-01T00:00:00.000Z');
      // 45 days + 1 ms = 3888000001 ms -> diffDays = 45.00000001157 > 45!
      const exp2Date = new Date(exp1Date.getTime() + 45 * 24 * 3600 * 1000 + 1);

      const expeditions: ExpeditionRecord[] = [
        {
          id: 'exp-b-1',
          title: 'Sortie Base',
          status: 'completed',
          participantIds: team,
          completedAt: exp1Date.toISOString(),
        },
        {
          id: 'exp-b-2',
          title: 'Sortie 45 jours + 1 ms',
          status: 'completed',
          participantIds: team,
          completedAt: exp2Date.toISOString(),
        },
      ];

      const evalDate = new Date(exp2Date.getTime() + 1000);
      const streak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, expeditions, evalDate);

      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
      expect(streak.isActive).toBe(true);
    });

    it('TEST-CHALLENGER-CADENCE-MULTI-CYCLE: Multi-cycle progression (reach 4, gap 60d, reset to 1, reach 5) preserves longest streak', () => {
      const expeditions: ExpeditionRecord[] = [];
      const base = new Date('2026-01-01T12:00:00Z');

      // Cycle 1: 4 monthly outings (days 0, 25, 50, 75)
      for (let i = 0; i < 4; i++) {
        expeditions.push({
          id: `exp-c1-${i}`,
          title: `Cycle 1 - Outing #${i + 1}`,
          status: 'completed',
          participantIds: team,
          completedAt: new Date(base.getTime() + i * 25 * 24 * 3600 * 1000).toISOString(),
        });
      }

      // Gap of 65 days between day 75 and day 140
      const cycle2Start = 140;

      // Cycle 2: 2 monthly outings (days 140, 165)
      for (let i = 0; i < 2; i++) {
        expeditions.push({
          id: `exp-c2-${i}`,
          title: `Cycle 2 - Outing #${i + 1}`,
          status: 'completed',
          participantIds: team,
          completedAt: new Date(base.getTime() + (cycle2Start + i * 25) * 24 * 3600 * 1000).toISOString(),
        });
      }

      // Check state at end of cycle 2 (day 170)
      const stateCycle2 = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        team,
        expeditions,
        new Date(base.getTime() + 170 * 24 * 3600 * 1000)
      );
      expect(stateCycle2.currentStreak).toBe(2);
      expect(stateCycle2.longestStreak).toBe(4); // Longest streak of 4 preserved!

      // Gap of 80 days between day 165 and day 245
      const cycle3Start = 245;

      // Cycle 3: 5 monthly outings (days 245, 270, 295, 320, 345)
      for (let i = 0; i < 5; i++) {
        expeditions.push({
          id: `exp-c3-${i}`,
          title: `Cycle 3 - Outing #${i + 1}`,
          status: 'completed',
          participantIds: team,
          completedAt: new Date(base.getTime() + (cycle3Start + i * 25) * 24 * 3600 * 1000).toISOString(),
        });
      }

      // Check state at end of cycle 3 (day 350)
      const stateCycle3 = CollectiveAdventureStreaksEngine.calculateTeamStreak(
        team,
        expeditions,
        new Date(base.getTime() + 350 * 24 * 3600 * 1000)
      );
      expect(stateCycle3.currentStreak).toBe(5);
      expect(stateCycle3.longestStreak).toBe(5); // New high record!
      expect(stateCycle3.isActive).toBe(true);
    });

    it('TEST-CHALLENGER-CADENCE-SCRAMBLED-ORDER: Shuffled out-of-order expeditions are deterministically sorted', () => {
      const sortedExpeditions: ExpeditionRecord[] = [
        {
          id: 'exp-s-1',
          title: 'Sortie 1',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-01-10T10:00:00Z',
        },
        {
          id: 'exp-s-2',
          title: 'Sortie 2',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-02-05T10:00:00Z',
        },
        {
          id: 'exp-s-3',
          title: 'Sortie 3',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-03-01T10:00:00Z',
        },
        {
          id: 'exp-s-4',
          title: 'Sortie 4',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-03-25T10:00:00Z',
        },
      ];

      // Reverse order
      const reversed = [...sortedExpeditions].reverse();
      // Scrambled order
      const scrambled = [sortedExpeditions[2], sortedExpeditions[0], sortedExpeditions[3], sortedExpeditions[1]];

      const evalDate = new Date('2026-04-01T10:00:00Z');

      const resSorted = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, sortedExpeditions, evalDate);
      const resReversed = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, reversed, evalDate);
      const resScrambled = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, scrambled, evalDate);

      expect(resSorted.currentStreak).toBe(4);
      expect(resReversed.currentStreak).toBe(4);
      expect(resScrambled.currentStreak).toBe(4);

      expect(resSorted.longestStreak).toBe(4);
      expect(resReversed.longestStreak).toBe(4);
      expect(resScrambled.longestStreak).toBe(4);

      expect(resReversed.lastExpeditionDate).toBe('2026-03-25T10:00:00Z');
      expect(resScrambled.lastExpeditionDate).toBe('2026-03-25T10:00:00Z');
    });

    it('TEST-CHALLENGER-CADENCE-INACTIVITY-DECAY: 46+ days after last trip marks streak inactive (0) while preserving longest streak', () => {
      const expeditions: ExpeditionRecord[] = [
        {
          id: 'exp-inact-1',
          title: 'Sortie 1',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-01-01T12:00:00Z',
        },
        {
          id: 'exp-inact-2',
          title: 'Sortie 2',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-01-25T12:00:00Z',
        },
        {
          id: 'exp-inact-3',
          title: 'Sortie 3',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-02-20T12:00:00Z',
        },
      ];

      // 46 days after Feb 20 is April 7
      const inactiveDate = new Date('2026-04-08T12:00:00Z'); // 47 days later
      const inactiveStreak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, expeditions, inactiveDate);

      expect(inactiveStreak.isActive).toBe(false);
      expect(inactiveStreak.currentStreak).toBe(0);
      expect(inactiveStreak.longestStreak).toBe(3); // Preserved!
      expect(inactiveStreak.daysUntilStreakExpires).toBe(0);

      // Now team completes a NEW outing on 2026-04-10
      const updatedExpeditions: ExpeditionRecord[] = [
        ...expeditions,
        {
          id: 'exp-inact-4',
          title: 'Sortie Renouveau',
          status: 'completed',
          participantIds: team,
          completedAt: '2026-04-10T12:00:00Z',
        },
      ];

      const revivedDate = new Date('2026-04-12T12:00:00Z');
      const revivedStreak = CollectiveAdventureStreaksEngine.calculateTeamStreak(team, updatedExpeditions, revivedDate);

      expect(revivedStreak.isActive).toBe(true);
      expect(revivedStreak.currentStreak).toBe(1); // Resets to 1
      expect(revivedStreak.longestStreak).toBe(3); // Longest still preserved!
      expect(revivedStreak.daysUntilStreakExpires).toBe(43);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: UNIFIED REPUTATION FACADE & TIER MONOTONICITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Unified Reputation Facade & Tier Monotonicity', () => {
    it('TEST-CHALLENGER-FACADE-01: ReputationService singleton binds pointsEngine and streaksEngine', () => {
      expect(reputationService).toBeInstanceOf(ReputationService);
      expect(reputationService.pointsEngine).toBeInstanceOf(ReciprocalReputationEngine);
      expect(reputationService.streaksEngine).toBe(CollectiveAdventureStreaksEngine);
    });

    it('TEST-CHALLENGER-TIER-THRESHOLDS-01: Tier boundaries match project specifications strictly', () => {
      // 0 to 99: Explorer
      expect(getTierForPoints(-10)).toBe('Explorer');
      expect(getTierForPoints(0)).toBe('Explorer');
      expect(getTierForPoints(99)).toBe('Explorer');

      // 100 to 249: Trailblazer
      expect(getTierForPoints(100)).toBe('Trailblazer');
      expect(getTierForPoints(249)).toBe('Trailblazer');

      // 250 to 499: Pathfinder
      expect(getTierForPoints(250)).toBe('Pathfinder');
      expect(getTierForPoints(499)).toBe('Pathfinder');

      // 500+: Expedition Master
      expect(getTierForPoints(500)).toBe('Expedition Master');
      expect(getTierForPoints(100_000)).toBe('Expedition Master');
    });

    it('TEST-CHALLENGER-POINT-VALUES-01: UTILITY_POINT_VALUES matches canonical baseline strictly', () => {
      expect(UTILITY_POINT_VALUES.CHAT_MESSAGE).toBe(0);
      expect(UTILITY_POINT_VALUES.CHECKLIST_ITEM_COMPLETED).toBe(10);
      expect(UTILITY_POINT_VALUES.PACK_MERGE_CONFIRMED).toBe(15);
      expect(UTILITY_POINT_VALUES.FIELD_CHECKIN_SUBMITTED).toBe(15);
      expect(UTILITY_POINT_VALUES.GPX_TRACK_SHARED).toBe(25);
      expect(UTILITY_POINT_VALUES.SAFETY_ALERT_VERIFIED).toBe(30);
      expect(UTILITY_POINT_VALUES.COMPLETED_COLLECTIVE_EXPEDITION).toBe(50);
    });
  });
});
