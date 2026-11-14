# DISPATCH Task: Explorer Lot 2 R2 (Remediation Strategy for Forensic Audit Integrity Violation)

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`

## Audit Failure Evidence Reports (MANDATORY READING)
- Forensic Auditor Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_auditor_lot2/handoff.md`
- Reviewer Native Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot2_native/handoff.md`
- Challenger Native Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_challenger_lot2_native/handoff.md`

## Mission
You are the Technical Explorer for Lot 2 Remediation (R2).
The milestone FAILED because the Forensic Auditor issued a BINARY VETO (**INTEGRITY VIOLATION**).
Your fix strategy MUST address the specific integrity violations identified by the auditor, and MUST NOT recommend strategies that circumvent the audit.

Address the following 7 issues:
1. **Android Genuine Biometrics (`LKDVNativeUIPlugin.kt`)**:
   - Current: `authenticateBiometric` returns hardcoded `{ active: true, success: true }`.
   - Required fix: Implement real `androidx.biometric.BiometricPrompt` on `activity as AppCompatActivity` / `FragmentActivity` using `ContextCompat.getMainExecutor(context)` and `BiometricPrompt.PromptInfo.Builder()`. Resolve `success: true` only on `onAuthenticationSucceeded`, `success: false` on error/cancel/failure.
2. **iOS Genuine Face ID / Touch ID (`SceneDelegate.swift`)**:
   - Current: `LAContext` is completely missing from iOS code despite `ORIGINAL_REQUEST.md` (Item 3).
   - Required fix: In `ios/App/App/SceneDelegate.swift`, import `LocalAuthentication` and implement `authenticateBiometric` in `LKDVNativeUIPlugin` using `LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: ...)`.
3. **Android Pickers & Capabilities (`LKDVNativeUIPlugin.kt`)**:
   - Current: `presentPhotos` returns `[]` and `importGPX` returns `{ active: true }` without invoking system contracts, while `getCapabilities` falsely claims `photos: true` and `files: true`.
   - Required fix: Implement real contracts:
     - `presentPhotos`: Launch `ActivityResultContracts.PickMultipleVisualMedia` or `Intent(Intent.ACTION_OPEN_DOCUMENT)` / `Intent(Intent.ACTION_GET_CONTENT)` with `type = "image/*"`.
     - `importGPX`: Launch `Intent(Intent.ACTION_OPEN_DOCUMENT)` with MIME type or `*/*`.
     - If photo/file selection is deferred to web fallback, accurately return `photos: false` and `files: false` in `getCapabilities()`.
4. **Android GPX Export File Sharing (`LKDVNativeUIPlugin.kt`)**:
   - Current: `exportGPX` writes to private internal `activity.cacheDir`.
   - Required fix: Write to cache and share via `FileProvider` + `Intent.ACTION_SEND`, or invoke `Intent.ACTION_CREATE_DOCUMENT` via SAF so the user can save the GPX file.
5. **TypeScript Facade Wiring (`src/lib/native/ui.ts` & `dialogs.ts`)**:
   - Current: `supportsNativeUI()` is dead code with 0 callers; all bridge functions still call `supportsNativeIOSUI()`, which blocks Android (`getPlatform() !== 'ios'`) and `/compas`.
   - Required fix: Wire bridge functions (`presentNativeActions`, `presentNativePrompt`, `hasNativeDatePicker`, `presentNativeDate`, `hasNativeChoices`, `presentNativeChoices`, `openBrowser`, `shareNativeURL`, `authenticateBiometric`) to use `supportsNativeUI()`. Update `src/components/ui/dialogs.ts` and `NativeAppBootstrap.tsx` to use `supportsNativeUI()`. Update any unit tests in `tests/native/` to test both `supportsNativeUI()` and legacy `supportsNativeIOSUI()` appropriately.
6. **Live Activity Optional Chaining Regression (`src/features/explorer-v2/native/liveActivity.ts`)**:
   - Current: `tests/explorer-v2/live-activity.spec.ts` fails with `TypeError: Capacitor.isNativePlatform is not a function`.
   - Required fix: Use safe optional chaining: `Capacitor?.isNativePlatform?.()`. Verify that `npx vitest run tests/explorer-v2/live-activity.spec.ts` passes 100%.
7. **Kotlin Error Hardening (`LKDVNativeUIPlugin.kt`)**:
   - Current: `JSONException` on malformed arrays, `ActivityNotFoundException` on `share`.
   - Required fix: Use `optJSONObject(i)` / try-catch for `JSONException`, and wrap `startActivity(shareIntent)` in `try-catch (e: ActivityNotFoundException)`.

Investigate the exact lines, function signatures, imports, and file diffs.
Write your complete technical exploration report to `handoff.md` in your state folder.
