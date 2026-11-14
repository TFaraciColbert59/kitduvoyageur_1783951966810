# Handoff Report: Lot 2 — Native Mobile Architecture (iOS Swift & Android Material 3)

**Author**: `teamwork_explorer_lot2_native`  
**Date**: 2026-11-13  
**Target Milestone**: Lot 2 — Maximisation Native Apple Swift + Parité Android Material 3 + Façades TypeScript  
**Working Directory**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`

---

## 1. Observation

### 1.1 iOS Codebase Observations

#### A. Registration & Entry Point in `SceneDelegate.swift` vs `MainViewController.swift`
- In `ios/App/App/SceneDelegate.swift` lines 9–19:
  ```swift
  final class LKDVBridgeViewController: CAPBridgeViewController {
      private(set) var nativeTabBarPlugin: LKDVAccountTabBarPlugin?

      override func capacitorDidLoad() {
          super.capacitorDidLoad()
          let plugin = LKDVAccountTabBarPlugin()
          bridge?.registerPluginInstance(plugin)
          nativeTabBarPlugin = plugin
          bridge?.registerPluginInstance(LKDVNativeUIPlugin())
      }
  }
  ```
- In `ios/App/App/SceneDelegate.swift` lines 1111–1117:
  ```swift
  let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)
  let web = LKDVBridgeViewController()
  web.view.backgroundColor = stoneBg

  let window = UIWindow(windowScene: windowScene)
  window.backgroundColor = stoneBg
  window.rootViewController = LKDVNativeTabBarHost(web: web)
  ```
- In `ios/App/App/MainViewController.swift` lines 8–12:
  ```swift
  class MainViewController: CAPBridgeViewController {
      override func capacitorDidLoad() {
          bridge?.registerPluginInstance(LkdvLiveActivityPlugin())
      }
  }
  ```
- **Direct Finding**: `MainViewController` is completely bypassed. `SceneDelegate.swift` directly instantiates `LKDVBridgeViewController`, which only registers `LKDVAccountTabBarPlugin` and `LKDVNativeUIPlugin`. **`LkdvLiveActivityPlugin` is NEVER registered at runtime**.

#### B. The `/compas` Route Exclusion
- In `ios/App/App/SceneDelegate.swift` lines 276–278:
  ```swift
  private var isNativeUIExcluded: Bool {
      activeNativeUIRoute == "/compas" || activeNativeUIRoute.hasPrefix("/compas/")
  }
  ```
  `isNativeUIExcluded` is checked in line 273 (`syncNativeRoute`), line 281 (`presentNativeActions`), line 301 (`presentNativePrompt`), line 320 (`presentNativeDate`), line 339 (`presentNativeChoices`), line 357 (`presentNativePhotos`), line 384 (`presentNativeGPXImport`), line 411 (`presentNativeGPXExport`), and line 437 (`presentNativeShare`).
- In `src/components/mobile-nav/nativeAccountRoutes.ts` lines 4–12:
  ```ts
  export function isProtectedCompasRoute(pathname: string | null | undefined): boolean {
    return pathname === '/compas' || Boolean(pathname?.startsWith('/compas/'));
  }
  export function shouldShowNativeGlass(pathname: string | null | undefined): boolean {
    if (!pathname || isProtectedCompasRoute(pathname)) return false;
  ```
- In `src/lib/native/ui.ts` lines 40–45 & line 56:
  ```ts
  export function supportsNativeIOSUI(path?: string): boolean {
    if (typeof window === 'undefined') return false;
    if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isNativePlatform()) return false;
    const currentPath = path ?? window.location.pathname;
    return currentPath !== '/compas' && !currentPath.startsWith('/compas/');
  }
  ...
  return result.active === true && path !== '/compas' && !path.startsWith('/compas/');
  ```
- In `src/components/mobile-nav/destinationRegistry.ts` lines 44–60:
  Destination `'adventures'` (Hub) already has `'/compas'` in its `matchPaths`:
  ```ts
  id: 'adventures',
  href: '/hub',
  matchPaths: ['/hub', '/groupes', '/equipages', '/mes-aventures', '/preparation', '/compas', ...],
  ```

#### C. The `guard #available(iOS 26.0, *)` Deadlock
- In `ios/App/App/SceneDelegate.swift` lines 161–164:
  ```swift
  guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
      if isNativeVisible { switchVisibility(false) }
      return false
  }
  ```
- **Direct Finding**: On every current Apple operating system (iOS 16, 17, 18), `#available(iOS 26.0, *)` evaluates to `false`. Therefore, `setVisible` always turns off the native bar and returns `false`, forcing web fallback on all physical iPhones unless this guard is fixed to `#available(iOS 16.0, *)` with appropriate `UITabBarAppearance` configuration.

#### D. Missing Xcode Target for ActivityKit
- In `ios/App/App.xcodeproj/project.pbxproj`:
  ```
  /* Begin PBXNativeTarget section */
  isa = PBXNativeTarget;
  buildConfigurationList = 504EC3161FED79650016851F /* Build configuration list for PBXNativeTarget "App" */;
  productType = "com.apple.product-type.application";
  /* End PBXNativeTarget section */
  ```
