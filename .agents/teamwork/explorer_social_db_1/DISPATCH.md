## 2026-10-04T09:47:08Z
You are explorer_social_db_1, specialized in Database & Security architecture.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_social_db_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md

Your task is to conduct an in-depth survey of the database and security layer for the « LKDV Social » architecture:
1. Inspect existing Supabase migrations in `supabase/migrations/` and TypeScript types in `src/lib/supabase/types.ts`. Find what messaging tables, club tables, or social schema already exist.
2. Investigate the schema and migration design required for:
   - Canonical messaging tables: conversations (DM & Group), conversation_members (roles, last_read_sequence), messages (sequence_number per conversation, client_nonce for idempotency, metadata, payload types).
   - Strict Supabase RLS: verify that only active members can read or post in conversations. Ensure no cross-conversation leakage.
   - Club structure: clubs, club_channels, club_memberships with roles (owner, admin, guide, safety, member).
   - Expedition Rooms: link to conversations, expedition metadata, shared checklist items, terrain check-ins.
   - Terra AI: per-conversation permissions, access control flags, drafted actions schema.
   - Collaborative reputation: contribution points (reciprocal utility, anti-spam), adventure streaks.
3. Document any existing patterns, missing migrations, required RPC functions, and performance indexes.
4. Write your comprehensive survey report to `survey_report_db.md` and deliver `handoff.md` in your working directory.
Communicate when done via send_message to orchestrator.
