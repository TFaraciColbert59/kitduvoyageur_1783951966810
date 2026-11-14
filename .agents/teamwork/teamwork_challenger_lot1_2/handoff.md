# Handoff Report — Lot 1: Adversarial Challenge (Contrast & Icon Challenger)

- **Agent**: `teamwork_challenger_lot1_2` (Contrast and Icon Challenger)
- **Parent**: `38f1fd31-f581-4b46-b0dd-5af01c98f20a`
- **Milestone**: Lot 1 — Design System Bank & Multi-OS Asset Generation
- **Verdict**: **REQUEST_CHANGES**
- **Timestamp**: 2026-11-13T23:08:00Z

---

## 1. Observation

Direct observations obtained from code execution and forensic file inspection:

### 1.1 WCAG 2.1 AA & AAA Contrast Calculations
Empirical calculations using official W3C relative luminance formulas yielded:
- **`labelPrimary` (`#172B24`) on light surfaces**:
  - on `canvas` (`#FBFAF6`): **14.29:1** (WCAG AAA $\ge 7.0:1$)
  - on `surface` (`#F5F7F3`): **13.84:1** (WCAG AAA $\ge 7.0:1$)
  - on `surfaceElevated` (`#FFFFFF`): **14.92:1** (WCAG AAA $\ge 7.0:1$)
  - on `surfaceGrouped` (`#F0F5EE`): **13.50:1** (WCAG AAA $\ge 7.0:1$)
  - on `g3-bg` (`#EBF2EC`): **13.10:1** (WCAG AAA $\ge 7.0:1$)
- **Action & Brand inks**:
  - `onAction` (`#FFFFFF`) on `brandAction` (`#226148`): **7.31:1** (WCAG AAA $\ge 7.0:1$)
  - `onSecondarySubtle` (`#17402C`) on `secondarySubtle` (`#D8E5D5`): **8.91:1** (WCAG AAA $\ge 7.0:1$)
  - `onBrand` (`#FFFFFF`) on `brandPrimary` (`#17402C`): **11.63:1** (WCAG AAA $\ge 7.0:1$)
- **Secondary & Tertiary inks**:
  - `labelSecondary` (`#56665D`) on all light surfaces: **5.34:1 to 6.08:1** (WCAG AA $\ge 4.5:1$)
  - `labelTertiary` (`#46584D`) on all light surfaces: **6.67:1 to 7.60:1** (WCAG AA & AAA $\ge 4.5:1$)

### 1.2 Icon Resolver (`src/components/ui/Icon/Icon.tsx`)
1. **Zero Raster PNG Masks**: Verified 0 occurrences of `/icons/*.png` raster mask URLs or `maskImage` across `src/components/ui/Icon/` and `src/`.
2. **Unhandled Exception on missing/null/undefined name**:
   Running `npx vitest run tests/design/adversarial-icon-stress.spec.tsx` yielded:
   ```
   FAIL tests/design/adversarial-icon-stress.spec.tsx > 5. Handles missing/undefined/null/invalid icon name without unhandled exceptions
   AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot read properties of undefined (reading 'endsWith')' was thrown
   ```
   - In `src/components/ui/Icon/Icon.tsx`:
     Line 157: `resolveLucideComponent(name)` returns `undefined` if `!name`.
     Line 303: Calls `resolveHeroComponent(name, variant)`.
     Line 197: `if (name.endsWith('SolidIcon'))` crashes when `name` is `undefined` or `null`: `TypeError: Cannot read properties of undefined (reading 'endsWith')`.
     When `name` is numeric (`123`), line 159 crashes with `name.toLowerCase is not a function`.
3. **Object Prototype Leak / Leaked Component**:
   When `name="toString"`, `(LucideIcons as any)['toString']` resolves to `[Function: toString]`.
   React renders `<LucideGlyph />` which executes `Object.prototype.toString`, injecting `"[object Undefined]"` into the DOM:
   ```
   <span aria-hidden="true" class="inline-flex items-center justify-center select-none shrink-0" style="width:24px;height:24px;color:currentColor">[object Undefined]</span>
   ```

