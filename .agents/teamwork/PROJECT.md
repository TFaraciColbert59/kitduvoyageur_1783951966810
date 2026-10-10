# Project: LKDV Social Architecture & Canonical Messaging Industrialization

## Architecture
LKDV Social is an adventure outdoor community and real-time messaging architecture built on top of the canonical `src/features/messaging/` domain and Supabase. It provides guaranteed message delivery, offline resilience, live outdoor domain cards, thematic club channels, unified Expedition Rooms, and human-in-the-loop Terra AI.

### Architectural Pillars:
1. **Canonical Messaging Foundation & Security (Supabase / Postgres)**:
   - Monotonic atomic `sequence_number` per conversation via Postgres trigger (`BEFORE INSERT` on `messages`).
   - Network send idempotency via `client_nonce TEXT` and unique index `UNIQUE(conversation_id, client_nonce)`.
   - Aggregated read progress tracking via `last_read_sequence BIGINT` on `conversation_members`.
   - Hermetic Supabase RLS with InitPlan caching `(SELECT auth.uid())` and strict exclusion of exited members (`left_at IS NULL`).
   - Facade pattern on `messagingService.ts` maintaining 100% backward compatibility while delegating to specialized services (`sequenceService`, `cursorPaginationService`, `offlineSyncQueue`).
2. **First-Class Outdoor Objects & Live Cards (Domain & UI)**:
   - Zero-overhead chat rendering: pre-computed metadata snapshots in `message.metadata` (SVG geometry, metrics) eliminating runtime GPX XML parsing and network overhead during thread scroll.
   - Live interactive cards for GPX tracks, Kits with Pack Merge action, equipment items, activity sheets, and expeditions.
   - Pack Merge engine: deduplicates collective gear, balances loads using safety ratios (20% human body weight, 15% dog), integrating with `loadDistribution.ts`.
3. **Community Clubs & Expedition Rooms (Spaces & Cockpit)**:
   - Thematic club channels tied 1:1 to canonical `conversations.id` (`context_type = 'club_channel'`).
   - 5 modular outdoor roles: `owner`, `admin`, `guide`, `safety`, `member` with granular per-channel permissions (`min_role_to_read`, `min_role_to_write`).
   - "Expedition Rooms": unified multi-pane cockpit synchronizing conversation stream, Open-Meteo live weather, interactive GPX route, shared checklist, and field check-ins.
4. **Terra AI Integration & Collaborative Reputation (AI & Community)**:
   - Per-conversation context isolation with explicit opt-in policy.
   - "Quiet Catch-Up" summaries with mandatory source citations (`[seq #N, @author]`).
   - Draft-only action engine: Terra proposals (expeditions, polls, checklist edits) saved as `status: 'draft'`, `requiresConfirmation: true`, requiring human validation.
   - Anti-spam reciprocal utility reputation model: 0 points for raw chat; points awarded strictly for verified field utility (safety check-ins, carrying mutual pack merge gear, completed trips).
   - Collective adventure streaks requiring joint verified team outings.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1-DB-Schema-Sequencing | Atomic monotonic sequence_number trigger and last_sequence_number tracking | M1 | ORIGINAL_REQUEST §R1 |
