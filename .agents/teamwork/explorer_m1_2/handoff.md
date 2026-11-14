# Handoff Report: Explorer M1-2 — Apple Design Tokens & Primitives Architecture (LKDV Greens)

## 1. Observation

### 1.1 Codebase & Token Artifacts Inspected
1. **`src/design/bank.ts`** (Lines 1–394):
   - Defines master tokens for `surfaces`, `inks`, `brand`, `glass`, `typography`, `radii`, `zIndex`, `spacing`, `motion`, and `ghosts`.
   - **Discrepancies observed**:
     - Line 116–122 & 288–297: `radii` defines `sm: 16`, `md: 20`, `lg: 24`, `sheet: 44`. However, `SCOPE.md` Interface Contract requires `radii.sm: 8`, `radii.md: 12`, `radii.lg: 16`, `radii.sheet: 28`.
     - Lines 67–82 & 235–264: `glass` defines levels `clear`, `regular`, `prominent`, `capsule`, but lacks official Apple UIKit Material primitives (`ultraThin`, `thin`, `regular`, `thick`, `chrome`).
     - Lines 84–112 & 265–286: `typography` defines 11 Dynamic Type metric entries with `size`, `lineHeight`, `weight`, and `tracking`, but omits the official WebKit CSS primitives (`-apple-system-body`, `-apple-system-headline`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`, `-apple-system-caption2`, etc.).
     - Lines 1–394: Complete absence of dedicated Apple component specifications for:
       - Sheet Grabber (Apple HIG exact 36×5pt, radius 2.5pt, translucent `rgba(23, 64, 44, 0.25)`).
       - `UISegmentedControl` (height 32pt, touch target 44pt, padding 2pt, radius 8pt container / 6pt thumb).
       - `UICollectionViewListCell` / `UITableViewStyleInsetGrouped` (margin 16pt, corner radius 12pt, min row height 44pt, separator leading inset 16/56pt, 0.5px hairline `rgba(23, 43, 36, 0.12)`).

2. **`scripts/generate-design-bank.mjs`** (Lines 1–597):
   - Currently compiles `src/design/bank.ts` into 7 targets:
     1. `src/styles/tokens.generated.css`
     2. `src/design/tokens.generated.ts`
     3. `tailwind.preset.generated.js` (ESM)
     4. `tailwind.preset.generated.cjs` (CommonJS)
     5. `ios/App/App/DesignTokens.generated.swift`
     6. `android/app/src/main/res/values/design_tokens.generated.xml`
     7. `android/app/src/main/java/com/lekitduvoyageur/app/LKDVTheme.generated.kt`
   - Verified execution via `npm run design:check`: returns exit code 0 (`✅ All design bank generated artifacts are in sync with src/design/bank.ts.`).
   - Does not currently emit CSS utility classes for Apple WebKit dynamic type (`.apple-font-*`), continuous squircle corners (`.squircle-*`), sheet grabber (`.apple-sheet-grabber`), or segmented controls.

3. **`src/components/ui/Sheet.tsx`** (Lines 145–150):
   - Line 149 verbatim: `<div className="h-1.5 w-12 rounded-full bg-[color:var(--lkv-text-muted)] opacity-40" />`
   - Violates Apple HIG specification: uses 6×48px (`h-1.5 w-12`) instead of exact 36×5pt with 2.5pt radius and green translucent color `rgba(23, 64, 44, 0.25)`.

4. **`src/components/ui/InsetGroupedList.tsx`** (Lines 22–37):
   - Line 28: `<div className="g1 overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-rim)] divide-y divide-[color:var(--glass-rim)]">`
   - Uses `rounded-[var(--lkv-radius-card)]` (28px) and `divide-y` full-width dividers rather than Apple HIG standard 12pt continuous radius and indented 0.5pt separators (16pt leading inset).

5. **`capacitor.config.ts`** (Lines 73–77):
   - Line 75 verbatim: `style: "DARK" as any` under `Keyboard`.
   - Violates LKDV 100% Light Mode Liquid Glass rule (causes dark iOS keyboard to render instead of light glass keyboard).

6. **Shadow & Color Audit in Stylesheets**:
   - `src/styles/tokens.css`:
     - Line 706: `0 8px 32px rgba(0, 0, 0, 0.14)`
     - Line 713: `0 24px 48px -16px rgba(0, 0, 0, 0.5)`
     - Line 714: `0 -4px 24px -8px rgba(0, 0, 0, 0.3)`
     - Line 1030: `0 4px 16px rgba(0, 0, 0, 0.25)`
     - Line 1039: `0 4px 14px rgba(0,0,0,0.18)`
   - `src/components/messaging/messages-grammar.css`:
     - Line 1395: `box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);`
     - Line 1410: `box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);`
   - Direct violation of the "Zero pure black `#000000` / Pure LKDV green palette" requirement.

---

## 2. Logic Chain

