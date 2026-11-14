# Handoff Report — Explorer 3 (Milestone M1)
**Swift Native Design Tokens Synchronization & External Skills Integration**

- **Investigator**: Explorer 3 (Archetype: Explorer, Sub-Agent M1)
- **Target Milestone**: M1 (Apple Design Tokens & Components Bank - LKDV Greens)
- **Original Parent**: `bd885e84-b8b5-4d39-943a-74a48a5d55e7`
- **Working Directory**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
- **State Folder**: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/explorer_m1_3`

---

## 1. Observation

### 1.1 iOS Project Structure & Layout
Direct inspection of `ios/App/App/` and `ios/App/App.xcodeproj`:
- **App Entry Points & Controllers**:
  - `AppDelegate.swift`: Implements `UIApplicationDelegate`, delegates window/scene management to `SceneDelegate.self` via `UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)`.
  - `MainViewController.swift`: Subclasses `CAPBridgeViewController`, registers native ActivityKit plugin `LkdvLiveActivityPlugin` inside `capacitorDidLoad()`.
  - `SceneDelegate.swift` (1193 lines): Root UI coordinator hosting both Capacitor web layer and native UIKit / SwiftUI components:
    - `LKDVBridgeViewController`: Extends `CAPBridgeViewController`.
    - `LKDVNativeTabBarHost`: Implements `UIViewController`, `UITabBarDelegate`. Hosts `web: LKDVBridgeViewController` and the native iOS 16+ Liquid Glass tab bar.
    - `LKDVNativeUIPlugin`: Capacitor bridged plugin (`CAPPlugin`, `CAPBridgedPlugin`) exposing methods: `setRoute`, `presentActions`, `presentPrompt`, `presentDate`, `presentChoices`, `presentPhotos`, `importGPX`, `exportGPX`, `getCapabilities`, `share`, `authenticateBiometric`.
    - Native SwiftUI Views: `LKDVNativeActionsView`, `LKDVNativePromptView`, `LKDVNativeDateView`, `LKDVNativeChoicesView`, `LKDVNativePhotosView`, `LKDVNativeGPXImportView`, `LKDVNativeGPXExportView`.
    - Native Sheet Presentation: Presented via `UIHostingController(rootView: content)` with `.modalPresentationStyle = .pageSheet`, configuring `sheetPresentationController`:
      ```swift
      // SceneDelegate.swift:298-302
      if let sheet = controller.sheetPresentationController {
          sheet.detents = [.medium(), .large()]
          sheet.prefersGrabberVisible = true
          sheet.preferredCornerRadius = 28
      }
      ```
    - Hardcoded Color Literals in `SceneDelegate.swift`:
      - Line 65: `view.backgroundColor = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)` (`surfaceCanvas` `#FBFAF6`)
      - Line 73: `tabBar.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)` (`brandPrimary` `#17402C`)
      - Line 77: `appearance.backgroundColor = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 0.85)` (`surfaceCanvas` 85%)
      - Line 78: `appearance.shadowColor = UIColor(red: 23.0 / 255.0, green: 43.0 / 255.0, blue: 36.0 / 255.0, alpha: 0.14)` (`glass.rimColor`)
      - Line 525: `.tint(Color(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0))` (`brandPrimary` in SwiftUI)
      - Line 670: `.tint(Color(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0))` (`brandPrimary` in SwiftUI)
      - Line 1173: `let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)` (`surfaceCanvas`)
  - `ios/LkdvWidgetsExtension/LkdvLiveActivityWidget.swift`:
    - Lines 21 & 59: `Color(red: 34/255, green: 97/255, blue: 72/255)` (`brandAction` `#226148`).

### 1.2 Xcode Project Configuration (`project.pbxproj`)
Inspection of `ios/App/App.xcodeproj/project.pbxproj`:
- Targets:
  1. `App` (ID `504EC3011FED79650016851F`, Product: `App.app`)
  2. `LkdvWidgetsExtension` (ID `B80000002C00000000000000`, Product: `LkdvWidgetsExtension.appex`)
