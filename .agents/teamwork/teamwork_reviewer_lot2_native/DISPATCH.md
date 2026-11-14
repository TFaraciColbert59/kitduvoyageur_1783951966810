# DISPATCH Task: Reviewer Lot 2 Native (iOS Swift & Android M3 Parity)

## Context
Working directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
State folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot2_native`
Scope document: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md`
Original request: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md`
Worker Lot 2 Report: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2/handoff.md`

## Mission
Review the Native implementation of Lot 2:
1. iOS Swift:
   - `ios/App/App/SceneDelegate.swift`: Registration of `LkdvLiveActivityPlugin`, `#available(iOS 16.0, *)` with `UITabBarAppearance` configured for Liquid Glass (`systemUltraThinMaterialLight` blur, `#FBFAF6` stone background at 85% opacity, rim shadow `rgba(23,43,36,0.14)`). Verification that `/compas` route is no longer excluded. Verification of `LKDVNativeGPXExportView` error handling structure.
   - `ios/LkdvWidgetsExtension/`: `Info.plist` and `LkdvLiveActivityWidget.swift` (Dynamic Island compact/expanded/minimal, lock screen). Project PBX configuration in `ios/App/App.xcodeproj/project.pbxproj` and `plutil -lint`.
2. Android Kotlin Material 3:
   - `android/build.gradle` and `android/app/build.gradle`: Kotlin 1.9.24, `kotlin-android`, `material:1.12.0`, `biometric:1.2.0-alpha05`, `browser:1.8.0`, `activity-ktx`, `fragment-ktx`, `kotlin-stdlib`.
   - `android/app/src/main/res/values/styles.xml`: `Theme.Material3.Light.NoActionBar` with design tokens.
   - `android/app/src/main/AndroidManifest.xml`: Permissions and `LiveOutingNotificationService`.
   - `android/app/src/main/java/com/lekitduvoyageur/app/`: `LKDVAndroidTabBarHost.kt` (capsule M3 tab bar with 28dp radius, haptic tick, keyboard hide), `LKDVAccountTabBarPlugin.kt`, `LiveOutingNotificationService.kt`, `LkdvLiveActivityPlugin.kt`, `LKDVNativeUIPlugin.kt`, `MainActivity.kt`.
3. TypeScript Facades:
   - `src/lib/native/ui.ts`: `supportsNativeUI` for iOS & Android, `/compas` unblocked.
   - `src/components/mobile-nav/nativeAccountRoutes.ts`: removal of `isProtectedCompasRoute`, allowing `/compas` in `shouldShowNativeGlass`.
   - `src/components/mobile-nav/NavigationBar.tsx`: native tab bar handling.
   - `src/features/explorer-v2/native/liveActivity.ts`: cross-platform Live Activity manager.
4. Independent verification:
   - Run tests: `npx vitest run tests/native/`, `npx vitest run src/components/mobile-nav/__tests__/`, `plutil -lint ios/App/App.xcodeproj/project.pbxproj`, `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`.
5. Write your report in `handoff.md` with verdict: `APPROVE` or `REQUEST_CHANGES`.


## 2026-11-13T23:04:27Z
Review the Native iOS Swift & Android Kotlin Material 3 implementation of Lot 2.
Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
State folder: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot2_native
Scope document: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
Original user request: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
Worker Lot 2 Report: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_worker_lot2/handoff.md
Task dispatch details: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/teamwork_reviewer_lot2_native/DISPATCH.md