### 2.1 Apple WebKit CSS Primitives & Dynamic Type
- **Premise**: WebKit on iOS natively implements Dynamic Type via prefixed system font keywords in the CSS `font:` shorthand.
- **Specification**:
  - `font: -apple-system-large-title` -> Size 34pt, Leading 41pt, Weight 700 (Bold), Tracking +0.37px
  - `font: -apple-system-title1` -> Size 28pt, Leading 34pt, Weight 700 (Bold), Tracking +0.36px
  - `font: -apple-system-title2` -> Size 22pt, Leading 28pt, Weight 700 (Bold), Tracking +0.35px
  - `font: -apple-system-title3` -> Size 20pt, Leading 25pt, Weight 600 (Semibold), Tracking +0.38px
  - `font: -apple-system-headline` -> Size 17pt, Leading 22pt, Weight 600 (Semibold), Tracking -0.41px
  - `font: -apple-system-body` -> Size 17pt, Leading 22pt, Weight 400 (Regular), Tracking -0.41px
  - `font: -apple-system-callout` -> Size 16pt, Leading 21pt, Weight 400 (Regular), Tracking -0.32px
  - `font: -apple-system-subheadline` -> Size 15pt, Leading 20pt, Weight 400 (Regular), Tracking -0.24px
  - `font: -apple-system-footnote` -> Size 13pt, Leading 18pt, Weight 400 (Regular), Tracking -0.08px
  - `font: -apple-system-caption1` -> Size 12pt, Leading 16pt, Weight 400 (Regular), Tracking 0.00px
  - `font: -apple-system-caption2` -> Size 11pt, Leading 13pt, Weight 400 (Regular), Tracking +0.07px
- **Deduction**: On iOS Safari / WebKit WebViews (Capacitor), using `font: -apple-system-*` connects directly to iOS Dynamic Type accessibility scaling. On non-WebKit platforms (Chromium, Firefox, Android), `-apple-system-*` keywords are unsupported. Therefore, every typography token must declare both the `webkitPrimitive` shorthand AND exact numeric fallbacks (`font-family`, `font-size`, `line-height`, `font-weight`, `letter-spacing`).

### 2.2 Continuous Corner Radii (Squircle) Geometry & Math
- **Premise**: Standard CSS `border-radius: R` generates circular arc corners ($C_1$ tangent continuity, but $C_2$ curvature discontinuity with an abrupt step from $\kappa=0$ to $\kappa=1/R$). Apple hardware and iOS UI use continuous corners (squircle / Lamé superellipse with $n \approx 5$) where curvature transitions smoothly ($G2$ continuity).
- **Mathematical Model**:
  $$\left|\frac{x}{a}\right|^n + \left|\frac{y}{b}\right|^n = 1 \quad (n \approx 4.5\text{ to }5.0)$$
  - In cubic Bézier curve approximation: circle corners use kappa handle distance $\kappa_{circle} = 4(\sqrt{2}-1)/3 \approx 0.5523$. Apple squircle corners use an extended handle distance $\kappa_{squircle} \approx 0.82$, easing into the flat edges with ~60% corner smoothing.
- **CSS Standard vs Progressive Enhancement**:
  - CSS Borders and Box Decorations Module Level 4 introduces `corner-shape: squircle`.
  - Supported natively in Chromium 139+.
  - Safari/WebKit supports progressive enhancement via:
    ```css
    .squircle-md {
      border-radius: var(--lkv-radius-md, 12px);
    }
    @supports (corner-shape: squircle) {
      .squircle-md {
        corner-shape: squircle;
      }
    }
    ```
  - For pixel-perfect SVG clipping: path generator with extended cubic Bézier control points.
  - Native iOS (Capacitor Swift bridge):
    - UIKit: `layer.cornerRadius = DesignTokens.Radii.md; layer.cornerCurve = .continuous`
    - SwiftUI: `RoundedRectangle(cornerRadius: DesignTokens.Radii.md, style: .continuous)`

### 2.3 Sheet Grabber Specifications
- **Premise**: `UISheetPresentationController.prefersGrabberVisible = true` is the Apple HIG standard for modal drawer sheets.
- **Specification**:
  - Width: 36pt (exact 36px)
  - Height: 5pt (exact 5px)
  - Corner radius: 2.5pt (capsule `border-radius: 2.5px` or `9999px`)
  - Margin top: 5pt (5px)
  - Rest color: `rgba(23, 64, 44, 0.25)` (translucent `brand.primary`)
  - Dragging / active color: `rgba(23, 64, 44, 0.40)`
  - Touch target container: $\ge 44\text{pt}$ vertical height around the centered grabber.
- **Deduction**: Centralizing these in `bank.ts` under `components.sheetGrabber` allows both `Sheet.tsx` and native Swift bottom sheets to share identical dimensions and colors.

### 2.4 Apple Material Blur & Translucency
- **Premise**: iOS UIKit `UIVisualEffectView` provides 5 core system material tiers.
- **Mapping to LKDV Greens**:
  1. `ultraThin`: `backdrop-filter: blur(10px) saturate(140%)`, bg: `rgba(255, 255, 255, 0.55)`
  2. `thin`: `backdrop-filter: blur(16px) saturate(160%)`, bg: `rgba(255, 255, 255, 0.70)`
  3. `regular`: `backdrop-filter: blur(20px) saturate(180%)`, bg: `rgba(255, 255, 255, 0.82)`
  4. `thick`: `backdrop-filter: blur(30px) saturate(190%)`, bg: `rgba(251, 250, 246, 0.88)` (tinted with `surfaces.canvas`)
  5. `chrome`: `blur(40px) saturate(200%)`, bg: `rgba(245, 247, 243, 0.90)` (tinted with `surfaces.sauge`)
