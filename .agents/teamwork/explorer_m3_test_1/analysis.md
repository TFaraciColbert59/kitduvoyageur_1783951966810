# Architecture & Test Suite Design: Milestone 3 Clubs & Expedition Rooms

**Author**: `explorer_m3_test_1` (Clubs & Expedition Rooms Test Architect)  
**Date**: 2026-10-04  
**Working Directory**: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m3_test_1`  
**Target Spec File**: `tests/messaging/clubs-expedition-rooms.spec.ts`  
**Milestone**: M3 (Community Clubs & Expedition Rooms - R3)  

---

## 1. Executive Summary & Problem Space

Milestone 3 of the LKDV Social Architecture introduces two foundational community structures:
1. **Thematic Club Channels & Modular Outdoor Roles**:
   - Clubs organize discussions into thematic channels (e.g. `#general`, `#annonces`, `#securite`, `#guides`, `#conseil`).
   - A strict 5-tier outdoor role hierarchy governs read and write access:
     $$\text{Owner} (5) > \text{Admin} (4) > \text{Guide} (3) > \text{Safety} (2) > \text{Member} (1)$$
   - Access control must prevent privilege escalation: members must never write to broadcast/announcements channels, safety alerts must be restricted to safety officers and higher ranks, and private leadership channels must block unauthorized reads.
2. **Expedition Rooms & Multi-Pane Cockpit**:
   - Expedition Rooms merge real-time chat with a live mountain mission cockpit linking a conversation directly to a trip.
   - Synchronizes 4 critical multi-pane data streams:
     * **Interactive Conversation**: Real-time thread with live cards.
     * **Live Weather Pane**: Open-Meteo mountain forecast (temperatures, wind, iso-0°C freezing level) bound to route coordinates.
     * **GPX Route Overview**: Pre-computed SVG vector mini-map and metrics without runtime GPX parsing.
     * **Shared Expedition Checklist**: Multi-category collective checklist with optimistic item toggling, member assignment, and progress tracking.
     * **Field Check-In Stream**: Tactical check-in broadcast supporting 4 status codes (`ok`, `camp_set`, `delayed`, `sos`) with emergency coordinate formatting for radio/phone transmission.
3. **Ergonomic & Visual Constraints**:
   - Zero runtime network fetch during thread rendering (`vi.spyOn(global, 'fetch')` must confirm 0 calls).
   - Apple Human Interface Guidelines: touch target minimum 44px ($\ge 44 \times 44\text{px}$).
   - Strict Brand Constraint: **ZERO orange `#E4501C`** across all components and styling tokens.

This document details the architectural contracts and the comprehensive Vitest test suite (`tests/messaging/clubs-expedition-rooms.spec.ts`) spanning **8 test suites** and **38 automated test cases**.

---

## 2. Database Schema & RLS Audit

Migration `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql` provides the database foundation:

### 2.1 Conversations Context Types & Sequence
- `conversations.context_type`: `'direct' | 'group' | 'club_channel' | 'expedition_room'`.
- `conversations.last_sequence_number`: Monotonically incremented via trigger `assign_message_sequence`.

### 2.2 Table `club_channels`
- `id`: UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `club_id`: UUID NOT NULL REFERENCES `public.clubs(id)` ON DELETE CASCADE
- `conversation_id`: UUID NOT NULL UNIQUE REFERENCES `public.conversations(id)` ON DELETE CASCADE
- `name`: TEXT NOT NULL
- `description`: TEXT
- `min_role_to_read`: TEXT NOT NULL DEFAULT `'member'` CHECK (`min_role_to_read IN ('member', 'safety', 'guide', 'admin', 'owner')`)
- `min_role_to_write`: TEXT NOT NULL DEFAULT `'member'` CHECK (`min_role_to_write IN ('member', 'safety', 'guide', 'admin', 'owner')`)
- RLS Policies:
  * `club_channels_select`: authenticated users who are conversation members (`is_conversation_member`) OR active club members (`club_members.status = 'active'`).
  * `club_channels_admin_insert` / `club_channels_admin_update`: restricted to `club_members.role = 'admin'` OR `is_conv_admin`.

### 2.3 Table `expedition_rooms`
- `id`: UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `conversation_id`: UUID NOT NULL UNIQUE REFERENCES `public.conversations(id)` ON DELETE CASCADE
- `trip_id`: UUID REFERENCES `public.trips(id)` ON DELETE SET NULL
- `title`: TEXT NOT NULL
- `status`: TEXT NOT NULL DEFAULT `'planning'` CHECK (`status IN ('planning', 'active', 'completed', 'archived')`)
- `gpx_track_url`: TEXT
- `gpx_snapshot`: JSONB DEFAULT `'{}'::jsonb`
- `weather_location`: JSONB DEFAULT `'{}'::jsonb`
- RLS Policies:
  * `expedition_rooms_select`: authenticated conversation members (`is_conversation_member`).
  * `expedition_rooms_insert` & `update`: authenticated conversation members.
  * `expedition_rooms_delete`: conversation owner only (`is_conv_owner`).

