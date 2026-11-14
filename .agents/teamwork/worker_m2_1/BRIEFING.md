# BRIEFING — 2026-11-14T12:03:00Z

## Mission
Implement the complete refactor for Milestone M2 (/messagerie Refactor & Drawers) covering Features 5 through 12.

## 🔒 My Identity
- Archetype: teamwork_worker
- Roles: implementer, qa, specialist
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/worker_m2_1
- Original parent: 2681e077-cac3-4443-8af1-fb9b1fb27368
- Milestone: M2 (/messagerie Refactor & Drawers)

## 🔒 Key Constraints
- Strict non-violation of integrity mandate: genuine implementation only, no mock/dummy, real state and behavior.
- Write ownership strictly limited to:
  1. `src/components/ui/NotificationBell.tsx`
  2. `src/components/ui/Sheet.tsx`
  3. `src/features/messaging/services/messagingService.ts`
  4. `src/features/messaging/hooks/useConversations.ts`
  5. `src/features/messaging/hooks/useMessages.ts`
  6. `src/features/messaging/components/ComposerMenuSheet.tsx`
  7. `src/features/messaging/components/ConversationOptionsSheet.tsx`
  8. `src/features/messaging/components/SharedPostEmbed.tsx`
  9. `src/components/messaging/MessagesScreen.tsx`
  10. `src/components/messaging/messages-grammar.css`
  (Plus tests in testing directories as needed)
- Visual styling rules: zero `#000000`, zero `#0d1117` in modified files. Apple UISegmentedControl styling, 36x5pt capsule grabbers, safe clearances, accessible focus states.
- 100% test pass: `node tests/e2e/runner.mjs` (140/140), `npx vitest run src/components/messaging/__tests__/` and related tests.

## Current Parent
- Conversation ID: 2681e077-cac3-4443-8af1-fb9b1fb27368
- Updated: 2026-11-14T12:03:00Z

## Task Summary
- **What to build**: Full implementation of Features 5-12 for /messagerie:
  - Feature 5: Header Navigation Fix (NotificationBell onClick, title reset & smooth scroll, Sheet with NotificationsPane)
  - Feature 6: Filter SegmentedControl Repositioning (SubCapsuleTabs in normal flow .mfilters-bar, inline placement, Apple style)
  - Feature 7: Split View 40/60 De-collision (header .mpane-header with margin-top 20px, Close, truncated .mpill max-width 220px, Options, top padding 16px, aria-valuemin/max)
  - Feature 8: Bottom Sheet Drawers (+ and ...) migrating ComposerMenuSheet & ConversationOptionsSheet to Sheet.tsx, actions wired
  - Feature 9: Demandes & Empty State Fix (deduplication of empty state, #17402C contrast CTA, wired to NewConversationModal)
  - Feature 10: Group Chat Realtime Freeze Elimination (silent fetchConversations, no skeleton if conversations already present)
  - Feature 11: Shared Post Embed Graceful Fallback & Bubble Text Breaking (branded fallback card, overflow-wrap anywhere, width fit-content)
  - Feature 12: Reaction Emoji Overlay Bar & Message Actions (floating popover overlay, 44pt capsule bar, contextual actions, delete/edit in service & hook)
- **Success criteria**: All features fully functional, passing 140/140 e2e tests, all vitest tests pass, no dark theme artifacts (#000000, #0d1117).
- **Interface contracts**: PROJECT.md, SCOPE.md, synthesis.md
- **Code layout**: PROJECT.md

## Key Decisions Made
- [TBD]

## Artifact Index
- DISPATCH.md — Dispatch instructions from orchestrator
- progress.md — Liveness heartbeat and progress tracker
- handoff.md — Final handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Not yet executed
- **Lint status**: Not yet checked
- **Tests added/modified**: None yet

## Loaded Skills
None
