# Handoff Report: Lot 2 Native iOS Swift & Android Material 3 Parity Verification

**Agent**: teamwork_challenger_lot2_native  
**Date**: 2026-11-13T23:14:00Z  
**Role**: critic, specialist (Empirical Challenger)  
**Recipient**: teamwork_orchestrator (Conversation ID: `59615597-1e96-4de1-9730-9299e1e6ef8c`)  
**Verdict**: **`REQUEST_CHANGES`**  

---

## 1. Observation

### 1.1 Verbatim Test Failure in `tests/explorer-v2/live-activity.spec.ts`
Command executed:
```bash
npx vitest run tests/explorer-v2/live-activity.spec.ts
```
Output:
```text
 FAIL  tests/explorer-v2/live-activity.spec.ts > explorer-v2 · Live Activity (pont web) > ne fait rien sur le web et ne lève jamais
AssertionError: promise rejected "TypeError: __vite_ssr_import_0__.Capacito…" instead of resolving
 ❯ tests/explorer-v2/live-activity.spec.ts:40:48
     38|   it('ne fait rien sur le web et ne lève jamais', async () => {
     39|     const mod = await import('@/features/explorer-v2/native/liveActivity');
     40|     await expect(mod.isLiveActivitySupported()).resolves.toBe(false);
       |                                                ^
     41|     await expect(
     42|       mod.startLiveActivity({

Caused by: TypeError: Capacitor.isNativePlatform is not a function
 ❯ supportsLiveTracking src/features/explorer-v2/native/liveActivity.ts:36:18
 ❯ Module.isLiveActivitySupported src/features/explorer-v2/native/liveActivity.ts:43:8
 ❯ tests/explorer-v2/live-activity.spec.ts:40:22
```

In `src/features/explorer-v2/native/liveActivity.ts` (lines 35-39):
```ts
function supportsLiveTracking(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}
```
In git diff between origin and working tree, `src/features/explorer-v2/native/liveActivity.ts` previously checked `if (Capacitor.getPlatform() !== 'ios') return false;`. Worker Lot 2 introduced `if (!Capacitor.isNativePlatform()) return false;` without optional chaining (`Capacitor?.isNativePlatform?.()`). When `Capacitor.isNativePlatform` is undefined (such as on web mock environments), this throws `TypeError: Capacitor.isNativePlatform is not a function`.

### 1.2 TypeScript Facade Disconnection for Android Native UI in `src/lib/native/ui.ts`
In `src/lib/native/ui.ts` lines 41-53:
```ts
/** Returns true when running on iOS or Android within Capacitor without route exclusion. */
export function supportsNativeUI(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}

export function supportsNativeIOSUI(path?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isNativePlatform()) return false;
  const currentPath = path ?? window.location.pathname;
  return currentPath !== '/compas' && !currentPath.startsWith('/compas/');
}
```
Grep verification across the codebase:
```bash
grep -rn "supportsNativeUI" src/ tests/
# Result: src/lib/native/ui.ts:41:export function supportsNativeUI(): boolean { (0 callers)
```
In contrast, all 12 native UI methods in `src/lib/native/ui.ts`:
- `presentNativeActions` (line 73)
- `presentNativePrompt` (line 89)
- `hasNativeDatePicker` (line 101)
- `presentNativeDate` (line 110)
- `hasNativeChoices` (line 122)
- `presentNativeChoices` (line 131)
- `hasNativePhotos` (line 145)
- `pickNativePhotos` (line 158)
- `hasNativeGPXFiles` (line 185)
- `importNativeGPX` (line 203)
- `exportNativeGPX` (line 215)
- `shareNativeURL` (line 225)
- AND `src/components/ui/dialogs.ts` (`lkvConfirm`, `lkvPromptAsync`, `lkvAlert`)

ALL call `supportsNativeIOSUI()`.
Because `supportsNativeIOSUI()` explicitly checks `Capacitor.getPlatform() !== 'ios'`, on Android it always returns `false`. Consequently, NONE of the Android Kotlin native UI dialogs, pickers, or bridges implemented in `LKDVNativeUIPlugin.kt` can ever be reached by the web/TypeScript application on Android.

### 1.3 AST & Exact String Observations in `SceneDelegate.swift`
In `ios/App/App/SceneDelegate.swift`:
- `guard let data = try? Data(contentsOf: url)` and `self.error = "Impossible de lire le fichier GPX."` are in `LKDVNativeGPXImportView` (lines 808 & 815), NOT `LKDVNativeGPXExportView`.
- The variable name in `LKDVNativeGPXImportView` is `@State private var error: String?`, so the exact statement is `self.error = "Impossible de lire le fichier GPX."` (not `self.errorMessage`).
- In `LKDVNativeGPXExportView` (lines 828-890), error handling is implemented as:
  - `@State private var saveError: String?`
  - `.alert("Échec de l’enregistrement", ...)`
  - `Button("Réessayer") { saveError = nil; showExporter = true }`
  - `saveError = "Impossible d’enregistrer le fichier GPX. Vérifiez le stockage ou iCloud, puis réessayez. Détail : \(error.localizedDescription)"`