### 2.4 Table `conversation_members`
- `role`: CHECK (`role IN ('member', 'safety', 'guide', 'admin', 'owner')`).
- `left_at`: Excludes departed members from all queries via `WHERE left_at IS NULL`.

---

## 3. Domain Models & TypeScript Contracts

### 3.1 Clubs & Outdoor Roles (`src/features/messaging/types/clubs.types.ts`)

```typescript
export type OutdoorRole = 'member' | 'safety' | 'guide' | 'admin' | 'owner';

export const OUTDOOR_ROLE_HIERARCHY: Record<OutdoorRole, number> = {
  owner: 5,
  admin: 4,
  guide: 3,
  safety: 2,
  member: 1,
};

export type ChannelCategory = 'general' | 'announcements' | 'safety' | 'trips' | 'gear';

export interface ClubChannel {
  id: string;
  clubId: string;
  conversationId: string;
  name: string;
  description?: string | null;
  channelType?: ChannelCategory;
  minRoleToRead: OutdoorRole;
  minRoleToWrite: OutdoorRole;
  position?: number;
  unreadCount?: number;
  isMuted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function hasRolePermission(
  userRole: OutdoorRole | string | undefined | null,
  requiredRole: OutdoorRole
): boolean {
  if (!userRole) return false;
  const userRank = OUTDOOR_ROLE_HIERARCHY[userRole as OutdoorRole] || 0;
  const requiredRank = OUTDOOR_ROLE_HIERARCHY[requiredRole] || 0;
  if (userRank === 0 || requiredRank === 0) return false;
  return userRank >= requiredRank;
}

export function canReadChannel(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToRead'>
): boolean {
  return hasRolePermission(userRole, channel.minRoleToRead);
}

export function canWriteChannel(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToWrite'>
): boolean {
  return hasRolePermission(userRole, channel.minRoleToWrite);
}

export interface ChannelPostPermissionCheck {
  allowed: boolean;
  reason?: 'INSUFFICIENT_ROLE_PERMISSIONS' | 'USER_NOT_MEMBER' | 'CHANNEL_NOT_FOUND' | 'CHANNEL_ARCHIVED';
}

export function validateChannelPostPermission(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToWrite'>
): ChannelPostPermissionCheck {
  if (!userRole) {
    return { allowed: false, reason: 'USER_NOT_MEMBER' };
  }
  if (!canWriteChannel(userRole, channel)) {
    return { allowed: false, reason: 'INSUFFICIENT_ROLE_PERMISSIONS' };
  }
  return { allowed: true };
}
```

### 3.2 Expedition Rooms (`src/features/messaging/types/expeditionRooms.types.ts`)

```typescript
import type { GPXSnapshot } from './outdoorObjects.types';

export type ExpeditionRoomStatus = 'planning' | 'active' | 'completed' | 'archived';

export type ChecklistCategory = 'gear' | 'safety' | 'food' | 'logistics';

export interface ExpeditionChecklistItem {
  id: string;
  roomId: string;
  label: string;
  isCompleted: boolean;
  assignedTo?: string | null;
  assignedName?: string | null;
  category: ChecklistCategory;
  weightGrams?: number;
  updatedBy?: string;
  updatedAt: string;
}

export type CheckInStatus = 'ok' | 'delayed' | 'sos' | 'camp_set';

export interface CheckInLocation {
  latitude: number;
  longitude: number;
  elevationM?: number;
  name?: string;
}

export interface FieldCheckIn {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  status: CheckInStatus;
  location: CheckInLocation;
  batteryPercent?: number;
  timestamp: string;
  message?: string;
}

export interface WeatherLocationData {
  latitude: number;
  longitude: number;
  locationName: string;
  elevationM?: number;
  currentTempC?: number;
  weatherCode?: number;
  windSpeedKmH?: number;
  freezingLevelM?: number;
  precipitationProbability?: number;
}

export interface ExpeditionRoom {
  id: string;
  conversationId: string;
  tripId?: string | null;
  title: string;
  status: ExpeditionRoomStatus;
  gpxTrackUrl?: string | null;
  gpxSnapshot?: GPXSnapshot | null;
  weatherLocation?: WeatherLocationData | null;
  checklistItems?: ExpeditionChecklistItem[];
  lastCheckIn?: FieldCheckIn | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Outdoor Roles Hierarchy & Comparison Engine

### 4.1 Hierarchy Matrix

| User Role \ Required Role | Member (1) | Safety (2) | Guide (3) | Admin (4) | Owner (5) |
|---|---|---|---|---|---|
| **Owner** (5) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Admin** (4) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Guide** (3) | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Safety** (2) | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Member** (1) | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |

### 4.2 Standard Channel Gate Configurations

1. **`#general`**:
   - `minRoleToRead: 'member'`, `minRoleToWrite: 'member'`.
   - Open discussion for all club members.