- **Specular & Hairline Rim**:
  - Inner specular highlight: `inset 0 0.5px 0 0 rgba(255, 255, 255, 0.65)`
  - Outer hairline border: `0 0 0 0.5px rgba(23, 43, 36, 0.12)`
  - Elevation shadow: `0 10px 32px rgba(23, 64, 44, 0.12)` (zero pure black)
  - Always pair `-webkit-backdrop-filter` with `backdrop-filter`.

### 2.5 `UISegmentedControl` and `insetGrouped` List Cell Metrics
- **`UISegmentedControl`**:
  - Height: 32pt (standard native height), interactive envelope: 44pt
  - Internal gutter padding: 2pt
  - Container radius: 8pt continuous squircle (`radii.sm`)
  - Thumb pill height: 28pt (32 - 4)
  - Thumb radius: 6pt continuous squircle
  - Background: `rgba(23, 64, 44, 0.08)` or `#F0F5EE` (`surfaces.surfaceGrouped`)
  - Active thumb background: `#FFFFFF` (`surfaces.surfaceElevated`)
  - Thumb shadow: `0 1px 3px rgba(23, 64, 44, 0.12), 0 0.5px 1px rgba(23, 64, 44, 0.08)`
  - Inactive separator: 1pt wide × 16pt high, `rgba(23, 43, 36, 0.15)`
  - Typography: 13pt (`-apple-system-subheadline`), weight 500/600, tracking -0.08px
  - Inks: Active `#172B24`, Inactive `#56665D`
- **`insetGrouped` List Cell**:
  - Horizontal margin: 16pt
  - Section corner radius: 12pt continuous squircle (`radii.md`)
  - Row minimum height: 44pt (standard touch target)
  - Row padding: horizontal 16pt, vertical 12pt
  - Hairline separator: height 0.5pt, color `rgba(23, 43, 36, 0.12)`
  - Separator leading inset: 16pt (text) or 56pt (icon 28pt + 16pt margin + 12pt gap)
  - Separator trailing inset: 0pt
  - Final row separator: omitted (hidden)
  - Group background: `#FFFFFF` on canvas `#FBFAF6`

---

## 3. Caveats

1. **Browser Support for `corner-shape: squircle`**:
   - `corner-shape: squircle` is fully supported in Chromium 139+, but Safari/WebKit currently uses `border-radius` with standard G1 curves unless clipped via SVG or rendered in native Swift (`CALayer.cornerCurve = .continuous`). Therefore, web elements must rely on `@supports (corner-shape: squircle)` progressive enhancement with calibrated optical radii fallback.
2. **Dynamic Type Font Shorthand Quirks in WebKit**:
   - `font: -apple-system-body` overrides `font-weight` and `line-height` if declared after those properties. To prevent unexpected style resets, the generated CSS utility classes must declare `font: -apple-system-*` as the primary rule followed by explicit `letter-spacing` and `font-family` fallbacks.
3. **Pure Black Shadow Elimination**:
   - Multiple stylesheets (`tokens.css`, `messages-grammar.css`, etc.) currently have hardcoded `rgba(0, 0, 0, ...)` shadows. While M1 generates clean tokens, replacing every call site in component CSS files is coordinated between M1 and M2.

---

## 4. Conclusion & Proposed Architecture

### 4.1 Exact Structure for `src/design/bank.ts`

