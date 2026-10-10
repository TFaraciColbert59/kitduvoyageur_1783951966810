## 2026-10-04T09:47:08Z
You are explorer_social_domain_1, specialized in Canonical Messaging Domain & Algorithms.
Your working directory is: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_social_domain_1

You MUST read ORIGINAL_REQUEST.md first:
c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md

Your task is to conduct an in-depth survey of `src/features/messaging/` and the domain logic for « LKDV Social »:
1. Thoroughly inspect `src/features/messaging/` (existing services, types, hooks, tests, stores). Understand how messaging is currently implemented.
2. Investigate canonical requirements:
   - Consolidation of `src/features/messaging/messagingService.ts` and related domain services without breaking changes.
   - DM and group conversation handling, cursor pagination, deterministic ordering by sequence numbers.
   - Client send idempotency with `client_nonce` (prevent duplicate messages on network drop/reconnect).
   - Aggregated read tracking with `last_read_sequence`.
   - Offline sync, pending message queue, and reconnection reconciliation.
   - Outdoor first-class objects integration: GPX traces/routes, kits with Pack Merge logic, equipment items, activity sheets, expeditions.
   - Terra AI integration: participant isolation per conversation, "Quiet Catch-Up" summaries, decision extraction, precise source citations, draft-only actions (creating expeditions, polls) requiring user confirmation.
   - Collaborative reputation model: reciprocal utility contribution points and collective adventure streaks (anti-spam design).
3. Document existing tests, gaps in test coverage, and exact architectural interfaces.
4. Write your comprehensive survey report to `survey_report_domain.md` and deliver `handoff.md` in your working directory.
Communicate when done via send_message to orchestrator.