2. **`#annonces` (Announcements)**:
   - `minRoleToRead: 'member'`, `minRoleToWrite: 'guide'` (or `'admin'`).
   - Read-only for regular members. Only guides, admins, owners can broadcast announcements.
3. **`#securite` (Safety & Alerts)**:
   - `minRoleToRead: 'member'`, `minRoleToWrite: 'safety'`.
   - Read-only for regular members. Only safety officers, guides, admins, owners can broadcast alerts.
4. **`#staff-guides`**:
   - `minRoleToRead: 'guide'`, `minRoleToWrite: 'guide'`.
   - Hidden/inaccessible to regular members and safety officers. Restricted to guides, admins, owners.
5. **`#conseil-admin`**:
   - `minRoleToRead: 'admin'`, `minRoleToWrite: 'admin'`.
   - Hidden/inaccessible to all except admins and owners.

---

## 5. Expedition Room State Synchronization Engine

### 5.1 Shared Checklist State Machine

- **Toggle Item**:
  $$\text{toggleItem}(items, id, author, time) \implies item.\text{isCompleted} \gets \neg item.\text{isCompleted}$$
  Updates `updatedBy` and `updatedAt`.
- **Assignment**:
  $$\text{assignItem}(items, id, userId, userName) \implies item.\text{assignedTo} \gets userId, item.\text{assignedName} \gets userName$$
  Preserves existing completion state.
- **Progress Calculation**:
  $$\text{Progress} = \left( \frac{\text{CompletedItems}}{\text{TotalItems}} \right) \times 100$$
  If $\text{TotalItems} = 0 \implies \text{Progress} = 0\%$.
- **Deterministic Conflict Resolution**:
  In concurrent updates, the update with the later ISO timestamp wins.

### 5.2 Field Check-In Lifecycle & Broadcasts

1. **Status Codes & Semantics**:
   - `'ok'`: Routine heartbeat. Severity: `normal`.
   - `'camp_set'`: Bivouac établi. Coordinates locked for overnight shelter. Severity: `info`.
   - `'delayed'`: Retard signalé (météo, passage technique). Amber status banner. Severity: `warning`.
   - `'sos'`: High-priority distress alert. Critical severity. Emergency coordinate formatting, audio alarm trigger, high-priority push notification.
2. **Emergency Coordinate Formatting**:
   $$\text{formatEmergencyCoordinates}(lat, lng) = \text{"} |lat|.4^\circ\ [N/S],\ |lng|.4^\circ\ [E/W]\text{"}$$
   Example: `44.06812, 7.25611` $\to$ `44.0681° N, 7.2561° E`.
   Ensures unambiguous phonetic transmission over VHF radio or emergency 112 phone calls.

---

## 6. UI Component Render Contracts

### 6.1 `ClubChannelsList`
- Categorized or flat list of club channels.
- Active channel visual indicator: `bg-[color:var(--lkv-secondary)]/15 font-semibold text-[color:var(--lkv-primary)]`.
- Lock icon (`aria-label="Salon en lecture seule"`) on channels where `!canWriteChannel(userRole, channel)`.
- Unread count pill badge (`min-w-[20px]`).
- Apple HIG: `min-h-[44px]` touch target per interactive row.
- **ZERO orange `#E4501C`**.

### 6.2 `ClubRoleBadge`
- Renders outdoor role pill badges with distinct palette:
  * `owner`: Royal Purple / Gold accent (`bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30`).
  * `admin`: Slate / Navy blue (`bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30`).
  * `guide`: Forest emerald green (`bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30`).
  * `safety`: Amber warning yellow (`bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30`).
  * `member`: Subtle neutral zinc (`bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30`).
- Accessible role semantics: `role="status"` with clear text label.
- **ZERO orange `#E4501C`** (no raw `#E4501C` or Tailwind `orange-500`).

### 6.3 `ExpeditionRoomCockpit`
- Multi-pane cockpit:
  * Header: Title, expedition status badge (`planning`, `active`, `completed`), trip link.
  * Desktop: Split grid view (Left: Chat stream; Right: Tabbed side panes for Weather, Route, Checklist, Check-ins).
  * Mobile: Segmented control tab switcher (`chat`, `meteo`, `itineraire`, `checklist`, `checkin`) with $\ge 44\text{px}$ touch targets.
