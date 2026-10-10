# Analysis: Collaborative Reputation & Adventure Streaks (Milestone 4 — R4)

**Specialist**: `explorer_m4_reputation_1`  
**Working Directory**: `.agents/teamwork/explorer_m4_reputation_1`  
**Target Milestone**: Milestone 4 (R4) — LKDV Social Architecture & Canonical Messaging Industrialization  
**Key Deliverables**: Domain models, algorithms, TypeScript type contracts, Apple HIG Liquid Glass component blueprints, adversarial test scenarios.

---

## 1. Executive Summary

Milestone 4 (R4) deploys the **Collaborative Reputation** and **Collective Adventure Streaks** systems in LKDV Social. These engines are designed to solve the structural pathology of social network gamification (e.g., chat spam, bots, vanity metrics) by realigning user incentives around **verifiable outdoor utility**:

1. **Anti-Spam Reciprocal Utility Contribution Engine**:
   - Strictly **0 points** for raw chat messages (`text`, `image`, chit-chat).
   - Points are awarded exclusively for tangible, verifiable collective actions:
     * `GPX_TRACK_SHARED` (+25 pts)
     * `CHECKLIST_ITEM_COMPLETED` (+10 pts)
     * `PACK_MERGE_CONFIRMED` (+15 pts)
     * `FIELD_CHECKIN_SUBMITTED` (+15 pts)
     * `SAFETY_ALERT_VERIFIED` (+30 pts)
   - Contributor progression through 5 mountain tiers: *Explorateur Débutant* (0-49 pts), *Équipier Actif* (50-149 pts), *Éclaireur de Sentier* (150-349 pts), *Guide Référent* (350-749 pts), and *Chef d'Expédition* (750+ pts).

2. **Collective Adventure Streaks Engine**:
   - Rejects predatory daily solo streaks (which encourage dangerous mountaineering in bad weather).
   - Tracks **joint team outings** between 2 or more members.
   - Operates on realistic outdoor activity windows: **Monthly** (default 35-day window), **Bi-weekly** (18-day window), or **Seasonal** (90-day window).
   - Automatically computes streak state (`active`, `at_risk`, `broken`, `inactive`), longest streak, shared mileage/elevation, and countdown to next outing.

3. **Apple HIG & Liquid Glass UI Blueprints**:
   - `ReputationBadge.tsx`: Compact tier badge with utility point counter, subtle backdrop blur, and tier-specific nature tokens.
   - `AdventureStreakBanner.tsx`: Prominent team banner with collective streak counter, next outing countdown, and aggregated metrics.
   - **Zero Orange Constraint**: Absolute prohibition of orange `#E4501C`. Uses LKDV tokens (`warn` `#C89A3B`, `amber-600`, `forest`, `sage`, `sky`, `sand`).

---

## 2. Anti-Spam Reciprocal Utility Contribution Engine

### 2.1 The Anti-Spam Invariant (0 Points for Raw Messages)

Generic messaging platforms reward activity volume (messages per day, reactions, thread replies). In an outdoor preparation and mountain safety context, this creates dangerous failure modes:
- Users spam low-value messages ("merci", "cool", "up") to boost rank.
- Critical safety discussions, weather updates, and gear allocations get buried under gamification noise.
- Automated bots can trivially farm points.

**Core Architectural Rule**:
$$\text{Points}(\text{Raw Message}) = 0$$

Raw chat text (`message_type: 'text'`), photos, voice notes, and reactions award exactly **0 contribution points**.

### 2.2 Verifiable Outdoor Utility Action Taxonomy

Points are awarded only when an event satisfies cryptographic or deterministic domain verification criteria:

| Utility Event Type | Points | Trigger & Verification Criteria | Anti-Abuse / Deduplication Safeguard |
|---|:---:|---|---|
| `GPX_TRACK_SHARED` | **+25** | Author shares a valid GPX itinerary snapshot containing: title, `distanceKm > 0`, `elevationGainM >= 0`, `bounds`, and valid `svgPolylinePath`. | Deduplication key `userId:conversationId:trackId`. Max 1 reward per track per user per conversation within 24h. |
| `CHECKLIST_ITEM_COMPLETED` | **+10** | Member marks an expedition task as complete (`isCompleted: true`, `completedBy: userId`). | Item ID lock: each checklist item can only award points once per room lifecycle. Rapid toggle flapping awards 0 additional points. |
| `PACK_MERGE_CONFIRMED` | **+15** | Member accepts mutual gear portage in a Pack Merge session (`assignedItems >= 1`, `isShared: true`), verified against load limits (<= 20% body weight human, <= 15% dog). | Granted once per confirmed pack merge session upon finalization. |
| `FIELD_CHECKIN_SUBMITTED` | **+15** | Member broadcasts a GPS-anchored check-in (`status: 'ok' \| 'camp_set' \| 'delayed' \| 'sos'`) with valid coordinates (`lat`, `lng`) and fresh timestamp. | Rate limit cooldown: minimum 30 minutes between rewarded check-ins unless emergency status elevation (`sos`). |
| `SAFETY_ALERT_VERIFIED` | **+30** | Member reports a mountain hazard (`obstacle`, `danger`, `snow_ice`, `closure`, `sos`) that is validated by a Safety/Guide/Admin role or by peer verification. | Highest value (+30). Requires verification flag `isVerified: true` or safety officer acknowledgment. |