### 1.4 Xcode Project Configuration & Swift Toolchain
- `plutil -lint ios/App/App.xcodeproj/project.pbxproj`: returned `OK`.
- Target `LkdvWidgetsExtension` (UUID: `B80000072C00000000000007`) and its build file `LkdvLiveActivityWidget.swift in Sources` (UUID: `B80000012C00000000000001`, FileRef: `B80000022C00000000000002`) are valid and balanced.
- `xcodebuild -project ios/App/App.xcodeproj -list`: succeeded with exit code 0. Targets `App` and `LkdvWidgetsExtension` recognized; SPM package dependencies resolved cleanly.
- `xcodebuild -project ios/App/App.xcodeproj -scheme LkdvWidgetsExtension -showBuildSettings`: succeeded with exit code 0.
- `xcrun -sdk iphonesimulator swiftc -parse ios/LkdvWidgetsExtension/LkdvLiveActivityWidget.swift ios/App/App/LiveActivity/LkdvLiveActivityAttributes.swift`: succeeded with exit code 0.
- `xcrun -sdk iphonesimulator swiftc -parse ios/App/App/SceneDelegate.swift`: succeeded with exit code 0.

### 1.5 Android Kotlin Observations
- `AndroidManifest.xml`:
  - `LiveOutingNotificationService` is declared with `android:foregroundServiceType="location"` and `android:exported="false"`.
  - Required permissions declared: `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `USE_BIOMETRIC`, `VIBRATE`.
- `LiveOutingNotificationService.kt`:
  - `startAsForeground()` handles API 29+ (`ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION`) vs older APIs.
  - `PendingIntent` uses `FLAG_IMMUTABLE` on API 23+.
  - Notification channel uses `NotificationManager.IMPORTANCE_LOW`.
- `LKDVAndroidTabBarHost.kt`:
  - Capsule 28dp radius background with token colors `#E6FBFAF6` and `#2417402C`.
  - Keyboard listener correctly uses `ViewCompat.setOnApplyWindowInsetsListener`.
  - Haptic feedback on tab selection uses `HapticFeedbackConstants.CLOCK_TICK`.
- `LKDVNativeUIPlugin.kt`:
  - Potential unhandled `JSONException`: `actionsArray.getJSONObject(i)` (line 61) and `optionsArray.getJSONObject(i)` (line 149) can throw uncaught `JSONException` if invalid arrays are passed across the bridge.
  - `share` (lines 227-243): calls `activity.startActivity(shareIntent)` without `try-catch` for `ActivityNotFoundException`.
  - `exportGPX` (lines 264-282): writes directly to `activity.cacheDir` rather than opening a Storage Access Framework (SAF) document picker.

### 1.6 Route Eligibility & Platform Fallback Empirical Results
Adversarial test runner executed with `npx tsx`:
- SSR environment: `supportsNativeUI()` returns `false`, `supportsNativeIOSUI()` returns `false`.
- Platform `'web'`: returns `false` safely.
- Non-native platforms (`'electron'`, `'windows'`, `'macos'`, `''`): all return `false` safely.
- `/compas` routing:
  - `isProtectedCompasRoute('/compas')`: `false`.
  - `shouldShowNativeGlass('/compas')`: `true`.
  - `shouldShowNativeGlass('/compas/preparer')`: `true`.
  - `getNativeGlassDestination('/compas')`: `'adventures'`.
  - In `NavigationBar.tsx`: `eligible = iosNative && shouldShowNativeGlass(pathname)` -> native TabBar IS active on `/compas` on iOS and Android.
- Blacklisted full-screen routes (`/connexion`, `/inscription`, `/checkout`, `/kit-studio`): all return `shouldShowNativeGlass: false` and `destination: null`.

---

## 2. Logic Chain