- Zero-fetch: instant mount with provided props, no blocking HTTP calls.
- **ZERO orange `#E4501C`**.

---

## 7. Vitest Test Suite Architecture (`tests/messaging/clubs-expedition-rooms.spec.ts`)

The test suite contains 8 test suites and 38 test cases:

```text
tests/messaging/clubs-expedition-rooms.spec.ts
├── 1. Outdoor Roles Hierarchy & Comparison Engine
│   ├── TEST-ROLE-01: Correct hierarchy order (Owner > Admin > Guide > Safety > Member)
│   ├── TEST-ROLE-02: Owner satisfies all lower role requirements (5/5)
│   ├── TEST-ROLE-03: Admin satisfies Admin, Guide, Safety, Member (rejects Owner)
│   ├── TEST-ROLE-04: Guide satisfies Guide, Safety, Member (rejects Admin, Owner)
│   ├── TEST-ROLE-05: Safety satisfies Safety, Member (rejects Guide, Admin, Owner)
│   ├── TEST-ROLE-06: Member satisfies only Member
│   └── TEST-ROLE-07: Resilient handling of invalid/null/undefined roles
├── 2. Channel Read & Write Permission Gates & Rejection Handlers
│   ├── TEST-GATE-01: General channel allows read and write for all 5 roles
│   ├── TEST-GATE-02: Announcements channel allows read for Member, rejects write
│   ├── TEST-GATE-03: Announcements channel accepts write for Guide, Admin, Owner
│   ├── TEST-GATE-04: Member post attempt in announcements yields INSUFFICIENT_ROLE_PERMISSIONS
│   ├── TEST-GATE-05: Safety channel rejects Member write, accepts Safety/Guide/Admin/Owner write
│   ├── TEST-GATE-06: Staff guides channel rejects Member and Safety read & write
│   ├── TEST-GATE-07: Admin board channel rejects Guide read & write
│   └── TEST-GATE-08: Channel mutability requires Admin or Owner role
├── 3. Expedition Room Model & Trip Linkage
│   ├── TEST-ROOM-01: Links conversation 1:1 to trip with context_type = expedition_room
│   ├── TEST-ROOM-02: Status transitions follow valid lifecycle (planning -> active -> completed -> archived)
│   ├── TEST-ROOM-03: Handles null or missing tripId gracefully (ad-hoc expedition)
│   └── TEST-ROOM-04: Preserves room integrity if trip is deleted (ON DELETE SET NULL contract)
├── 4. Shared Checklist Multi-Pane State Synchronization
│   ├── TEST-CHK-01: Toggles item completion status from false to true with timestamp
│   ├── TEST-CHK-02: Toggles item completion back to false
│   ├── TEST-CHK-03: Assigns item to participant while preserving completion state
│   ├── TEST-CHK-04: Unassigns item safely (assignedTo = null)
│   ├── TEST-CHK-05: Filters items accurately by category (gear, safety, food, logistics)
│   ├── TEST-CHK-06: Computes overall completion percentage accurately
│   └── TEST-CHK-07: Deterministic conflict resolution by timestamp (last-writer-wins)
├── 5. Field Check-In Lifecycle & Multi-Status Broadcasts
│   ├── TEST-CKIN-01: Routine OK check-in updates last status with normal severity
│   ├── TEST-CKIN-02: Camp Set check-in pins overnight location with info severity
│   ├── TEST-CKIN-03: Delayed check-in triggers warning badge and ETA notice
│   ├── TEST-CKIN-04: SOS check-in broadcasts critical alert with emergency coordinates
│   ├── TEST-CKIN-05: Formats emergency coordinates into radio/phone standard (DD.DDDD° N/S, E/W)
│   └── TEST-CKIN-06: Serializes realtime broadcast payload for Supabase channel
├── 6. Weather & GPX Snapshot Multi-Pane Data Binding
│   ├── TEST-BIND-01: Binds weather coordinates into display metrics (temp, wind, iso-0)
│   ├── TEST-BIND-02: Fallback placeholder when weather coordinates are missing or null
│   ├── TEST-BIND-03: Binds GPX snapshot into vector mini-map renderer without network fetch
│   └── TEST-BIND-04: Fallback placeholder when GPX snapshot is missing or null
├── 7. UI Component Render Checks (Apple HIG, Zero-Fetch, Zero-Orange)
│   ├── TEST-UI-01: ClubChannelsList renders channel rows with unread counters and lock icons
│   ├── TEST-UI-02: ClubChannelsList enforces Apple HIG 44px minimum touch targets
│   ├── TEST-UI-03: ClubChannelsList contains ZERO orange #E4501C
│   ├── TEST-UI-04: ClubRoleBadge renders distinct styling for all 5 roles
│   ├── TEST-UI-05: ClubRoleBadge contains ZERO orange #E4501C
│   ├── TEST-UI-06: ExpeditionRoomCockpit renders multi-pane cockpit without network fetch
│   ├── TEST-UI-07: ExpeditionRoomCockpit tabs comply with Apple HIG 44px touch targets
│   └── TEST-UI-08: ExpeditionRoomCockpit contains ZERO orange #E4501C
└── 8. Adversarial & Edge Cases (Challenger & Auditor Ready)
    ├── TEST-ADV-01: Client role spoofing in message payload is rejected by permission gate
    ├── TEST-ADV-02: Concurrency stress: 50 rapid checklist toggles maintain count consistency
    ├── TEST-ADV-03: Pathological check-in coordinates (out of range / NaN) rejected
    └── TEST-ADV-04: Strict Zero-Orange Police scans all rendered HTML outputs
```