- Swift files registered in `PBXSourcesBuildPhase` of target `App`:
  - `AppDelegate.swift` (`504EC3081FED79650016851F`)
  - `MainViewController.swift` (`762950BD8B152FC47081ED92`)
  - `LkdvLiveActivityPlugin.swift` (`0B086AE908B95699C6C7AD09`)
  - `LkdvLiveActivityAttributes.swift` (`47DB3E48B33B9668E5DF52A8`)
  - `SceneDelegate.swift` (`9582B6832FE993A70072D4E8`)
- **Critical Finding**: `ios/App/App/DesignTokens.generated.swift` exists in the filesystem (generated previously), but is **NOT** registered in `App.xcodeproj/project.pbxproj` (`grep "DesignTokens.generated.swift" ios/App/App.xcodeproj/project.pbxproj` returned no matches).

### 1.3 Existing Generator Script (`scripts/generate-design-bank.mjs`)
Inspection of `scripts/generate-design-bank.mjs`:
- Currently outputs 7 artifacts from `src/design/bank.ts`:
  1. `src/styles/tokens.generated.css`
  2. `src/design/tokens.generated.ts`
  3. `tailwind.preset.generated.js`
  4. `tailwind.preset.generated.cjs`
  5. `ios/App/App/DesignTokens.generated.swift`
  6. `android/app/src/main/res/values/design_tokens.generated.xml`
  7. `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt`
- Limitations in current `generateSwift(b)`:
  - Uses runtime string parsing with `Scanner(string: hexSanitized).scanHexInt64(&rgb)` which cannot parse RGBA expressions (e.g. `rgba(23, 43, 36, 0.14)`).
  - Only generates 8 static colors; omits status colors, border colors, rim colors, sheet grabber color.
  - Lacks UIKit `UIColor` and SwiftUI `Color` namespace extensions (`UIColor.lkdvCanvas`, `Color.lkdvBrandPrimary`).
  - Lacks Apple Dynamic Type typography metrics (`largeTitle` through `caption2` point size, line height, weight, tracking).
  - Lacks sheet grabber constants (Apple standard 36×5pt, radius 2.5pt, color `rgba(23, 64, 44, 0.25)`).
  - Lacks SwiftUI continuous squircle shape helper (`RoundedRectangle(..., style: .continuous)`).

### 1.4 External Skills Evaluation (`npx skills`)
Execution and analysis of external skills:
1. `wondelai/skills@ios-hig-design` (tested via `npx skills use wondelai/skills@ios-hig-design`):
   - Comprehensive Apple HIG reference covering:
     - Safe areas (Status bar 20/44/54pt, Nav bar 44+52=96pt, Tab bar 49/64pt, Home indicator 34pt, touch min 44pt).
     - Dynamic Type: Full 11-level hierarchy (Large Title 34pt, Title1 28pt, Title2 22pt, Title3 20pt, Headline 17pt, Body 17pt, Callout 16pt, Subheadline 15pt, Footnote 13pt, Caption1 12pt, Caption2 11pt).
     - Standard modal sheet presentation with `UISheetPresentationController`, grabber 36×5pt, detents `.medium()`, `.large()`.
     - Inset Grouped list rhythm (`.listStyle(.insetGrouped)`).
2. `affaan-m/ecc@liquid-glass-design` (tested via `npx skills use affaan-m/ecc@liquid-glass-design`):
   - iOS 26 Liquid Glass material guidelines:
     - SwiftUI: `.glassEffect()`, `.buttonStyle(.glass)`, `GlassEffectContainer(spacing:)`, morphing with `@Namespace` and `glassEffectID`.
     - UIKit: `UIGlassEffect()`, `UIGlassContainerEffect()`, `clipsToBounds = true` with corner radii.
     - WidgetKit: `widgetRenderingMode == .accented` handling.
