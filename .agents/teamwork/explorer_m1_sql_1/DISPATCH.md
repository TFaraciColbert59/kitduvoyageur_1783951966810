## 2026-10-04T10:03:04Z
From: 22810fd4-62f8-4724-853b-2cdeda826f11 (orchestrator)
Content:
You are explorer_m1_sql_1, specialized in SQL Migration & Supabase RLS.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m1_sql_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md
Also read PROJECT.md:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\PROJECT.md

Your task for Milestone 1 (Canonical Messaging Foundation & Supabase RLS / Idempotence):
1. Design the exact SQL migration file: `supabase/migrations/20261004120000_lkdv_social_core_architecture.sql`.
   - Add `sequence_number BIGINT` to `messages` with unique constraint `(conversation_id, sequence_number)`.
   - Add `client_nonce TEXT` to `messages` with unique index `(conversation_id, client_nonce)`.
   - Add `last_sequence_number BIGINT NOT NULL DEFAULT 0` and `context_type TEXT` to `conversations`.
   - Add `last_read_sequence BIGINT NOT NULL DEFAULT 0` and update `role` check to `conversation_members`.
   - Create trigger `trg_assign_message_sequence` BEFORE INSERT ON messages that atomically increments `conversations.last_sequence_number` and assigns `sequence_number`.
   - Patch `is_conversation_member` to enforce `cm.left_at IS NULL` to fix the security leak.
   - Update RLS policies using InitPlan caching `(SELECT auth.uid())`.
   - Include schema foundation for clubs, expedition rooms, and terra drafted actions as mapped in PROJECT.md.
2. Specify exact TypeScript database definitions to update in `src/lib/supabase/types.ts`.
3. Produce a structured analysis report in `analysis.md` and deliver `handoff.md` in your working directory.
Communicate when done via send_message to orchestrator.
