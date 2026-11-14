# BRIEFING — 2026-11-13T20:38:00Z

## Mission
Survey demo account, codebase mock data occurrences, and database parasite test rows for safe targeted purge in Lot 3.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, analyzer, synthesizer
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_survey_3_gen1
- Original parent: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Milestone: Lot 3 Survey & Targeted Purge Plan

## 🔒 Key Constraints
- Read-only investigation — do NOT implement destructive SQL queries (only tested with `ROLLBACK` in dry-run)
- Detailed handoff report with exact demo account credentials, all fake mock occurrences, and draft SQL queries for safe targeted purge
- Update progress.md regularly with timestamps

## Current Parent
- Conversation ID: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Updated: 2026-11-13T20:30:32Z

## Investigation State
- **Explored paths**:
  - `src/app/api/demo-login/route.ts`, `src/app/connexion/page.tsx`, `src/app/api/auth/demo/route.ts`
  - `scripts/ops/phase1_demo_check.mjs`, `supabase/migrations/20261010160000_phase1_demo_isolation.sql`
  - Supabase database (`icxyvwzfjbflcbqukpfz`): `auth.users`, `public.user_profiles`, `public.trips`, `public.clubs`, `public.events`, `public.club_events`, `public.community_posts`, `public.messages`, `pg_constraint`, `information_schema`
  - Codebase mock data: `_MOCK_*`, `CLUB_PRESETS`, `DEMO_*`, `no_image.png`, `Mathieu Chevrier`, `Traversée des Écrins 2026`, `Tour des Fiz 2025`, `Refuge des Écrins`, `Gourdes & Hydratation (2L)`, `author-thomas-alps`, `TONY_AVATAR`
- **Key findings**:
  - Official demo account: UID `d5451f35-db9f-4575-9114-6d3b79550bbc`, Email `demo@lkdv.app`, Name `Léa Fontaine`, Handle `lea.fontaine`. 16 trips, 27 posts, 11 clubs, 10 orders. Complete isolation verified. Must NEVER be purged.
  - Mock occurrences indexed across 20+ files in `src/components/`, `src/features/`, `src/lib/`.
  - Supabase parasite targets identified: 1 club (`Judisid`), 4 `events`, 27 `club_events`, 16 `community_posts` with CC0, 83 parasite test accounts in `auth.users`.
  - Critical DB discovery: Trigger `prevent_message_immutable_fields_update()` on `public.messages` blocks `ON DELETE SET NULL` when deleting users who sent messages. Deleting test messages first avoids this trigger error.
  - Safe transactional SQL tested via PostgreSQL dry-run (`ROLLBACK`) with 100% success.
- **Unexplored areas**: None.

## Key Decisions Made
- Confirmed full preservation rule for Léa Fontaine (`d5451f35-db9f-4575-9114-6d3b79550bbc`).
- Structured SQL purge script with explicit temporary table `target_user_ids` and multi-table cleanups before `auth.users` deletion.

## Artifact Index
- DISPATCH.md — incoming instructions log
- BRIEFING.md — persistent working memory
- progress.md — liveness heartbeat
- handoff.md — final survey report