3. Existing Local Skills:
   - `.agents/skills/apple-ui-designer/SKILL.md`: Native over custom, clear hierarchy, subtle over expressive, calm and confident, first-party Apple feel.
   - `.agents/skills/lkdv-ios27-page-refonte/SKILL.md`: Measured tokens (406px card, r24, top bar 56px, grabber 40×4 / 36×5, zero main scroll 100dvh).
   - `.agent/skills/lkdv-explorer-v2-ios-native/SKILL.md`: LiveActivity, haptics, iOS Capacitor bridge.

---

## 2. Logic Chain

1. **Premise 1**: The user request and Milestone M1 require exact, un-approximated Apple Design Tokens and native Swift components synchronized from a single source of truth (`src/design/bank.ts`) into `ios/App/App/DesignTokens.generated.swift`.
2. **Premise 2**: Runtime color parsing using `Scanner` in Swift introduces unnecessary overhead, risks failure on transparency values (`rgba(...)`), and is incompatible with SwiftUI constants that prefer pre-computed normalized floats (`red: g: b: alpha:`).
3. **Premise 3**: In `SceneDelegate.swift` and `LkdvLiveActivityWidget.swift`, multiple colors are hardcoded as raw RGBA literals (`251.0/255.0`, `23.0/255.0`, `34/255`). When `DesignTokens.generated.swift` provides idiomatic `UIColor.lkdv*` and `Color.lkdv*` extensions, these views can adopt the centralized tokens without breaking changes or visual shifts.
4. **Premise 4**: If `DesignTokens.generated.swift` is not included in `App.xcodeproj/project.pbxproj`, native Swift files cannot import or use `DesignTokens` during `xcodebuild` compilation. Registering the file in the `PBXSourcesBuildPhase` ensures clean native compilation.
5. **Premise 5**: External skills (`wondelai/skills@ios-hig-design` and `affaan-m/ecc@liquid-glass-design`) provide exact specifications for Apple Human Interface Guidelines and Liquid Glass styling, aligning the web CSS and Swift native layers into a unified design system.

---

## 3. Caveats

- **Investigation Boundary**: In accordance with the Explorer archetype and project instructions, no source code was modified during this investigation. A prototype Swift file (`.agents/teamwork/explorer_m1_3/DesignTokensTest.swift`) was verified using `swiftc -parse`.
- **Xcode PBXProj Editing**: Modifying `project.pbxproj` manually requires exact UUID and section placement to prevent Xcode project corruption. The implementer should follow the exact snippet provided in this report or use `pbxproj` tooling.
- **Dark Mode Exclusion**: Per requirements R1 & R2, the LKDV application is 100% Mode Clair Liquid Glass (zero `#000000`, zero `#0d1117`). In `capacitor.config.ts`, line 75 (`Keyboard: { style: "DARK" }`) should be updated to `"LIGHT"` by the implementer.

---

## 4. Conclusion & Design Specification

### 4.1 Recommended Swift Generator Output (`ios/App/App/DesignTokens.generated.swift`)

The generator must produce the following complete, verified Swift structure:

```swift
// Generated by scripts/generate-design-bank.mjs. DO NOT EDIT.
// Source of truth: src/design/bank.ts

import UIKit
import SwiftUI

// MARK: - Core Tokens Namespace
public enum DesignTokens {

    // MARK: - Colors (Pre-computed normalized RGBA, zero runtime string parsing)
    public enum Colors {
        // Surfaces
        public static let surfaceCanvas = UIColor(red: 251.0/255.0, green: 250.0/255.0, blue: 246.0/255.0, alpha: 1.0)
        public static let surfaceSauge = UIColor(red: 245.0/255.0, green: 247.0/255.0, blue: 243.0/255.0, alpha: 1.0)
        public static let surfaceElevated = UIColor(red: 255.0/255.0, green: 255.0/255.0, blue: 255.0/255.0, alpha: 1.0)
        public static let surfaceGrouped = UIColor(red: 240.0/255.0, green: 245.0/255.0, blue: 238.0/255.0, alpha: 1.0)
        public static let surfaceMuted = UIColor(red: 237.0/255.0, green: 241.0/255.0, blue: 234.0/255.0, alpha: 1.0)
        public static let border = UIColor(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, alpha: 0.12)
        public static let borderSubtle = UIColor(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, alpha: 0.06)
        public static let borderStrong = UIColor(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, alpha: 0.24)

        // Inks / Labels (Zero pure black)
        public static let labelPrimary = UIColor(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, alpha: 1.0)
        public static let labelSecondary = UIColor(red: 86.0/255.0, green: 102.0/255.0, blue: 93.0/255.0, alpha: 1.0)
        public static let labelTertiary = UIColor(red: 70.0/255.0, green: 88.0/255.0, blue: 77.0/255.0, alpha: 1.0)
        public static let labelQuaternary = UIColor(red: 140.0/255.0, green: 151.0/255.0, blue: 144.0/255.0, alpha: 1.0)
        public static let onBrand = UIColor(red: 255.0/255.0, green: 255.0/255.0, blue: 255.0/255.0, alpha: 1.0)
        public static let onAction = UIColor(red: 255.0/255.0, green: 255.0/255.0, blue: 255.0/255.0, alpha: 1.0)

        // Brand & Actions (LKDV Greens)
        public static let brandPrimary = UIColor(red: 23.0/255.0, green: 64.0/255.0, blue: 44.0/255.0, alpha: 1.0)
        public static let brandAction = UIColor(red: 34.0/255.0, green: 97.0/255.0, blue: 72.0/255.0, alpha: 1.0)
        public static let brandSecondary = UIColor(red: 91.0/255.0, green: 127.0/255.0, blue: 85.0/255.0, alpha: 1.0)
        public static let primarySubtle = UIColor(red: 211.0/255.0, green: 235.0/255.0, blue: 217.0/255.0, alpha: 1.0)
        public static let secondarySubtle = UIColor(red: 216.0/255.0, green: 229.0/255.0, blue: 213.0/255.0, alpha: 1.0)

        // Glass & Materials
        public static let rimColor = UIColor(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, alpha: 0.14)
        public static let shadowColor = UIColor(red: 23.0/255.0, green: 64.0/255.0, blue: 44.0/255.0, alpha: 0.12)

        // Sheet Grabber
        public static let sheetGrabberColor = UIColor(red: 23.0/255.0, green: 64.0/255.0, blue: 44.0/255.0, alpha: 0.25)

        // SwiftUI Colors
        public static let swiftUISurfaceCanvas = Color(red: 251.0/255.0, green: 250.0/255.0, blue: 246.0/255.0, opacity: 1.0)
        public static let swiftUISurfaceElevated = Color(red: 255.0/255.0, green: 255.0/255.0, blue: 255.0/255.0, opacity: 1.0)
        public static let swiftUISurfaceGrouped = Color(red: 240.0/255.0, green: 245.0/255.0, blue: 238.0/255.0, opacity: 1.0)
        public static let swiftUILabelPrimary = Color(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, opacity: 1.0)
        public static let swiftUILabelSecondary = Color(red: 86.0/255.0, green: 102.0/255.0, blue: 93.0/255.0, opacity: 1.0)
        public static let swiftUIBrandPrimary = Color(red: 23.0/255.0, green: 64.0/255.0, blue: 44.0/255.0, opacity: 1.0)
        public static let swiftUIBrandAction = Color(red: 34.0/255.0, green: 97.0/255.0, blue: 72.0/255.0, opacity: 1.0)
        public static let swiftUIBrandSecondary = Color(red: 91.0/255.0, green: 127.0/255.0, blue: 85.0/255.0, opacity: 1.0)
        public static let swiftUIRimColor = Color(red: 23.0/255.0, green: 43.0/255.0, blue: 36.0/255.0, opacity: 0.14)
        public static let swiftUISheetGrabber = Color(red: 23.0/255.0, green: 64.0/255.0, blue: 44.0/255.0, opacity: 0.25)
    }

    // MARK: - Continuous Corner Radii
    public enum Radii {
        public static let xs: CGFloat = 12
        public static let sm: CGFloat = 16
        public static let md: CGFloat = 20
        public static let lg: CGFloat = 24
        public static let card: CGFloat = 28
        public static let hero: CGFloat = 38
        public static let sheet: CGFloat = 28 // Sheet detent corner radius per HIG
        public static let sheetFull: CGFloat = 44
        public static let pill: CGFloat = 9999
        public static let concentricFloor: CGFloat = 20
    }

    // MARK: - Sheet Grabber Specifications (Apple standard 36×5pt)
    public enum SheetGrabber {
        public static let width: CGFloat = 36.0
        public static let height: CGFloat = 5.0
        public static let cornerRadius: CGFloat = 2.5
        public static let color: UIColor = Colors.sheetGrabberColor
        public static let swiftUIColor: Color = Colors.swiftUISheetGrabber
    }

    // MARK: - Dynamic Type Font Metrics
    public struct FontMetric {
        public let size: CGFloat
        public let lineHeight: CGFloat
        public let weight: UIFont.Weight
        public let tracking: CGFloat

        public func font() -> UIFont {
            UIFont.systemFont(ofSize: size, weight: weight)
        }
    }

    public enum Typography {
        public static let largeTitle  = FontMetric(size: 34, lineHeight: 41, weight: .bold, tracking: 0.37)
        public static let title1      = FontMetric(size: 28, lineHeight: 34, weight: .bold, tracking: 0.36)
        public static let title2      = FontMetric(size: 22, lineHeight: 28, weight: .bold, tracking: 0.35)
        public static let title3      = FontMetric(size: 20, lineHeight: 25, weight: .semibold, tracking: 0.38)
        public static let headline    = FontMetric(size: 17, lineHeight: 22, weight: .semibold, tracking: -0.41)
        public static let body        = FontMetric(size: 17, lineHeight: 22, weight: .regular, tracking: -0.41)
        public static let callout     = FontMetric(size: 16, lineHeight: 21, weight: .regular, tracking: -0.32)
        public static let subheadline = FontMetric(size: 15, lineHeight: 20, weight: .regular, tracking: -0.24)
        public static let footnote    = FontMetric(size: 13, lineHeight: 18, weight: .regular, tracking: -0.08)
        public static let caption1    = FontMetric(size: 12, lineHeight: 16, weight: .regular, tracking: 0.00)
        public static let caption2    = FontMetric(size: 11, lineHeight: 13, weight: .regular, tracking: 0.07)
    }

    // MARK: - Z-Index Scale (Monotone 8 Levels)
    public enum ZIndex {
        public static let base: Int = 1
        public static let sticky: Int = 100
        public static let subbar: Int = 200
        public static let tabbar: Int = 300
        public static let hud: Int = 400
        public static let sheet: Int = 500
        public static let modal: Int = 600
        public static let alert: Int = 700
    }

    // MARK: - Spacing & Touch Targets
    public enum Spacing {
        public static let touchMinApple: CGFloat = 44.0
        public static let navHeight: CGFloat = 60.0
        public static let tabBarHeight: CGFloat = 64.0
        public static let bottomClearance: CGFloat = 88.0
    }
}

// MARK: - UIKit UIColor Extensions
public extension UIColor {
    enum LKDV {
        public static let surfaceCanvas = DesignTokens.Colors.surfaceCanvas
        public static let surfaceSauge = DesignTokens.Colors.surfaceSauge
        public static let surfaceElevated = DesignTokens.Colors.surfaceElevated
        public static let surfaceGrouped = DesignTokens.Colors.surfaceGrouped
        public static let surfaceMuted = DesignTokens.Colors.surfaceMuted
        public static let border = DesignTokens.Colors.border
        public static let borderSubtle = DesignTokens.Colors.borderSubtle
        public static let borderStrong = DesignTokens.Colors.borderStrong

        public static let labelPrimary = DesignTokens.Colors.labelPrimary
        public static let labelSecondary = DesignTokens.Colors.labelSecondary
        public static let labelTertiary = DesignTokens.Colors.labelTertiary
        public static let labelQuaternary = DesignTokens.Colors.labelQuaternary
        public static let onBrand = DesignTokens.Colors.onBrand
        public static let onAction = DesignTokens.Colors.onAction

        public static let brandPrimary = DesignTokens.Colors.brandPrimary
        public static let brandAction = DesignTokens.Colors.brandAction
        public static let brandSecondary = DesignTokens.Colors.brandSecondary
        public static let primarySubtle = DesignTokens.Colors.primarySubtle
        public static let secondarySubtle = DesignTokens.Colors.secondarySubtle

        public static let rimColor = DesignTokens.Colors.rimColor
        public static let shadowColor = DesignTokens.Colors.shadowColor
        public static let sheetGrabber = DesignTokens.Colors.sheetGrabberColor
    }

    static let lkdvCanvas = LKDV.surfaceCanvas
    static let lkdvSurfaceElevated = LKDV.surfaceElevated
    static let lkdvSurfaceGrouped = LKDV.surfaceGrouped
    static let lkdvBrandPrimary = LKDV.brandPrimary
    static let lkdvBrandAction = LKDV.brandAction
    static let lkdvLabelPrimary = LKDV.labelPrimary
    static let lkdvLabelSecondary = LKDV.labelSecondary
    static let lkdvRimColor = LKDV.rimColor
}

// MARK: - SwiftUI Color Extensions
public extension Color {
    enum LKDV {
        public static let surfaceCanvas = DesignTokens.Colors.swiftUISurfaceCanvas
        public static let surfaceElevated = DesignTokens.Colors.swiftUISurfaceElevated
        public static let surfaceGrouped = DesignTokens.Colors.swiftUISurfaceGrouped
        public static let labelPrimary = DesignTokens.Colors.swiftUILabelPrimary
        public static let labelSecondary = DesignTokens.Colors.swiftUILabelSecondary
        public static let brandPrimary = DesignTokens.Colors.swiftUIBrandPrimary
        public static let brandAction = DesignTokens.Colors.swiftUIBrandAction
        public static let brandSecondary = DesignTokens.Colors.swiftUIBrandSecondary
        public static let rimColor = DesignTokens.Colors.swiftUIRimColor
        public static let sheetGrabber = DesignTokens.Colors.swiftUISheetGrabber
    }

    static let lkdvCanvas = LKDV.surfaceCanvas
    static let lkdvSurfaceElevated = LKDV.surfaceElevated
    static let lkdvSurfaceGrouped = LKDV.surfaceGrouped
    static let lkdvBrandPrimary = LKDV.brandPrimary
    static let lkdvBrandAction = LKDV.brandAction
    static let lkdvLabelPrimary = LKDV.labelPrimary
    static let lkdvLabelSecondary = LKDV.labelSecondary
    static let lkdvRimColor = LKDV.rimColor
}

// MARK: - SwiftUI Continuous Corner & Grabber Helpers
public struct LKDVSquircle: Shape {
    public var cornerRadius: CGFloat

    public init(cornerRadius: CGFloat = DesignTokens.Radii.card) {
        self.cornerRadius = cornerRadius
    }

    public func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRoundedRect(in: rect, cornerSize: CGSize(width: cornerRadius, height: cornerRadius), style: .continuous)
        return path
    }
}

public struct LKDVSheetGrabberView: View {
    public init() {}

    public var body: some View {
        RoundedRectangle(cornerRadius: DesignTokens.SheetGrabber.cornerRadius, style: .continuous)
            .fill(DesignTokens.SheetGrabber.swiftUIColor)
            .frame(width: DesignTokens.SheetGrabber.width, height: DesignTokens.SheetGrabber.height)
            .padding(.top, 8)
            .padding(.bottom, 4)
    }
}

// MARK: - UISheetPresentationController LKDV Configuration Helper
public extension UISheetPresentationController {
    func configureLKDVSheet(detents: [UISheetPresentationController.Detent] = [.medium(), .large()]) {
        self.detents = detents
        self.prefersGrabberVisible = true
        self.preferredCornerRadius = DesignTokens.Radii.sheet
    }
}
```