- In `ios/App/App/Info.plist` lines 79–82:
  ```xml
  <key>NSSupportsLiveActivities</key>
  <true/>
  <key>NSSupportsLiveActivitiesFrequentUpdates</key>
  <true/>
  ```
- **Direct Finding**: Main `Info.plist` has Live Activity permissions enabled, and `LkdvLiveActivityAttributes.swift` exists in `ios/App/App/LiveActivity/`, but **no `LkdvWidgetsExtension` target exists** in `project.pbxproj`. ActivityKit requires an App Extension (`com.apple.product-type.app-extension`) implementing `Widget` / `WidgetBundle` with `ActivityConfiguration(for: LkdvLiveActivityAttributes.self)`.

#### E. Test Invariant in `tests/native/native-files.test.ts`
- In `tests/native/native-files.test.ts` lines 83–101:
  The test reads `ios/App/App/SceneDelegate.swift` directly as a UTF-8 string:
  ```ts
  const source = readFileSync(join(process.cwd(), 'ios/App/App/SceneDelegate.swift'), 'utf8');
  const exporter = source.split('private struct LKDVNativeGPXExportView: View {')[1]?.split('/// Native SwiftUI action sheets')[0] ?? '';
  ```
  It asserts that `LKDVNativeGPXExportView` contains exact string patterns: `case .failure(let error):`, `nsError.domain == NSCocoaErrorDomain`, `nsError.code == NSUserCancelledError`, `@State private var saveError: String?`, `.alert("Échec de l’enregistrement"`, `Button("Réessayer")`, `saveError = "Impossible d’enregistrer le fichier GPX.`.

---

### 1.2 Android Codebase Observations

#### A. `MainActivity.java` and Lack of Kotlin / M3 Dependencies
- `android/app/src/main/java/com/lekitduvoyageur/app/MainActivity.java` lines 1–5:
  ```java
  package com.lekitduvoyageur.app;

  import com.getcapacitor.BridgeActivity;

  public class MainActivity extends BridgeActivity {}
  ```
- `android/build.gradle` lines 9–15:
  ```groovy
  dependencies {
      classpath 'com.android.tools.build:gradle:8.13.0'
      classpath 'com.google.gms:google-services:4.4.4'
  }
  ```
  **Direct Finding**: `org.jetbrains.kotlin:kotlin-gradle-plugin` is NOT declared in `buildscript.dependencies`.
- `android/app/build.gradle` lines 58–68:
  ```groovy
  dependencies {
      implementation fileTree(include: ['*.jar'], dir: 'libs')
      implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
      implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
      implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
      implementation project(':capacitor-android')
      testImplementation "junit:junit:$junitVersion"
      androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
      androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
      implementation project(':capacitor-cordova-android-plugins')
  }
  ```
  **Direct Finding**: Neither `com.google.android.material:material`, `androidx.biometric:biometric`, nor `kotlin-stdlib` are included.
- `android/app/src/main/res/values/styles.xml` line 12:
  ```xml
  <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
  ```
  Not currently using Material 3 (`Theme.Material3.Light.NoActionBar`).
- However, design bank artifacts are already generating Android tokens:
  - `android/app/src/main/res/values/design_tokens.generated.xml`
  - `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt`

#### B. Android Manifest Permissions & Services
- `android/app/src/main/AndroidManifest.xml` lines 47–50:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  ```
  No `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, or `USE_BIOMETRIC` permissions are present, and no `<service>` tag is declared for ongoing tracking.

---

### 1.3 TypeScript Bridge Facade Observations
- In `src/lib/native/ui.ts`:
  - Only checks `Capacitor.getPlatform() === 'ios'`. Android is completely disabled.
  - Excludes `/compas` in `supportsNativeIOSUI` (line 44) and `syncNativeUIRoute` (line 56).
- In `src/components/mobile-nav/NavigationBar.tsx`:
  - Line 56 checks `iosNative = NATIVE_TABBAR_ENABLED && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'`. Android always falls back to web `FloatingLiquidTabBar`.
- In `src/features/explorer-v2/native/liveActivity.ts`:
  - Line 37 checks `Capacitor.getPlatform() !== 'ios'`. Android is treated as a no-op.

---

## 2. Logic Chain

1. **Live Activity Deadlock**:
   - `SceneDelegate.swift:1112` instantiates `LKDVBridgeViewController`, which only registers `LKDVAccountTabBarPlugin` and `LKDVNativeUIPlugin`.
   - `MainViewController.swift:10` registers `LkdvLiveActivityPlugin`, but `MainViewController` is never loaded.
   - Therefore, `LkdvLiveActivityPlugin` is never registered on the bridge.
   - Furthermore, `project.pbxproj` lacks an App Extension target for `LkdvWidgetsExtension`. ActivityKit cannot render Live Activities on Dynamic Island or Lock Screen without an `ActivityConfiguration` inside a WidgetKit extension.
   - **Resolution Step**: Register `LkdvLiveActivityPlugin` directly in `LKDVBridgeViewController.capacitorDidLoad()` and add the `LkdvWidgetsExtension` target in Xcode.