### 1.3 Lingering White-on-Light Bugs and Dark Mode Overrides in `src/styles/liquid-ios27.css`
Running `npx vitest run tests/design/adversarial-contrast-and-css.spec.ts` uncovered multiple active violations:
1. **`.hub-progression-drawer`** (`src/styles/liquid-ios27.css:1184-1206`):
   ```css
   .hub-progression-drawer {
     --lkv-text-primary: #ffffff;
     --lkv-text-secondary: rgba(255, 255, 255, 0.72);
     --lkv-text-muted: rgba(255, 255, 255, 0.54);
     --lkv-primary: #ffffff;
     --card-content: #ffffff;
   }
   .hub-progression-drawer .glass,
   .hub-progression-drawer :is(.rounded-2xl, .rounded-3xl) {
     --lkv-text-primary: #ffffff;
     --lkv-text-secondary: rgba(255, 255, 255, 0.72);
     --lkv-text-muted: rgba(255, 255, 255, 0.54);
     --card-content: #ffffff;
     border-color: rgba(255, 255, 255, 0.14) !important;
     background-color: rgba(255, 255, 255, 0.07) !important;
   }
   ```
   In `src/components/progression/MaProgressionView.tsx:758-761`, when `presentation="drawer"`, sections use `glass rounded-3xl`. The effective background is light sage (`rgba(255, 255, 255, 0.07)` over `#F0F5EE` sheet = `#F1F5EF`), but text is forced to `#ffffff`. **Contrast ratio is 1.11:1** (completely unreadable).
2. **`.hub-state-drawer`** (`src/styles/liquid-ios27.css:656-731` & `ActivityStateDrawer.tsx`):
   - `liquid-ios27.css:658`: `.hub-state-drawer__score, .hub-state-drawer__pill { color: rgba(255, 255, 255, 0.78); }` on `background-color: rgba(255, 255, 255, 0.055);` (contrast: **1.05:1**).
   - `liquid-ios27.css:704`: `.hub-state-drawer__check-icon { color: rgba(255, 255, 255, 0.82); }`
   - `liquid-ios27.css:721, 725, 729`: `.hub-state-drawer__status--ready` (`rgba(255, 255, 255, 0.76)`), `--attention` (`rgba(255, 255, 255, 0.6)`), `--blocked` (`rgba(255, 255, 255, 0.92)`).
   - `ActivityStateDrawer.tsx:71, 74, 119, 122, 128, 173, 199`: Hardcoded Tailwind classes `text-white`, `text-white/55`, `text-white/58`, `text-white/70`, `text-white/42`, `text-white/60` directly rendered on light glass cards.
3. **`.hub-edge-panel` and `.hub-edge-panel__body--status`** (`src/styles/liquid-ios27.css:557-573, 908, 923-925`):
   - Lines 923-925: `.hub-edge-panel__surface` retains dark background `rgba(16, 16, 16, 0.36)` (hardcoded `#101010` alpha, violating 100% Light Mode mandate).
   - Line 908: `.hub-edge-panel` sets `color: var(--hub-white);`. Because `--hub-white` was remapped to `#172B24` (dark forest green), the drawer title and close buttons are dark text on a dark semi-transparent background.
   - Lines 557-573: `.hub-edge-panel__body--status, .hub-edge-panel__body--cockpit` declare `--lkv-text-primary: #ffffff;`.
4. **`.hub-liquid-action` and `.hub-map-card`**:
   - `liquid-ios27.css:458-465`: `.hub-liquid-action` has `background: rgba(16, 16, 16, 0.34) !important; color: #fff !important;`.
   - `liquid-ios27.css:1153, 1167`: `.hub-map-card__legend li` (`color: rgba(255, 255, 255, 0.84)` on `background: rgba(255, 255, 255, 0.08)`) and `.hub-map-card__cta` (`color: #fff` on `background: rgba(255, 255, 255, 0.12)`).

---

## 2. Logic Chain

