## 2026-10-04T14:41:39Z

You are explorer_m3_cockpit_1, specialized in Expedition Rooms Multi-Pane Cockpit UI Architecture.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m3_cockpit_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Your task for Milestone 3 (Community Clubs & Expedition Rooms - R3):
1. Investigate Expedition Rooms domain and UI architecture:
   - Check `expedition_rooms` table in `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`.
   - Inspect existing weather components (`src/features/trips/components/` or `WeatherStrip`), GPX preview components (`TraceMiniMap.tsx`), checklist components (`src/features/preparation/`), and quick report sheets.
   - Design `src/features/messaging/types/expeditionRooms.types.ts`:
     * `ExpeditionRoom` (id, tripId, conversationId, status: 'planning' | 'active' | 'completed', checklistSummary, checkinStatus).
     * `ExpeditionChecklistItem` (id, label, assignedTo, isCompleted, category).
     * `FieldCheckIn` (id, authorId, authorName, status: 'ok' | 'delayed' | 'sos' | 'camp_set', location, timestamp, message).
2. Design unified multi-pane cockpit UI in `src/features/messaging/components/expedition/`:
   - `ExpeditionRoomCockpit.tsx`:
     * Conversation stream pane (chat with live cards).
     * Open-Meteo live weather pane (`WeatherPane.tsx`).
     * GPX route overview pane (`RouteMiniMapPane.tsx` using SVG snapshot).
     * Shared checklist pane (`SharedChecklistPane.tsx` with toggleable items).
     * Field check-ins pane (`FieldCheckInsPane.tsx` with quick status broadcast: OK, Bivouac, Retard, Alerte).
   - Responsive design: Desktop split multi-column view, mobile segmented tab/drawer switcher with Apple HIG 44px touch targets and Liquid Glass styling. ZERO orange `#E4501C`!
3. Formulate the exact implementation blueprint.
4. Write your findings in `analysis.md` and deliver `handoff.md`.
Communicate when done via send_message to orchestrator.
