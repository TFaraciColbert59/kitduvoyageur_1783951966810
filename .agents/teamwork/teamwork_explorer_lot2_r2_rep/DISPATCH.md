# DISPATCH Task: Explorer Lot 2 R2 Replacement

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2_rep`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`

## Predecessor Explorer State
Read `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2/BRIEFING.md` where the technical investigation of all 7 issues was already 100% completed.

## Audit Failure Evidence Reports (MANDATORY READING)
- Forensic Auditor Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_auditor_lot2/handoff.md`
- Reviewer Native Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot2_native/handoff.md`
- Challenger Native Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_native/handoff.md`

## Mission
You are the replacement Explorer for Lot 2 R2 Remediation.
Your predecessor finished investigating all 7 issues (documented in `teamwork_explorer_lot2_r2/BRIEFING.md`) but timed out before writing `handoff.md`.
Your job is to compile the final, detailed technical remediation plan into `handoff.md` in your state folder.
Cover all 7 items with exact code blocks, signatures, imports, and file diff specifications:
1. Android `BiometricPrompt` in `LKDVNativeUIPlugin.kt`.
2. iOS `LAContext` Face ID / Touch ID in `SceneDelegate.swift` + `Info.plist`.
3. Android photo/file pickers with real contracts or truthful capabilities in `LKDVNativeUIPlugin.kt`.
4. Android GPX export via `FileProvider` + `Intent.ACTION_SEND` in `LKDVNativeUIPlugin.kt`.
5. TypeScript facade wiring (`supportsNativeUI`) in `src/lib/native/ui.ts`, `dialogs.ts`, `NativeAppBootstrap.tsx` and test reconciliation in `tests/native/`.
6. Safe optional chaining `Capacitor?.isNativePlatform?.()` in `src/features/explorer-v2/native/liveActivity.ts` so `tests/explorer-v2/live-activity.spec.ts` passes 100%.
7. Kotlin hardening (`optJSONObject` and `ActivityNotFoundException` try-catch).

Write `handoff.md` in your state folder and send a completion message back.


## 2026-11-13T23:41:55Z
Compile the technical remediation plan for Lot 2 R2 into handoff.md.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2_rep
Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
Original user request: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
Predecessor findings: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2/BRIEFING.md
Task dispatch details: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2_rep/DISPATCH.md
Auditor Evidence Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_auditor_lot2/handoff.md
Reviewer Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot2_native/handoff.md
Challenger Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_native/handoff.md

Read predecessor BRIEFING.md and the auditor/reviewer/challenger reports. Compile the complete code designs, signatures, imports, and file diff specifications for all 7 issues into handoff.md in your state folder. Send a completion message back when done.
