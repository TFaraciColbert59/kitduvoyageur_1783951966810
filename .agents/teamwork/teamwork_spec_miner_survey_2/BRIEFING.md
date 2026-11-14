# BRIEFING — 2026-11-14T10:37:45Z

## Mission
Survey Task 2: Mine and document exhaustive specifications for Section 5 (/messagerie) iPhone audit and baseline screenshots (01-messagerie-main.png through 13-*.png), mapping all bugs to Apple HIG requirements and LKDV green palette rules (no pure black #000000).

## 🔒 My Identity
- Archetype: teamwork_spec_miner
- Roles: Specification Miner, Audit Analyzer, Apple HIG / LKDV Palette Compliance Specialist
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_spec_miner_survey_2
- Original parent: 5ca13125-701a-4c70-a7c3-f849d2125e35
- Milestone: Survey 2 - Section 5 Audit & Baseline Screenshots Spec Mining

## 🔒 Key Constraints
- Read-only miner: do NOT implement code changes.
- Prioritize authoritative sources: iPhone Audit Report Section 5 and actual screenshots 01..13 in `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/`.
- Thoroughly map every single glitch, coordinate bug (sheet y=114..386 vs bottom sheet), touch target issue, unwanted navigation to `/compte`, overlapping badges, split view header / resize handle, skeleton freeze in group chats, "Publication indisponible" errors, reaction emoji clipping.
- Map each issue to Apple Human Interface Guidelines (HIG) and LKDV green palette rules (no pure black `#000000`, dark greens `#0B1E16`, `#143527`, `#1A4333`, `#245B45`, `#2D7255`, emerald/mint accents, off-whites).
- Output comprehensive specification report to `spec_messagerie_audit.md` and `handoff.md`.

## Current Parent
- Conversation ID: 5ca13125-701a-4c70-a7c3-f849d2125e35
- Updated: 2026-11-14T10:37:45Z

## Task Summary
- **What to build**: Specification document analyzing all flaws in `/messagerie` baseline and mapping to Apple HIG / LKDV rules.
- **Success criteria**: Detailed, exhaustive specification table with inputs, outputs, coordinates, error behaviors, HIG violations, and LKDV palette remediation.
- **Interface contracts**: `spec_messagerie_audit.md` and `handoff.md` in state folder.

## Key Decisions Made
- All 14 baseline screenshots (`00-messagerie-main.png` to `09-messagerie-message-longpress.png`) and 5 XCUITest XML trees systematically analyzed.
- Exact coordinate collisions mapped for iPhone 16 Pro (402 × 874 pt).
- Sheet misplacement root cause diagnosed: `AccountDrawerHost variant="card"` measuring `#card` (`y=110..386 pt`) instead of anchoring to viewport bottom.
- Header navigation to `/compte` diagnosed: hardcoded `router.push('/compte')` in line 1471 and notification link in `NotificationBell.tsx`.
- Contrast failure diagnosed: `.mbtn.p` `--pg-ink: #17402C` on dark green background.
- Skeleton freeze diagnosed: `useConversations.ts` resetting `loading=true` on Postgres Realtime updates triggered by `markAsRead`.
- `spec_messagerie_audit.md` and `handoff.md` fully drafted and finalized.

## Artifact Index
- `spec_messagerie_audit.md` — Complete specification mining of Section 5 audit and baseline screenshots.
- `handoff.md` — 5-component hard handoff report.
- `progress.md` — Liveness and status heartbeat.
