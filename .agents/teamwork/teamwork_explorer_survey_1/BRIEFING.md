# BRIEFING — 2026-11-14T10:38:00Z

## Mission
Survey Task 1: Codebase & Capacitor iOS Bridge Architecture. Deep investigation of /messagerie implementation, design system/Tailwind/CSS palettes (#000000/#0d1117 detection), and Capacitor iOS native bridge setup (ios/App/App).

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, investigation, synthesis
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_survey_1
- Original parent: f5b12d51-f943-4c09-a4eb-05cb349cbcf9
- Milestone: Survey & Working Tree Audit
- Updated Parent: 5ca13125-701a-4c70-a7c3-f849d2125e35
- New Milestone: Survey Task 1: Codebase & Capacitor iOS Bridge Architecture

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Audit working tree modifications and untracked files against master plan & original request
- Specifically check 100% Light Mode Liquid Glass palette, no #000, bank.ts architecture
- Survey Task 1: Investigate /messagerie, design system / Tailwind / color palettes, and Capacitor iOS native setup (ios/App/App)

## Current Parent
- Conversation ID: 5ca13125-701a-4c70-a7c3-f849d2125e35
- Updated: 2026-11-14T10:38:00Z

## Investigation State
- **Explored paths**:
  - `src/app/messagerie/page.tsx` & `layout.tsx`
  - `src/components/messaging/MessagesScreen.tsx` & `messages-grammar.css`, `messagesModel.ts`
  - `src/features/messaging/*` (types, services, hooks, components)
  - `src/design/bank.ts`, `scripts/generate-design-bank.mjs`, `src/styles/tokens.css`, `tailwind.config.js`
  - `ios/App/App/SceneDelegate.swift`, `AppDelegate.swift`, `MainViewController.swift`, `DesignTokens.generated.swift`, `capacitor.config.ts`
  - `src/lib/native/ui.ts`, `src/lib/native/haptics.ts`, `src/lib/native/status-bar.ts`
  - `tests/adversarial-lot2-web-primitives.test.tsx`, `tests/native/native-ui-bridge.spec.ts`
- **Key findings**:
  1. `/messagerie` Header has hardcoded `onClick={() => router.push('/compte')}` on the "Messages" title button and notification bell.
  2. Filter pill `.mfilters` has `position: absolute !important; bottom: 10px; right: 12px;` covering 4th conversation row.
  3. "Nouvelle discussion" button only focuses search input (`focusSearch()`), while `NewConversationModal.tsx` exists unused in `src/features/messaging/components/`.
  4. `ComposerMenuSheet` and `ConversationOptionsSheet` use `AccountDrawerHost variant="card"` with `DRAWER_INSET` restricting them to top half of screen instead of bottom sheet.
  5. Group chat freeze is caused by `useConversations.ts:46` setting `setLoading(true)` on every background realtime refresh (e.g. `markAsRead`).
  6. Message reaction menu is dumped inline in message row flow (`<div className="mreacts">`) breaking onto 2 lines instead of floating pill context menu.
  7. `capacitor.config.ts:75` forces `Keyboard.style: "DARK"` in an entirely light-mode application.
  8. Capacitor iOS bridge (`SceneDelegate.swift` / `LKDVNativeUIPlugin`) has native SwiftUI `presentActions`, `presentPrompt`, `presentPhotos`, `importGPX`, but web app was relying on ad-hoc drawers.
- **Unexplored areas**: none within survey scope.

## Key Decisions Made
- Fully documented all technical findings and root-cause mappings in `survey_codebase.md` and `handoff.md`.

## Artifact Index
- DISPATCH.md — incoming dispatch instructions
- progress.md — liveness and progress tracking
- survey_codebase.md — comprehensive technical survey report
- handoff.md — 5-component handoff report