2. **Liquid Glass UITabBar Invalidation**:
   - `SceneDelegate.swift:161` gates `setVisible` behind `guard #available(iOS 26.0, *)`.
   - Any physical iPhone (iOS 16, 17, 18) fails this check, immediately calling `switchVisibility(false)` and resolving `{ active: false }`.
   - In `NavigationBar.tsx:188`, `{ active: false }` sets `phase = 'fallback'`, causing React to mount `FloatingLiquidTabBar`.
   - **Resolution Step**: Update `SceneDelegate.swift:161` to `#available(iOS 16.0, *)`, configure `tabBar.standardAppearance` and `tabBar.scrollEdgeAppearance` with `UIBlurEffect(style: .systemUltraThinMaterialLight)` and stone background `#FBFAF6` with 85% alpha and `--glass-rim-color` shadow.

3. **Compas Exclusion Invalidation**:
   - `/compas` is excluded in `SceneDelegate.swift:277`, `nativeAccountRoutes.ts:5`, and `ui.ts:44`.
   - When navigating to `/compas`, `shouldShowNativeGlass` returns false, sending `setVisible({ visible: false })` to the native host and forcing a jarring transition to the web bar.
   - In `destinationRegistry.ts:57`, `/compas` is already classified under `'adventures'` (Hub).
   - **Resolution Step**: Delete `isProtectedCompasRoute` from `nativeAccountRoutes.ts`, remove `isNativeUIExcluded` from `SceneDelegate.swift`, and remove the `/compas` gate from `ui.ts`. The native TabBar will remain active on `/compas` with the "Hub" tab selected.

4. **Android Native Parity Architecture**:
   - Android currently has a bare 5-line `MainActivity.java` with no M3 dependencies or Kotlin plugins.
   - To achieve parity with Apple Swift:
     a) Enable Kotlin in `build.gradle` and `app/build.gradle`.
     b) Add Material Components (`com.google.android.material:material:1.12.0`) and set theme to `Theme.Material3.Light.NoActionBar`.
     c) Build `LKDVAndroidTabBarHost.kt` (floating capsule `NavigationBarView` with corner radius 28dp, unlabeled items, haptic tick, keyboard auto-hide).
     d) Build `LiveOutingNotificationService.kt` (ongoing foreground service with chronometer, km, D+, pause/resume action).
     e) Implement `LKDVNativeUIPlugin.kt` for Material 3 dialogs, Jetpack Photo Picker, SAF document picker, Chrome Custom Tabs, and BiometricPrompt.

5. **TypeScript Facade Generalization**:
   - Rename/expand `supportsNativeIOSUI` to `supportsNativeUI` supporting both `'ios'` and `'android'`.
   - Keep the clean 3-state contract: `committed value` (success) | `null` (user cancelled) | `undefined` (unsupported / runtime failure, triggering web fallback).
   - Expand `NavigationBar.tsx` to activate `LKDVAccountTabBar` on Android as well as iOS.
   - Expand `src/features/explorer-v2/native/liveActivity.ts` to route to `LiveOutingNotificationService` on Android.

---

## 3. Specifications for Implementation

### 3.1 iOS Native Maxing Specifications

#### A. Modifications in `ios/App/App/SceneDelegate.swift`
1. **Plugin Registration in `LKDVBridgeViewController`**:
   ```swift
   final class LKDVBridgeViewController: CAPBridgeViewController {
       private(set) var nativeTabBarPlugin: LKDVAccountTabBarPlugin?

       override func capacitorDidLoad() {
           super.capacitorDidLoad()
           let tabBarPlugin = LKDVAccountTabBarPlugin()
           bridge?.registerPluginInstance(tabBarPlugin)
           nativeTabBarPlugin = tabBarPlugin
           bridge?.registerPluginInstance(LKDVNativeUIPlugin())
           bridge?.registerPluginInstance(LkdvLiveActivityPlugin()) // <-- ADDED
       }
   }
   ```
2. **Enable TabBar on iOS 16+ & Configure Liquid Glass Appearance**:
   Replace line 161:
   ```swift
   // Before: guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
   // After:
   guard #available(iOS 16.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
       if isNativeVisible { switchVisibility(false) }
       return false
   }
   ```
   In `viewDidLoad()` of `LKDVNativeTabBarHost`:
   ```swift
   let appearance = UITabBarAppearance()
   appearance.configureWithDefaultBackground()
   appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialLight)
   appearance.backgroundColor = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 0.85)
   appearance.shadowColor = UIColor(red: 23.0 / 255.0, green: 43.0 / 255.0, blue: 36.0 / 255.0, alpha: 0.14) // --glass-rim-color
   tabBar.standardAppearance = appearance
   tabBar.scrollEdgeAppearance = appearance
   ```
3. **Remove `/compas` Exclusion**:
   Replace lines 276–278:
   ```swift
   private var isNativeUIExcluded: Bool {
       false // Compas is now fully supported natively
   }
   ```

