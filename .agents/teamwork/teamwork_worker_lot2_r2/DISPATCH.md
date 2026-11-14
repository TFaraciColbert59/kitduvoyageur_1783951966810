# DISPATCH Task: Worker Lot 2 R2 (Remediation Implementation)

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2_r2`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
Remediation Plan (MANDATORY TO FOLLOW): `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2_rep/handoff.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Boundaries & Write Ownership
You exclusively own:
- `android/app/src/main/java/com/lekitduvoyageur/app/LKDVNativeUIPlugin.kt`
- `ios/App/App/SceneDelegate.swift`
- `ios/App/App/Info.plist`
- `src/lib/native/ui.ts`
- `src/components/ui/dialogs.ts`
- `src/components/NativeAppBootstrap.tsx`
- `src/features/explorer-v2/native/liveActivity.ts`
- `tests/native/native-ui-bridge.spec.ts`
- `tests/native/native-files.test.ts`

## Tasks to Implement (Follow `teamwork_explorer_lot2_r2_rep/handoff.md` verbatim)
1. **Android `BiometricPrompt` in `LKDVNativeUIPlugin.kt`**:
   - Replace dummy stub in `authenticateBiometric` with real `androidx.biometric.BiometricPrompt` on `activity as FragmentActivity` via `ContextCompat.getMainExecutor`. Return genuine success/failure/errorCode.
2. **iOS `LAContext` Face ID / Touch ID in `SceneDelegate.swift` and `Info.plist`**:
   - Add `import LocalAuthentication` in `SceneDelegate.swift`.
   - Register `CAPPluginMethod(name: "authenticateBiometric", returnType: CAPPluginReturnPromise)` in `LKDVNativeUIPlugin.pluginMethods`.
   - Implement `authenticateBiometric` using `LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: ...)`.
   - Update `getCapabilities` to check `LAContext().canEvaluatePolicy(...)`.
   - Add `NSFaceIDUsageDescription` in `ios/App/App/Info.plist`.
3. **Android Photo & File Pickers in `LKDVNativeUIPlugin.kt`**:
   - Implement real `Intent(Intent.ACTION_GET_CONTENT)` for photos with `@ActivityCallback private fun photosCallback` and Base64 conversion.
   - Implement real `Intent(Intent.ACTION_OPEN_DOCUMENT)` for GPX files with `@ActivityCallback private fun importGPXCallback`.
   - Update `getCapabilities` with real biometric check via `BiometricManager`.
4. **Android GPX Export in `LKDVNativeUIPlugin.kt`**:
   - Write GPX to `activity.cacheDir`, obtain URI with `FileProvider.getUriForFile`, create chooser with `Intent.ACTION_SEND` and `FLAG_GRANT_READ_URI_PERMISSION`.
5. **TypeScript Facade Wiring**:
   - In `src/lib/native/ui.ts`: Add `authenticateBiometric` to `NativeUIPlugin` interface. Wire `supportsNativeUI()` across all bridge functions (`presentNativeActions`, `presentNativePrompt`, `hasNativeDatePicker`, `presentNativeDate`, `hasNativeChoices`, `presentNativeChoices`, `hasNativePhotos`, `pickNativePhotos`, `hasNativeGPXFiles`, `importNativeGPX`, `exportNativeGPX`, `shareNativeURL`, `authenticateNativeBiometric`). Retain `supportsNativeIOSUI` for backward compatibility.
   - In `src/components/ui/dialogs.ts`: Use `supportsNativeUI()`.
   - In `src/components/NativeAppBootstrap.tsx`: Use `supportsNativeUI()`.
   - In `tests/native/native-ui-bridge.spec.ts` & `tests/native/native-files.test.ts`: Reconcile tests per explorer specification.
6. **Live Activity Safe Optional Chaining**:
   - In `src/features/explorer-v2/native/liveActivity.ts`: Replace `!Capacitor.isNativePlatform()` with `!Capacitor?.isNativePlatform?.()` and `Capacitor.getPlatform?.()`.
   - Ensure `npx vitest run tests/explorer-v2/live-activity.spec.ts` passes 100%.
7. **Kotlin Hardening**:
   - In `LKDVNativeUIPlugin.kt`: Use `optJSONObject(i)` in `presentActions` and `presentChoices`. Catch `ActivityNotFoundException` in `share`.
   - Replace `EditText` in `presentDate` with genuine Material 3 `MaterialDatePicker`.

## Verification Commands to Run & Pass
1. `npx vitest run tests/explorer-v2/live-activity.spec.ts`
2. `npx vitest run tests/native/`
3. `npx vitest run tests/design/`
4. `npx vitest run src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/`
5. `npx vitest run src/components/mobile-nav/__tests__/`
6. `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`
7. `plutil -lint ios/App/App/Info.plist`
8. `plutil -lint ios/App/App.xcodeproj/project.pbxproj`

Write your complete report to `handoff.md` in your state folder and send a completion message back.


## 2026-11-13T23:48:21Z
Implement the Lot 2 R2 technical remediation for Android Kotlin, iOS Swift, and TypeScript native bridges.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2_r2
Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
Original user request: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
Remediation Plan: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_r2_rep/handoff.md
Task dispatch details: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2_r2/DISPATCH.md
