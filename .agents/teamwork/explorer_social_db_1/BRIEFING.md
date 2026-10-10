# BRIEFING — 2026-10-04T09:47:30Z

## Mission
Survey the database, RLS security, and Supabase migration layer for « LKDV Social » (messaging, clubs, expedition rooms, Terra AI permissions, collaborative reputation).

## 🔒 My Identity
- Archetype: explorer
- Roles: Database & Security architecture explorer
- Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_social_db_1
- Original parent: 22810fd4-62f8-4724-853b-2cdeda826f11
- Milestone: LKDV Social Architecture Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect existing Supabase migrations in `supabase/migrations/` and TypeScript types in `src/lib/supabase/types.ts`
- Investigate canonical messaging tables, strict Supabase RLS, club structure, expedition rooms, Terra AI permissions, collaborative reputation
- Document missing migrations, required RPC functions, and performance indexes
- Deliver `survey_report_db.md` and `handoff.md`

## Current Parent
- Conversation ID: 22810fd4-62f8-4724-853b-2cdeda826f11
- Updated: 2026-10-04T12:00:00Z

## Investigation State
- **Explored paths**: `supabase/migrations/` (canonical messaging 20260831000000, helpers 20260830000000, initplan 20260925010000, clubs 20260713120000, tribu 20260913*, rewards 20261003120000), `src/features/messaging/`, `src/lib/supabase/types.ts`.
- **Key findings**:
  1. Messages lacks sequence_number & client_nonce.
  2. conversation_members lacks last_read_sequence; is_conversation_member helper fails to check left_at IS NULL (leakage vulnerability).
  3. Clubs currently have no real-time channels (only forum topics). Roles need expansion to 5 outdoor roles: owner, admin, guide, safety, member.
  4. Expedition rooms need dedicated orchestration table linking conversations, trips, checklists, and terrain check-ins.
  5. Terra AI requires explicit per-conversation settings & drafted actions schema with source message citations.
  6. Collaborative reputation requires reciprocal utility rewards and adventure streaks with zero points for raw chat spam.
- **Unexplored areas**: None on the database & security layer. Complete DDL, RLS, RPC, indexes, and TypeScript mappings specified.

## Key Decisions Made
- Reused canonical messaging tables and helpers without parallel systems.
- Designed atomic sequence generation via BEFORE INSERT trigger touching conversation.last_sequence_number and last_message_at.
- Formulated 100% idempotent send_message_idempotent RPC.
- Fixed active membership verification in RLS to prevent leakage to departing members.
- Designed club_channels as 1:1 bridge to canonical conversations with inherited access.
- Structured Terra actions as drafts requiring guide/admin review.

## Artifact Index
- DISPATCH.md — Initial dispatch message
- progress.md — Heartbeat and completion log
- survey_report_db.md — Exhaustive architectural specification and DDL
- handoff.md — 5-component hard handoff report
