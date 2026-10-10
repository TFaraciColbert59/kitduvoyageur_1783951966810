# Handoff Report: Collaborative Reputation & Adventure Streaks (Milestone 4 — R4)

**Agent**: `explorer_m4_reputation_1`  
**To**: Orchestrator (`22810fd4-62f8-4724-853b-2cdeda826f11`) / Implementer (`worker_m4`)  
**Date**: 2026-10-04T19:28:00Z  
**Type**: Hard Handoff (Investigation & Blueprints Complete)

---

## 1. Observation

1. **Project & Scope Requirements**:
   - `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md` (lines 25-26, 57-58, 69, 157-162):
     * Line 25-26: *"Anti-spam reciprocal utility reputation model: 0 points for raw chat; points awarded strictly for verified field utility... Collective adventure streaks requiring joint verified team outings."*
     * Line 57-58: Feature R4-Reputation-AntiSpam & R4-Reputation-Streaks scheduled for Milestone 4.
     * Line 157-162: Reciprocal points table: Raw chat messages: 0 points.
   - Dispatch prompt verbatim:
     * Strictly 0 points for raw chat text messages.
     * `GPX_TRACK_SHARED`: +25 pts.
     * `CHECKLIST_ITEM_COMPLETED`: +10 pts.
     * `PACK_MERGE_CONFIRMED`: +15 pts.
     * `FIELD_CHECKIN_SUBMITTED`: +15 pts.
     * `SAFETY_ALERT_VERIFIED`: +30 pts.
     * Domain logic: `calculateContributionPoints(event: UtilityEvent): number`, `getUserReputation(userId: string)`.
     * Streak logic: `calculateTeamStreak(teamMembers: string[], expeditions: ExpeditionRecord[]): AdventureStreak` with $\ge 2$ members and activity windows.
     * Blueprints: `ReputationBadge.tsx`, `AdventureStreakBanner.tsx`.
     * Zero orange `#E4501C`!

2. **Codebase & Architecture Baseline**:
   - `src/features/messaging/types/`: Currently contains `clubs.types.ts`, `expeditionRooms.types.ts`, `messaging.types.ts`, `outdoorObjects.types.ts`.
   - `src/features/messaging/types/reputation.types.ts` does not yet exist; needs to be created.
   - `src/features/messaging/services/domain/`: Contains `cursorPaginationService.ts`, `idempotencyService.ts`, `offlineSyncQueue.ts`, `packMergeService.ts`, `sequenceService.ts`.
   - `src/features/messaging/services/messagingService.ts`: Serves as the central facade delegating to domain services.
   - `tailwind.config.js` (lines 72-140): Defines nature palette tokens: `forest`, `sand`, `sky`, `stone`, `sage`, `ink`, `warn` (`#C89A3B`), `danger` (`#A8443A`).
   - `tests/messaging/clubs-expedition-rooms.spec.ts`: Passes 52/52 tests in 216ms (`npx vitest run tests/messaging/clubs-expedition-rooms.spec.ts`). Verifies UI components via `renderToStaticMarkup` and audits against `#E4501C`.

---

## 2. Logic Chain

1. **Step 1 (Anti-Spam Invariant)**:
   - *Premise*: In outdoor groups, rewarding raw chat messages floods emergency channels with meaningless chatter.
   - *Derivation*: Setting `calculateContributionPoints` to return 0 for raw text messages eliminates farming bots and chat spam at the mathematical source. Points can only be earned when events carry verifiable outdoor artifacts (`gpxSnapshot`, `checklistItem`, `packMerge`, `fieldCheckIn`, `safetyAlert`).

2. **Step 2 (Point Values & Verification Guardrails)**:
   - *Premise*: Actions differ in effort, trust, and risk.
   - *Derivation*:
     * Sharing a verified GPX route (+25 pts) requires GPX validation (`distanceKm > 0`, `elevationGainM >= 0`, `bounds`, SVG polyline).
     * Completing an expedition task (+10 pts) requires `isCompleted: true` and is deduplicated per checklist item ID.
     * Confirming collective pack merge gear (+15 pts) requires carrying $\ge 1$ shared item safely within physiological load ratios (<= 20% body weight human, <= 15% dog).
     * Submitting a field check-in (+15 pts) requires valid coordinate ranges (`lat` $\in [-90, 90]$, `lng` $\in [-180, 180]$) and a 30-min rate limit.
     * Verifying a mountain safety alert (+30 pts) has highest utility (saving lives) and requires safety validation.

