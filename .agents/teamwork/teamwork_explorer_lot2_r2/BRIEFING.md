# BRIEFING — 2026-11-13T23:23:00Z

## Mission
Formulate complete technical remediation strategy and code designs for Lot 2 R2 addressing all 7 integrity violations identified by Forensic Auditor.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer, investigator, synthesizer
- Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
- State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2
- Original parent: 59615597-1e96-4de1-9730-9299e1e6ef8c
- Milestone: Lot 2 R2 Remediation Strategy

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in project source code
- Address all 7 specific integrity violations identified by the auditor
- Do not recommend strategies that circumvent the audit
- Provide exact lines, function signatures, imports, types, and logic for remediation
- File workspace convention: write only in state folder

## Current Parent
- Conversation ID: 59615597-1e96-4de1-9730-9299e1e6ef8c
- Updated: not yet

## Investigation State
- **Explored paths**:
  - Reports: Auditor (`teamwork_auditor_lot2/handoff.md`), Reviewer (`teamwork_reviewer_lot2_native/handoff.md`), Challenger (`teamwork_challenger_lot2_native/handoff.md`)
  - Android: `android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/xml/file_paths.xml`
  - iOS: `ios/App/App/SceneDelegate.swift`, `ios/App/App/Info.plist`, `ios/App/App.xcodeproj/project.pbxproj`
  - Web / TypeScript: `src/lib/native/ui.ts`, `src/components/ui/dialogs.ts`, `src/components/NativeAppBootstrap.tsx`, `src/features/explorer-v2/native/liveActivity.ts`
  - Tests: `tests/explorer-v2/live-activity.spec.ts`, `tests/native/native-ui-bridge.spec.ts`, `tests/native/native-files.test.ts`, `tests/native/native-confirm.spec.ts`, `tests/native/native-date-field.test.tsx`, `tests/native/native-select.test.tsx`, `src/components/mobile-nav/__tests__/`
- **Key findings**:
  1. `BiometricPrompt`: `androidx.biometric:biometric:1.2.0-alpha05` and `USE_BIOMETRIC` permission already exist in project. Implement real prompt on `activity as FragmentActivity` on main thread with `PromptInfo`.
  2. `LocalAuthentication`: `LAContext` completely missing from iOS plugin. Must import `LocalAuthentication`, register `authenticateBiometric` in `pluginMethods`, add `NSFaceIDUsageDescription` to `Info.plist`, and evaluate policy asynchronously.
  3. Pickers: Implement genuine Android system contracts with `Intent(ACTION_GET_CONTENT)` / `Intent(ACTION_OPEN_DOCUMENT)` via `startActivityForResult(call, intent, ...)` and `@ActivityCallback`, returning base64 images and GPX text. Truthful capabilities in `getCapabilities()`.
  4. GPX Export: `FileProvider` already declared in `AndroidManifest.xml` with `@xml/file_paths` covering cache dir. Write GPX to cache, get URI via `FileProvider.getUriForFile`, launch `Intent.ACTION_SEND` chooser, handle `ActivityNotFoundException`.
  5. `supportsNativeUI`: Wire across all bridge functions in `ui.ts`, `dialogs.ts`, and `NativeAppBootstrap.tsx`. Reconcile tests so `supportsNativeIOSUI` remains as legacy helper and `supportsNativeUI` is validated for cross-platform support.
  6. Optional chaining in `liveActivity.ts`: `Capacitor?.isNativePlatform?.()` prevents uncaught `TypeError` in vitest web mock environment.
  7. Hardening: `optJSONObject(i)` in loops and `try-catch (e: ActivityNotFoundException)` on `startActivity` calls. `MaterialDatePicker` replaces `EditText` in `presentDate`.
- **Unexplored areas**: None. All 7 issues fully investigated with verbatim lines and diff designs.

## Key Decisions Made
- Deliver a comprehensive, ready-to-implement remediation specification in `handoff.md` with complete code blocks for all 7 issues.
- Retain read-only stance: no project source modifications by explorer; all changes documented as complete replacement designs and patches in state folder.

## Artifact Index
- /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2/BRIEFING.md — Persistent working memory
- /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2/progress.md — Liveness heartbeat
- /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2/handoff.md — Complete technical remediation plan and design
