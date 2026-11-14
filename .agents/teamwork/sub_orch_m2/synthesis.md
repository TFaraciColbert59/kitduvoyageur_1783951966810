# Synthesis: Milestone M2 (/messagerie Refactor & Drawers)

**Date**: 2026-11-14
**Orchestrator**: Sub-Orchestrator M2 (`sub_orch_m2`)
**Inputs**:
- Explorer 1 Report (`explorer_m2_1/analysis.md`, `handoff.md`): Features 5, 6, 7
- Explorer 2 Report (`explorer_m2_2/analysis.md`, `handoff.md`): Features 8, 9
- Explorer 3 Report (`explorer_m2_3/analysis.md`, `handoff.md`): Features 10, 11, 12

---

## 1. Executive Summary

Milestone M2 resolves all Section 5 anomalies from the iPhone 16 Pro audit report (`audit_complet_iphone.md`, lines 305-338) on `/messagerie` across 8 core features (Features 5 through 12).
All three Explorers conducted exhaustive read-only investigations, identified precise root causes down to specific line numbers, AST nodes, and CSS rules, and provided drop-in implementation blueprints.

Zero conflicts were found between the three reports; their file boundaries and responsibilities are fully complementary:
- `MessagesScreen.tsx` is the primary integration surface.
- `NotificationBell.tsx` handles header notification encapsulation.
- `messages-grammar.css` encapsulates layout, inline filters, de-collision, and overlay styling.
- `ComposerMenuSheet.tsx` & `ConversationOptionsSheet.tsx` migrate to canonical Apple `Sheet.tsx`.
- `useConversations.ts` & `useMessages.ts` handle silent background synchronization and message actions.
- `messagingService.ts` exposes `deleteMessage` and `editMessage`.
- `SharedPostEmbed.tsx` provides elegant LKDV branded fallback.

---

## 2. Synthesized Blueprint per Feature

### Feature 5: Header Navigation Fix
- **Files**: `src/components/messaging/MessagesScreen.tsx`, `src/components/ui/NotificationBell.tsx`
- **Root Cause**: Title button calls `router.push('/compte')` with `aria-label="Messages — aller au compte"`. `NotificationBell` renders `<Link href="/compte?tab=notifications">`. Navigating to `/compte` triggers an unhydrated charcoal black (`#0d1117`) flash.
- **Solution**:
  - `NotificationBell.tsx`: Accept optional `onClick?: (event: React.MouseEvent) => void`. When provided, render `<button type="button" onClick={onClick}>` instead of `<Link>`.
  - `MessagesScreen.tsx`: Add `notificationsOpen` state. Title click (`handleTitleClick`) resets active conversation (`setSelectedId(null)`), resets query/filter, and scrolls list to top without leaving `/messagerie`. Bell click opens an in-page bottom `<Sheet>` displaying `<NotificationsPane />`.

### Feature 6: Filter SegmentedControl Repositioning
- **Files**: `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`
- **Root Cause**: `<SubCapsuleTabs>` is positioned at the bottom of `#card` with `position: absolute; bottom: 10px; right: 12px; width: 196px;`. It floats directly over the 4th conversation row (`Dolomites — août`) at `x=182..378, y=348..374`.
- **Solution**:
  - Move `<SubCapsuleTabs>` into normal document flow inside a new container `<div className="mfilters-bar">` between `.msearch` and `.card-scroll`.
  - Change `placement="inline"` and `showLabels={true}` so category labels (`Toutes`, `Directs`, `Groupes`, `Demandes`) are visible.
  - In `messages-grammar.css`: remove absolute positioning on `.mfilters`, style `.mfilters-bar` as an inline flex container (height 32px, margin 8px 12px), adhering to Apple UISegmentedControl metrics with sauge background and green selection indicator.

### Feature 7: Split View 40/60 De-collision
- **Files**: `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`
- **Root Cause**: Resize handle `msplit` (`x=157..245, y=396..418`) and group pill `mpill` (`x=12..201, y=402..446`) collide by 44 points horizontally. In addition, the first message bubble is clipped under `.mpill` without a Close (`×`) or Options (`...`) button.
- **Solution**:
  - Structure conversation header inside `<header className="mpane-header">` with `margin-top: 20px`, containing:
    - Close button (`×`) that sets `setSelectedId(null)`.
    - `.mpill` capped at `max-width: 220px` to clear `msplit` by > 16pt horizontally.
    - Options button (`...`) opening `ConversationOptionsSheet`.
  - In `messages-grammar.css`: style `.mpane-header` with flex, safe clearance under `msplit`, and set `.mthread` top padding to `16px` to ensure the first message bubble is 100% visible. Add `aria-valuemin={140}` and `aria-valuemax={694}` to `msplit`.

### Feature 8: Bottom Sheet Drawers (`+` and `...`)
- **Files**: `src/features/messaging/components/ComposerMenuSheet.tsx`, `src/features/messaging/components/ConversationOptionsSheet.tsx`, `src/components/ui/Sheet.tsx`, `src/components/messaging/MessagesScreen.tsx`
- **Root Cause**: `ComposerMenuSheet` and `ConversationOptionsSheet` use `AccountDrawerHost variant="card"`, which measures `#card` (the top 40% pane) and opens at `y=114..386` instead of the screen bottom. `.sh-h` sets `padding: 2px 0 6px` causing 0px left padding on title, and lower options are truncated. `ConversationOptionsSheet` contains a redundant "Écrire un message" button and lacks mute/block/delete options.
- **Solution**:
  - Enhance `Sheet.tsx` with optional `onBack?: () => void` and `headerAction?: React.ReactNode`.
  - Migrate both `ComposerMenuSheet` and `ConversationOptionsSheet` to `src/components/ui/Sheet.tsx`.
  - Bottom anchoring (`fixed inset-x-0 bottom-0 z-[var(--z-sheet)]`), 36×5pt capsule grabber, 20px padding (`px-[var(--space-5)]`), scrollable options list (`Photo`, `Carte GPX`, `Randonnée`, `Équipement`, `Kit`).
  - In `ConversationOptionsSheet`: remove redundant "Écrire un message". Provide Mute, Block, Delete conversation (`deleteConversationForMe`), Profile info, and Close (`×`).