| 2 | R1-DB-Idempotency | client_nonce with unique index for zero-duplicate delivery on reconnect | M1 | ORIGINAL_REQUEST §R1 |
| 3 | R1-DB-RLS-Hardening | Strict RLS isolation, left_at IS NULL leak fix, InitPlan auth.uid() caching | M1 | ORIGINAL_REQUEST §R1 |
| 4 | R1-Domain-Facade | messagingService.ts modularization using Facade pattern (backward compatible) | M1 | ORIGINAL_REQUEST §R1 |
| 5 | R1-Domain-CursorPagination | Bidirectional cursor pagination (before/after) by sequence_number | M1 | ORIGINAL_REQUEST §R1 |
| 6 | R1-Domain-OfflineSync | 3-phase offline sync queue and reconnection reconciliation protocol | M1 | ORIGINAL_REQUEST §R1 |
| 7 | R1-Domain-LastReadSequence | O(1) read receipts and unread tracking via integer sequence comparison | M1 | ORIGINAL_REQUEST §R1 |
| 8 | R1-Tests-Foundation | Vitest test suite validating ordering, idempotency, and offline queue | M1 | ORIGINAL_REQUEST §R1 |
| 9 | R2-Outdoor-ObjectModels | TypeScript interfaces and snapshot formats for GPX, Kits, and Expeditions | M2 | ORIGINAL_REQUEST §R2 |
| 10 | R2-Outdoor-GPXLiveCard | Lightweight SVG snapshot rendering (TraceMiniMap) without runtime fetch | M2 | ORIGINAL_REQUEST §R2 |
| 11 | R2-Outdoor-PackMergeEngine | Group gear deduplication and load balancing algorithm (loadDistribution.ts) | M2 | ORIGINAL_REQUEST §R2 |
| 12 | R2-Outdoor-KitLiveCard | Kit live card with gear metrics and interactive PackMergeSheet trigger | M2 | ORIGINAL_REQUEST §R2 |
| 13 | R2-Outdoor-ExpeditionCard | Expedition & equipment live cards with status and participant snapshots | M2 | ORIGINAL_REQUEST §R2 |
| 14 | R2-Tests-LiveCards | Vitest tests for Pack Merge logic, snapshot serialization, and card rendering | M2 | ORIGINAL_REQUEST §R2 |
| 15 | R3-Clubs-ChannelsSchema | club_channels schema pointing 1:1 to conversations with channel metadata | M3 | ORIGINAL_REQUEST §R3 |
| 16 | R3-Clubs-RolePermissions | Modular 5 roles (owner, admin, guide, safety, member) and read/write gates | M3 | ORIGINAL_REQUEST §R3 |
| 17 | R3-Clubs-UI | Thematic channels navigation and modular outdoor role badges | M3 | ORIGINAL_REQUEST §R3 |
| 18 | R3-ExpeditionRooms-Model | expedition_rooms schema linking conversation, trips, checklist, checkins | M3 | ORIGINAL_REQUEST §R3 |
| 19 | R3-ExpeditionRooms-MultiPaneUI | Unified multi-pane cockpit (chat, weather, GPX, checklist, field check-ins) | M3 | ORIGINAL_REQUEST §R3 |
| 20 | R3-Tests-ClubsExpeditions | Vitest tests for club permissions, expedition rooms state, and check-ins | M3 | ORIGINAL_REQUEST §R3 |
| 21 | R4-Terra-ContextIsolation | Per-conversation isolation and permission toggles for Terra AI | M4 | ORIGINAL_REQUEST §R4 |
| 22 | R4-Terra-QuietCatchUp | Quiet Catch-Up summary generation with mandatory message citations | M4 | ORIGINAL_REQUEST §R4 |
| 23 | R4-Terra-DraftActions | Draft action engine (status: draft, requiresConfirmation) for polls/trips | M4 | ORIGINAL_REQUEST §R4 |
| 24 | R4-Terra-UI | Quiet Catch-Up drawer and TerraDraftActionCard with approve/reject actions | M4 | ORIGINAL_REQUEST §R4 |
| 25 | R4-Reputation-AntiSpam | Reciprocal utility contribution points engine (0 pts for raw messages) | M4 | ORIGINAL_REQUEST §R4 |
| 26 | R4-Reputation-Streaks | Collective adventure streaks engine for verified joint team outings | M4 | ORIGINAL_REQUEST §R4 |
| 27 | R4-E2E-TypeCheck-Lint-Audit | Project-wide type check, lint clean, full test suite pass, forensic audit | M4 | ORIGINAL_REQUEST Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Canonical Messaging Foundation & Supabase RLS / Idempotence | Supabase migration (sequence_number, client_nonce, last_read_sequence, RLS left_at fix, InitPlan), types.ts update, messagingService Facade, cursor pagination, offline sync queue, Vitest test suite | none | DONE |
| 2 | M2: First-Class Outdoor Objects & Live Cards | Outdoor object models, Pack Merge engine (load balancing), GPXLiveCard (SVG snapshot), KitLiveCard with PackMergeSheet, Equipment/Expedition live cards, Vitest test suite | M1 | DONE |
| 3 | M3: Community Clubs & Expedition Rooms | Club channels schema & 5 outdoor roles, expedition_rooms schema, multi-pane Expedition Room cockpit (chat + weather + GPX + checklist + check-ins), Vitest tests | M1 | DONE |
| 4 | M4: Terra AI, Reputation & Full E2E QA | Terra context isolation, Quiet Catch-Up with citations, Draft Action Engine & UI, reciprocal utility points, adventure streaks, project-wide type-check, lint, Vitest, Challenger & Auditor gates | M1, M2, M3 | DONE |

