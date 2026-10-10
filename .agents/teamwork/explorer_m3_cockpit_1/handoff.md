# Handoff Report: Expedition Rooms Multi-Pane Cockpit Architecture (M3 - R3)
**Author**: `explorer_m3_cockpit_1`  
**Date**: 2026-10-04  
**Type**: Hard Handoff (Investigation & Architecture Complete)

---

## 1. Observation

1. **Database Schema**:
   - `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`:
     - Lines 584–595: `expedition_rooms` table created with columns `id UUID`, `conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id)`, `trip_id UUID REFERENCES public.trips(id)`, `title TEXT NOT NULL`, `status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived'))`, `gpx_track_url TEXT`, `gpx_snapshot JSONB`, `weather_location JSONB`.
     - Lines 603–636: RLS policies (`expedition_rooms_select`, `expedition_rooms_insert`, `expedition_rooms_update`, `expedition_rooms_delete`) strictly enforce `public.is_conversation_member(conversation_id, (SELECT auth.uid()))` and `public.is_conv_owner`.
   - `supabase/migrations/20260909100000_trip_checklist_items.sql`:
     - Lines 11–21: Table `trip_checklist_items` with `trip_id`, `label`, `done`, `position`.
   - `supabase/migrations/20260716000000_group_system_complete.sql`:
     - Lines 120–130: `group_tasks` with `assigned_to`, `created_by`, `title`, `description`, `status`.

2. **Existing Domain Snapshots & Live Cards**:
   - `src/features/messaging/types/outdoorObjects.types.ts`:
     - Lines 41–72: `GPXSnapshot` interface with `svgPolylinePath`, `bounds`, `distanceKm`, `elevationGainM`.
     - Lines 160–195: `ExpeditionSnapshot` interface with `status`, `participantCount`, `members`.
     - Lines 337–411: `serializeGPXSnapshot` projecting lat/lng onto 240x90 SVG viewBox.
   - `src/features/messaging/components/GPXLiveCard.tsx`:
     - Lines 100–138: SVG rendering using `snapshot.svgPolylinePath` without network fetching.
   - `src/features/messaging/components/ExpeditionLiveCard.tsx`:
     - Lines 55–150: Compact article card with status badge, member avatars, distance and elevation.

3. **Existing Weather & Live Reporting**:
   - `src/features/hub/components/weather/WeatherStrip.tsx`:
     - Lines 21–55: Honest fallback (`Météo indisponible`) when `current === null`.
   - `src/features/hiking/services/WeatherService.ts`:
     - Lines 18–60: Open-Meteo endpoint integration returning `WeatherSnapshot` with `tempC`, `condition`, `windKmH`, `precipitationProbability`.
   - `src/features/terrain-live/components/QuickReportSheet.tsx`:
     - Lines 85–150: 3-step bottom sheet with minimum 44px buttons, zero-orange palette.

4. **Design System & Style Rules**:
   - `src/styles/tokens.css`:
     - Lines 18–33: `--lkv-primary: #17402C`, `--lkv-action: #226148`, `--lkv-secondary: #5B7F55`.
     - Zero instances of forbidden orange `#E4501C` allowed.
   - `src/styles/liquid-glass.css`:
     - Lines 32–48: `.glass`, backdrop-blur, subtle translucent borders.

---

## 2. Logic Chain

1. **Association Model**: Because `expedition_rooms.conversation_id` is a 1:1 foreign key referencing `conversations(id)` with `context_type = 'expedition_room'`, the cockpit can wrap and embed the canonical `ConversationView` / `MessageList` stream without creating a bifurcated chat system.
2. **Zero-Fetch Performance**: By using pre-computed SVG polyline paths from `GPXSnapshot` and pre-loaded snapshots, the GPX route overview pane mounts instantaneously without blocking UI threads on GPX XML parsing or external mapping library downloads.
3. **Field Integrity & Truth**: Weather data uses Open-Meteo with an explicit fallback when disconnected or coordinates are missing, strictly avoiding fabricated temperatures or fake sun icons.
4. **Safety Broadcasts**: Field check-ins require 4 discrete, universally recognizable outdoor statuses:
   - `ok` (Progression normale, emerald-600)
   - `camp_set` (Bivouac établi, sky-600)
   - `delayed` (Retard sur planning, amber-500)
   - `sos` (Alerte / assistance, rose-600)
   Any SOS or delay immediately surfaces an omnipresent safety banner in the cockpit.
5. **Ergonomic Adaptation**:
   - On Desktop (≥ 1024px), users view chat and expedition console simultaneously side-by-side.
   - On Mobile (< 1024px), screen real estate is preserved via an Apple HIG Segmented Switcher (`💬 Discussion`, `🧭 Tracé`, `🌦️ Météo`, `✅ Checklist`, `📍 Check-ins`) where every tab and button has a minimum 44px touch target.

---

## 3. Caveats

1. **Real-time Broadcast Channel**: While Supabase Realtime will deliver field check-in updates and checklist toggles, the UI components must support optimistic local state updates so offline or degraded connectivity feels responsive.
2. **Offline GPX Storage**: For offline hiking mode, the cockpit links to the local vector snapshot; downloading the raw GPX file requires network connectivity.
3. **No Orange Color (#E4501C)**: Any implementation or test must strictly verify that warning states use standard `amber-500` and alerts use `rose-600`, never `#E4501C`.

---

## 4. Conclusion

The Expedition Rooms multi-pane cockpit architecture is fully specified and ready for implementation.
The deliverables for Workers are partitioned as:
1. **Types (`src/features/messaging/types/expeditionRooms.types.ts`)**:
   - `ExpeditionRoom`, `ExpeditionChecklistItem`, `FieldCheckIn`, `ExpeditionLocation`, `ExpeditionChecklistSummary`, `ExpeditionCheckinStatusSummary`.
   - Type guards: `isExpeditionRoom`, `isFieldCheckIn`, `isExpeditionChecklistItem`.
   - Summary calculation helpers: `computeChecklistSummary`, `computeCheckinSummary`, `getCheckinStatusBadgeInfo`.
2. **Components (`src/features/messaging/components/expedition/`)**:
   - `RouteMiniMapPane.tsx` (GPX SVG route & metrics).
   - `WeatherPane.tsx` (Open-Meteo live mountain weather & 4-day forecast).
   - `SharedChecklistPane.tsx` (Categories, progress bar, 44px toggle items).
   - `FieldCheckInsPane.tsx` (4-state broadcast bar, active alert banner, feed).
   - `ExpeditionRoomCockpit.tsx` (Desktop 2-column split / Mobile Apple HIG segmented switcher).

---

## 5. Verification Method

1. **TypeScript Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   Ensures zero type errors in `expeditionRooms.types.ts` and component exports.
2. **Unit & SSR Rendering Tests**:
   ```bash
   npx vitest run tests/messaging/clubs-expedition-rooms.spec.ts
   ```
   Runs `renderToStaticMarkup` on `ExpeditionRoomCockpit` and sub-panes to verify:
   - Renders valid markup without throwing.
   - Desktop and mobile view modes render appropriate DOM containers.
   - 4 check-in status buttons render with correct CSS classes.
   - Zero occurrences of `#E4501C`.
3. **Code Style & Linting**:
   ```bash
   npm run lint
   ```
