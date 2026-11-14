# DISPATCH: Lot 2 — Native Apple Swift + Android Material 3 + Web Primitives Unification

## Date: 2026-11-13T22:39:00Z
## Agent: teamwork_worker_lot2
## Role: Native and Web Primitives Implementer

### Context & Inputs
- Master Plan: `/Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/implementation_plan.md` (Lot 2 §4, §6.3)
- Original Request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
- Design Bank: `src/design/bank.ts` and generated tokens
- Explorer Native Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_native/handoff.md`
- Explorer Web Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_explorer_lot2_web/handoff.md`

---

### Scope & Tasks

#### 1. iOS Native Maxing
1. **SceneDelegate.swift**:
   - In `LKDVBridgeViewController.capacitorDidLoad()`: register `bridge?.registerPluginInstance(LkdvLiveActivityPlugin())`.
   - In `LKDVNativeTabBarHost.setVisible`: change `guard #available(iOS 26.0, *)` to `guard #available(iOS 16.0, *)`. Configure `tabBar.standardAppearance` and `scrollEdgeAppearance` with `UIBlurEffect(style: .systemUltraThinMaterialLight)` and stone background `#FBFAF6` with 85% alpha and `--glass-rim-color` shadow (`rgba(23,43,36,0.14)`).
   - In `SceneDelegate.swift`: remove `/compas` exclusion (`isNativeUIExcluded` returns `false`).
   - IMPORTANT: Preserve the exact `LKDVNativeGPXExportView` error handling structure tested in `tests/native/native-files.test.ts`.
2. **ActivityKit Dynamic Island Target (`LkdvWidgetsExtension`)**:
   - Create `ios/LkdvWidgetsExtension/Info.plist` (with `com.apple.widgetkit-extension`).
   - Create `ios/LkdvWidgetsExtension/LkdvLiveActivityWidget.swift` (implementing `LkdvWidgetsBundle`, `LkdvLiveActivityWidget`, `ActivityConfiguration(for: LkdvLiveActivityAttributes.self)` with compact leading/trailing/minimal and expanded Dynamic Island regions, plus lock screen view).
   - Configure Xcode project (`ios/App/App.xcodeproj/project.pbxproj`) to include the `LkdvWidgetsExtension` target embedded in `App.app/PlugIns`.

#### 2. Android Material 3 Parity
1. **Gradle & Manifest**:
   - In `android/build.gradle`: declare Kotlin Gradle plugin `org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24`.
   - In `android/app/build.gradle`: apply `kotlin-android`, add dependencies for `material:1.12.0`, `biometric:1.2.0-alpha05`, `browser:1.8.0`, `activity-ktx`, `fragment-ktx`, `kotlin-stdlib`.
   - In `android/app/src/main/res/values/styles.xml`: configure `AppTheme` with `Theme.Material3.Light.NoActionBar` using `@color/lkdv_surface_canvas`, `@color/lkdv_brand_action`, etc.
   - In `android/app/src/main/AndroidManifest.xml`: add permissions (`POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `USE_BIOMETRIC`, `VIBRATE`) and declare `LiveOutingNotificationService`.
2. **Kotlin Implementation**:
   - In `android/app/src/main/java/com/lekitduvoyageur/app/`:
     - Implement `LKDVAndroidTabBarHost.kt`: floating capsule `NavigationBarView` with corner radius 28dp (`@dimen/lkdv_radius_card`), unlabeled items, haptic tick, keyboard auto-hide, 5 destinations (`adventures`, `explorer`, `community`, `messages`, `me`).
     - Implement `LKDVAccountTabBarPlugin.kt`: Capacitor plugin handling `setVisible` and emitting `tabSelected`.
     - Implement `LiveOutingNotificationService.kt`: Ongoing foreground service with chronometer, km, D+, pause/resume action.
     - Implement `LkdvLiveActivityPlugin.kt`: Android version of Live Activity plugin bridging `isSupported`, `start`, `update`, `end` to `LiveOutingNotificationService`.
     - Implement `LKDVNativeUIPlugin.kt`: Material 3 dialogs, prompt, single-choice, photo picker, GPX import/export, Chrome Custom Tabs, biometric auth.
     - Update `MainActivity.kt` (or `MainActivity.java`) to initialize `LKDVAndroidTabBarHost` and register plugins on the Capacitor bridge.

#### 3. TypeScript Native Facades
1. **src/lib/native/ui.ts**:
   - Expand `supportsNativeUI` to support both `ios` and `android`.
   - Remove `/compas` exclusions.
   - Preserve backward-compatible alias `supportsNativeIOSUI`.
2. **src/components/mobile-nav/nativeAccountRoutes.ts**:
   - Remove `isProtectedCompasRoute` and allow `/compas` in `shouldShowNativeGlass`.
3. **src/components/mobile-nav/NavigationBar.tsx**:
   - Support native TabBar on both iOS and Android.
4. **src/features/explorer-v2/native/liveActivity.ts**:
   - Support both iOS and Android platforms.

#### 4. Web Primitives Unification
1. **Unified Sheet / DrawerShell**:
   - Update `src/components/ui/Sheet.tsx` & `src/components/ui/drawer/DrawerShell.tsx`.
   - 3 canonical snaps (`collapsed` 18dvh / peek, `half` 55dvh, `expanded` 90dvh).
   - Preserves backward compatibility of exports (`DRAWER_SHELL_CSS`, `DrawerShell`, `DrawerTab`, `DrawerSecondaryItem`, `DrawerEmpty`, `DrawerError`, `DrawerSkeleton`).
   - Replace duplicated `src/components/compte/drawer/shell/DrawerShell.tsx` with a clean re-export of `src/components/ui/drawer/DrawerShell.tsx`.
2. **Unified SegmentedControl**:
   - Create `src/components/ui/SegmentedControl.tsx`.
   - Sizes: `default` (48px) and `sm` (30px).
   - Apple HIG sliding glass active indicator (`.sel-lens` / `.ig-th.lens`).
   - Icons first, accessible ARIA, haptic feedback.
   - Backwards compatibility exports in `CapsuleTabs.tsx`, `Tabs.tsx`, `SubTabBar.tsx`.
3. **Unified DynamicIslandHost**:
   - Create `src/components/ui/DynamicIslandHost.tsx` & `src/lib/dynamic-island.ts`.
   - Position: `top: calc(env(safe-area-inset-top, 0px) + 8px)`.
   - `z-index: var(--z-alert, 700)` (above sheets at 500 and modals at 600).
   - 100% Light Mode Liquid Glass: sauge/white, zero `#000`/`#121815`.
   - Compact and Expanded states, auto-dismiss, undo/action callbacks.
   - Mount in `src/app/layout.tsx`.
4. **Toast & Dialogs Repair (`lkvAlert`)**:
   - Remove unused `react-hot-toast` from `src/components/ui/dialogs.ts`.
   - Create `src/components/ui/ToastHost.tsx` mounted in `src/app/layout.tsx` at `z-index: var(--z-alert, 700)`.
   - Route `lkvAlert` to native dialogs on iOS/Android or `ToastHost` on Web.

---

### Verification Commands
Your handoff report MUST document the execution and output of:
1. `npx vitest run tests/design/` (all 47 suites passing)
2. `npx vitest run tests/native/`
3. `npx vitest run src/components/ui/drawer/__tests__/ src/components/compte/drawer/shell/__tests__/`
4. `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` (0 errors)
5. `git status` summary

---

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