1. **Step 1 (Contrast in `bank.ts`)**: Direct mathematical evaluation of the tokens in `src/design/bank.ts` proves that `labelPrimary` on `canvas`, `surface`, `surfaceElevated`, `surfaceGrouped`, and `g3-bg` produces contrast ratios between 13.10:1 and 14.92:1, far exceeding WCAG AAA (7.0:1). Similarly, `onAction` (7.31:1), `onSecondarySubtle` (8.91:1), and `onBrand` (11.63:1) are compliant.
2. **Step 2 (Icon Resolver Robustness)**: In `src/components/ui/Icon/Icon.tsx`, while semantic kebab-case resolution and vector SVG rendering work well for valid strings, `resolveHeroComponent` assumes `name` is a non-null string and invokes `name.endsWith(...)`. If `name` is omitted, `undefined`, `null`, or numeric, this throws an unhandled `TypeError`, crashing the React component tree. Furthermore, unchecked indexing into `LucideIcons` allows native properties (`toString`) to be treated as React component functions, rendering `"[object Undefined]"`.
3. **Step 3 (CSS Light Mode Enforcement)**: `PROJECT.md` mandates "100% Mode Clair Liquid Glass — Quasi zéro sombre, zéro noir (`#000`/`#101010`/`#121815`)". In `liquid-ios27.css`, several legacy component blocks (`.hub-progression-drawer`, `.hub-state-drawer`, `.hub-edge-panel`, `.hub-liquid-action`) were left with `--lkv-text-primary: #ffffff`, `rgba(255, 255, 255, 0.78)`, or `rgba(16, 16, 16, 0.36)`. When opened in light mode drawers or cards, this results in white text on light sage/white backgrounds (contrast ~1.05:1 to 1.11:1), failing both WCAG AA/AAA and the project light-mode requirement.

---

## 3. Caveats

- We did not modify any source code in `src/` (strictly adhering to the review-only constraint).
- Tests added in `tests/design/` (`adversarial-icon-stress.spec.tsx` and `adversarial-contrast-and-css.spec.ts`) reproduce these defects.

---

## 4. Conclusion

**VERDICT: REQUEST_CHANGES**

The Design System bank tokens themselves are mathematically sound and exceed WCAG AAA standards. However, Lot 1 cannot be approved until the following defects are resolved:

### Actionable Remediation Required:
1. **`src/components/ui/Icon/Icon.tsx`**:
   - Add safety guards at the beginning of `Icon`:
     ```tsx
     if (!name || typeof name !== 'string') return null;
     ```
   - In `resolveLucideComponent`:
     ```tsx
     if (!name || typeof name !== 'string' || name in Object.prototype) return undefined;
     ```
     Ensure `typeof (LucideIcons as any)[mapped] === 'object'` or `hasOwnProperty` is checked before returning.
   - In `resolveHeroComponent`:
     ```tsx
     if (!name || typeof name !== 'string') return undefined;
     ```
2. **`src/styles/liquid-ios27.css`**:
   - Remove `--lkv-text-primary: #ffffff` in `.hub-progression-drawer` (lines 1184-1206) and map text to `var(--lkv-text-primary)` (forest ink `#172B24`).
   - Remove white text and white borders in `.hub-state-drawer` (lines 656-731); map text to forest inks (`#172B24`, `#56665D`).
   - In `ActivityStateDrawer.tsx`: Replace hardcoded `text-white` classes on drawer elements with `text-[var(--lkv-text-primary)]` / `text-[var(--lkv-text-secondary)]`.
   - In `.hub-edge-panel` and `.hub-edge-panel__surface`: Replace dark `rgba(16, 16, 16, 0.36)` background with light sage Liquid Glass (`#F5F7F3` / `rgba(245, 247, 243, 0.85)`). Remove `--lkv-text-primary: #ffffff` in `.hub-edge-panel__body--status` and `.hub-edge-panel__body--cockpit`.
   - In `.hub-liquid-action`: Replace dark `rgba(16, 16, 16, 0.34)` with light action glass (`bank.brand.action` / `var(--btn-tint-solid)`).

---

## 5. Verification Method

To verify these findings and confirm fixes:

```bash
# 1. Run Icon adversarial stress test (reproduces endsWith crash and toString leak)
npx vitest run tests/design/adversarial-icon-stress.spec.tsx

# 2. Run WCAG contrast & CSS white-on-light audit test (reproduces CSS white text & dark overrides)
npx vitest run tests/design/adversarial-contrast-and-css.spec.ts

# 3. Check for lingering white text declarations in liquid-ios27.css
grep -n "\-\-lkv-text-primary:\s*#ffffff" src/styles/liquid-ios27.css
```

### Invalidation Conditions:
- `adversarial-icon-stress.spec.tsx` passes 7/7 with zero exceptions on null, undefined, or missing icon props.
- `adversarial-contrast-and-css.spec.ts` passes 8/8 with zero lingering white-on-light text bugs or dark mode overrides in `liquid-ios27.css`.
- All text in `ActivityStateDrawer` and `MaProgressionView` (in drawer presentation) renders with contrast $\ge 4.5:1$ against underlying surfaces.