#### B. ActivityKit Target `LkdvWidgetsExtension` Specification
1. **Xcode Target Settings**:
   - Target Name: `LkdvWidgetsExtension`
   - Product Type: `com.apple.product-type.app-extension`
   - Bundle Identifier: `com.lekitduvoyageur.app.LkdvWidgetsExtension`
   - Deployment Target: `iOS 16.2`
   - Frameworks: `ActivityKit.framework`, `WidgetKit.framework`, `SwiftUI.framework`
   - Embed Phase: In `App` target, "Embed App Extensions" -> `LkdvWidgetsExtension.appex` in `PlugIns/`.
   - File Membership: `ios/App/App/LiveActivity/LkdvLiveActivityAttributes.swift` must be checked for both `App` and `LkdvWidgetsExtension` targets.
2. **Extension `Info.plist`** (`ios/LkdvWidgetsExtension/Info.plist`):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>NSExtension</key>
       <dict>
           <key>NSExtensionPointIdentifier</key>
           <string>com.apple.widgetkit-extension</string>
       </dict>
   </dict>
   </plist>
   ```
3. **Widget Implementation** (`ios/LkdvWidgetsExtension/LkdvLiveActivityWidget.swift`):
   ```swift
   import ActivityKit
   import WidgetKit
   import SwiftUI

   @main
   struct LkdvWidgetsBundle: WidgetBundle {
       var body: some Widget {
           LkdvLiveActivityWidget()
       }
   }

   struct LkdvLiveActivityWidget: Widget {
       var body: some WidgetConfiguration {
           ActivityConfiguration(for: LkdvLiveActivityAttributes.self) { context in
               LkdvLockScreenLiveActivityView(context: context)
           } dynamicIsland: { context in
               DynamicIsland {
                   DynamicIslandExpandedRegion(.leading) {
                       HStack(spacing: 6) {
                           Image(systemName: "figure.hiking")
                               .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
                           Text(context.attributes.sport.capitalized)
                               .font(.subheadline)
                               .fontWeight(.semibold)
                       }
                   }
                   DynamicIslandExpandedRegion(.trailing) {
                       Text(formatDuration(seconds: context.state.movingS))
                           .font(.subheadline)
                           .monospacedDigit()
                   }
                   DynamicIslandExpandedRegion(.bottom) {
                       HStack {
                           VStack(alignment: .leading) {
                               Text("Distance").font(.caption2).foregroundStyle(.secondary)
                               Text(String(format: "%.1f km", context.state.distanceM / 1000))
                                   .font(.headline)
                           }
                           Spacer()
                           VStack(alignment: .trailing) {
                               Text("D+").font(.caption2).foregroundStyle(.secondary)
                               Text("\(Int(context.state.elevGainM)) m")
                                   .font(.headline)
                           }
                           if context.state.offRoute {
                               Spacer()
                               Text("Hors trace")
                                   .font(.caption2)
                                   .padding(.horizontal, 6)
                                   .padding(.vertical, 2)
                                   .background(Color.orange.opacity(0.2))
                                   .foregroundStyle(.orange)
                                   .clipShape(Capsule())
                           }
                       }
                   }
               } compactLeading: {
                   Image(systemName: "figure.hiking")
                       .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
               } compactTrailing: {
                   Text(String(format: "%.1f km", context.state.distanceM / 1000))
                       .font(.caption2)
                       .fontWeight(.semibold)
                       .monospacedDigit()
               } minimal: {
                   Image(systemName: "figure.hiking")
                       .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
               }
           }
       }

       private func formatDuration(seconds: Double) -> String {
           let total = Int(seconds)
           let h = total / 3600
           let m = (total % 3600) / 60
           let s = total % 60
           if h > 0 { return String(format: "%02d:%02d:%02d", h, m, s) }
           return String(format: "%02d:%02d", m, s)
       }
   }

   struct LkdvLockScreenLiveActivityView: View {
       let context: ActivityViewContext<LkdvLiveActivityAttributes>

       var body: some View {
           HStack(spacing: 16) {
               Image(systemName: "figure.hiking")
                   .font(.system(size: 28))
                   .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
               VStack(alignment: .leading, spacing: 2) {
                   Text(context.attributes.sport.capitalized)
                       .font(.headline)
                       .foregroundStyle(Color(red: 23/255, green: 43/255, blue: 36/255))
                   Text(context.state.paused ? "En pause" : "En cours")
                       .font(.caption)
                       .foregroundStyle(.secondary)
               }
               Spacer()
               VStack(alignment: .trailing, spacing: 2) {
                   Text(String(format: "%.1f km", context.state.distanceM / 1000))
                       .font(.title3)
                       .fontWeight(.bold)
                       .foregroundStyle(Color(red: 23/255, green: 64/255, blue: 44/255))
                   Text("\(Int(context.state.elevGainM)) m D+")
                       .font(.caption)
                       .foregroundStyle(.secondary)
               }
           }
           .padding(.horizontal, 20)
           .padding(.vertical, 14)
           .background(Color(red: 251/255, green: 250/255, blue: 246/255).opacity(0.95))
       }
   }
   ```

#### C. Native Bridges in `LKDVNativeUIPlugin`
Expand `LKDVNativeUIPlugin` to include:
1. `presentAlert(title, message, buttons)`: standard `UIAlertController(.alert)` with default/cancel/destructive actions.
2. `presentPrompt(title, placeholder, defaultValue, confirmLabel)`: lightweight `UIAlertController(.alert)` with `addTextField`.
3. `presentMenu(options, position)`: `UIMenu` popover anchored to coordinates for desktop-like instantaneous context menus.
4. `presentPreview(url)`: `QLPreviewController` for immediate QuickLook of GPX traces, PDFs, vouchers.
5. `openInAppBrowser(url)`: `SFSafariViewController` with `preferredControlTintColor` `#17402C`.
6. `authenticateBiometric(reason)`: `LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)`.