### 4.2 Generator Implementation in `scripts/generate-design-bank.mjs`

To implement this design, update `generateSwift(b)` in `scripts/generate-design-bank.mjs`:
```javascript
// Color parsing helper for Hex (#RGB, #RRGGBB, #RRGGBBAA) and RGBA (rgba(r, g, b, a))
function parseColorToSwift(str) {
  if (!str) return { uiColor: 'UIColor.clear', swiftColor: 'Color.clear' };
  const trimmed = str.trim();

  // Hex format
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex.slice(0, 6), 16);
    const r = ((num >> 16) & 255);
    const g = ((num >> 8) & 255);
    const b = (num & 255);
    let a = 1.0;
    if (hex.length === 8) {
      a = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 1000) / 1000;
    }
    return {
      uiColor: `UIColor(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, alpha: ${a})`,
      swiftColor: `Color(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, opacity: ${a})`
    };
  }

  // RGBA format
  const rgbaMatch = trimmed.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseFloat(rgbaMatch[1]);
    const g = parseFloat(rgbaMatch[2]);
    const b = parseFloat(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1.0;
    return {
      uiColor: `UIColor(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, alpha: ${a})`,
      swiftColor: `Color(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, opacity: ${a})`
    };
  }

  return { uiColor: 'UIColor.clear', swiftColor: 'Color.clear' };
}
```

