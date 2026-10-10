# LKDV Social — Milestone 3: Expedition Rooms Multi-Pane Cockpit Architecture
**Author**: `explorer_m3_cockpit_1`  
**Date**: 2026-10-04  
**Target Scope**: `src/features/messaging/types/expeditionRooms.types.ts` & `src/features/messaging/components/expedition/`

---

## 1. Executive Summary

Milestone 3 of the LKDV Social Architecture introduces **Expedition Rooms** (R3), uniting team messaging with real-world mountain adventure tools inside a synchronized multi-pane cockpit. 

An Expedition Room brings together five essential pillars:
1. **Conversation Stream**: Real-time chat with live outdoor cards (GPX, Kits, Equipment, Expeditions).
2. **Open-Meteo Live Weather Pane**: Mountain and trail weather forecasts without fake data.
3. **GPX Route Overview Pane**: Zero-blocking SVG vector snapshots, elevation profile, and mountain metrics.
4. **Shared Checklist Pane**: Collaborative preparation and safety checklist with item assignment and progress tracking.
5. **Field Check-Ins Pane**: Field status broadcasts (**OK**, **Bivouac**, **Retard**, **Alerte**) with GPS timestamps and safety alerts.

This document establishes the domain models, type guards, component interfaces, responsive layouts (Desktop 2-column split vs Mobile Apple HIG segmented switcher), and styling guidelines conforming strictly to Apple Human Interface Guidelines (44px touch targets, Liquid Glass translucency) with an **unconditional ZERO orange `#E4501C` policy**.

---

## 2. Database Schema Alignment & Security

The database foundation is declared in `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.expedition_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  gpx_track_url TEXT,
  gpx_snapshot JSONB DEFAULT '{}'::jsonb,
  weather_location JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expedition_rooms_conv ON public.expedition_rooms(conversation_id);
CREATE INDEX IF NOT EXISTS idx_expedition_rooms_trip ON public.expedition_rooms(trip_id);
CREATE INDEX IF NOT EXISTS idx_expedition_rooms_status ON public.expedition_rooms(status);
```

### Security & RLS Policies:
- **`expedition_rooms_select`**: `is_conversation_member(conversation_id, (SELECT auth.uid()))`
- **`expedition_rooms_insert`**: `is_conversation_member(conversation_id, (SELECT auth.uid()))`
- **`expedition_rooms_update`**: `is_conversation_member(conversation_id, (SELECT auth.uid()))`
- **`expedition_rooms_delete`**: `is_conv_owner(conversation_id, (SELECT auth.uid()))`

### Relationship with Canonical Messaging:
- `conversations.context_type = 'expedition_room'`.
- 1:1 association: each `expedition_rooms` record maps strictly to one `conversations.id`.
- The conversation stream carries team communication, while live cards and cockpit panes query and update room state.

---

## 3. Domain Models & TypeScript Contracts (`expeditionRooms.types.ts`)

Target path: `src/features/messaging/types/expeditionRooms.types.ts`.