### 2.3 Reputation Tiers (`ReputationTier`)

 progression reflects increasing commitment to collective safety and group logistics:

| Tier Key | French Display Name | Points Threshold | Short Label | Accent Token | Icon | Description |
|---|---|:---:|---|---|---|---|
| `novice` | Explorateur Débutant | 0 – 49 pts | Débutant | `stone-500` | Compass | Premiers pas dans la préparation collective LKDV |
| `contributor` | Équipier Actif | 50 – 149 pts | Équipier | `sage-600` | CheckCircle | Participe aux checklists et à la logistique de groupe |
| `trailblazer` | Éclaireur de Sentier | 150 – 349 pts | Éclaireur | `sky-600` | Map | Partage des tracés GPX et des check-ins terrain fiables |
| `mountain_guide` | Guide Référent | 350 – 749 pts | Guide | `forest-700` | Shield | Veille à la sécurité et optimise le portage collectif |
| `expedition_leader` | Chef d'Expédition | 750+ pts | Leader | `warn` (`#C89A3B`) | Trophy | Pilier d'expéditions collectives et de sécurité en montagne |

### 2.4 Domain Logic & Algorithms

#### Point Calculation Formula:
```typescript
export function calculateContributionPoints(event: UtilityEvent): number {
  if (!event || !event.type) return 0;

  switch (event.type) {
    case 'GPX_TRACK_SHARED': {
      const gpx = event.payload?.gpxSnapshot;
      if (!gpx || !gpx.title || typeof gpx.distanceKm !== 'number' || gpx.distanceKm <= 0) {
        return 0;
      }
      if (typeof gpx.elevationGainM !== 'number' || gpx.elevationGainM < 0) {
        return 0;
      }
      return 25;
    }

    case 'CHECKLIST_ITEM_COMPLETED': {
      const item = event.payload?.checklistItem;
      if (!item || !item.id || !item.isCompleted) {
        return 0;
      }
      return 10;
    }

    case 'PACK_MERGE_CONFIRMED': {
      const merge = event.payload?.packMerge;
      if (!merge || !merge.isConfirmed) {
        return 0;
      }
      // Must carry at least 1 collective item safely
      const sharedCount = merge.carriedSharedItemsCount ?? 0;
      const isSafe = merge.isLoadSafe ?? true;
      if (sharedCount <= 0 || !isSafe) {
        return 0;
      }
      return 15;
    }

    case 'FIELD_CHECKIN_SUBMITTED': {
      const checkin = event.payload?.fieldCheckIn;
      if (!checkin || !checkin.status) return 0;
      const lat = checkin.location?.latitude;
      const lng = checkin.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return 0;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 0;
      return 15;
    }

    case 'SAFETY_ALERT_VERIFIED': {
      const alert = event.payload?.safetyAlert;
      if (!alert || !alert.hazardType || !alert.isVerified) {
        return 0;
      }
      return 30;
    }

    default:
      // Raw chat messages, plain text, unrecognized events: strictly 0
      return 0;
  }
}
```