---

## Interface Contracts

### 1. Database & Security Contracts (M1 - DONE)
- **Table `conversations` additions**:
  - `last_sequence_number BIGINT NOT NULL DEFAULT 0`
  - `context_type TEXT NOT NULL DEFAULT 'direct' CHECK (context_type IN ('direct', 'group', 'club_channel', 'expedition_room'))`
- **Table `messages` additions**:
  - `sequence_number BIGINT NOT NULL`
  - `client_nonce TEXT`
  - `UNIQUE (conversation_id, sequence_number)`
  - `UNIQUE (conversation_id, client_nonce)`
- **Table `conversation_members` additions**:
  - `last_read_sequence BIGINT NOT NULL DEFAULT 0`
  - `role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'safety', 'guide', 'admin', 'owner'))`
- **Trigger `trg_assign_message_sequence`**:
  - `BEFORE INSERT ON public.messages`
  - Increments `conversations.last_sequence_number` atomically and assigns `NEW.sequence_number`.
- **Function `is_conversation_member(p_conv_id, p_user_id)`**:
  - `RETURNS BOOLEAN`
  - Enforces `WHERE cm.conversation_id = p_conv_id AND cm.user_id = p_user_id AND cm.left_at IS NULL`.

### 2. Live Outdoor Cards & Pack Merge Contracts (M2)
- **Outdoor Object Payload in `message.metadata`**:
  ```typescript
  interface GPXSnapshot {
    type: 'gpx_snapshot';
    title: string;
    distanceKm: number;
    elevationGainM: number;
    estimatedDurationMinutes: number;
    svgPolylinePath: string; // pre-computed SVG path for instant rendering
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  }
  interface KitSnapshot {
    type: 'kit_snapshot';
    kitId: string;
    title: string;
    totalWeightGrams: number;
    itemCount: number;
    categories: Array<{ name: string; count: number; weightGrams: number }>;
  }
  ```
- **Pack Merge Service**:
  ```typescript
  interface PackMergeInput {
    participants: Array<{ id: string; name: string; bodyWeightKg: number; isDog?: boolean }>;
    kits: Array<{ ownerId: string; items: Array<{ id: string; name: string; weightGrams: number; isShared: boolean; category: string }> }>;
  }
  interface PackMergeResult {
    deduplicatedItems: Array<{ id: string; name: string; weightGrams: number; assignedParticipantId: string }>;
    individualLoads: Record<string, { totalWeightGrams: number; bodyWeightRatio: number; isSafe: boolean }>;
    warnings: Array<string>;
  }
  ```

