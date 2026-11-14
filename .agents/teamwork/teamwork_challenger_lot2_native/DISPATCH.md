# DISPATCH Task: Challenger Lot 2 Native (Adversarial Verification)

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_native`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
Worker Lot 2 Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2/handoff.md`

## Mission
Adversarial stress-testing of Native Bridges, ActivityKit, Android M3 & navigation lifecycle:
1. Native UI Bridges (`tests/native/`):
   - Stress test `tests/native/native-confirm.spec.ts`, `native-ui-bridge.spec.ts`, `native-files.test.ts`.
   - Test platform fallback: what happens when `Capacitor.getPlatform()` returns `'web'`? Does `supportsNativeUI` safely return false?
   - Test `/compas` routing: does `shouldShowNativeGlass('/compas')` return true? Are native tabs active on `/compas`?
2. Swift & Xcode:
   - Run `plutil -lint ios/App/App.xcodeproj/project.pbxproj`. Verify UUID consistency and file references for `LkdvWidgetsExtension` and `LkdvLiveActivityWidget.swift`.
   - Check AST / exact strings in `ios/App/App/SceneDelegate.swift`: verify `LKDVNativeGPXExportView` has `guard let data = try? Data(contentsOf: url)` and `self.errorMessage = "Impossible de lire le fichier GPX."`.
3. Android Kotlin:
   - Verify `LKDVAndroidTabBarHost.kt`, `LiveOutingNotificationService.kt`, `LKDVNativeUIPlugin.kt`, `MainActivity.kt` for null-safety, memory leaks, missing intent filters or permission exceptions.
4. Run commands independently and report findings.
5. Write your report in `handoff.md` with verdict: `APPROVE` or `REQUEST_CHANGES`.


## 2026-11-13T23:04:41Z
Adversarially challenge and stress-test the Native iOS Swift & Android Material 3 parity of Lot 2.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_native
Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
Original user request: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
Worker Lot 2 Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2/handoff.md
Task dispatch details: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_native/DISPATCH.md
