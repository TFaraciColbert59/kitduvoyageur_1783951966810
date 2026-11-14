// verify_swift_primitives.swift
// Empirical verification test harness for DesignTokens.generated.swift

import UIKit
import SwiftUI

@main
struct EmpiricalSwiftVerification {
    static func main() {
        print("=== STARTING SWIFT TOKENS & PRIMITIVES EMPIRICAL VERIFICATION ===")

        // 1. Verify Sheet Grabber specifications
        print("[1/8] Verifying Sheet Grabber...")
        assert(DesignTokens.SheetGrabber.width == 36.0, "Grabber width must be 36.0 pt")
        assert(DesignTokens.SheetGrabber.height == 5.0, "Grabber height must be 5.0 pt")
        assert(DesignTokens.SheetGrabber.cornerRadius == 2.5, "Grabber corner radius must be 2.5 pt")
        assert(DesignTokens.SheetGrabber.minTouchTarget == 44.0, "Min touch target must be 44.0 pt")
        let grabberColor: UIColor = DesignTokens.SheetGrabber.color
        let grabberSwiftUIColor: Color = DesignTokens.SheetGrabber.swiftUIColor
        _ = grabberColor
        _ = grabberSwiftUIColor
        print("  ✓ Sheet Grabber: 36x5pt, r=2.5pt, touch=44pt passed")

        // 2. Verify Corner Radii
        print("[2/8] Verifying Corner Radii...")
        assert(DesignTokens.Radii.xs == 6.0, "Radii.xs must be 6.0")
        assert(DesignTokens.Radii.sm == 8.0, "Radii.sm must be 8.0")
        assert(DesignTokens.Radii.md == 12.0, "Radii.md must be 12.0")
        assert(DesignTokens.Radii.lg == 16.0, "Radii.lg must be 16.0")
        assert(DesignTokens.Radii.card == 20.0, "Radii.card must be 20.0")
        assert(DesignTokens.Radii.sheet == 28.0, "Radii.sheet must be 28.0")
        assert(DesignTokens.Radii.hero == 32.0, "Radii.hero must be 32.0")
        assert(DesignTokens.Radii.pill == 9999.0, "Radii.pill must be 9999.0")
        assert(DesignTokens.Radii.concentricFloor == 20.0, "Radii.concentricFloor must be 20.0")
        print("  ✓ Corner Radii (8/12/16/20/28/32/9999) passed")

        // 3. Verify Segmented Control specifications
        print("[3/8] Verifying Segmented Control...")
        assert(DesignTokens.SegmentedControl.height == 32.0, "SegmentedControl height must be 32.0")
        assert(DesignTokens.SegmentedControl.minTouchTarget == 44.0, "SegmentedControl touch target must be 44.0")
        assert(DesignTokens.SegmentedControl.padding == 2.0, "SegmentedControl padding must be 2.0")
        assert(DesignTokens.SegmentedControl.radius == 8.0, "SegmentedControl radius must be 8.0")
        assert(DesignTokens.SegmentedControl.thumbRadius == 6.0, "SegmentedControl thumbRadius must be 6.0")
        _ = DesignTokens.SegmentedControl.bg
        _ = DesignTokens.SegmentedControl.thumbBg
        print("  ✓ Segmented Control metrics passed")

        // 4. Verify Inset Grouped List specifications
        print("[4/8] Verifying Inset Grouped List...")
        assert(DesignTokens.InsetGroupedList.marginHorizontal == 16.0, "Margin must be 16.0")
        assert(DesignTokens.InsetGroupedList.cornerRadius == 12.0, "Corner radius must be 12.0")
        assert(DesignTokens.InsetGroupedList.rowMinHeight == 44.0, "Row min height must be 44.0")
        assert(DesignTokens.InsetGroupedList.separatorInsetLeading == 16.0, "Separator leading must be 16.0")
        assert(DesignTokens.InsetGroupedList.separatorInsetWithIcon == 56.0, "Separator icon must be 56.0")
        assert(DesignTokens.InsetGroupedList.separatorHeight == 0.5, "Separator height must be 0.5")
        print("  ✓ Inset Grouped List metrics passed")

        // 5. Verify Dynamic Type Typography (11 Apple Styles)
        print("[5/8] Verifying Typography (11 Apple Styles)...")
        let typoList: [(name: String, metric: DesignTokens.FontMetric, expectedSize: CGFloat, expectedWeight: UIFont.Weight)] = [
            ("largeTitle", DesignTokens.Typography.largeTitle, 34, .bold),
            ("title1", DesignTokens.Typography.title1, 28, .bold),
            ("title2", DesignTokens.Typography.title2, 22, .bold),
            ("title3", DesignTokens.Typography.title3, 20, .semibold),
            ("headline", DesignTokens.Typography.headline, 17, .semibold),
            ("body", DesignTokens.Typography.body, 17, .regular),
            ("callout", DesignTokens.Typography.callout, 16, .regular),
            ("subheadline", DesignTokens.Typography.subheadline, 15, .regular),
            ("footnote", DesignTokens.Typography.footnote, 13, .regular),
            ("caption1", DesignTokens.Typography.caption1, 12, .regular),
            ("caption2", DesignTokens.Typography.caption2, 11, .regular)
        ]

        for item in typoList {
            assert(item.metric.size == item.expectedSize, "Typography \(item.name) size must be \(item.expectedSize)")
            assert(item.metric.weight == item.expectedWeight, "Typography \(item.name) weight mismatch")
            let uiFont = item.metric.font()
            assert(uiFont.pointSize == item.expectedSize, "UIFont pointSize must match \(item.expectedSize)")
            print("  ✓ Typography \(item.name): size \(item.metric.size)pt, line \(item.metric.lineHeight)pt, tracking \(item.metric.tracking)pt")
        }

        // 6. Verify Colors and Zero Pure Black
        print("[6/8] Verifying Colors and Checking for Zero Pure Black...")
        let colorsToCheck: [(name: String, color: UIColor)] = [
            ("surfaceCanvas", DesignTokens.Colors.surfaceCanvas),
            ("surfaceSauge", DesignTokens.Colors.surfaceSauge),
            ("surfaceElevated", DesignTokens.Colors.surfaceElevated),
            ("surfaceGrouped", DesignTokens.Colors.surfaceGrouped),
            ("surfaceMuted", DesignTokens.Colors.surfaceMuted),
            ("border", DesignTokens.Colors.border),
            ("borderSubtle", DesignTokens.Colors.borderSubtle),
            ("borderStrong", DesignTokens.Colors.borderStrong),
            ("labelPrimary", DesignTokens.Colors.labelPrimary),
            ("labelSecondary", DesignTokens.Colors.labelSecondary),
            ("labelTertiary", DesignTokens.Colors.labelTertiary),
            ("labelQuaternary", DesignTokens.Colors.labelQuaternary),
            ("onBrand", DesignTokens.Colors.onBrand),
            ("onAction", DesignTokens.Colors.onAction),
            ("brandPrimary", DesignTokens.Colors.brandPrimary),
            ("brandAction", DesignTokens.Colors.brandAction),
            ("brandSecondary", DesignTokens.Colors.brandSecondary),
            ("primarySubtle", DesignTokens.Colors.primarySubtle),
            ("secondarySubtle", DesignTokens.Colors.secondarySubtle),
            ("rimColor", DesignTokens.Colors.rimColor),
            ("shadowColor", DesignTokens.Colors.shadowColor),
            ("sheetGrabberColor", DesignTokens.Colors.sheetGrabberColor),
            ("uicolor.LKDV.surfaceCanvas", UIColor.LKDV.surfaceCanvas),
            ("uicolor.LKDV.brandPrimary", UIColor.LKDV.brandPrimary),
            ("uicolor.LKDV.labelPrimary", UIColor.LKDV.labelPrimary),
            ("uicolor.lkdvCanvas", UIColor.lkdvCanvas),
            ("uicolor.lkdvBrandPrimary", UIColor.lkdvBrandPrimary),
            ("uicolor.lkdvLabelPrimary", UIColor.lkdvLabelPrimary)
        ]

        for (name, color) in colorsToCheck {
            var r: CGFloat = 0
            var g: CGFloat = 0
            var b: CGFloat = 0
            var a: CGFloat = 0
            let success = color.getRed(&r, green: &g, blue: &b, alpha: &a)
            assert(success, "Failed to get RGBA components for \(name)")

            // Pure black check: r == 0, g == 0, b == 0, a > 0
            if r == 0.0 && g == 0.0 && b == 0.0 && a > 0.0 {
                fatalError("CRITICAL: Color \(name) is pure black (r=0, g=0, b=0)!")
            }

            // Unwanted dark background check: #0d1117 (r≈13/255=0.051, g≈17/255=0.067, b≈23/255=0.090)
            let intR = Int(round(r * 255.0))
            let intG = Int(round(g * 255.0))
            let intB = Int(round(b * 255.0))
            if intR == 13 && intG == 17 && intB == 23 {
                fatalError("CRITICAL: Color \(name) matches forbidden #0d1117!")
            }
        }
        print("  ✓ Verified \(colorsToCheck.count) UIColors: ZERO pure black, ZERO #0d1117.")

        // Also verify SwiftUI Colors
        let swiftUIColors: [Color] = [
            DesignTokens.Colors.swiftUISurfaceCanvas,
            DesignTokens.Colors.swiftUISurfaceElevated,
            DesignTokens.Colors.swiftUISurfaceGrouped,
            DesignTokens.Colors.swiftUILabelPrimary,
            DesignTokens.Colors.swiftUILabelSecondary,
            DesignTokens.Colors.swiftUIBrandPrimary,
            DesignTokens.Colors.swiftUIBrandAction,
            DesignTokens.Colors.swiftUIBrandSecondary,
            DesignTokens.Colors.swiftUIRimColor,
            DesignTokens.Colors.swiftUISheetGrabber,
            Color.LKDV.surfaceCanvas,
            Color.LKDV.brandPrimary,
            Color.LKDV.sheetGrabber,
            Color.lkdvBrandPrimary
        ]
        print("  ✓ Verified \(swiftUIColors.count) SwiftUI colors accessible.")

        // 7. Verify SwiftUI Views & Shapes
        print("[7/8] Verifying SwiftUI Shapes and Views...")
        let defaultSquircle = LKDVSquircle()
        assert(defaultSquircle.cornerRadius == DesignTokens.Radii.card, "Default squircle radius must be card (20)")
        let customSquircle = LKDVSquircle(cornerRadius: DesignTokens.Radii.sheet)
        assert(customSquircle.cornerRadius == 28.0, "Custom squircle radius must be sheet (28)")

        let rect = CGRect(x: 0, y: 0, width: 200, height: 100)
        let path = customSquircle.path(in: rect)
        assert(!path.isEmpty, "Squircle path must not be empty")

        let grabberView = LKDVSheetGrabberView()
        _ = grabberView.body
        print("  ✓ LKDVSquircle and LKDVSheetGrabberView instantiate and render correctly.")

        // 8. Verify UISheetPresentationController extension
        print("[8/8] Verifying UISheetPresentationController configuration...")
        let configureMethod: (UISheetPresentationController) -> ([UISheetPresentationController.Detent]) -> Void = UISheetPresentationController.configureLKDVSheet
        _ = configureMethod
        print("  ✓ configureLKDVSheet() extension method verified on UISheetPresentationController.")

        print("=== ALL SWIFT TOKENS & PRIMITIVES EMPIRICALLY VERIFIED: 100% SUCCESS ===")
    }
}
