# Synthesis: Milestone M1 Explorers

## Consensus
All 3 explorers have reached complete alignment on the following specifications and required changes:
1. **Source of Truth & Generator**:
   - `src/design/bank.ts` is the single source of truth, compiled via `scripts/generate-design-bank.mjs` to 7 targets including CSS, TypeScript, Tailwind, Swift, Android XML/Kotlin.
   - Synchronized execution via `node scripts/generate-design-bank.mjs` and `npm run design:check`.
2. **Apple Primitives & Metrics**:
   - **Sheet Grabber**: Exact Apple standard 36×5pt, radius 2.5pt (continuous capsule), color `rgba(23, 64, 44, 0.25)` active `rgba(23, 64, 44, 0.40)`. `src/components/ui/Sheet.tsx` must be updated from 48×6px to 36×5pt.
   - **Continuous Radii Alignment**: Contract requires `radii.sm: 8`, `radii.md: 12`, `radii.lg: 16`, `radii.sheet: 28`. This reconciles with native iOS (`SceneDelegate.swift:301`: `sheet.preferredCornerRadius = 28`).
   - **Continuous Squircle**: Math ($n \approx 5$, $\kappa \approx 0.82$). Progressively enhanced with CSS `corner-shape: squircle` and native `CALayer.cornerCurve = .continuous` / `RoundedRectangle(..., style: .continuous)`.
   - **Apple WebKit Typography**: System font primitives (`-apple-system-body`, `-apple-system-headline`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`, `-apple-system-caption2`, etc.) with fallback font stacks.
   - **Apple 5-Tier Materials**: `ultraThin`, `thin`, `regular`, `thick`, `chrome` with WebKit backdrop blur/saturation and specular highlights.
   - **`UISegmentedControl` & `insetGrouped`**: 32pt height / 8pt squircle / 28pt thumb for segmented control; 16pt margin / 12pt radius / 44pt min row height / 0.5px hairline for inset grouped lists.
3. **Pure LKDV Greens & Elimination of Pure Black**:
   - Dark keyboard: `capacitor.config.ts:75` and `ios/App/App/capacitor.config.json:33` must be changed from `style: "DARK"` to `style: "LIGHT"`.
   - Pure black shadows: Convert all `rgba(0, 0, 0, ...)` shadows in `src/styles/tokens.css`, `messages-grammar.css`, `community-social.css`, etc., to forest green `rgba(23, 64, 44, ...)`.
   - Residual `.dark` in `tokens.css`: Replace dark surfaces/scrims with light green / forest green while preserving variables required by existing tests (`prep-dark-ink.test.ts`).
4. **Swift Native Synchronization & Xcode Registration**:
   - Generator `generateSwift(b)` must produce pre-computed normalized RGBA values without runtime string parsing (`UIColor(red:green:blue:alpha:)` and `Color(red:green:blue:opacity:)`).
   - Add `DesignTokens.SheetGrabber`, `DesignTokens.Radii`, `DesignTokens.Typography`, `LKDVSquircle`, and `LKDVSheetGrabberView`.
   - Register `DesignTokens.generated.swift` in `ios/App/App.xcodeproj/project.pbxproj` (`PBXSourcesBuildPhase` of target `App`).
   - Validate with `swiftc -parse ios/App/App/DesignTokens.generated.swift`.
5. **External Skills**:
   - Integrated guidelines from `wondelai/skills@ios-hig-design` and `affaan-m/ecc@liquid-glass-design`.

## Worker Task Assignment (Worker M1)
1. Update `src/design/bank.ts` with:
   - Aligned radii (`sm: 8`, `md: 12`, `lg: 16`, `sheet: 28`).
   - New `components.sheetGrabber`, `components.segmentedControl`, `components.insetGroupedList`.
   - Apple 5-tier materials (`ultraThin`, `thin`, `regular`, `thick`, `chrome`).
   - Apple system typography styles with `webkitPrimitive` (`-apple-system-*`).
2. Update `scripts/generate-design-bank.mjs`:
   - Emit Apple WebKit font classes (`.apple-font-*`).
   - Emit continuous squircle utility classes (`.squircle-*`).
   - Emit sheet grabber variables & classes (`.apple-sheet-grabber`).
   - Emit Apple material classes (`.apple-material-*`).
   - Implement `generateSwift(b)` with pre-computed normalized RGBA, `DesignTokens.SheetGrabber`, `DesignTokens.Radii`, `UIColor.LKDV`, `Color.LKDV`, `LKDVSquircle`, `LKDVSheetGrabberView`.
   - Run `node scripts/generate-design-bank.mjs` to regenerate all 7 artifacts.
3. Clean up Dark Mode & Pure Black:
   - In `capacitor.config.ts`, change `Keyboard.style` from `"DARK"` to `"LIGHT"`.
   - In `ios/App/App/capacitor.config.json`, change `Keyboard.style` to `"LIGHT"`.
   - In `src/styles/tokens.css`, sanitize residual `.dark` blocks and convert all `rgba(0, 0, 0, ...)` shadows to `rgba(23, 64, 44, ...)`. Keep `--lkv-action` and `--lkv-on-action` valid for `prep-dark-ink.test.ts`.
   - In `src/components/ui/Sheet.tsx`, update the grabber div to exact 36×5pt, radius 2.5pt, color `rgba(23, 64, 44, 0.25)`.
4. Register `DesignTokens.generated.swift` in `ios/App/App.xcodeproj/project.pbxproj` under target `App`.
5. Run build and tests:
   - `node scripts/generate-design-bank.mjs`
   - `npm run design:check`
   - `npm run type-check`
   - `swiftc -parse ios/App/App/DesignTokens.generated.swift` (or `xcrun -sdk iphonesimulator swiftc -parse`)
   - `npx vitest run tests/design/ tests/design-system/ tests/capacitor-release-config.spec.ts`