```typescript
/**
 * LKDV Social — Expedition Rooms Domain Types & Cockpit Interfaces
 * File: src/features/messaging/types/expeditionRooms.types.ts
 */

import type { GPXSnapshot } from './outdoorObjects.types';
import type { UserProfileSummary } from './messaging.types';

// ============================================================================
// 1. EXPEDITION ROOM STATUS & MODEL
// ============================================================================

export type ExpeditionRoomStatus = 'planning' | 'active' | 'completed' | 'archived';

export interface ExpeditionLocation {
  latitude: number;
  longitude: number;
  label?: string;
  altitudeM?: number;
}

export interface ExpeditionChecklistSummary {
  totalCount: number;
  completedCount: number;
  remainingCount: number;
  progressPercent: number; // 0 - 100
}

export type FieldCheckInStatus = 'ok' | 'delayed' | 'sos' | 'camp_set';

export interface ExpeditionCheckinStatusSummary {
  latestStatus?: FieldCheckInStatus;
  lastCheckinAt?: string;
  lastCheckinAuthorName?: string;
  totalCheckins: number;
  hasActiveAlert: boolean;
}

export interface ExpeditionRoom {
  id: string;
  conversationId: string;
  tripId?: string | null;
  title: string;
  status: ExpeditionRoomStatus;
  gpxTrackUrl?: string | null;
  gpxSnapshot?: GPXSnapshot | null;
  weatherLocation?: ExpeditionLocation | null;
  checklistSummary?: ExpeditionChecklistSummary;
  checkinStatus?: ExpeditionCheckinStatusSummary;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// 2. SHARED CHECKLIST ITEMS
// ============================================================================

export type ExpeditionChecklistCategory =
  | 'safety'      // Sécurité & Urgences
  | 'navigation'  // Cartes & Tracés GPX
  | 'camp'        // Bivouac & Abri
  | 'nutrition'   // Vivres & Eau
  | 'gear'        // Matériel technique
  | 'medical'     // Pharmacie & Soins
  | 'admin';      // Logistique & Autorisations

export interface ExpeditionChecklistItem {
  id: string;
  roomId?: string;
  label: string;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedToAvatarUrl?: string | null;
  isCompleted: boolean;
  category: ExpeditionChecklistCategory;
  dueDate?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
}

// ============================================================================
// 3. FIELD CHECK-INS & SAFETY BROADCASTS
// ============================================================================

export interface FieldCheckIn {
  id: string;
  roomId?: string;
  conversationId?: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  status: FieldCheckInStatus;
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
    altitudeM?: number;
  };
  timestamp: string; // ISO 8601
  message?: string;
  batteryPct?: number;
  networkSignal?: 'strong' | 'weak' | 'satellite' | 'none';
}

// ============================================================================
// 4. COCKPIT UI NAVIGATION & PANE CONTROLS
// ============================================================================

export type CockpitPane = 'chat' | 'weather' | 'route' | 'checklist' | 'checkins';

export interface CheckinBadgeVisual {
  label: string;
  badgeClass: string;
  dotColorClass: string;
  iconName: string;
}

// ============================================================================
// 5. TYPE GUARDS & UTILITIES
// ============================================================================

export function isExpeditionRoom(obj: unknown): obj is ExpeditionRoom {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.conversationId === 'string' &&
    typeof r.title === 'string' &&
    typeof r.status === 'string'
  );
}

export function isFieldCheckIn(obj: unknown): obj is FieldCheckIn {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.authorId === 'string' &&
    typeof c.authorName === 'string' &&
    ['ok', 'delayed', 'sos', 'camp_set'].includes(c.status as string) &&
    typeof c.timestamp === 'string'
  );
}

export function isExpeditionChecklistItem(obj: unknown): obj is ExpeditionChecklistItem {
  if (!obj || typeof obj !== 'object') return false;
  const i = obj as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.label === 'string' &&
    typeof i.isCompleted === 'boolean' &&
    typeof i.category === 'string'
  );
}

export function computeChecklistSummary(
  items: ExpeditionChecklistItem[]
): ExpeditionChecklistSummary {
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.isCompleted).length;
  const remainingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    totalCount,
    completedCount,
    remainingCount,
    progressPercent,
  };
}

export function computeCheckinSummary(
  checkins: FieldCheckIn[]
): ExpeditionCheckinStatusSummary {
  if (checkins.length === 0) {
    return {
      totalCheckins: 0,
      hasActiveAlert: false,
    };
  }

  const sorted = [...checkins].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latest = sorted[0];
  const hasActiveAlert = sorted.some((c) => c.status === 'sos');

  return {
    latestStatus: latest.status,
    lastCheckinAt: latest.timestamp,
    lastCheckinAuthorName: latest.authorName,
    totalCheckins: sorted.length,
    hasActiveAlert,
  };
}

export function getCheckinStatusBadgeInfo(status: FieldCheckInStatus): CheckinBadgeVisual {
  switch (status) {
    case 'ok':
      return {
        label: 'OK · Progression normale',
        badgeClass: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
        dotColorClass: 'bg-emerald-500',
        iconName: 'check-circle',
      };
    case 'camp_set':
      return {
        label: 'Bivouac établi',
        badgeClass: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
        dotColorClass: 'bg-sky-500',
        iconName: 'tent',
      };
    case 'delayed':
      return {
        label: 'Retard sur planning',
        badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
        dotColorClass: 'bg-amber-500',
        iconName: 'clock',
      };
    case 'sos':
      return {
        label: 'ALERTE / SOS',
        badgeClass: 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40 animate-pulse',
        dotColorClass: 'bg-rose-600',
        iconName: 'alert-triangle',
      };
  }
}
```

---

## 4. Cockpit UI Architecture (`src/features/messaging/components/expedition/`)

### File Hierarchy
```
src/features/messaging/components/expedition/
├── ExpeditionRoomCockpit.tsx   # Master responsive cockpit orchestrator
├── WeatherPane.tsx             # Open-Meteo live mountain weather pane
├── RouteMiniMapPane.tsx        # GPX SVG route overview & profile pane
├── SharedChecklistPane.tsx     # Interactive shared checklist pane
└── FieldCheckInsPane.tsx       # Field status broadcast & safety feed pane
```