1. **Step 1 (Test Regression)**: Observation 1.1 demonstrates that running `npx vitest run tests/explorer-v2/live-activity.spec.ts` fails with an uncaught `TypeError: Capacitor.isNativePlatform is not a function`. The git diff confirms this regression was introduced during Lot 2 in `src/features/explorer-v2/native/liveActivity.ts`.
2. **Step 2 (Invariant Violation)**: The interface contract in `src/features/explorer-v2/native/liveActivity.ts` states: *"Sur le Web : No-op gracieux"* and *"un suivi live ne doit jamais faire échouer le suivi principal"*. Under Node/browser environments where `Capacitor` does not expose `isNativePlatform`, unhandled exceptions are thrown. Furthermore, Worker Lot 2's handoff states an Invalidation Condition: *"Any failure in the Vitest test suites."*
3. **Step 3 (Android UI Facade Gap)**: Observation 1.2 establishes that while Worker Lot 2 wrote Android Kotlin UI plugins in `LKDVNativeUIPlugin.kt`, the TypeScript bridge facade (`src/lib/native/ui.ts`) was never updated to invoke them. Every native dialog/prompt/picker in `src/lib/native/ui.ts` still invokes `supportsNativeIOSUI()`, which blocks Android (`getPlatform() !== 'ios'`). The newly introduced `supportsNativeUI()` function has 0 callers in the entire codebase.
4. **Step 4 (Xcode & Swift Stability)**: Observation 1.4 confirms that the Xcode project file is structurally sound, `LkdvWidgetsExtension` is correctly embedded as an app extension with consistent UUIDs, and both Swift files parse with zero errors under `xcrun -sdk iphonesimulator swiftc`.
5. **Step 5 (Verdict Assessment)**: Because a Vitest test in the repository is actively broken due to Lot 2 modifications, and Android Native UI methods are unreachable from the TypeScript application, the deliverable cannot be approved as-is.

---

## 3. Caveats

1. **Local Machine Environment**:
   - The macOS test runner lacks a Java Runtime Environment (`Unable to locate a Java Runtime`), preventing `./gradlew` execution on this machine. Kotlin code quality was evaluated via rigorous static analysis of lifecycle, threading, nullability, and manifest declarations.
2. **Xcode Full Simulator Build**:
   - Full Simulator linking of the host `App` requires codesigning identities / full simulator runtimes, which are tested in CI. Scheme inspection (`-showBuildSettings`) and AST parsing (`swiftc -parse`) validated syntax and configuration.
3. **Intentional Scope Constraints**:
   - `tests/native/native-ui-bridge.spec.ts` line 69 explicitly tests that `supportsNativeIOSUI()` returns `false` on Android and `/compas`. When wiring `supportsNativeUI()` for Android, tests checking `supportsNativeIOSUI` must be distinguished from general `supportsNativeUI` checks.

---

## 4. Conclusion

**Verdict**: **`REQUEST_CHANGES`**

The following changes are required before Lot 2 can be approved:

1. **Fix `src/features/explorer-v2/native/liveActivity.ts`**:
   - Replace `if (!Capacitor.isNativePlatform()) return false;` with safe optional chaining:
     ```ts
     function supportsLiveTracking(): boolean {
       if (!Capacitor?.isNativePlatform?.()) return false;
       const platform = Capacitor.getPlatform?.();
       return platform === 'ios' || platform === 'android';
     }
     ```
   - Ensure `npx vitest run tests/explorer-v2/live-activity.spec.ts` passes 100%.

2. **Reconcile TypeScript Facade in `src/lib/native/ui.ts` for Android**:
   - Connect the generic `supportsNativeUI()` check to the common dialog functions (`presentNativeActions`, `presentNativePrompt`, `presentNativeDate`, `presentNativeChoices`, `openBrowser`, `shareNativeURL`) so Android users actually benefit from `LKDVNativeUIPlugin.kt`.
   - Preserve `supportsNativeIOSUI` as an iOS-specific helper where appropriate, or update tests to test both facades cleanly.

3. **Harden Android Kotlin Edge Cases in `LKDVNativeUIPlugin.kt`**:
   - In `presentActions` and `presentChoices`: use `optJSONObject(i)` or wrap array parsing in `try { ... } catch (e: JSONException)`.
   - In `share`: wrap `activity.startActivity(shareIntent)` in `try { ... } catch (e: ActivityNotFoundException)`.

---

## 5. Verification Method

To independently verify after changes are applied:

```bash
# 1. Verify the failing live activity test passes
npx vitest run tests/explorer-v2/live-activity.spec.ts

# 2. Verify native bridge tests
npx vitest run tests/native/

# 3. Verify design governance tests (53 files, 569 tests)
npx vitest run tests/design/ src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/

# 4. Verify mobile nav routing tests
npx vitest run src/components/mobile-nav/__tests__/

# 5. Verify static TypeScript types
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit

# 6. Verify Xcode project file integrity
plutil -lint ios/App/App.xcodeproj/project.pbxproj
```

**Invalidation Conditions**:
- Any failing test in `tests/explorer-v2/live-activity.spec.ts`.
- Any TypeScript diagnostic error under `npx tsc --noEmit`.
- Inability of Android platforms to invoke native UI dialogs through `src/lib/native/ui.ts`.