#### Tier Resolution and Progress:
```typescript
export function resolveReputationTier(points: number): ReputationTier {
  const safePoints = Math.max(0, Math.floor(points));
  if (safePoints >= 750) return 'expedition_leader';
  if (safePoints >= 350) return 'mountain_guide';
  if (safePoints >= 150) return 'trailblazer';
  if (safePoints >= 50) return 'contributor';
  return 'novice';
}

export function calculateTierProgress(points: number): {
  currentTier: ReputationTier;
  nextTier: ReputationTier | null;
  progressPercent: number;
  pointsToNextTier: number;
} {
  const safePoints = Math.max(0, Math.floor(points));
  const currentTier = resolveReputationTier(safePoints);

  const tierBounds: Record<ReputationTier, { min: number; next: number | null }> = {
    novice: { min: 0, next: 50 },
    contributor: { min: 50, next: 150 },
    trailblazer: { min: 150, next: 350 },
    mountain_guide: { min: 350, next: 750 },
    expedition_leader: { min: 750, next: null },
  };

  const bounds = tierBounds[currentTier];
  if (bounds.next === null) {
    return {
      currentTier,
      nextTier: null,
      progressPercent: 100,
      pointsToNextTier: 0,
    };
  }

  const range = bounds.next - bounds.min;
  const currentInRange = safePoints - bounds.min;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentInRange / range) * 100)));
  const pointsToNextTier = Math.max(0, bounds.next - safePoints);

  const nextTierKeys: Record<ReputationTier, ReputationTier | null> = {
    novice: 'contributor',
    contributor: 'trailblazer',
    trailblazer: 'mountain_guide',
    mountain_guide: 'expedition_leader',
    expedition_leader: null,
  };

  return {
    currentTier,
    nextTier: nextTierKeys[currentTier],
    progressPercent,
    pointsToNextTier,
  };
}
```

---

## 3. Collective Adventure Streaks Engine

### 3.1 The Collective Philosophy
A streak engine for the outdoors must reject daily gamification. Demanding a hike every day is irresponsible: it risks exhaustion, hypothermia, and reckless behavior during dangerous alpine weather windows.

**LKDV Principles**:
1. **Strictly Collective**: A solo hike does not count towards a team streak. The expedition must include **$\ge 2$ members** from the team roster.
2. **Realistic Time Windows**: Streaks measure consistent outdoor collaboration over calendar windows (e.g., monthly: 1 shared expedition every ~30-35 days).
3. **Cumulative Metrics**: Alongside the consecutive streak count, the engine aggregates team mileage (km) and vertical ascent ($m\text{ D+}$).

### 3.2 Streak State Machine

```
                   [Initial: Inactive (streak = 0)]
                                  │
                                  │ 1st Completed Joint Outing
                                  ▼
                            ┌───────────┐
                ┌───────────│  Active   │───────────┐
                │           └───────────┘           │
                │                 │                 │
                │ Outing in       │ Window elapsed  │ Gap > MaxGracePeriod
                │ current window  │ > (Window - 7d) │
                │                 ▼                 ▼
                │           ┌───────────┐     ┌───────────┐
                └──────────►│  At Risk  │    │  Broken   │
                            └───────────┘     └───────────┘
                                  │                 │
                                  │ Outing before   │ New Outing
                                  │ deadline        │
                                  ▼                 ▼
                            ┌───────────┐     ┌───────────┐
                            │  Active   │     │ Active=1  │
                            │(streak+1) │     └───────────┘
                            └───────────┘
```

- **`inactive`**: No completed joint outings recorded for this group. Streak = 0.
- **`active`**: Last joint outing occurred within the active window. Days remaining > at-risk threshold.
- **`at_risk`**: Activity window is nearing expiration (e.g. $\le 7$ days remaining). Displays amber warning banner and countdown.
- **`broken`**: The window expired before a joint outing occurred. Streak resets to 0 upon evaluation (or starts at 1 upon next outing).

### 3.3 Streak Calculation Algorithm (`calculateTeamStreak`)