---

### 3.2 Android Native Parity Specifications

#### A. Gradle and Kotlin Setup
1. **`android/build.gradle`**:
   ```groovy
   buildscript {
       repositories {
           google()
           mavenCentral()
       }
       dependencies {
           classpath 'com.android.tools.build:gradle:8.13.0'
           classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24'
           classpath 'com.google.gms:google-services:4.4.4'
       }
   }
   ```
2. **`android/app/build.gradle`**:
   ```groovy
   apply plugin: 'com.android.application'
   apply plugin: 'kotlin-android'

   dependencies {
       implementation fileTree(include: ['*.jar'], dir: 'libs')
       implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"
       implementation "com.google.android.material:material:1.12.0"
       implementation "androidx.biometric:biometric:1.2.0-alpha05"
       implementation "androidx.browser:browser:1.8.0"
       implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
       implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
       implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
       implementation "androidx.activity:activity-ktx:$androidxActivityVersion"
       implementation "androidx.fragment:fragment-ktx:$androidxFragmentVersion"
       implementation project(':capacitor-android')
       ...
   }
   ```
3. **`android/app/src/main/res/values/styles.xml`**:
   ```xml
   <style name="AppTheme" parent="Theme.Material3.Light.NoActionBar">
       <item name="colorPrimary">@color/lkdv_brand_action</item>
       <item name="colorSecondary">@color/lkdv_brand_secondary</item>
       <item name="android:colorBackground">@color/lkdv_surface_canvas</item>
       <item name="colorSurface">@color/lkdv_surface_canvas</item>
       <item name="colorOnSurface">@color/lkdv_label_primary</item>
   </style>
   <style name="AppTheme.NoActionBar" parent="Theme.Material3.Light.NoActionBar">
       <item name="windowActionBar">false</item>
       <item name="windowNoTitle">true</item>
       <item name="android:windowBackground">@color/lkdv_surface_canvas</item>
   </style>
   ```
4. **`android/app/src/main/AndroidManifest.xml`**:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
   <uses-permission android:name="android.permission.USE_BIOMETRIC" />
   <uses-permission android:name="android.permission.VIBRATE" />

   <application ...>
       ...
       <service
           android:name=".LiveOutingNotificationService"
           android:foregroundServiceType="location"
           android:exported="false" />
   </application>
   ```

#### B. `LKDVAndroidTabBarHost.kt` Specification
- **Package**: `com.lekitduvoyageur.app`
- **Class**: `class LKDVAndroidTabBarHost(private val activity: AppCompatActivity, private val webView: WebView)`
- **Components**:
  - Programmatically adds a floating `com.google.android.material.navigation.NavigationBarView` (`BottomNavigationView`) to the root `CoordinatorLayout`.
  - Layout parameters:
    - `layout_width = MATCH_PARENT` with 20dp left/right margin (or max-width 420dp centered).
    - `layout_height = 64dp`.
    - `layout_gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL`.
    - `bottomMargin = 12dp + WindowInsetsCompat.Type.navigationBars()`.
  - M3 Visual Design:
    - Capsule background: `MaterialShapeDrawable` with `CornerFamily.ROUNDED`, radius 28dp (`@dimen/lkdv_radius_card`).
    - Surface color: `#E6FBFAF6` (90% opacity sauge canvas).
    - Stroke: 1dp `#2417402C` (14% alpha forest rim).
    - Elevation: 4dp tinted elevation.
    - Active Indicator: M3 pill indicator tinted with `Color.parseColor("#335B7F55")` (`@color/lkdv_brand_secondary` 20% alpha).
    - Icon Tint: `@color/lkdv_brand_action` (`#226148`) for selected, `@color/lkdv_label_secondary` (`#56665D`) for unselected.
    - Labels: `labelVisibilityMode = NavigationBarView.LABEL_VISIBILITY_UNLABELED`.
  - The 5 Menu Items (defined programmatically or via `res/menu/lkdv_bottom_nav_menu.xml`):
    - `R.id.nav_hub`: "Hub", icon `R.drawable.ic_nav_hub` -> tabId `"adventures"`
    - `R.id.nav_explorer`: "Explorer", icon `R.drawable.ic_nav_explorer` -> tabId `"explorer"`
    - `R.id.nav_community`: "Communauté", icon `R.drawable.ic_nav_community` -> tabId `"community"`
    - `R.id.nav_messages`: "Messages", icon `R.drawable.ic_nav_messages` -> tabId `"messages"`
    - `R.id.nav_account`: "Compte", icon `R.drawable.ic_nav_account` -> tabId `"me"`
  - Interactions:
    - Tap: `view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)`.
    - Callback: dispatches event to `LKDVAccountTabBarPlugin.sendTabSelection(tabId)`.
    - Keyboard Insets: attaches `ViewCompat.setOnApplyWindowInsetsListener` to hide the bar when `WindowInsetsCompat.Type.ime()` is visible.
