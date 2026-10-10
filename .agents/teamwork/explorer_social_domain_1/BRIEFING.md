# BRIEFING — 2026-10-04T10:02:00Z

## Mission
In-depth read-only survey of `src/features/messaging/` and the domain logic for « LKDV Social » (algorithms, models, state, sync, outdoor objects, Terra AI, collaborative reputation).

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer_social_domain_1 (Canonical Messaging Domain & Algorithms)
- Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_social_domain_1
- Original parent: 22810fd4-62f8-4724-853b-2cdeda826f11
- Milestone: LKDV Social Domain & Algorithms Architectural Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Read ORIGINAL_REQUEST.md first
- Survey `src/features/messaging/` services, types, hooks, tests, stores
- Address canonical requirements: consolidation, sequence ordering, client idempotency (`client_nonce`), read tracking (`last_read_sequence`), offline sync, outdoor objects, Terra AI, collaborative reputation
- Document existing tests, gaps, interfaces, and recommendations in `survey_report_domain.md` and `handoff.md`

## Current Parent
- Conversation ID: 22810fd4-62f8-4724-853b-2cdeda826f11
- Updated: 2026-10-04T10:02:00Z

## Investigation State
- **Explored paths**:
  - `src/features/messaging/` (types, services, lib, hooks, components)
  - `tests/messaging/messagingUtils.spec.ts`
  - `supabase/migrations/20260831000000_messaging_system_canonical.sql`, `20260925010000_messaging_rls_auth_initplan.sql`, `20261003120000_r1_reward_rpc_security_hardening.sql`
  - `supabase/tests/database/messaging_security.test.sql`, `messaging_rls_initplan.test.sql`
  - `src/features/preparation/services/loadDistribution.ts`
  - `src/lib/ai/askAI.ts`, `src/features/adventure-intelligence/domain/decisions.ts`, `syncMerge.ts`
  - `src/components/clubs/ClubDiscussionCard.tsx`
- **Key findings**:
  - Service monolithique (`messagingService.ts`, 1312 l.) mélangeant mock démo et appels Supabase, requiert une décomposition via Façade Pattern.
  - Ordonnancement par `created_at` et limite 50 sans curseur -> nécessite `sequence_number` et pagination bidirectionnelle.
  - Absence d'idempotence réseau -> nécessite `client_nonce` avec index d'unicité partiel.
  - Accusés de lecture reposant sur `msgTime - 1000` -> nécessite `last_read_sequence` arithmétique.
  - Manque de file d'attente offline persistante -> protocole de réconciliation en 3 phases (drain, catch-up, read-sync).
  - Pack Merge unifiant matériel partagé et distribution de portage via `loadDistribution.ts`.
  - Terra AI isolé par conversation, résumés "Quiet Catch-Up" avec citations obligatoires et actions draft exigeant confirmation.
  - Réputation anti-spam : 0 point sur message brut, valorisation exclusive de l'utilité réciproque et streaks collectifs.
  - Lacune de tests frontend majeure : 0 test pour `messagingService`, hooks ou composants (seul 1 test utilitaire existe).
- **Unexplored areas**: None for domain survey.

## Key Decisions Made
- Complété l'enquête architecturale et algorithmique sans modifier le code source de production.
- Rédigé le rapport exhaustif `survey_report_domain.md`.
- Rédigé le rapport de passation `handoff.md` (5 sections protocolaires).

## Artifact Index
- DISPATCH.md — Journal des instructions reçues
- progress.md — Liveness heartbeat et journal d'avancement
- survey_report_domain.md — Rapport d'enquête architectural et algorithmique exhaustif
- handoff.md — Rapport de passation 5-composants