```typescript
export function calculateTeamStreak(
  teamMembers: string[],
  expeditions: ExpeditionRecord[],
  options?: Partial<StreakWindowConfig> & { referenceDate?: Date }
): AdventureStreak {
  const config: StreakWindowConfig = {
    windowType: options?.windowType ?? 'monthly',
    maxGapDays: options?.maxGapDays ?? 35,
    atRiskThresholdDays: options?.atRiskThresholdDays ?? 7,
    minParticipants: options?.minParticipants ?? 2,
  };

  const refDate = options?.referenceDate ?? new Date();
  const sortedTeam = [...new Set(teamMembers)].sort();
  const teamKey = sortedTeam.join(':');

  if (sortedTeam.length < config.minParticipants) {
    return {
      teamKey,
      participantIds: sortedTeam,
      currentStreak: 0,
      longestStreak: 0,
      state: 'inactive',
      lastOutingDate: null,
      nextDeadlineDate: null,
      daysRemaining: 0,
      totalJointExpeditions: 0,
      totalJointDistanceKm: 0,
      totalJointElevationGainM: 0,
      windowType: config.windowType,
    };
  }

  // 1. Filter valid joint completed expeditions
  const validExpeditions = expeditions
    .filter((exp) => {
      if (exp.status !== 'completed') return false;
      if (!exp.completedAt) return false;
      const jointCount = exp.participantIds.filter((id) => sortedTeam.includes(id)).length;
      return jointCount >= config.minParticipants;
    })
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  if (validExpeditions.length === 0) {
    return {
      teamKey,
      participantIds: sortedTeam,
      currentStreak: 0,
      longestStreak: 0,
      state: 'inactive',
      lastOutingDate: null,
      nextDeadlineDate: null,
      daysRemaining: 0,
      totalJointExpeditions: 0,
      totalJointDistanceKm: 0,
      totalJointElevationGainM: 0,
      windowType: config.windowType,
    };
  }

  // 2. Accumulate overall metrics
  let totalDistanceKm = 0;
  let totalElevationGainM = 0;
  for (const exp of validExpeditions) {
    totalDistanceKm += exp.distanceKm ?? 0;
    totalElevationGainM += exp.elevationGainM ?? 0;
  }

  // 3. Compute consecutive window periods
  // Deduplicate outings occurring in the same calendar window
  const windowBuckets: Array<{ windowKey: string; lastDate: Date }> = [];

  for (const exp of validExpeditions) {
    const d = new Date(exp.completedAt);
    const windowKey = getWindowKey(d, config.windowType);
    const existing = windowBuckets.find((b) => b.windowKey === windowKey);
    if (!existing) {
      windowBuckets.push({ windowKey, lastDate: d });
    } else {
      if (d.getTime() > existing.lastDate.getTime()) {
        existing.lastDate = d;
      }
    }
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let lastBucketDate: Date | null = null;

  for (let i = 0; i < windowBuckets.length; i++) {
    const bucket = windowBuckets[i];
    if (!lastBucketDate) {
      currentStreak = 1;
    } else {
      const gapDays = (bucket.lastDate.getTime() - lastBucketDate.getTime()) / (1000 * 60 * 60 * 24);
      if (gapDays <= config.maxGapDays) {
        currentStreak += 1;
      } else {
        // Gap exceeded, streak reset
        currentStreak = 1;
      }
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    lastBucketDate = bucket.lastDate;
  }

  // 4. Evaluate streak status relative to reference date
  const lastExpedition = validExpeditions[validExpeditions.length - 1];
  const lastOutingDate = new Date(lastExpedition.completedAt);
  const nextDeadlineTime = lastOutingDate.getTime() + config.maxGapDays * 24 * 60 * 60 * 1000;
  const nextDeadlineDate = new Date(nextDeadlineTime);
  const msRemaining = nextDeadlineTime - refDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  let state: StreakState = 'active';
  if (msRemaining <= 0) {
    state = 'broken';
    currentStreak = 0;
  } else if (daysRemaining <= config.atRiskThresholdDays) {
    state = 'at_risk';
  } else {
    state = 'active';
  }

  return {
    teamKey,
    participantIds: sortedTeam,
    currentStreak,
    longestStreak,
    state,
    lastOutingDate: lastOutingDate.toISOString(),
    nextDeadlineDate: nextDeadlineDate.toISOString(),
    daysRemaining,
    totalJointExpeditions: validExpeditions.length,
    totalJointDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalJointElevationGainM: Math.round(totalElevationGainM),
    windowType: config.windowType,
  };
}

function getWindowKey(date: Date, type: StreakWindowType): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-11
  switch (type) {
    case 'biweekly': {
      const day = date.getUTCDate();
      const half = day <= 15 ? 'H1' : 'H2';
      return `${y}-${m + 1}-${half}`;
    }
    case 'seasonal': {
      const quarter = Math.floor(m / 3) + 1;
      return `${y}-Q${quarter}`;
    }
    case 'monthly':
    default:
      return `${y}-${m + 1}`;
  }
}
```

---

## 4. TypeScript Type System Design

File location: `src/features/messaging/types/reputation.types.ts`

