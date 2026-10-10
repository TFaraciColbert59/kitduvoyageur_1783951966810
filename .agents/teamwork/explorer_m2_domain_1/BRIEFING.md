# BRIEFING — 2026-10-04T10:39:15Z

## Mission
Design outdoor objects snapshot types and group pack merge algorithm with load distribution for Milestone 2.

## 🔒 My Identity
- Archetype: explorer
- Roles: Outdoor Objects Domain Specialist, Load Distribution & Pack Merge Architect
- Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_domain_1
- Original parent: 22810fd4-62f8-4724-853b-2cdeda826f11
- Milestone: Milestone 2 (First-Class Outdoor Objects & Live Cards)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/ (write specs, proposed designs, analysis.md and handoff.md in working directory)
- Group collective gear deduplication (shared tents, stoves, water purification)
- Load distribution algorithm integrating with existing `src/features/preparation/services/loadDistribution.ts`
- Respect strict physiological safety thresholds: 20% max body weight ratio for humans, 15% for dogs
- Support roles ('guide', 'medic', 'scout') and produce warnings if weight exceeds thresholds
- Wire snapshots with `Message.metadata` and messaging types

## Current Parent
- Conversation ID: 22810fd4-62f8-4724-853b-2cdeda826f11
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `PROJECT.md`
  - `src/features/messaging/types/messaging.types.ts`
  - `src/features/messaging/components/GPXPreviewCard.tsx`, `KitCard.tsx`, `MessageBubble.tsx`
  - `src/features/preparation/services/loadDistribution.ts`
  - `src/features/preparation/types/preparation.types.ts`
  - `src/features/trips/components/TraceMiniMap.tsx`, `src/features/trips/lib/traceSvg.ts`
  - `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`
- **Key findings**:
  - Former `GPXPreviewCard` performed runtime `fetch` and `DOMParser` XML parsing during chat scroll, creating jank. Pre-computing `svgPolylinePath` directly in `message.metadata` delivers zero-overhead instant rendering.
  - `src/features/preparation/services/loadDistribution.ts` already establishes canonical `DEFAULT_HUMAN_MAX_RATIO = 0.20`, `DEFAULT_DOG_PORTAGE_RATIO = 0.15`, and `calculateDogMaxPackWeight`.
  - Collective gear deduplication logic handles shelters (group capacity >= party size), stoves (1 per 4 humans), water purification (1 per 4 humans), and trauma first aid (1 per expedition, prioritized to medic).
  - Role-aware leveling protects scouts (target <= 15%), guides (reserve agility buffer), and medics (emergency mobility buffer) while strictly forbidding dogs from carrying human equipment.
- **Unexplored areas**:
  - React UI implementation of `PackMergeSheet.tsx` and `GPXLiveCard.tsx` (assigned to `explorer_m2_cards_1`).

## Key Decisions Made
- Authored `proposed_outdoorObjects.types.ts` defining `GPXSnapshot`, `KitSnapshot`, `EquipmentSnapshot`, `ExpeditionSnapshot`, `ActivitySheetSnapshot` with type guards and backward-compatible wiring into `MessageMetadata`.
- Authored `proposed_packMerge.ts` providing full deduplication engine, greedy load leveling, physiological threshold checking, and bridge to `ParticipantLoad[]`.
- Documented comprehensive architectural decisions in `analysis.md` and complete handoff report in `handoff.md`.

## Artifact Index
- DISPATCH.md — Initial dispatch instruction
- BRIEFING.md — Working memory
- progress.md — Liveness heartbeat
- proposed_outdoorObjects.types.ts — Proposed types for `src/features/messaging/types/outdoorObjects.types.ts`
- proposed_packMerge.ts — Proposed algorithm implementation for `src/features/messaging/domain/packMerge.ts`
- analysis.md — Full technical and mathematical domain analysis
- handoff.md — 5-component handoff report