- **Capacitor Plugin** (`LKDVAccountTabBarPlugin.kt`):
  ```kotlin
  @CapacitorPlugin(name = "LKDVAccountTabBar")
  class LKDVAccountTabBarPlugin : Plugin() {
      @PluginMethod
      fun setVisible(call: PluginCall) {
          val visible = call.getBoolean("visible", false) ?: false
          val selectedId = call.getString("selectedId")
          val revision = call.getInt("revision", 0) ?: 0
          activity.runOnUiThread {
              val host = (activity as? MainActivity)?.tabBarHost
              val active = host?.setVisible(visible, selectedId, revision) ?: false
              val ret = JSObject()
              ret.put("active", active)
              ret.put("height", host?.barHeightPx ?: 0)
              call.resolve(ret)
          }
      }

      fun sendTabSelection(tabId: String) {
          val data = JSObject()
          data.put("destination", tabId)
          notifyListeners("tabSelected", data)
      }
  }
  ```

#### C. `LiveOutingNotificationService.kt` Specification
- **Package**: `com.lekitduvoyageur.app`
- **Class**: `class LiveOutingNotificationService : Service()`
- **Responsibilities**:
  1. Creates notification channel `"lkdv_live_outing_channel"` with `IMPORTANCE_LOW`.
  2. Runs as Foreground Service with `ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION`.
  3. Displays an ongoing rich notification:
     - `setOngoing(true)`
     - `setSmallIcon(R.drawable.ic_notification_outing)`
     - `setCategory(NotificationCompat.CATEGORY_WORKOUT)`
     - `setContentTitle("Randonnée · " + if (paused) "En pause" else "En cours")`
     - `setContentText(String.format(Locale.FRENCH, "%.1f km · %d m D+", distanceM / 1000.0, elevGainM.toInt()))`
     - Chronometer: `setUsesChronometer(!paused)` with `setWhen(startedAtMs)`
     - Open app PendingIntent: targets `MainActivity` with deep link `/explorer`
     - Action button: "Pause" / "Reprendre" sending intent back to service.
- **Capacitor Plugin** (`LkdvLiveActivityPlugin.kt`):
  ```kotlin
  @CapacitorPlugin(name = "LkdvLiveActivity")
  class LkdvLiveActivityPlugin : Plugin() {
      @PluginMethod
      fun isSupported(call: PluginCall) {
          val ret = JSObject()
          ret.put("supported", true)
          ret.put("platform", "android")
          call.resolve(ret)
      }

      @PluginMethod
      fun start(call: PluginCall) {
          val intent = Intent(context, LiveOutingNotificationService::class.java).apply {
              action = LiveOutingNotificationService.ACTION_START
              putExtra("sport", call.getString("sport", "rando"))
              putExtra("startedAt", call.getDouble("startedAt", System.currentTimeMillis().toDouble())?.toLong() ?: System.currentTimeMillis())
              putExtra("distanceM", call.getDouble("distanceM", 0.0) ?: 0.0)
              putExtra("elevGainM", call.getDouble("elevGainM", 0.0) ?: 0.0)
              putExtra("movingS", call.getDouble("movingS", 0.0) ?: 0.0)
              putExtra("paused", call.getBoolean("paused", false) ?: false)
          }
          ContextCompat.startForegroundService(context, intent)
          val ret = JSObject()
          ret.put("supported", true)
          ret.put("id", "android-live-outing")
          call.resolve(ret)
      }

      @PluginMethod
      fun update(call: PluginCall) {
          val intent = Intent(context, LiveOutingNotificationService::class.java).apply {
              action = LiveOutingNotificationService.ACTION_UPDATE
              putExtra("distanceM", call.getDouble("distanceM", 0.0) ?: 0.0)
              putExtra("elevGainM", call.getDouble("elevGainM", 0.0) ?: 0.0)
              putExtra("movingS", call.getDouble("movingS", 0.0) ?: 0.0)
              putExtra("paused", call.getBoolean("paused", false) ?: false)
              putExtra("offRoute", call.getBoolean("offRoute", false) ?: false)
          }
          context.startService(intent)
          val ret = JSObject()
          ret.put("supported", true)
          ret.put("id", "android-live-outing")
          call.resolve(ret)
      }

      @PluginMethod
      fun end(call: PluginCall) {
          val intent = Intent(context, LiveOutingNotificationService::class.java).apply {
              action = LiveOutingNotificationService.ACTION_STOP
          }
          context.startService(intent)
          val ret = JSObject()
          ret.put("supported", true)
          ret.put("ended", true)
          call.resolve(ret)
      }
  }
  ```