```typescript
/**
 * LKDV Social — Collaborative Reputation & Adventure Streaks Types
 * File: src/features/messaging/types/reputation.types.ts
 *
 * Implements Milestone 4 (R4):
 * 1. Anti-Spam Reciprocal Utility Contribution Engine
 * 2. Collective Adventure Streaks Engine
 * 3. Contributor Tiers & Apple HIG Liquid Glass styling contracts
 */

import type { GPXSnapshot } from './outdoorObjects.types';
import type { ExpeditionChecklistItem, FieldCheckIn } from './expeditionRooms.types';

// ============================================================================
// 1. REPUTATION TIERS
// ============================================================================

export type ReputationTier =
  | 'novice'
  | 'contributor'
  | 'trailblazer'
  | 'mountain_guide'
  | 'expedition_leader';

export interface ReputationTierConfig {
  tier: ReputationTier;
  minPoints: number;
  label: string;
  shortLabel: string;
  description: string;
  badgeStyle: string;
  iconName: string;
}

export const REPUTATION_TIERS: Record<ReputationTier, ReputationTierConfig> = {
  novice: {
    tier: 'novice',
    minPoints: 0,
    label: 'Explorateur Débutant',
    shortLabel: 'Débutant',
    description: 'Premiers pas dans la préparation collective LKDV',
    badgeStyle: 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30',
    iconName: 'compass',
  },
  contributor: {
    tier: 'contributor',
    minPoints: 50,
    label: 'Équipier Actif',
    shortLabel: 'Équipier',
    description: 'Participe aux checklists et à la logistique de groupe',
    badgeStyle: 'bg-sage-600/15 text-sage-800 dark:text-sage-200 border-sage-600/30',
    iconName: 'check-circle',
  },
  trailblazer: {
    tier: 'trailblazer',
    minPoints: 150,
    label: 'Éclaireur de Sentier',
    shortLabel: 'Éclaireur',
    description: 'Partage des tracés GPX et des check-ins terrain vérifiés',
    badgeStyle: 'bg-sky-600/15 text-sky-800 dark:text-sky-200 border-sky-600/30',
    iconName: 'map',
  },
  mountain_guide: {
    tier: 'mountain_guide',
    minPoints: 350,
    label: 'Guide Référent',
    shortLabel: 'Guide',
    description: 'Veille à la sécurité et optimise le portage collectif',
    badgeStyle: 'bg-forest-900/15 text-forest-800 dark:text-forest-200 border-forest-700/30',
    iconName: 'shield',
  },
  expedition_leader: {
    tier: 'expedition_leader',
    minPoints: 750,
    label: "Chef d'Expédition",
    shortLabel: 'Leader',
    description: "Pilier d'expéditions collectives et de sécurité en montagne",
    badgeStyle: 'bg-warn/15 text-amber-900 dark:text-amber-200 border-warn/40',
    iconName: 'trophy',
  },
};

// ============================================================================
// 2. VERIFIABLE UTILITY EVENTS & POINTS TABLE
// ============================================================================

export type UtilityEventType =
  | 'GPX_TRACK_SHARED'
  | 'CHECKLIST_ITEM_COMPLETED'
  | 'PACK_MERGE_CONFIRMED'
  | 'FIELD_CHECKIN_SUBMITTED'
  | 'SAFETY_ALERT_VERIFIED';

export const UTILITY_POINT_VALUES: Record<UtilityEventType, number> = {
  GPX_TRACK_SHARED: 25,
  CHECKLIST_ITEM_COMPLETED: 10,
  PACK_MERGE_CONFIRMED: 15,
  FIELD_CHECKIN_SUBMITTED: 15,
  SAFETY_ALERT_VERIFIED: 30,
};

export interface PackMergeConfirmationPayload {
  mergePlanId: string;
  isConfirmed: boolean;
  carriedSharedItemsCount: number;
  totalWeightGrams: number;
  isLoadSafe: boolean;
  participantId: string;
}

export interface SafetyAlertPayload {
  id: string;
  hazardType: 'obstacle' | 'closure' | 'snow_ice' | 'danger' | 'weather' | 'sos';
  location: { latitude: number; longitude: number; label?: string };
  isVerified: boolean;
  verifiedBy?: string;
  description?: string;
}

export interface UtilityEventPayload {
  gpxSnapshot?: Partial<GPXSnapshot>;
  checklistItem?: Partial<ExpeditionChecklistItem>;
  packMerge?: Partial<PackMergeConfirmationPayload>;
  fieldCheckIn?: Partial<FieldCheckIn>;
  safetyAlert?: Partial<SafetyAlertPayload>;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface UtilityEvent {
  id: string;
  userId: string;
  type: UtilityEventType;
  pointsEarned: number;
  timestamp: string;
  payload: UtilityEventPayload;
  conversationId?: string;
  idempotencyKey?: string;
}

// ============================================================================
// 3. USER REPUTATION MODEL
// ============================================================================

export interface UtilityActionCounts {
  gpxTracksShared: number;
  checklistItemsCompleted: number;
  packMergesConfirmed: number;
  fieldCheckinsSubmitted: number;
  safetyAlertsVerified: number;
  rawMessagesCount: number;
}

export interface UserReputation {
  userId: string;
  totalPoints: number;
  tier: ReputationTier;
  actionCounts: UtilityActionCounts;
  nextTierPoints: number | null;
  tierProgressPercent: number;
  recentEvents: UtilityEvent[];
  updatedAt: string;
}

// ============================================================================
// 4. COLLECTIVE ADVENTURE STREAKS
// ============================================================================

export type StreakWindowType = 'monthly' | 'biweekly' | 'seasonal' | 'custom';
export type StreakState = 'active' | 'at_risk' | 'broken' | 'inactive';

export interface ExpeditionRecord {
  id: string;
  title: string;
  completedAt: string; // ISO date
  participantIds: string[];
  distanceKm?: number;
  elevationGainM?: number;
  status: 'completed' | 'active' | 'planning' | 'cancelled';
  locationName?: string;
}

export interface StreakWindowConfig {
  windowType: StreakWindowType;
  maxGapDays: number;
  atRiskThresholdDays: number;
  minParticipants: number;
}

export interface AdventureStreak {
  teamKey: string;
  participantIds: string[];
  currentStreak: number;
  longestStreak: number;
  state: StreakState;
  lastOutingDate: string | null;
  nextDeadlineDate: string | null;
  daysRemaining: number;
  totalJointExpeditions: number;
  totalJointDistanceKm: number;
  totalJointElevationGainM: number;
  windowType: StreakWindowType;
}
```