### 3. Expedition Rooms & Clubs Contracts (M3)
- **Table `club_channels`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE`
  - `conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL`
  - `description TEXT`
  - `min_role_to_read TEXT NOT NULL DEFAULT 'member'`
  - `min_role_to_write TEXT NOT NULL DEFAULT 'member'`
- **Table `expedition_rooms`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE`
  - `trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL`
  - `title TEXT NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived'))`
  - `gpx_track_url TEXT`
  - `gpx_snapshot JSONB`
  - `weather_location JSONB`

### 4. Terra AI & Reputation Contracts (M4)
- **Table `terra_drafted_actions`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE`
  - `action_type TEXT NOT NULL CHECK (action_type IN ('create_expedition', 'create_poll', 'update_checklist', 'safety_alert'))`
  - `proposed_payload JSONB NOT NULL`
  - `source_message_sequences BIGINT[] NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected'))`
  - `reviewed_by UUID REFERENCES public.user_profiles(id)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Reciprocal Reputation Points**:
  - Raw chat messages: 0 points.
  - Verified field check-in / safety report: 15 points.
  - Mutual Pack Merge gear carrying: 20 points.
  - Completed collective expedition: 50 points.

---

## Code Layout
- `supabase/migrations/`:
  - `20261004120000_lkdv_social_core_architecture.sql`: Core schema migration (M1, M3, M4)
- `src/lib/supabase/types.ts`: TypeScript database schemas
- `src/features/messaging/`:
  - `types/`: `messaging.types.ts`, `outdoorObjects.types.ts`, `terra.types.ts`, `clubs.types.ts`
  - `services/`:
    - `messagingService.ts`: Facade pattern (delegates to domain services, 100% backward compatible)
    - `domain/`:
      - `sequenceService.ts`: Sequence numbering and ordering logic
      - `idempotencyService.ts`: client_nonce tracking and duplicate prevention
      - `cursorPaginationService.ts`: Bidirectional cursor pagination
      - `offlineSyncQueue.ts`: Local pending queue and 3-phase reconnection sync
      - `packMergeService.ts`: Group gear deduplication and load balancing
      - `terraService.ts`: Quiet Catch-Up summary generation and draft action parsing
      - `reputationService.ts`: Anti-spam reciprocal utility points and streaks
  - `components/`:
    - `GPXLiveCard.tsx`: Instant SVG vector rendering, non-blocking
    - `KitLiveCard.tsx`: Kit card with Pack Merge trigger
    - `PackMergeSheet.tsx`: Bottom sheet for collective gear distribution
    - `EquipmentLiveCard.tsx`: Equipment card with weight and specs
    - `ExpeditionLiveCard.tsx`: Expedition status and members card
    - `TerraDraftActionCard.tsx`: Action card with human Approve/Reject buttons
    - `QuietCatchUpSheet.tsx`: Summary drawer with clickable source citations
    - `expedition/`:
      - `ExpeditionRoomCockpit.tsx`: Multi-pane unified view
      - `ExpeditionWeatherPane.tsx`: Live Open-Meteo weather pane
      - `ExpeditionRoutePane.tsx`: GPX map & profile pane
      - `ExpeditionChecklistPane.tsx`: Real-time shared checklist
      - `ExpeditionCheckinPane.tsx`: Field check-in & safety alerts
    - `clubs/`:
      - `ClubChannelsList.tsx`: Thematic channels list with role permissions
      - `ClubRoleBadge.tsx`: Badges for the 5 outdoor roles
- `tests/messaging/`:
  - `canonical-foundation.spec.ts`: M1 ordering, idempotency, cursor, offline queue
  - `adversarial-stress-m1.spec.ts`: M1 adversarial stress tests (sequences & idempotency)
  - `challenger-m1-2-stress.spec.ts`: M1 adversarial stress tests (cursor & offline)
  - `outdoor-live-cards.spec.ts`: M2 Pack Merge math, snapshot serialization, card tests
  - `clubs-expedition-rooms.spec.ts`: M3 channel permissions, expedition room state
  - `terra-reputation-e2e.spec.ts`: M4 Terra citations, draft actions, points, streaks