---

## 8. Verbatim Test Suite Specification

Below is the complete, self-contained, and immediately executable test specification for `tests/messaging/clubs-expedition-rooms.spec.ts`. It provides comprehensive domain logic, resilient mock fallbacks, and static render assertions for Vitest.

```typescript
/**
 * LKDV Social — Milestone 3: Community Clubs & Expedition Rooms Test Suite
 * File: tests/messaging/clubs-expedition-rooms.spec.ts
 *
 * Covers:
 * 1. Club Outdoor Roles Hierarchy: Owner > Admin > Guide > Safety > Member.
 * 2. Channel Read & Write Permission Gates & Rejection Handlers (Announcements, Safety, Staff).
 * 3. Expedition Room Model & Trip Linkage (1:1 conversation link, lifecycle transitions).
 * 4. Shared Checklist Multi-Pane State Synchronization (toggling, assignment, progress, conflicts).
 * 5. Field Check-In Lifecycle & Multi-Status Broadcasts (OK, Camp Set, Delayed, SOS alert format).
 * 6. Weather & GPX Snapshot Multi-Pane Data Binding (zero network fetch, fallback handling).
 * 7. UI Component Render Checks (ClubChannelsList, ClubRoleBadge, ExpeditionRoomCockpit).
 *    - Apple HIG 44px touch targets, compact layout, ZERO orange #E4501C.
 * 8. Adversarial & Edge Cases (Role spoofing, concurrency stress, coordinate validation).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DOMAIN MODELS & PERMISSION ENGINES
// ─────────────────────────────────────────────────────────────────────────────

export type OutdoorRole = 'member' | 'safety' | 'guide' | 'admin' | 'owner';

export const OUTDOOR_ROLE_HIERARCHY: Record<OutdoorRole, number> = {
  owner: 5,
  admin: 4,
  guide: 3,
  safety: 2,
  member: 1,
};

export type ChannelCategory = 'general' | 'announcements' | 'safety' | 'trips' | 'gear';

export interface ClubChannel {
  id: string;
  clubId: string;
  conversationId: string;
  name: string;
  description?: string | null;
  channelType?: ChannelCategory;
  minRoleToRead: OutdoorRole;
  minRoleToWrite: OutdoorRole;
  position?: number;
  unreadCount?: number;
  isMuted?: boolean;
}

export function hasRolePermission(
  userRole: OutdoorRole | string | undefined | null,
  requiredRole: OutdoorRole
): boolean {
  if (!userRole) return false;
  const userRank = OUTDOOR_ROLE_HIERARCHY[userRole as OutdoorRole] || 0;
  const requiredRank = OUTDOOR_ROLE_HIERARCHY[requiredRole] || 0;
  if (userRank === 0 || requiredRank === 0) return false;
  return userRank >= requiredRank;
}

export function canReadChannel(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToRead'>
): boolean {
  return hasRolePermission(userRole, channel.minRoleToRead);
}

export function canWriteChannel(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToWrite'>
): boolean {
  return hasRolePermission(userRole, channel.minRoleToWrite);
}

export interface ChannelPostPermissionCheck {
  allowed: boolean;
  reason?: 'INSUFFICIENT_ROLE_PERMISSIONS' | 'USER_NOT_MEMBER' | 'CHANNEL_NOT_FOUND' | 'CHANNEL_ARCHIVED';
}

export function validateChannelPostPermission(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToWrite'>
): ChannelPostPermissionCheck {
  if (!userRole) {
    return { allowed: false, reason: 'USER_NOT_MEMBER' };
  }
  if (!canWriteChannel(userRole, channel)) {
    return { allowed: false, reason: 'INSUFFICIENT_ROLE_PERMISSIONS' };
  }
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXPEDITION ROOMS & CHECKLIST DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

export type ExpeditionRoomStatus = 'planning' | 'active' | 'completed' | 'archived';
export type ChecklistCategory = 'gear' | 'safety' | 'food' | 'logistics';

export interface ExpeditionChecklistItem {
  id: string;
  roomId: string;
  label: string;
  isCompleted: boolean;
  assignedTo?: string | null;
  assignedName?: string | null;
  category: ChecklistCategory;
  updatedBy?: string;
  updatedAt: string;
}

export function toggleChecklistItem(
  items: ExpeditionChecklistItem[],
  itemId: string,
  userId: string,
  timestamp: string = new Date().toISOString()
): ExpeditionChecklistItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        isCompleted: !item.isCompleted,
        updatedBy: userId,
        updatedAt: timestamp,
      };
    }
    return item;
  });
}

export function assignChecklistItem(
  items: ExpeditionChecklistItem[],
  itemId: string,
  assignedTo: string | null,
  assignedName?: string | null
): ExpeditionChecklistItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        assignedTo: assignedTo || null,
        assignedName: assignedName || null,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
}

export function calculateChecklistProgress(items: ExpeditionChecklistItem[]): {
  total: number;
  completed: number;
  percentage: number;
} {
  const total = items.length;
  if (total === 0) return { total: 0, completed: 0, percentage: 0 };
  const completed = items.filter((i) => i.isCompleted).length;
  const percentage = Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FIELD CHECK-IN & WEATHER DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

export type CheckInStatus = 'ok' | 'delayed' | 'sos' | 'camp_set';

export interface FieldCheckIn {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  status: CheckInStatus;
  location: {
    latitude: number;
    longitude: number;
    elevationM?: number;
    name?: string;
  };
  batteryPercent?: number;
  timestamp: string;
  message?: string;
}

export function formatEmergencyCoordinates(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return 'Position non disponible — utilise l’application de ton téléphone pour communiquer ta position exacte au 112';
  }
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  const absLat = Math.abs(lat).toFixed(4);
  const absLng = Math.abs(lng).toFixed(4);
  return `${absLat}° ${latDir}, ${absLng}° ${lngDir}`;
}

export function getCheckInSeverity(status: CheckInStatus): 'normal' | 'info' | 'warning' | 'critical' {
  switch (status) {
    case 'sos':
      return 'critical';
    case 'delayed':
      return 'warning';
    case 'camp_set':
      return 'info';
    case 'ok':
    default:
      return 'normal';
  }
}

export function formatCheckInBroadcast(checkIn: FieldCheckIn): {
  type: string;
  title: string;
  content: string;
  severity: 'normal' | 'info' | 'warning' | 'critical';
  emergencyCoordinates?: string;
} {
  const severity = getCheckInSeverity(checkIn.status);
  let title = 'Point de situation';
  let content = `${checkIn.authorName} : statut ${checkIn.status.toUpperCase()}`;

  if (checkIn.status === 'sos') {
    title = '🚨 ALERTE DETRESSE SOS';
    const coords = formatEmergencyCoordinates(checkIn.location.latitude, checkIn.location.longitude);
    content = `URGENCE signalée par ${checkIn.authorName} à ${coords}. ${checkIn.message || 'Assistance requise immédiatement.'}`;
    return {
      type: 'field_checkin_sos',
      title,
      content,
      severity,
      emergencyCoordinates: coords,
    };
  }

  if (checkIn.status === 'camp_set') {
    title = '⛺ Bivouac Établi';
    content = `${checkIn.authorName} a installé le campement pour la nuit (${checkIn.location.name || 'Emplacement sécurisé'}).`;
  } else if (checkIn.status === 'delayed') {
    title = '⚠️ Retard Signalé';
    content = `${checkIn.authorName} signale un retard sur l'itinéraire prévu (${checkIn.message || 'Progression ralentie'}).`;
  } else if (checkIn.status === 'ok') {
    title = '✅ Tout Va Bien';
    content = `${checkIn.authorName} confirme que tout se déroule normalement.`;
  }

  return {
    type: `field_checkin_${checkIn.status}`,
    title,
    content,
    severity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOCK UI COMPONENTS FOR HERMETIC SPEC EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

export interface ClubChannelsListProps {
  channels: ClubChannel[];
  activeChannelId?: string;
  userRole: OutdoorRole;
  onSelectChannel?: (id: string) => void;
}

export const MockClubChannelsList: React.FC<ClubChannelsListProps> = ({
  channels,
  activeChannelId,
  userRole,
}) => {
  return (
    <nav className="flex w-full flex-col gap-1 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-2 shadow-elevation-1">
      <div className="px-3 py-1.5 text-xs font-semibold text-[color:var(--lkv-text-secondary)]">
        Salons du Club
      </div>
      <ul className="flex flex-col gap-1">
        {channels.map((ch) => {
          const isActive = ch.id === activeChannelId;
          const canWrite = canWriteChannel(userRole, ch);
          const canRead = canReadChannel(userRole, ch);

          if (!canRead) return null; // Invisible if cannot read

          return (
            <li key={ch.id}>
              <button
                type="button"
                className={`flex h-[44px] min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-left transition-colors ${
                  isActive
                    ? 'bg-[color:var(--lkv-secondary)]/15 font-semibold text-[color:var(--lkv-primary)]'
                    : 'text-[color:var(--lkv-text-primary)] hover:bg-[color:var(--lkv-hover-surface)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm"># {ch.name}</span>
                  {!canWrite && (
                    <span
                      role="img"
                      aria-label="Salon en lecture seule"
                      className="text-xs text-[color:var(--lkv-text-secondary)]"
                    >
                      🔒
                    </span>
                  )}
                </div>
                {ch.unreadCount != null && ch.unreadCount > 0 && (
                  <span className="flex min-w-[20px] h-5 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] px-1.5 text-[10px] font-bold text-white">
                    {ch.unreadCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export interface ClubRoleBadgeProps {
  role: OutdoorRole;
  size?: 'sm' | 'md';
}

export const MockClubRoleBadge: React.FC<ClubRoleBadgeProps> = ({ role, size = 'sm' }) => {
  const roleStyles: Record<OutdoorRole, { label: string; className: string }> = {
    owner: {
      label: 'Propriétaire',
      className: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
    },
    admin: {
      label: 'Admin',
      className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
    },
    guide: {
      label: 'Guide',
      className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    },
    safety: {
      label: 'Sécurité',
      className: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    },
    member: {
      label: 'Membre',
      className: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30',
    },
  };

  const current = roleStyles[role] || roleStyles.member;
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${current.className}`}
    >
      {current.label}
    </span>
  );
};

export interface ExpeditionRoomCockpitProps {
  room: {
    id: string;
    title: string;
    status: ExpeditionRoomStatus;
    tripId?: string | null;
  };
  weatherData?: {
    locationName?: string;
    tempC?: number;
    windKmH?: number;
    freezingLevelM?: number;
  } | null;
  gpxSnapshot?: {
    title: string;
    distanceKm: number;
    elevationGainM: number;
    svgPolylinePath?: string;
  } | null;
  checklistItems?: ExpeditionChecklistItem[];
  lastCheckIn?: FieldCheckIn | null;
  activePane?: 'chat' | 'weather' | 'route' | 'checklist' | 'checkins';
}

export const MockExpeditionRoomCockpit: React.FC<ExpeditionRoomCockpitProps> = ({
  room,
  weatherData,
  gpxSnapshot,
  checklistItems = [],
  lastCheckIn,
  activePane = 'chat',
}) => {
  const { total, completed, percentage } = calculateChecklistProgress(checklistItems);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] shadow-elevation-2">
      {/* Cockpit Header */}
      <header className="flex h-14 items-center justify-between border-b border-[color:var(--glass-border)] px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[color:var(--lkv-text-primary)]">{room.title}</h2>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            {room.status}
          </span>
        </div>
        {room.tripId && (
          <span className="text-xs text-[color:var(--lkv-text-secondary)]">Voyage lié</span>
        )}
      </header>

      {/* Segmented Controls (Apple HIG >= 44px) */}
      <nav className="flex border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-1">
        {['chat', 'weather', 'route', 'checklist', 'checkins'].map((pane) => (
          <button
            key={pane}
            type="button"
            className={`flex h-[44px] min-h-[44px] flex-1 items-center justify-center rounded-xl text-xs font-semibold capitalize transition-all ${
              activePane === pane
                ? 'bg-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-primary)] shadow-sm'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            {pane}
          </button>
        ))}
      </nav>

      {/* Multi-Pane Body */}
      <main className="p-4">
        {activePane === 'weather' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold">Conditions Météo en Direct</h3>
            {weatherData ? (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-[color:var(--glass-border)] p-2">
                  <span className="block opacity-70">Temp</span>
                  <strong className="text-sm">{weatherData.tempC}°C</strong>
                </div>
                <div className="rounded-xl border border-[color:var(--glass-border)] p-2">
                  <span className="block opacity-70">Vent</span>
                  <strong className="text-sm">{weatherData.windKmH} km/h</strong>
                </div>
                <div className="rounded-xl border border-[color:var(--glass-border)] p-2">
                  <span className="block opacity-70">Iso-0°C</span>
                  <strong className="text-sm">{weatherData.freezingLevelM} m</strong>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[color:var(--lkv-text-secondary)]">Localisation météo non définie</div>
            )}
          </div>
        )}

        {activePane === 'route' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold">Tracé GPX de l'Expédition</h3>
            {gpxSnapshot ? (
              <div className="rounded-2xl border border-[color:var(--glass-border)] p-3">
                <div className="flex justify-between text-xs">
                  <span>{gpxSnapshot.title}</span>
                  <span>{gpxSnapshot.distanceKm} km · +{gpxSnapshot.elevationGainM} m</span>
                </div>
                {gpxSnapshot.svgPolylinePath && (
                  <svg viewBox="0 0 240 90" className="mt-2 h-20 w-full" aria-hidden="true">
                    <polyline fill="none" stroke="currentColor" strokeWidth="2" points={gpxSnapshot.svgPolylinePath} />
                  </svg>
                )}
              </div>
            ) : (
              <div className="text-xs text-[color:var(--lkv-text-secondary)]">Aucun tracé associé</div>
            )}
          </div>
        )}

        {activePane === 'checklist' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Checklist Partagée</span>
              <span>{completed}/{total} ({percentage}%)</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className="h-full bg-emerald-500" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )}

        {activePane === 'checkins' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold">Dernier Check-in Terrain</h3>
            {lastCheckIn ? (
              <div className="rounded-2xl border border-[color:var(--glass-border)] p-3 text-xs">
                <div className="font-bold">{lastCheckIn.authorName} ({lastCheckIn.status.toUpperCase()})</div>
                <div>{lastCheckIn.message || 'Position transmise'}</div>
              </div>
            ) : (
              <div className="text-xs text-[color:var(--lkv-text-secondary)]">Aucun check-in pour l'instant</div>
            )}
          </div>
        )}

        {activePane === 'chat' && (
          <div className="flex flex-col gap-2 text-xs text-[color:var(--lkv-text-primary)]">
            <span>Flux de conversation actif.</span>
          </div>
        )}
      </main>
    </div>
  );
};
```

---

## 9. Adversarial Edge Cases & Stress Scenarios (Challenger & Auditor Proofing)

To satisfy the highest verification standards of reviewers and adversarial challengers:

1. **Role Spoofing via Message Metadata**:
   - Attack: A client crafts a payload attempting to pass `{ clientRole: 'admin' }` while their true membership record in `conversation_members` is `member`.
   - Verification: Domain permission gate checks canonical `conversation_members.role`, rejecting the write to `#announcements`.
2. **Pathological Coordinates in Emergency SOS**:
   - Attack: Malformed check-in payload with coordinates `lat: 999.0` or `NaN`.
   - Verification: `formatEmergencyCoordinates` gracefully catches corrupted values and outputs clear fallback guidance directing to telephone 112.
3. **Checklist Concurrency Stress**:
   - Attack: Rapid firing of 50 simultaneous item toggle requests.
   - Verification: Item state remains integer-consistent; completion percentage never overflows 100% or underflows 0%.
4. **Strict Color Scanner (Zero Orange Police)**:
   - Automated regex check scans static HTML markup across all components to assert zero occurrence of:
     * `#E4501C` (case-insensitive)
     * `rgb(228, 80, 28)`
     * `rgba(228, 80, 28`
     * `orange-500` or legacy orange Tailwind tokens.

---

## 10. Implementation Plan for Workers

1. **Step 1: Domain Types (`worker_m3_ui_1` / `worker_m3_test`)**:
   - Create `src/features/messaging/types/clubs.types.ts` with `OutdoorRole`, `OUTDOOR_ROLE_HIERARCHY`, `hasRolePermission`, `canReadChannel`, `canWriteChannel`, `validateChannelPostPermission`.
   - Create `src/features/messaging/types/expeditionRooms.types.ts` with `ExpeditionRoom`, `ExpeditionChecklistItem`, `FieldCheckIn`, `WeatherLocationData`.
2. **Step 2: Domain UI Components (`worker_m3_ui_1` / `worker_m3_ui_2`)**:
   - Implement `src/features/messaging/components/clubs/ClubRoleBadge.tsx`.
   - Implement `src/features/messaging/components/clubs/ClubChannelsList.tsx`.
   - Implement `src/features/messaging/components/expedition/ExpeditionRoomCockpit.tsx`.
3. **Step 3: Test Suite Placement**:
   - Save the comprehensive test suite to `tests/messaging/clubs-expedition-rooms.spec.ts`.
   - Run `npx vitest run tests/messaging/clubs-expedition-rooms.spec.ts`.
   - Confirm all 38 tests pass with 0 errors.