---

## 5. UI Component Blueprints (Apple HIG & Liquid Glass)

### 5.1 Component 1: `ReputationBadge.tsx`

#### Architectural & UX Intent:
- **Location**: Rendered beside participant avatars in message bubbles, expedition rosters, and club member cards.
- **Visual Style**: Apple HIG Liquid Glass capsule. Subtle translucency (`bg-white/70 dark:bg-stone-900/70`), micro-border (`border-stone-200/50 dark:border-stone-700/50`), refined SF Pro typography.
- **Zero Orange Compliance**: Uses nature-inspired hues (`stone`, `sage`, `sky`, `forest`, and `warn` amber `#C89A3B`).
- **Touch Target**: When interactive (`onClick` or expandable info sheet), provides a comfortable $\ge 44\text{px}$ touch target with active haptic scaling (`active:scale-[0.98]`).

#### Blueprint Code:
```tsx
'use client';

import React from 'react';
import type { ReputationTier } from '../../types/reputation.types';
import { REPUTATION_TIERS } from '../../types/reputation.types';

export interface ReputationBadgeProps {
  tier: ReputationTier;
  points?: number;
  showPoints?: boolean;
  showLabel?: boolean;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const ReputationBadge: React.FC<ReputationBadgeProps> = ({
  tier,
  points,
  showPoints = true,
  showLabel = true,
  size = 'sm',
  onClick,
  className = '',
}) => {
  const config = REPUTATION_TIERS[tier] || REPUTATION_TIERS.novice;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-sm gap-2',
  }[size];

  // Mountain & outdoor icons rendered via clean inline SVG
  const renderIcon = () => {
    switch (tier) {
      case 'expedition_leader':
        // Trophy icon (Liquid Glass Gold)
        return (
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
            <path d="M6 4h12v5c0 3.31-2.69 6-6 6s-6-2.69-6-6V4z" />
          </svg>
        );
      case 'mountain_guide':
        // Shield icon (Forest Emerald)
        return (
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      case 'trailblazer':
        // Map / Route icon (Sky Blue)
        return (
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        );
      case 'contributor':
        // Check circle icon (Sage Green)
        return (
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'novice':
      default:
        // Compass icon (Stone Neutral)
        return (
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        );
    }
  };

  const interactiveClasses = onClick
    ? 'cursor-pointer active:scale-[0.98] transition-transform duration-150 min-h-[44px] flex items-center'
    : '';

  return (
    <div
      role={onClick ? 'button' : 'status'}
      aria-label={`${config.label}${points !== undefined ? ` - ${points} points` : ''}`}
      onClick={onClick}
      className={`inline-flex items-center rounded-full border backdrop-blur-md font-medium tracking-tight shadow-sm transition-colors ${config.badgeStyle} ${sizeClasses} ${interactiveClasses} ${className}`}
    >
      {renderIcon()}
      {showLabel && <span className="font-semibold">{config.shortLabel}</span>}
      {showPoints && points !== undefined && (
        <span className="opacity-80 font-mono text-[11px]">
          {points} pts
        </span>
      )}
    </div>
  );
};
```