---

### Component 1: `ExpeditionRoomCockpit.tsx`
Orchestrates the multi-pane console with full responsive ergonomics.

#### Layout Behavior:
- **Desktop (≥ 1024px / lg)**:
  - 2-column split layout:
    - **Main stream (55-60% width)**: Full-featured Conversation View (MessageList, Live Cards, MessageComposer).
    - **Side Console (40-45% width, min 380px)**: Multi-pane outdoor console with quick tabs for Weather, Route, Checklist, and Check-ins.
  - Header: Expedition Title, Room Status badge (`En préparation`, `En cours`, `Terminée`), Quick Check-In banner (e.g., `Dernier point : OK il y a 8 min`), participant counter.
- **Mobile (< 1024px)**:
  - Apple HIG Segmented Bar at top (min 44px touch targets):
    `[ 💬 Discussion | 🧭 Tracé | 🌦️ Météo | ✅ Checklist | 📍 Check-ins ]`
  - Active pane fills screen with clean vertical scrolling.
  - Docked / Floating Quick Status Broadcast trigger (44px target with haptic feedback).

#### Design Tokens & Rules:
- **Liquid Glass**: `.glass`, `backdrop-blur-md`, subtle border `border-[color:var(--glass-border)]`.
- **Apple HIG**: 44px min button height, safe-area insets (`pb-safe`), SF Pro hierarchy.
- **ZERO ORANGE `#E4501C`**:
  - Primary actions: `--lkv-action: #226148`.
  - Brand identity: `--lkv-primary: #17402C`.
  - Accents: Forest emerald (`emerald-600`), alpine blue (`sky-600`), amber (`amber-500`), emergency red (`rose-600`).

---

### Component 2: `WeatherPane.tsx`
Mountain & trail weather pane powered by Open-Meteo.

#### Key Features:
- Real-time weather for `weatherLocation` (latitude, longitude, altitude).
- **Core Metrics Grid**:
  - Temperature in °C + weather condition label (`Dégagé`, `Pluie`, `Neige`, etc.).
  - Precipitation probability (%) with droplet icon.
  - Wind speed (km/h) with alert threshold (> 50 km/h triggers warning badge).
  - UV Index / Freezing level altitude when available.
- **4-Day Forecast Strip**:
  - Daily cards showing high/low temperatures, weather icons, rain probability.
- **Reliability Guarantee**:
  - If weather cannot be retrieved, honest fallback state: `"Météo de montagne indisponible (vérifiez les coordonnées ou le réseau)"` with manual Refresh button. **Never fake or hallucinate temperatures.**

---

### Component 3: `RouteMiniMapPane.tsx`
Instant, zero-fetch GPX route overview.

#### Key Features:
- Vector SVG path rendering (`snapshot.svgPolylinePath`) projected onto standard viewBox.
- Halo-reinforced polyline with gradient (`--lkv-secondary` to `--lkv-primary`).
- Start point, summit/waypoint points, and destination markers.
- **Mountain Pace Metrics**:
  - Total distance (km).
  - Elevation gain (`+N m D+`).
  - Estimated hike duration using mountain standard pace (4 km/h flat + 300 m/h ascent).
  - Min / Max altitude indicators.
- **Action Buttons (Apple HIG 44px)**:
  - "Télécharger GPX" (direct file download).
  - "Explorer la trace détaillée" (links to `/explorer?trail=${snapshot.id}`).

---

### Component 4: `SharedChecklistPane.tsx`
Real-time shared checklist with category organization.

#### Key Features:
- **Progress Gauge**:
  - Horizontal progress bar (`X / Y validés · Z%`).
- **Category Filter & Breakdown**:
  - Grouped by `safety` (Sécurité), `camp` (Bivouac), `nutrition` (Vivres), `navigation` (Tracé), `gear` (Matériel).
- **Item Row Architecture**:
  - Min 44px tap target for checkbox toggle.
  - Haptic feedback on completion (`selection` / `success`).
  - Assignee pill showing initials or profile photo.
  - Due date indicator if set.
- **Add Item Form**:
  - Quick inline input for team members to append necessary gear or tasks.

---

### Component 5: `FieldCheckInsPane.tsx`
Field status broadcast and safety tracking.