```typescript
/**
 * src/design/bank.ts — Source de vérité unique du Design System LKDV
 * 100 % Mode Clair Liquid Glass — Pure Palette Verte LKDV, Zéro noir (#000/#101010/#121815)
 * Spécifications exactes Apple (WebKit CSS, HIG, UIKit, SwiftUI).
 */

export interface SurfaceTokens {
  readonly canvas: string;          // Fond d'écran / toile claire (#FBFAF6)
  readonly sauge: string;           // Sauge très pâle (#F5F7F3)
  readonly canvasFallback: string;  // Sauge très pâle (#F5F7F3)
  readonly canvasVoile: string;     // Voile vert forêt (rgba(242, 246, 243, 0.78))
  readonly surfaceElevated: string; // Verre blanc pur (#FFFFFF)
  readonly surfaceGrouped: string;  // Sauge 50 (#F0F5EE, pour InsetGroupedList)
  readonly surfaceMuted: string;    // Gris sauge (#EDF1EA)
  readonly border: string;          // Bordure teintée vert (rgba(23, 43, 36, 0.12))
  readonly borderSubtle: string;    // Bordure douce (rgba(23, 43, 36, 0.06))
  readonly borderStrong: string;    // Bordure forte (rgba(23, 43, 36, 0.24))
  readonly fieldBg: string;         // Fond de champ (rgba(255, 255, 255, 0.70))
  readonly fieldBorder: string;     // Bordure de champ (rgba(23, 43, 36, 0.15))
}

export interface InkTokens {
  readonly labelPrimary: string;    // Vert forêt profond WCAG AAA (#172B24)
  readonly labelSecondary: string;  // Vert forêt moyen WCAG AA (#56665D)
  readonly labelTertiary: string;   // Vert forêt adouci (#46584D)
  readonly labelQuaternary: string; // Vert forêt subtil (#8C9790)
  readonly onBrand: string;         // Blanc sur bouton vert (#FFFFFF)
  readonly onAction: string;        // Blanc sur action (#FFFFFF)
  readonly onMedia: string;         // Blanc sur média plein écran (#FFFFFF)
  readonly scrim: string;           // Voile protecteur texte photo (rgba(16, 28, 23, 0.42))
}

export interface StatusColor {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

export interface BrandTokens {
  readonly primary: string;           // Vert forêt marque (#17402C)
  readonly primaryHover: string;      // Survol primaire (#205238)
  readonly primarySoft: string;       // Vert adouci (#365233)
  readonly action: string;            // Vert action LKDV (#226148)
  readonly actionHover: string;       // Survol action (#1B4F3A)
  readonly secondary: string;         // Vert sauge (#5B7F55)
  readonly secondaryHover: string;    // Survol sauge (#4A6B44)
  readonly primarySubtle: string;     // Vert clair (#D3EBD9)
  readonly secondarySubtle: string;   // Sauge clair (#D8E5D5)
  readonly onSecondarySubtle: string; // Vert forêt sur sauge clair (#17402C)
  readonly onAction: string;          // Blanc (#FFFFFF)
  readonly status: {
    readonly success: StatusColor;
    readonly warning: StatusColor;
    readonly danger: StatusColor;
    readonly info: StatusColor;
  };
}

export interface AppleMaterialLevel {
  readonly blur: string;
  readonly sat: string;
  readonly bg: string;
  readonly cssFilter: string;
}

export interface AppleMaterialTokens {
  readonly ultraThin: AppleMaterialLevel;
  readonly thin: AppleMaterialLevel;
  readonly regular: AppleMaterialLevel;
  readonly thick: AppleMaterialLevel;
  readonly chrome: AppleMaterialLevel;
  readonly specularHighlight: string;
  readonly rimBorder: string;
  readonly shadow: string;
  readonly shadowElevated: string;
}

export interface DynamicTypeStyle {
  readonly size: number;              // px
  readonly lineHeight: number;        // px
  readonly weight: 400 | 500 | 600 | 700;
  readonly tracking: number;          // px
  readonly webkitPrimitive: string;   // ex: '-apple-system-body'
  readonly textStyle: string;         // ex: 'body'
}

export interface TypographyTokens {
  readonly styles: {
    readonly largeTitle: DynamicTypeStyle;
    readonly title1: DynamicTypeStyle;
    readonly title2: DynamicTypeStyle;
    readonly title3: DynamicTypeStyle;
    readonly headline: DynamicTypeStyle;
    readonly body: DynamicTypeStyle;
    readonly callout: DynamicTypeStyle;
    readonly subheadline: DynamicTypeStyle;
    readonly footnote: DynamicTypeStyle;
    readonly caption1: DynamicTypeStyle;
    readonly caption2: DynamicTypeStyle;
  };
  readonly fontFamilies: {
    readonly sans: string;
    readonly display: string;
    readonly brand: string;
    readonly serif: string;
    readonly mono: string;
  };
}

export interface ContinuousCornerTokens {
  readonly xs: number;                // 6pt
  readonly sm: number;                // 8pt (chips, badges, segmented thumb)
  readonly md: number;                // 12pt (insetGrouped cells, standard inputs)
  readonly lg: number;                // 16pt (prominent cards, alerts)
  readonly card: number;              // 20pt (dashboard cards)
  readonly sheet: number;             // 28pt (bottom sheets, drawer headers)
  readonly hero: number;              // 32pt
  readonly pill: number;              // 9999pt (full capsules)
  readonly concentricFloor: number;   // 12pt
  readonly smoothing: number;         // 0.82 (Bézier kappa multiplier for Apple squircle)
}

export interface SheetGrabberTokens {
  readonly width: number;             // 36 (exact Apple HIG 36pt)
  readonly height: number;            // 5 (exact Apple HIG 5pt)
  readonly radius: number;            // 2.5 (exact 2.5pt capsule)
  readonly color: string;             // 'rgba(23, 64, 44, 0.25)' (translucent LKDV brand)
  readonly activeColor: string;       // 'rgba(23, 64, 44, 0.40)' (on drag)
  readonly topOffset: number;         // 5 (5pt margin top)
  readonly minTouchTarget: number;    // 44 (touch container height)
}

export interface SegmentedControlTokens {
  readonly height: number;            // 32 (standard iOS 13+ UISegmentedControl)
  readonly minTouchTarget: number;    // 44 (HIG touch target)
  readonly padding: number;           // 2 (2pt internal gutter)
  readonly radius: number;            // 8 (8pt continuous squircle)
  readonly thumbRadius: number;       // 6 (6pt continuous squircle)
  readonly bg: string;                // 'rgba(23, 64, 44, 0.08)' (grouped/sauge tint)
  readonly thumbBg: string;           // '#FFFFFF' (elevated surface)
  readonly thumbShadow: string;       // '0 1px 3px rgba(23, 64, 44, 0.12), 0 0.5px 1px rgba(23, 64, 44, 0.08)'
  readonly textActive: string;        // '#172B24' (inks.labelPrimary)
  readonly textInactive: string;      // '#56665D' (inks.labelSecondary)
  readonly separatorColor: string;    // 'rgba(23, 43, 36, 0.15)'
  readonly separatorHeight: number;   // 16 (16pt high vertical divider)
}

export interface InsetGroupedListTokens {
  readonly marginHorizontal: number;       // 16 (16pt screen side margin)
  readonly cornerRadius: number;           // 12 (12pt continuous squircle radii.md)
  readonly rowMinHeight: number;           // 44 (44pt standard single-line row)
  readonly rowSubtitleHeight: number;      // 52 (52pt subtitle row)
  readonly rowPaddingHorizontal: number;   // 16 (16pt cell horizontal padding)
  readonly rowPaddingVertical: number;     // 12 (12pt cell vertical padding)
  readonly separatorInsetLeading: number;  // 16 (16pt text-only leading inset)
  readonly separatorInsetWithIcon: number; // 56 (16 + 28 + 12 leading inset with icon)
  readonly separatorInsetTrailing: number; // 0 (0pt trailing inset)
  readonly separatorColor: string;         // 'rgba(23, 43, 36, 0.12)' (hairline divider)
  readonly separatorHeight: number;        // 0.5 (0.5pt hairline)
  readonly bg: string;                     // '#FBFAF6' (canvas background)
  readonly groupBg: string;                // '#FFFFFF' (elevated surface)
  readonly activeBg: string;               // 'rgba(23, 64, 44, 0.05)' (pressed state)
  readonly headerColor: string;            // '#56665D' (inks.labelSecondary)
  readonly footerColor: string;            // '#56665D' (inks.labelSecondary)
}

export interface ZIndexTokens {
  readonly base: number;              // 1
  readonly sticky: number;            // 100
  readonly subbar: number;            // 200
  readonly tabbar: number;            // 300
  readonly hud: number;               // 400
  readonly sheet: number;             // 500
  readonly modal: number;             // 600
  readonly alert: number;             // 700
}

export interface SpacingTokens {
  readonly 0: number;
  readonly 1: number;
  readonly 2: number;
  readonly 3: number;
  readonly 4: number;
  readonly 5: number;
  readonly 6: number;
  readonly 8: number;
  readonly 10: number;
  readonly 12: number;
  readonly 16: number;
  readonly touchMinApple: number;     // 44
  readonly touchMinAndroid: number;   // 48
  readonly navHeight: number;         // 60
  readonly tabBarHeight: number;      // 64
  readonly bottomClearance: number;   // 88
}

export interface MotionTokens {
  readonly duration: {
    readonly instant: string;
    readonly fast: string;
    readonly med: string;
    readonly slow: string;
  };
  readonly easing: {
    readonly snappy: string;
    readonly bouncy: string;
    readonly smooth: string;
    readonly glass: string;
    readonly out: string;
    readonly emphasis: string;
  };
  readonly pressScale: number;
}

export interface GhostVariablesCatalog {
  readonly [variableName: string]: string;
}

export interface DesignBank {
  readonly surfaces: SurfaceTokens;
  readonly inks: InkTokens;
  readonly brand: BrandTokens;
  readonly materials: AppleMaterialTokens;
  readonly typography: TypographyTokens;
  readonly radii: ContinuousCornerTokens;
  readonly components: {
    readonly sheetGrabber: SheetGrabberTokens;
    readonly segmentedControl: SegmentedControlTokens;
    readonly insetGroupedList: InsetGroupedListTokens;
  };
  readonly zIndex: ZIndexTokens;
  readonly spacing: SpacingTokens;
  readonly motion: MotionTokens;
  readonly ghosts: GhostVariablesCatalog;
}

export const bank: DesignBank = {
  surfaces: {
    canvas: '#FBFAF6',
    sauge: '#F5F7F3',
    canvasFallback: '#F5F7F3',
    canvasVoile: 'rgba(242, 246, 243, 0.78)',
    surfaceElevated: '#FFFFFF',
    surfaceGrouped: '#F0F5EE',
    surfaceMuted: '#EDF1EA',
    border: 'rgba(23, 43, 36, 0.12)',
    borderSubtle: 'rgba(23, 43, 36, 0.06)',
    borderStrong: 'rgba(23, 43, 36, 0.24)',
    fieldBg: 'rgba(255, 255, 255, 0.70)',
    fieldBorder: 'rgba(23, 43, 36, 0.15)',
  },
  inks: {
    labelPrimary: '#172B24',
    labelSecondary: '#56665D',
    labelTertiary: '#46584D',
    labelQuaternary: '#8C9790',
    onBrand: '#FFFFFF',
    onAction: '#FFFFFF',
    onMedia: '#FFFFFF',
    scrim: 'rgba(16, 28, 23, 0.42)',
  },
  brand: {
    primary: '#17402C',
    primaryHover: '#205238',
    primarySoft: '#365233',
    action: '#226148',
    actionHover: '#1B4F3A',
    secondary: '#5B7F55',
    secondaryHover: '#4A6B44',
    primarySubtle: '#D3EBD9',
    secondarySubtle: '#D8E5D5',
    onSecondarySubtle: '#17402C',
    onAction: '#FFFFFF',
    status: {
      success: { fg: '#3D6038', bg: '#EAF3E9', border: '#B4D4B0' },
      warning: { fg: '#8F671E', bg: '#FBF1DC', border: '#E8CF96' },
      danger: { fg: '#85261E', bg: '#F5DDD9', border: '#DFA8A1' },
      info: { fg: '#2C4C5E', bg: '#DDE7EE', border: '#A3BDCC' },
    },
  },
  materials: {
    ultraThin: {
      blur: '10px',
      sat: '140%',
      bg: 'rgba(255, 255, 255, 0.55)',
      cssFilter: 'blur(10px) saturate(140%)',
    },
    thin: {
      blur: '16px',
      sat: '160%',
      bg: 'rgba(255, 255, 255, 0.70)',
      cssFilter: 'blur(16px) saturate(160%)',
    },
    regular: {
      blur: '20px',
      sat: '180%',
      bg: 'rgba(255, 255, 255, 0.82)',
      cssFilter: 'blur(20px) saturate(180%)',
    },
    thick: {
      blur: '30px',
      sat: '190%',
      bg: 'rgba(251, 250, 246, 0.88)',
      cssFilter: 'blur(30px) saturate(190%)',
    },
    chrome: {
      blur: '40px',
      sat: '200%',
      bg: 'rgba(245, 247, 243, 0.90)',
      cssFilter: 'blur(40px) saturate(200%)',
    },
    specularHighlight: 'inset 0 0.5px 0 0 rgba(255, 255, 255, 0.65)',
    rimBorder: '0 0 0 0.5px rgba(23, 43, 36, 0.12)',
    shadow: '0 10px 32px rgba(23, 64, 44, 0.12)',
    shadowElevated: '0 16px 48px rgba(23, 64, 44, 0.16)',
  },
  typography: {
    styles: {
      largeTitle:  { size: 34, lineHeight: 41, weight: 700, tracking: 0.37, webkitPrimitive: '-apple-system-large-title', textStyle: 'largeTitle' },
      title1:      { size: 28, lineHeight: 34, weight: 700, tracking: 0.36, webkitPrimitive: '-apple-system-title1', textStyle: 'title1' },
      title2:      { size: 22, lineHeight: 28, weight: 700, tracking: 0.35, webkitPrimitive: '-apple-system-title2', textStyle: 'title2' },
      title3:      { size: 20, lineHeight: 25, weight: 600, tracking: 0.38, webkitPrimitive: '-apple-system-title3', textStyle: 'title3' },
      headline:    { size: 17, lineHeight: 22, weight: 600, tracking: -0.41, webkitPrimitive: '-apple-system-headline', textStyle: 'headline' },
      body:        { size: 17, lineHeight: 22, weight: 400, tracking: -0.41, webkitPrimitive: '-apple-system-body', textStyle: 'body' },
      callout:     { size: 16, lineHeight: 21, weight: 400, tracking: -0.32, webkitPrimitive: '-apple-system-callout', textStyle: 'callout' },
      subheadline: { size: 15, lineHeight: 20, weight: 400, tracking: -0.24, webkitPrimitive: '-apple-system-subheadline', textStyle: 'subheadline' },
      footnote:    { size: 13, lineHeight: 18, weight: 400, tracking: -0.08, webkitPrimitive: '-apple-system-footnote', textStyle: 'footnote' },
      caption1:    { size: 12, lineHeight: 16, weight: 400, tracking: 0.00, webkitPrimitive: '-apple-system-caption1', textStyle: 'caption1' },
      caption2:    { size: 11, lineHeight: 13, weight: 400, tracking: 0.07, webkitPrimitive: '-apple-system-caption2', textStyle: 'caption2' },
    },
    fontFamilies: {
      sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif",
      display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      brand: "'Manrope', -apple-system, sans-serif",
      serif: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
      mono: "'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
  },
  radii: {
    xs: 6,
    sm: 8,              // exact SCOPE.md radii.sm: 8pt
    md: 12,             // exact SCOPE.md radii.md: 12pt
    lg: 16,             // exact SCOPE.md radii.lg: 16pt
    card: 20,
    sheet: 28,          // exact SCOPE.md radii.sheet: 28pt
    hero: 32,
    pill: 9999,
    concentricFloor: 12,
    smoothing: 0.82,
  },
  components: {
    sheetGrabber: {
      width: 36,
      height: 5,
      radius: 2.5,
      color: 'rgba(23, 64, 44, 0.25)',
      activeColor: 'rgba(23, 64, 44, 0.40)',
      topOffset: 5,
      minTouchTarget: 44,
    },
    segmentedControl: {
      height: 32,
      minTouchTarget: 44,
      padding: 2,
      radius: 8,
      thumbRadius: 6,
      bg: 'rgba(23, 64, 44, 0.08)',
      thumbBg: '#FFFFFF',
      thumbShadow: '0 1px 3px rgba(23, 64, 44, 0.12), 0 0.5px 1px rgba(23, 64, 44, 0.08)',
      textActive: '#172B24',
      textInactive: '#56665D',
      separatorColor: 'rgba(23, 43, 36, 0.15)',
      separatorHeight: 16,
    },
    insetGroupedList: {
      marginHorizontal: 16,
      cornerRadius: 12,
      rowMinHeight: 44,
      rowSubtitleHeight: 52,
      rowPaddingHorizontal: 16,
      rowPaddingVertical: 12,
      separatorInsetLeading: 16,
      separatorInsetWithIcon: 56,
      separatorInsetTrailing: 0,
      separatorColor: 'rgba(23, 43, 36, 0.12)',
      separatorHeight: 0.5,
      bg: '#FBFAF6',
      groupBg: '#FFFFFF',
      activeBg: 'rgba(23, 64, 44, 0.05)',
      headerColor: '#56665D',
      footerColor: '#56665D',
    },
  },
  zIndex: {
    base: 1,
    sticky: 100,
    subbar: 200,
    tabbar: 300,
    hud: 400,
    sheet: 500,
    modal: 600,
    alert: 700,
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    touchMinApple: 44,
    touchMinAndroid: 48,
    navHeight: 60,
    tabBarHeight: 64,
    bottomClearance: 88,
  },
  motion: {
    duration: {
      instant: '100ms',
      fast: '200ms',
      med: '300ms',
      slow: '450ms',
    },
    easing: {
      snappy: 'var(--ease-emphasis)',
      bouncy: 'var(--ease-spring)',
      smooth: 'var(--ease-smooth)',
      glass: 'var(--ease-glass)',
      out: 'var(--ease-out)',
      emphasis: 'var(--ease-emphasis)',
    },
    pressScale: 0.97,
  },
  ghosts: {
    '--lkv-text-caption-1': '12px',
    '--lkv-line-caption-1': '16px',
    '--glass-secondary': '#56665D',
    '--glass-specular': 'inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 2px 8px rgba(23, 64, 44, 0.06)',
    '--bg-body': '#FBFAF6',
    '--lkv-native-bar-height': '64px',
    '--glass-bg-subtle': 'rgba(240, 245, 238, 0.70)',
    '--glass-bg-prominent': 'rgba(235, 242, 236, 0.95)',
    '--glass-bg-base': 'rgba(255, 255, 255, 0.72)',
    '--z-nav': '300',
    '--lkv-radius-pill': '9999px',
    '--lkv-surface-primary': '#FFFFFF',
    '--lkv-font-mono': '"IBM Plex Mono", SFMono-Regular, monospace',
    '--white-glass': 'rgba(255, 255, 255, 0.78)',
    '--kb-inset': 'env(keyboard-inset-height, 0px)',
    '--shell-top-padding': 'calc(env(safe-area-inset-top, 0px) + 12px)',
    '--cookie-banner-h': '0px',
    '--font-inter': '"Inter", -apple-system, sans-serif',
    '--font-sf': '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    '--lkv-warn': '#D97706',
    '--lkv-like': '#E11D48',
    '--forest-500': '#3D6038',
    '--lkv-text': '#172B24',
    '--cv2-layer-z': '1',
    '--post-pill-top': '12px',
    '--post-pill-h': '32px',
    '--lkv-sheet-from': 'translateY(100%)',
    '--lkdv-text-scale': '1',
    '--lkdv-a11y-map-min-height': '280px',
    '--explorer-carousel-height': '140px',
    '--msg-split': '360px',
    '--space-7': '28px',
    '--lkdv-cd-kb': 'env(keyboard-inset-height, 0px)',
    '--result-tone': '#17402C',
    '--lkdv-progress': '0%',
    '--card-radius': '20px',
  },
} as const;

export default bank;
```