### Feature 9: Demandes & Empty State Fix
- **Files**: `src/components/messaging/MessagesScreen.tsx`, `src/components/compte/compte-v8.css`, `src/features/messaging/components/NewConversationModal.tsx`
- **Root Cause**:
  - When `Demandes` is selected with no requests, both top pane (`visible.length === 0`) and bottom pane (`selectedId === null`) render stacked `.mstate` empty states simultaneously.
  - `.mbtn.p` in `compte-v8.css:138` applies `color: var(--pg-ink) !important;` (`#17402C`), overriding inline `#fff` on the dark green button (1.0:1 unreadable contrast).
  - "Nouvelle discussion" CTA button only calls `focusSearch()` instead of opening contact creation.
- **Solution**:
  - Deduplicate: Suppress lower pane `.mstate` when `visible.length === 0`.
  - Fix contrast: Add `.mbtn-cta-primary` with `background: #17402C !important; color: #FFFFFF !important;` guaranteeing 11.88:1 contrast (WCAG AAA compliant, zero pure black `#000000`).
  - Make functional: Import and wire `NewConversationModal` (`src/features/messaging/components/NewConversationModal.tsx`). Tapping CTA opens the modal in an Apple Sheet.

### Feature 10: Group Chat Realtime Freeze Elimination
- **Files**: `src/features/messaging/hooks/useConversations.ts`, `src/components/messaging/MessagesScreen.tsx`
- **Root Cause**: Selecting a group chat triggers `markAsRead`, updating `conversation_members`. Realtime listener invokes `fetchConversations()`, which calls `setLoading(true)`. In `MessagesScreen.tsx:1582`, `loading ?` wipes the list and displays 4 gray skeletons (`mskel`).
- **Solution**:
  - In `useConversations.ts`: add `silent?: boolean` to `fetchConversations(silent = false)`. If `silent || conversations.length > 0`, DO NOT set `loading = true`. Silently refresh conversations in background.
  - Pass `silent: true` in all Realtime listeners (`conversation_members`, `conversations`).
  - In `MessagesScreen.tsx`: only display skeletons on initial mount when `loading && conversations.length === 0`.

### Feature 11: Shared Post Embed Graceful Fallback & Bubble Text Breaking
- **Files**: `src/features/messaging/components/SharedPostEmbed.tsx`, `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`
- **Root Cause**: Unavailable shared posts render a raw gray box `"Publication indisponible"`. Also, short message bubbles ("Top / Bien") break words across lines due to `word-break: break-word` combined with flex constraints without `width: fit-content`.
- **Solution**:
  - Replace raw error box with an elegant LKDV branded card with continuous squircle corners (`rounded-2xl`), sauge surface, brand icon, informative label ("Publication indisponible ou privée"), and a "Réessayer" action.
  - In `messages-grammar.css`: add `overflow-wrap: anywhere; word-break: normal; width: fit-content; max-width: 78%;` to `.bub` / `.mstack`.

### Feature 12: Reaction Emoji Overlay Bar & Message Actions
- **Files**: `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`, `src/features/messaging/services/messagingService.ts`, `src/features/messaging/hooks/useMessages.ts`
- **Root Cause**: Reaction bar renders 9 buttons inside `.mstack` in normal document flow, breaking across 2 lines and pushing messages down by 50-60px. `.mthread { contain: paint }` clips floating elements. Missing `Supprimer` and `Modifier` actions.
- **Solution**:
  - Render reaction bar as a floating popover overlay (`position: absolute`, `z-index: 60`) anchored above the bubble with a dismissible backdrop.
  - 44pt single-row capsule bar for emojis (`👍`, `❤️`, `🔥`, `👏`, `⛺`, `🏔️`).
  - Contextual action menu: `Répondre`, `Copier`, plus `Modifier` and `Supprimer` if `message.sender_id === currentUserId`.
  - Implement `deleteMessage(messageId)` and `editMessage(messageId, text)` in `messagingService.ts` and wire in `useMessages.ts`.
  - Adjust `.mthread` containment/overflow so overlays are fully visible.

---

## 3. Work Ownership & Implementation Order for Worker

The Worker will implement the changes in a clean, logical sequence:
1. `src/components/ui/NotificationBell.tsx` & `src/components/ui/Sheet.tsx` (foundational component enhancements)
2. `src/features/messaging/services/messagingService.ts` & `src/features/messaging/hooks/useConversations.ts` & `src/features/messaging/hooks/useMessages.ts` (services & state hooks)
3. `src/features/messaging/components/ComposerMenuSheet.tsx` & `src/features/messaging/components/ConversationOptionsSheet.tsx` & `src/features/messaging/components/SharedPostEmbed.tsx` (messaging feature components)
4. `src/components/messaging/MessagesScreen.tsx` & `src/components/messaging/messages-grammar.css` (main screen integration & styling)

Verification commands to run upon completion:
- `node tests/e2e/runner.mjs` (must pass 140/140 tests)
- `npx vitest run src/components/messaging/__tests__/` and affected suites
- Invariant check: zero pure black `#000000`, zero `#0d1117`.