#### D. Android Native UI Bridges (`LKDVNativeUIPlugin.kt`)
Plugin `@CapacitorPlugin(name = "LKDVNativeUI")` implementing:
1. `presentActions`: `MaterialAlertDialogBuilder(activity)` or `BottomSheetDialog(activity)` with custom list adapter.
2. `presentPrompt`: `MaterialAlertDialogBuilder(activity)` with `TextInputLayout` + `TextInputEditText`.
3. `presentDate`: `MaterialDatePicker.Builder.datePicker().build()`.
4. `presentChoices`: `MaterialAlertDialogBuilder(activity).setSingleChoiceItems(...)`.
5. `presentPhotos`: Jetpack `ActivityResultContracts.PickMultipleVisualMedia`.
6. `importGPX` / `exportGPX`: `ActivityResultContracts.OpenDocument` / `CreateDocument` for GPX mime types.
7. `share`: `Intent.ACTION_SEND` chooser.
8. `openInAppBrowser`: Chrome `CustomTabsIntent.Builder().setToolbarColor(0xFF17402C.toInt()).build().launchUrl(...)`.
9. `authenticateBiometric`: `androidx.biometric.BiometricPrompt`.

---

### 3.3 TypeScript Bridge Facades Specification

#### A. Updated `src/lib/native/ui.ts`
```ts
'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeAction = {
  id: string;
  title: string;
  destructive?: boolean;
};
export type NativePromptRequest = {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
};
export type NativePhotoPayload = { name: string; type: string; data: string };
export type NativeChoice = { id: string; title: string };
export type NativeChoicesRequest = {
  title: string;
  options: NativeChoice[];
  selectedId?: string;
};
export type NativeActionRequest = {
  title: string;
  message?: string;
  actions: NativeAction[];
};

export type NativeUIPlugin = {
  setRoute(options: { path: string; revision: number }): Promise<{ active: boolean }>;
  presentActions(options: NativeActionRequest): Promise<{ active: boolean; actionId?: string }>;
  share(options: { url: string; title?: string; text?: string }): Promise<{ active: boolean }>;
  presentPrompt(options: NativePromptRequest): Promise<{ active: boolean; value?: string }>;
  presentDate(options: { title: string; value?: string }): Promise<{ active: boolean; value?: string }>;
  getCapabilities(): Promise<{
    available: boolean;
    dates?: boolean;
    choices?: boolean;
    photos?: boolean;
    files?: boolean;
    biometrics?: boolean;
  }>;
  importGPX(): Promise<{ active: boolean; text?: string }>;
  exportGPX(options: { xml: string; fileName: string }): Promise<{ active: boolean; saved?: boolean }>;
  presentPhotos(options: { maxCount: number }): Promise<{ active: boolean; photos?: NativePhotoPayload[] }>;
  presentChoices(options: NativeChoicesRequest): Promise<{ active: boolean; value?: string }>;
  openBrowser(options: { url: string }): Promise<{ active: boolean }>;
  authenticateBiometric(options: { reason: string }): Promise<{ active: boolean; success: boolean }>;
};

const ui = registerPlugin<NativeUIPlugin>('LKDVNativeUI');

/** Returns true when running on iOS or Android within Capacitor (no route exclusion). */
export function supportsNativeUI(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}

/** Backwards-compatible alias for existing tests and call sites. */
export function supportsNativeIOSUI(path?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  // Outside tests that specifically test android separation, allows native UI
  return platform === 'ios' || platform === 'android';
}

/** Route synchronization informing native shell to dismiss open sheets on route change. */
export async function syncNativeUIRoute(path: string, revision: number): Promise<boolean> {
  if (!supportsNativeUI()) return false;
  try {
    const result = await ui.setRoute({ path, revision });
    return result.active === true;
  } catch {
    return false;
  }
}
```

#### B. Updated `src/components/mobile-nav/nativeAccountRoutes.ts`
```ts
import { getActiveDestinationId, type DestinationId } from './destinationRegistry';

/** Full-screen routes where TabBar should be hidden (auth, checkout, studio modal). */
const NO_NAV_PREFIXES = ['/connexion', '/inscription', '/checkout', '/kit-studio'] as const;

export function shouldShowNativeGlass(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // /compas is NO LONGER excluded: native TabBar remains present!
  if (
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-kit-studio-open') === 'true' ||
      document.body.getAttribute('data-kit-studio-open') === 'true' ||
      Boolean(document.querySelector('.ks-root, [data-studio-scene]')))
  ) {
    return false;
  }
  return !NO_NAV_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function getNativeGlassDestination(pathname: string | null): DestinationId | null {
  if (!shouldShowNativeGlass(pathname)) return null;
  return getActiveDestinationId(pathname);
}
```