### 4.3 Proposed Xcode Project Registration (`project.pbxproj`)
In `ios/App/App.xcodeproj/project.pbxproj`:
1. Add `DesignTokens.generated.swift` in `PBXBuildFile`:
   ```
   9582B6852FE994A10072D4E8 /* DesignTokens.generated.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9582B6842FE994A10072D4E8 /* DesignTokens.generated.swift */; };
   ```
2. Add in `PBXFileReference`:
   ```
   9582B6842FE994A10072D4E8 /* DesignTokens.generated.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DesignTokens.generated.swift; sourceTree = "<group>"; };
   ```
3. Add to `children` of `504EC3061FED79650016851F /* App */`:
   ```
   9582B6842FE994A10072D4E8 /* DesignTokens.generated.swift */,
   ```
4. Add to `files` in `PBXSourcesBuildPhase` of target `App`:
   ```
   9582B6852FE994A10072D4E8 /* DesignTokens.generated.swift in Sources */,
   ```

### 4.4 Automated One-Command Workflow in `package.json`
- `"design:generate"`: `node scripts/generate-design-bank.mjs`
- `"design:check"`: `node scripts/generate-design-bank.mjs --check`
- `"mobile:sync"`: `node scripts/generate-design-bank.mjs && npx cap sync`
- `"predev"` / `"prebuild"`: Already trigger `node scripts/generate-design-bank.mjs`.

---

## 5. Verification Method

1. **Syntax Validation**:
   Run:
   ```bash
   xcrun -sdk iphonesimulator swiftc -parse ios/App/App/DesignTokens.generated.swift
   ```
   *Expected outcome*: Exit code 0, no syntax errors.

2. **Synchronization Check**:
   Run:
   ```bash
   npm run design:check
   ```
   *Expected outcome*: `✅ All design bank generated artifacts are in sync with src/design/bank.ts.`

3. **Xcode Build Validation**:
   Run:
   ```bash
   cd ios/App && xcodebuild -project App.xcodeproj -target App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO
   ```
   *Expected outcome*: `** BUILD SUCCEEDED **`.

4. **Zero Pure Black Audit**:
   Run:
   ```bash
   grep -i "#000000" ios/App/App/DesignTokens.generated.swift
   grep -i "#0d1117" ios/App/App/DesignTokens.generated.swift
   ```
   *Expected outcome*: 0 occurrences.