### 4.2 Additions to `scripts/generate-design-bank.mjs`

1. **CSS Generation (`generateCss`)**:
   - Emit Apple WebKit font utility classes:
     ```css
     .apple-font-large-title { font: -apple-system-large-title; font-family: var(--font-display); letter-spacing: 0.37px; }
     .apple-font-title1 { font: -apple-system-title1; font-family: var(--font-display); letter-spacing: 0.36px; }
     .apple-font-title2 { font: -apple-system-title2; font-family: var(--font-display); letter-spacing: 0.35px; }
     .apple-font-title3 { font: -apple-system-title3; font-family: var(--font-display); letter-spacing: 0.38px; }
     .apple-font-headline { font: -apple-system-headline; font-family: var(--font-sans); font-weight: 600; letter-spacing: -0.41px; }
     .apple-font-body { font: -apple-system-body; font-family: var(--font-sans); letter-spacing: -0.41px; }
     .apple-font-callout { font: -apple-system-body; font-family: var(--font-sans); font-size: 16px; line-height: 21px; letter-spacing: -0.32px; }
     .apple-font-subheadline { font: -apple-system-subheadline; font-family: var(--font-sans); letter-spacing: -0.24px; }
     .apple-font-footnote { font: -apple-system-footnote; font-family: var(--font-sans); letter-spacing: -0.08px; }
     .apple-font-caption1 { font: -apple-system-caption1; font-family: var(--font-sans); letter-spacing: 0px; }
     .apple-font-caption2 { font: -apple-system-caption2; font-family: var(--font-sans); letter-spacing: 0.07px; }
     ```
   - Emit Sheet Grabber CSS variables and utility class:
     ```css
     --sheet-grabber-w: 36px;
     --sheet-grabber-h: 5px;
     --sheet-grabber-r: 2.5px;
     --sheet-grabber-color: rgba(23, 64, 44, 0.25);
     --sheet-grabber-color-active: rgba(23, 64, 44, 0.40);

     .apple-sheet-grabber {
       width: var(--sheet-grabber-w);
       height: var(--sheet-grabber-h);
       border-radius: var(--sheet-grabber-r);
       background-color: var(--sheet-grabber-color);
       margin-left: auto;
       margin-right: auto;
       transition: background-color 0.2s ease;
     }
     .apple-sheet-grabber:active,
     .apple-sheet-grabber.is-dragging {
       background-color: var(--sheet-grabber-color-active);
     }
     ```
   - Emit Continuous Squircle utility classes:
     ```css
     .squircle-sm { border-radius: var(--lkv-radius-sm); }
     .squircle-md { border-radius: var(--lkv-radius-md); }
     .squircle-lg { border-radius: var(--lkv-radius-lg); }
     .squircle-sheet { border-radius: var(--lkv-radius-sheet) var(--lkv-radius-sheet) 0 0; }
     @supports (corner-shape: squircle) {
       .squircle-sm, .squircle-md, .squircle-lg, .squircle-sheet { corner-shape: squircle; }
     }
     ```
   - Emit Apple Material utility classes:
     ```css
     .apple-material-ultra-thin {
       background: rgba(255, 255, 255, 0.55);
       -webkit-backdrop-filter: blur(10px) saturate(140%);
       backdrop-filter: blur(10px) saturate(140%);
     }
     .apple-material-thin {
       background: rgba(255, 255, 255, 0.70);
       -webkit-backdrop-filter: blur(16px) saturate(160%);
       backdrop-filter: blur(16px) saturate(160%);
     }
     .apple-material-regular {
       background: rgba(255, 255, 255, 0.82);
       -webkit-backdrop-filter: blur(20px) saturate(180%);
       backdrop-filter: blur(20px) saturate(180%);
     }
     .apple-material-thick {
       background: rgba(251, 250, 246, 0.88);
       -webkit-backdrop-filter: blur(30px) saturate(190%);
       backdrop-filter: blur(30px) saturate(190%);
     }
     .apple-material-chrome {
       background: rgba(245, 247, 243, 0.90);
       -webkit-backdrop-filter: blur(40px) saturate(200%);
       backdrop-filter: blur(40px) saturate(200%);
     }
     ```
   - Emit `UISegmentedControl` and `insetGrouped` metrics variables:
     ```css
     --segc-h: 32px;
     --segc-pad: 2px;
     --segc-r: 8px;
     --segc-thumb-r: 6px;
     --segc-bg: rgba(23, 64, 44, 0.08);
     --segc-thumb-bg: #FFFFFF;
     --segc-thumb-shadow: 0 1px 3px rgba(23, 64, 44, 0.12), 0 0.5px 1px rgba(23, 64, 44, 0.08);

     --inset-grouped-margin: 16px;
     --inset-grouped-radius: 12px;
     --inset-grouped-row-min-h: 44px;
     --inset-grouped-sep-inset: 16px;
     --inset-grouped-sep-inset-icon: 56px;
     --inset-grouped-sep-color: rgba(23, 43, 36, 0.12);
     --inset-grouped-sep-h: 0.5px;
     ```