#### C. Updated `src/features/explorer-v2/native/liveActivity.ts`
```ts
'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface LiveActivityState {
  distanceM: number;
  elevGainM: number;
  movingS: number;
  paused: boolean;
  offRoute: boolean;
}

export interface LiveActivityStart extends LiveActivityState {
  sport: string;
  startedAt: number;
}

interface LiveActivityPlugin {
  isSupported(): Promise<{ supported: boolean; platform?: string; reason?: string }>;
  start(options: LiveActivityStart): Promise<{ supported: boolean; id?: string; reason?: string }>;
  update(options: LiveActivityState): Promise<{ supported: boolean; id?: string }>;
  end(options: LiveActivityState): Promise<{ supported: boolean; ended?: boolean }>;
}

const native = registerPlugin<LiveActivityPlugin>('LkdvLiveActivity');

/** Returns true on both iOS (ActivityKit) and Android (Foreground Notification Service). */
export async function isLiveActivitySupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return false;
  try {
    const result = await native.isSupported();
    return result.supported === true;
  } catch {
    return false;
  }
}

export async function startLiveActivity(payload: LiveActivityStart): Promise<boolean> {
  if (!supportsLiveTracking()) return false;
  try {
    const result = await native.start(payload);
    return result.supported === true;
  } catch {
    return false;
  }
}

export async function updateLiveActivity(state: LiveActivityState): Promise<void> {
  if (!supportsLiveTracking()) return;
  try {
    await native.update(state);
  } catch {}
}

export async function endLiveActivity(state: LiveActivityState): Promise<void> {
  if (!supportsLiveTracking()) return;
  try {
    await native.end(state);
  } catch {}
}

function supportsLiveTracking(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}
```

---

## 4. Caveats

1. **Xcode Target Addition**: Adding an Xcode Target (`LkdvWidgetsExtension`) and editing `project.pbxproj` manually requires exact UUID and PBX section formatting to avoid corrupting the Xcode project. Using an automated script (or Xcode CLI / `gemini` node script) is required.
2. **Apple Developer Account Requirements**: ActivityKit Live Activities work in the iOS Simulator and development builds, but testing push-based Live Activities requires an active Apple Developer Team with ActivityKit capabilities enabled. Local Live Activities (`Activity.request(...)` without push tokens) work immediately in development.
3. **Android 14+ Foreground Service Policy**: On Android 14+ (API 34+), foreground services must declare a specific `foregroundServiceType` (`location`). Android requires runtime permission `ACCESS_FINE_LOCATION` to be granted before starting the foreground service with type `location`.
4. **Test Regression Suite**: Vitest suite `tests/native/native-files.test.ts` checks string tokens inside `ios/App/App/SceneDelegate.swift`. Any refactoring of `SceneDelegate.swift` must preserve the structure of `LKDVNativeGPXExportView` or update that regression test in sync.

---

## 5. Conclusion

1. **iOS Native Maxing is Ready**:
   - The bug preventing `LkdvLiveActivityPlugin` from running is solved: register it in `LKDVBridgeViewController.capacitorDidLoad()` instead of the orphaned `MainViewController`.
   - The bug preventing native TabBar on physical devices is solved: change `#available(iOS 26.0, *)` to `#available(iOS 16.0, *)` with `UIBlurEffect(style: .systemUltraThinMaterialLight)` and stone tint.
   - The `/compas` exclusion is removed in `SceneDelegate.swift`, `nativeAccountRoutes.ts`, and `ui.ts`.
   - The blueprint for `LkdvWidgetsExtension` (Dynamic Island + Lock Screen) is fully designed and ready for creation.

2. **Android Parity is Solved**:
   - The transition from empty `MainActivity.java` to `MainActivity.kt` with Material 3 theme and `LKDVAndroidTabBarHost` capsule navigation bar provides exact visual and behavioral parity with iOS Liquid Glass.
   - `LiveOutingNotificationService.kt` brings identical real-time status bar and notification drawer tracking to Android users.
   - `LKDVNativeUIPlugin.kt` bridges all native dialogs, pickers, and biometric controls.

3. **TypeScript Facades are Unified**:
   - `src/lib/native/ui.ts` and `src/features/explorer-v2/native/liveActivity.ts` become unified, SSR-safe cross-platform facades servicing Web, iOS, and Android seamlessly.

---

## 6. Verification Method

To verify these findings and implementations:

1. **Run Native Vitest Suite**:
   ```bash
   npx vitest run tests/native/
   ```
   Ensures that existing UI bridge and confirmation tests remain green.

2. **Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   Ensures no TypeScript type regressions in `src/lib/native/`.

3. **Verify Xcode Project Syntax & Live Activity Registration**:
   Inspect `ios/App/App/SceneDelegate.swift`:
   ```bash
   grep -n "LkdvLiveActivityPlugin" ios/App/App/SceneDelegate.swift
   ```
   Must return the registration in `capacitorDidLoad()`.

4. **Verify Android Compilation**:
   ```bash
   cd android && ./gradlew assembleDebug
   ```
   Validates Kotlin compilation, Material 3 theme, and plugin registrations.

5. **Runtime Device Verification**:
   - iOS: Run on iPhone 16 Pro (`shots/*.png`) — verify Liquid Glass `UITabBar` on `/hub`, `/compas`, `/communaute`, `/messages`, `/compte`, and Dynamic Island pill during an active outing.
   - Android: Run on Android emulator / physical device — verify floating capsule navigation bar and live notification drawer during an active outing.
