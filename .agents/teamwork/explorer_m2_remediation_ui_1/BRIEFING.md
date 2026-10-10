# BRIEFING — 2026-10-04T16:05:30Z

## Mission
Investigate Live Cards UI & Apple HIG Mobile Ergonomics issues and formulate surgical remediation specs for MessageBubble, PackMergeSheet, and GPXLiveCard.

## 🔒 My Identity
- Archetype: explorer
- Roles: Live Cards UI & Apple HIG Mobile Ergonomics Specialist
- Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_remediation_ui_1
- Original parent: 22810fd4-62f8-4724-853b-2cdeda826f11
- Milestone: m2-remediation

## 🔒 Key Constraints
- Read-only investigation — do NOT modify application source code directly; write analysis, patches, and handoff reports in agent folder
- Apple HIG Mobile Ergonomics compliance (44px min touch targets, iOS safe area insets, backdrop scrim)
- Full evidence chain with exact file paths and line numbers

## Current Parent
- Conversation ID: 22810fd4-62f8-4724-853b-2cdeda826f11
- Updated: 2026-10-04T16:05:30Z

## Investigation State
- **Explored paths**:
  - `src/features/messaging/components/MessageBubble.tsx:516-523`
  - `src/features/messaging/components/PackMergeSheet.tsx:61, 65, 120, 223`
  - `src/features/messaging/components/GPXLiveCard.tsx:28, 35, 79`
  - `src/features/messaging/domain/packMerge.ts:500-741`
  - `src/features/messaging/services/domain/packMergeService.ts`
  - `src/features/messaging/types/outdoorObjects.types.ts:75-115`
  - `tests/messaging/outdoor-live-cards.spec.ts`
  - `tests/messaging/challenger-m2-2-livecards-stress.spec.ts`
- **Key findings**:
  1. `MessageBubble` mounts `PackMergeSheet` with no `result`, rendering an empty 0-item modal. Solved with domain helper `computeKitPreviewMergeResult`.
  2. `PackMergeSheet` lacks safe-area bottom padding, causing primary CTA button collision with iOS home indicator. Solved via `pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]`.
  3. `PackMergeSheet` segmented switcher tab height is 32px inside 40px container. Solved by increasing container to `h-12 min-h-[48px]` and buttons to `min-h-[44px]`.
  4. `PackMergeSheet` lacks backdrop scrim. Solved with `<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />`.
  5. `GPXLiveCard` used `window.location.href`. Solved via `router.push` with SSR-safe fallback.
  6. `GPXLiveCard` used non-unique SVG gradient ID. Solved via `React.useId()`.
  7. `GPXLiveCard` used unregistered icon `arrow-down-tray`. Solved via registered `'download'`.
- **Unexplored areas**: None. Complete investigation of all items.

## Key Decisions Made
- Designed domain helper `computeKitPreviewMergeResult` to cleanly calculate realistic 2-person expedition pack merge from any `KitSnapshot`.
- Provided double layer of defense: `MessageBubble` passes calculated `result`, and `PackMergeSheet` accepts optional `kitSnapshot` fallback.
- Ensured `useRouter` retrieval in `GPXLiveCard` is guarded against Next.js 15 App Router invariant errors during `renderToStaticMarkup`.
- Generated complete drop-in replacement code and diffs in `analysis.md` and `handoff.md`.

## Artifact Index
- DISPATCH.md — Incoming dispatch message
- BRIEFING.md — Persistent context and situational awareness
- progress.md — Liveness heartbeat
- analysis.md — Detailed UI findings and surgical code proposals
- handoff.md — 5-component hard handoff report