#### Key Features:
- **4-Button Quick Broadcast Bar (Touch targets ≥ 48px)**:
  1. **OK**: Progression normale (`bg-emerald-600/15 text-emerald-800 dark:text-emerald-300`).
  2. **Bivouac**: Campement établi pour la nuit (`bg-sky-600/15 text-sky-800 dark:text-sky-300`).
  3. **Retard**: Ralenti / Retard sur l'horaire (`bg-amber-500/15 text-amber-800 dark:text-amber-300`).
  4. **Alerte**: Demande d'assistance / SOS (`bg-rose-600/20 text-rose-800 dark:text-rose-300 animate-pulse`).
  - *ZERO orange `#E4501C`!*
- **Optional Note Input**:
  - e.g. "Col franchi à 14h, vent fort, bivouac prévu à la source."
- **Active Safety Alert Banner**:
  - If any member broadcast 'sos' or 'delayed' within recent window, prominent glass banner pinned to top of cockpit.
- **Chronological Feed**:
  - List of past check-ins with relative time ("Il y a 15 min"), member name, battery percentage, GPS altitude.

---

## 5. Blueprint for Implementation

### File 1: `src/features/messaging/types/expeditionRooms.types.ts`
Implement domain interfaces, type guards (`isExpeditionRoom`, `isFieldCheckIn`, `isExpeditionChecklistItem`), summary calculators (`computeChecklistSummary`, `computeCheckinSummary`), and badge helpers (`getCheckinStatusBadgeInfo`).

### File 2: `src/features/messaging/components/expedition/RouteMiniMapPane.tsx`
- Props: `snapshot?: GPXSnapshot | null`, `gpxTrackUrl?: string | null`, `title?: string`.
- Renders SVG polyline, metrics grid, download button, explorer link.

### File 3: `src/features/messaging/components/expedition/WeatherPane.tsx`
- Props: `location?: ExpeditionLocation | null`, `weatherSnapshot?: WeatherSnapshot | null`, `onRefresh?: () => void`.
- Renders mountain weather conditions, wind, precipitation, 4-day forecast.

### File 4: `src/features/messaging/components/expedition/SharedChecklistPane.tsx`
- Props: `items: ExpeditionChecklistItem[]`, `onToggleItem: (id: string, isCompleted: boolean) => void`, `onAddItem?: (label: string, category: ExpeditionChecklistCategory) => void`, `currentUserId?: string`.
- Renders category grouped list, progress bar, assignment pills.

### File 5: `src/features/messaging/components/expedition/FieldCheckInsPane.tsx`
- Props: `checkins: FieldCheckIn[]`, `onBroadcastCheckin: (status: FieldCheckInStatus, message?: string) => Promise<void> | void`, `currentUserName?: string`, `isBroadcasting?: boolean`.
- Renders 4-state broadcast bar, active alert banner, chronological timeline.

### File 6: `src/features/messaging/components/expedition/ExpeditionRoomCockpit.tsx`
- Master component accepting:
  ```typescript
  export interface ExpeditionRoomCockpitProps {
    room: ExpeditionRoom;
    conversation: Conversation;
    currentUserId: string;
    currentUserProfile?: UserProfileSummary | null;
    initialChecklist?: ExpeditionChecklistItem[];
    initialCheckins?: FieldCheckIn[];
    onBack?: () => void;
  }
  ```
- Manages desktop split view and mobile segmented navigation with 44px touch targets and Liquid Glass styling.

---

## 6. Test Suite & Verification Matrix

The test architecture in `tests/messaging/clubs-expedition-rooms.spec.ts` will validate:
1. **Model & Type Guard Integrity**:
   - `isExpeditionRoom` handles valid and corrupt inputs.
   - `isFieldCheckIn` validates 4 status types (`ok`, `delayed`, `sos`, `camp_set`).
   - `computeChecklistSummary` calculates exact completion percentages.
   - `computeCheckinSummary` flags active SOS alerts.
2. **Component Rendering (SSR-Safe via `renderToStaticMarkup`)**:
   - `ExpeditionRoomCockpit` renders desktop split panes and mobile segmented tabs.
   - `RouteMiniMapPane` renders vector SVG without throwing when bounds or waypoints are present.
   - `WeatherPane` renders weather metrics or honest fallback state.
   - `SharedChecklistPane` renders items and progress bar.
   - `FieldCheckInsPane` renders all 4 broadcast buttons with correct semantic colors.
3. **Ergonomic & Style Compliance**:
   - All interactive elements meet 44px min height/width.
   - Strict absence of forbidden hex `#E4501C` (verified by regex test).