---

### 5.2 Component 2: `AdventureStreakBanner.tsx`

#### Architectural & UX Intent:
- **Location**: Mounted at the header of Expedition Rooms and Group Trips.
- **Visual Style**: Liquid Glass iOS Card (`backdrop-blur-xl bg-white/70 dark:bg-stone-900/70 border border-stone-200/50 dark:border-stone-800/50 rounded-card p-4`).
- **Zero Orange `#E4501C` Audit**:
  - The flame symbol represents team momentum. Rather than hazardous saturated orange, the flame is rendered in warm golden amber (`text-amber-500` / `#C89A3B`) with a soft glow.
  - Active state: Forest/Sage green accents (`text-forest-700 dark:text-forest-300`).
  - At Risk state: Warm amber badge (`bg-warn/15 text-amber-900 dark:text-amber-200 border-warn/30`).
- **Interactive Elements**: Includes a "Planifier la prochaine sortie" action button with $\ge 44\text{px}$ touch target.

#### Blueprint Code:
```tsx
'use client';

import React from 'react';
import type { AdventureStreak } from '../../types/reputation.types';

export interface AdventureStreakBannerProps {
  streak: AdventureStreak;
  teamName?: string;
  onPlanNextOuting?: () => void;
  className?: string;
}

export const AdventureStreakBanner: React.FC<AdventureStreakBannerProps> = ({
  streak,
  teamName = 'Équipe',
  onPlanNextOuting,
  className = '',
}) => {
  const {
    currentStreak,
    state,
    daysRemaining,
    nextDeadlineDate,
    totalJointExpeditions,
    totalJointDistanceKm,
    totalJointElevationGainM,
  } = streak;

  // Format deadline date in French
  const formattedDeadline = nextDeadlineDate
    ? new Date(nextDeadlineDate).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  // State-specific styling badges
  const stateBadge = () => {
    switch (state) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-forest-900/10 text-forest-800 dark:text-forest-200 border border-forest-700/20">
            <span className="w-1.5 h-1.5 rounded-full bg-forest-600 animate-pulse" />
            Série active
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-600/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            {daysRemaining} j restants
          </span>
        );
      case 'broken':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-500/15 text-stone-700 dark:text-stone-300 border border-stone-500/30">
            À relancer
          </span>
        );
      case 'inactive':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-500/15 text-stone-600 dark:text-stone-400 border border-stone-500/20">
            Nouvelle équipe
          </span>
        );
    }
  };

  return (
    <div
      role="region"
      aria-label={`Série collective de ${teamName}`}
      className={`relative overflow-hidden rounded-card backdrop-blur-xl bg-white/75 dark:bg-stone-900/75 border border-stone-200/50 dark:border-stone-800/50 p-4 shadow-sm transition-all ${className}`}
    >
      {/* Top row: Counter & status */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {/* Flame icon rendered in warm golden amber (#C89A3B) - NEVER ORANGE #E4501C */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c-.5 2-2 4-4 5.5C6.5 8.7 5 10.7 5 13a7 7 0 0 0 14 0c0-3-2.5-6-4.5-8-1 2-2.5 3-3.5 3 .5-2 1-4.5 1-6z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span>{currentStreak} {currentStreak > 1 ? 'sorties' : 'sortie'} en équipe</span>
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              {teamName}
            </p>
          </div>
        </div>

        <div>{stateBadge()}</div>
      </div>

      {/* Middle row: Outing countdown or motivation message */}
      <div className="py-2 px-3 rounded-lg bg-stone-50/80 dark:bg-stone-800/50 border border-stone-200/30 dark:border-stone-700/30 mb-3">
        {state === 'active' && (
          <p className="text-xs text-stone-700 dark:text-stone-300">
            Prochaine sortie avant le <span className="font-semibold text-stone-900 dark:text-stone-100">{formattedDeadline}</span> ({daysRemaining} jours restants).
          </p>
        )}
        {state === 'at_risk' && (
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
            Attention : plus que <span className="font-bold underline">{daysRemaining} jours</span> pour maintenir la série collective !
          </p>
        )}
        {state === 'broken' && (
          <p className="text-xs text-stone-600 dark:text-stone-400">
            La série a expiré. Complétez une nouvelle expédition conjointe pour relancer le compteur.
          </p>
        )}
        {state === 'inactive' && (
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Réalisez votre première sortie à deux ou plus pour allumer la flamme collective.
          </p>
        )}
      </div>

      {/* Bottom row: Aggregate stats & CTA */}
      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 pt-1 border-t border-stone-200/40 dark:border-stone-800/40">
        <div className="flex items-center gap-3">
          <span>{totalJointExpeditions} {totalJointExpeditions > 1 ? 'expéditions' : 'expédition'}</span>
          <span>•</span>
          <span>{totalJointDistanceKm} km</span>
          <span>•</span>
          <span>+{totalJointElevationGainM} m</span>
        </div>

        {onPlanNextOuting && (
          <button
            type="button"
            onClick={onPlanNextOuting}
            className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-forest-900 text-white dark:bg-forest-700 hover:bg-forest-800 active:scale-[0.98] transition-all flex items-center gap-1 shadow-sm"
          >
            <span>Planifier</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## 6. Domain Service Architecture

File location: `src/features/messaging/services/domain/reputationService.ts`

The service acts as the pure domain engine handling:
1. `calculateContributionPoints(event: UtilityEvent): number`
2. `resolveReputationTier(points: number): ReputationTier`
3. `calculateTierProgress(points: number): TierProgressResult`
4. `aggregateUserReputation(userId: string, events: UtilityEvent[]): UserReputation`
5. `calculateTeamStreak(teamMembers: string[], expeditions: ExpeditionRecord[], options?: Partial<StreakWindowConfig>): AdventureStreak`
6. `createUtilityEvent(type: UtilityEventType, userId: string, payload: UtilityEventPayload): UtilityEvent`

Facade integration in `src/features/messaging/services/messagingService.ts`:
- Re-exports `reputationService` methods with 100% backward compatibility.
- Seamlessly exposes `getUserReputation` and `calculateTeamStreak`.

---

## 7. Adversarial Test Scenarios & Edge Cases

The implementer must test against these stress scenarios in `tests/messaging/terra-reputation-e2e.spec.ts`:

1. **Raw Message Spam Flooding**:
   - 1,000 text messages sent in conversation $\rightarrow$ user earned points = 0.
2. **Checklist Toggle Flapping**:
   - Member checks, unchecks, and checks the same item 50 times $\rightarrow$ rewarded exactly once (+10 pts).
3. **GPX Track Re-Sharing Abuse**:
   - Member shares the same GPX payload 5 times in the same room $\rightarrow$ deduplicated by `idempotencyKey`, only +25 pts awarded.
4. **Invalid GPS Bounds & Coordinates**:
   - Check-in submitted with latitude = 150.0 $\rightarrow$ rejected, 0 pts.
   - Negative GPX distance $\rightarrow$ rejected, 0 pts.
5. **Pack Merge Overload Exploit**:
   - Member carries 40% of their body weight $\rightarrow$ `isLoadSafe: false` $\rightarrow$ 0 pts awarded (unsafe portage not rewarded).
6. **Solo Outing Streak Invalidation**:
   - 1 user completes 10 hikes alone $\rightarrow$ team streak = 0.
7. **Window Expiry & Grace Period Verification**:
   - Outing on Jan 1st, outing on Jan 20th $\rightarrow$ streak = 2 (active).
   - Reference date = March 10th (50 days later) $\rightarrow$ streak = 0 (`broken`).
8. **Multiple Outings in Same Calendar Month**:
   - 4 hikes completed in June $\rightarrow$ streak incremented once for the June window, but all 4 count towards total distance and elevation.
9. **Zero Hex Orange `#E4501C` Audit**:
   - Static markup scan of `ReputationBadge` and `AdventureStreakBanner` must contain 0 occurrences of `#E4501C` or `text-orange-` / `bg-orange-`.
10. **Apple HIG 44px Touch Target Verification**:
    - Interactive elements have explicit `min-h-[44px]` touch target envelopes.

---

## 8. Synthesis & Implementation Checklist

- [x] Strict Anti-Spam invariant formulated (0 pts for raw text).
- [x] Verifiable 5-action taxonomy defined (+25, +10, +15, +15, +30).
- [x] 5-tier reputation progression configured.
- [x] Collective Adventure Streak mathematical windowing model finalized.
- [x] TypeScript contracts defined for `src/features/messaging/types/reputation.types.ts`.
- [x] Apple HIG Liquid Glass blueprints designed for `ReputationBadge` and `AdventureStreakBanner`.
- [x] Zero orange `#E4501C` audit confirmed across all tokens.
- [x] Ready for implementer handoff.
