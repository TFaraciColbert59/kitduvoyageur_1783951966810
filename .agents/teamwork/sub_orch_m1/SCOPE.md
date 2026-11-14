# Scope: Milestone M1 — Apple Design Tokens & Components Bank (LKDV Greens)

## Objective
Establish the definitive single source of truth for Apple Design Tokens and Primitives mapped into the LKDV Greens palette, with automated sync to Web CSS, Tailwind presets, TypeScript types, and Swift native code (`DesignTokens.generated.swift`), with zero pure black (`#000000`) and no unwanted dark backgrounds.

## Features Covered
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | Apple Primitives & Tokens Bank | Exact Apple specifications (`-apple-system-*`, continuous corners squircle, grabber 36×5pt, material blur, `UISegmentedControl`, `insetGrouped`) in `src/design/bank.ts` and `scripts/generate-design-bank.mjs` | PLANNED |
| 2 | Pure LKDV Green Palette (No Pure Black) | Zero `#000000`, zero `#0d1117`, cleanup of residual `.dark` rules in `tokens.css`, eliminate dark keyboard in `capacitor.config.ts`, map all surfaces and inks to LKDV green spectrum | PLANNED |
| 3 | Swift Native Design Tokens Sync | Automated build/generation script outputting `ios/App/App/DesignTokens.generated.swift` | PLANNED |
| 4 | External Skills Integration | Install and integrate skills such as `ios-hig-design` and `liquid-glass-design` via `npx skills` | PLANNED |

## Interface Contracts (M1 ↔ M2)
`src/design/bank.ts` exposes tokens under the LKDV namespace:
- Surfaces:
  - `surfaces.canvas`: `#FBFAF6`
  - `surfaces.sauge`: `#F5F7F3`
  - `surfaces.surfaceElevated`: `#FFFFFF`
  - `surfaces.surfaceGrouped`: `#F0F5EE`
- Inks:
  - `inks.labelPrimary`: `#172B24`
  - `inks.labelSecondary`: `#56665D`
  - `inks.labelTertiary`: `#46584D`
  - `inks.onBrand`: `#FFFFFF`
- Brand:
  - `brand.primary`: `#17402C`
  - `brand.action`: `#226148`
  - `brand.secondary`: `#5B7F55`
- Continuous Corner Radii:
  - `radii.sm`: 8pt
  - `radii.md`: 12pt
  - `radii.lg`: 16pt
  - `radii.sheet`: 28pt
- Sheet Grabber:
  - Dimensions: 36×5pt, corner-radius 2.5pt
  - Color: `rgba(23, 64, 44, 0.25)`
- System Typography:
  - `-apple-system-body`, `-apple-system-headline`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`
- Absolute Constraint:
  - Zero `#000000`, zero `#0d1117`.

## Key Files Owned
- `src/design/bank.ts`
- `scripts/generate-design-bank.mjs`
- `ios/App/App/DesignTokens.generated.swift`
- `src/styles/tokens.css` (or integration layer)
- `package.json` (for generator scripts if applicable)
- `capacitor.config.ts` (cleaning up dark mode / keyboard style)

## Verification Criteria
1. `node scripts/generate-design-bank.mjs` runs with exit code 0 and produces:
   - TypeScript definitions / exports in `src/design/bank.ts` or linked targets
   - CSS tokens / variables (`tokens.css`)
   - Swift tokens file `ios/App/App/DesignTokens.generated.swift`
2. No `#000000` or `#0d1117` in generated or configured tokens.
3. TypeScript / Next.js build passes (`npm run build` or `npm run type-check`).
4. Swift tokens file is valid Swift syntax.