3. **Step 3 (Reputation Tiers Progression)**:
   - *Premise*: Gamification should acknowledge progression without creating hyper-competitive toxic leaderboards.
   - *Derivation*: 5 mountain tiers with clear progression boundaries: Novice (0-49 pts), Contributor (50-149 pts), Trailblazer (150-349 pts), Mountain Guide (350-749 pts), and Expedition Leader (750+ pts). Progression percent and points-to-next-tier are calculated purely and monotonically.

4. **Step 4 (Collective Adventure Streaks)**:
   - *Premise*: Daily solo streaks encourage unsafe behavior in bad mountain conditions.
   - *Derivation*: Team streaks require joint participation ($\ge 2$ members) and operate over monthly (default 35 days), biweekly (18 days), or seasonal (90 days) windows.
   - *Windowing rule*: Multiple outings in the same calendar window increment the streak counter once, while accumulating total distance (km) and elevation gain ($m\text{ D+}$).
   - *Countdown rule*: `daysRemaining` and `nextDeadlineDate` give a clear, calm prompt without aggressive pressure. If a window is missed, state switches to `broken` and resets current streak to 0.

5. **Step 5 (Apple HIG Liquid Glass & Zero Orange)**:
   - *Premise*: Apple HIG demands subtlety, translucency, and calm system-like presentation; project rules strictly forbid orange `#E4501C`.
   - *Derivation*: `ReputationBadge` and `AdventureStreakBanner` utilize `backdrop-blur-xl`, `bg-white/70`, `stone`, `sage`, `sky`, `forest`, and `warn` (`#C89A3B`). Flame and streak icons are rendered in warm golden amber. All interactive touch targets are $\ge 44\text{px}$.

---

## 3. Caveats

1. **State Persistence**: This investigation addresses domain algorithms, pure calculation engines, and client component blueprints. Database tables for event storage can leverage existing `user_profiles.reputation` or dedicated event logs.
2. **Offline Replay**: If field check-ins are logged offline, their timestamps must be evaluated against server timestamps or monotonic clock checks to prevent backdated streak exploits.
3. **No other caveats**: All requirements, formulas, types, and component blueprints are completely specified.

---

## 4. Conclusion

The specification for Collaborative Reputation and Adventure Streaks is complete, verified, and ready for implementation. The implementer (`worker_m4`) has exact definitions for:
- `src/features/messaging/types/reputation.types.ts`: Full TypeScript interfaces, points constants, and tier configurations.
- `src/features/messaging/services/domain/reputationService.ts`: Pure domain functions for points calculation, anti-spam validation, tier resolution, and team streak calculation.
- `src/features/messaging/components/reputation/ReputationBadge.tsx`: Apple HIG Liquid Glass contributor badge with 5 tier styles and 44px touch targets.
- `src/features/messaging/components/reputation/AdventureStreakBanner.tsx`: Collective streak banner with countdown timer, aggregate distance/elevation, and ZERO `#E4501C`.
- `tests/messaging/terra-reputation-e2e.spec.ts`: 10 comprehensive test suites covering pure math, adversarial abuse, streak windowing, and static markup audits.

---

## 5. Verification Method

To verify the design and implementation:

1. **Type Checking**:
   ```bash
   npm run type-check
   ```
   Must pass with 0 errors after creating `src/features/messaging/types/reputation.types.ts`.

2. **Unit & Adversarial Testing**:
   Run Vitest targeting the test suite:
   ```bash
   npx vitest run tests/messaging/terra-reputation-e2e.spec.ts
   ```
   Must verify:
   - Raw text messages yield 0 points.
   - Point awards match +25, +10, +15, +15, +30.
   - Solo outings yield 0 team streak.
   - Monthly windowing correctly handles multi-hike months and missed windows.

3. **Zero Orange Audit**:
   Execute grep search on newly created UI components:
   ```bash
   grep -rn "#E4501C" src/features/messaging/components/reputation/
   ```
   Must return 0 matches.