2. **TypeScript Generation (`generateTs`)**:
   - Export `sheetGrabberTokens`, `segmentedControlTokens`, `insetGroupedTokens`, `materialsTokens`, and updated `radiiTokens` (`sm: 8`, `md: 12`, `lg: 16`, `sheet: 28`).

3. **Tailwind Preset Generation (`generateTailwindPresetObject`)**:
   - Update `borderRadius`:
     `sm: '8px'`, `md: '12px'`, `lg: '16px'`, `sheet: '28px'`.
   - Add Apple-calibrated green box-shadows:
     `'glass-sm': '0 1px 3px rgba(23, 64, 44, 0.12)'`,
     `'glass-md': '0 4px 14px rgba(23, 64, 44, 0.10)'`,
     `'glass-lg': '0 10px 32px rgba(23, 64, 44, 0.12)'`.

4. **Swift Generation (`generateSwift`)**:
   - Output `DesignTokens.SheetGrabber` (width 36, height 5, cornerRadius 2.5, color `UIColor(red: 23/255, green: 64/255, blue: 44/255, alpha: 0.25)`).
   - Output `DesignTokens.Radii` (`sm: 8`, `md: 12`, `lg: 16`, `sheet: 28`).
   - Output `DesignTokens.SegmentedControl` & `DesignTokens.InsetGroupedList`.
   - Provide helper for UIKit `CALayer.cornerCurve = .continuous`.

---

## 5. Verification Method

1. **Token Compilation & Check**:
   ```bash
   node scripts/generate-design-bank.mjs
   npm run design:check
   ```
   *Expected result*: Exit code 0, all 7 artifacts generated without error, `[check]` passes.

2. **Zero Pure Black & Zero `#0d1117` Assertion**:
   ```bash
   grep -rn "#000000" src/styles/tokens.generated.css ios/App/App/DesignTokens.generated.swift
   grep -rn "#0d1117" src/styles/tokens.generated.css ios/App/App/DesignTokens.generated.swift
   ```
   *Expected result*: No output / 0 matches in generated artifacts.

3. **TypeScript Type Safety & Build**:
   ```bash
   npm run type-check
   ```
   *Expected result*: Exit code 0, TypeScript compiles without errors.

4. **Physical iOS Token Alignment**:
   - Inspect `ios/App/App/DesignTokens.generated.swift`:
     - `DesignTokens.SheetGrabber.width == 36.0`
     - `DesignTokens.SheetGrabber.height == 5.0`
     - `DesignTokens.SheetGrabber.cornerRadius == 2.5`
     - `DesignTokens.Radii.sheet == 28.0`
     - `DesignTokens.Radii.md == 12.0`
     - `DesignTokens.Radii.sm == 8.0`

5. **Invalidation Conditions**:
   - Any reintroduction of pure black `#000000`, `#0d1117`, or dark shadows `rgba(0, 0, 0, ...)`.
   - Grabber dimensions diverging from 36×5pt or radius diverging from 2.5pt.
   - Sheet radius diverging from 28pt or list cell radius diverging from 12pt.
