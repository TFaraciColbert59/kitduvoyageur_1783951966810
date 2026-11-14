# Handoff Report — Lot 0 Investigation: CI Failures, Light-Only Conflicts, Tokens & StatusBar

## 1. Observation

### 1.1 Test Suite Failure on `tests/design/compte-profile-visibility.spec.ts`
- **Execution command**: `npm test -- tests/design/compte-profile-visibility.spec.ts` (Vitest v4.1.11).
- **Exact failure**:
  ```
  FAIL tests/design/compte-profile-visibility.spec.ts > Compte — confidentialité du compte et visibilité de l’empreinte > confirme la persistance de l’empreinte avant tout succès affiché
  AssertionError: expected 'import type { SupabaseClient } from ...' to contain ".select('signature_visibility')"
  ❯ tests/design/compte-profile-visibility.spec.ts:251:23
     249|   it('confirme la persistance de l’empreinte avant tout succès affiché', () => {
     250|     expect(SIGNATURE_VISIBILITY_EVENT).toBe('lkdv:signature-visibility');
     251|     expect(bootstrap).toContain(".select('signature_visibility')");
        |                       ^
     252|     expect(bootstrap).toContain('persistSignatureVisibility');
  ```
- **Code state**:
  - `tests/design/compte-profile-visibility.spec.ts:28`:
    `const bootstrap = read('src/features/compte/data/accountBootstrap.ts');`
  - In commit `10a71a0cce3c661b62b4931ac7f35bb9845bda2d` ("fix(prod): split client-safe signature visibility, literal route exports, and prod-safe SQL migrations"), the function `persistSignatureVisibility` and its database query containing `.select('signature_visibility')` were moved out of `src/features/compte/data/accountBootstrap.ts` and placed into a new dedicated module `src/features/compte/data/accountSignatureVisibility.ts` (lines 103-111).
  - In `src/features/compte/data/accountBootstrap.ts:596-604`, `persistSignatureVisibility` is now re-exported from `./accountSignatureVisibility`.
  - Therefore, `bootstrap` (which holds the file content of `accountBootstrap.ts`) only contains the re-export declaration `persistSignatureVisibility`, but no longer contains `.select('signature_visibility')`.

### 1.2 Full Suite Run on `tests/design/` (45 files, 494 tests)
- **Command**: `npm test -- tests/design/`
- **Result**: **44 passed, 1 failed (493 passed, 1 failed)**.
- `tests/design/compte-profile-visibility.spec.ts:251` is the **only failing test in the entire `tests/design/` suite**.

### 1.3 Audit of `tests/design/p5-direction-tokens.spec.ts` & `tests/design/tokens-sync.spec.ts`
- Currently both test files pass on `HEAD` (35 tests total).
- However, they contain hardcoded expectations that directly conflict with the upcoming Lot 1 "100% Light-only mode" and Bank tokens:
  1. `p5-direction-tokens.spec.ts:48-69` (`it('palette sombre complète : fond, surface, texte et tous les états')`):
     - Directly slices `tokens.slice(tokens.indexOf('.dark {'))` and verifies dark mode tokens: `--lkv-surface: #101C17;`, `--lkv-surface-card: #1B2D24;`, `color-scheme: dark;`.
     - When `.dark` is removed in Lot 1 (per Master Plan §6.2), this test will throw because `indexOf('.dark {')` will return -1.
  2. `p5-direction-tokens.spec.ts:265-274` (`it('layout.tsx initialise le thème depuis la préférence système ou le choix stocké')`):
     - Asserts `layout.tsx` contains `colorScheme: 'light dark'`, `localStorage.getItem('lkdv_theme')`, `matchMedia('(prefers-color-scheme: dark)')`, `classList.add('dark')`.
     - In 100% Light mode, `colorScheme: 'light'` is forced and theme toggling / `#lkdv-theme-init` are removed.
  3. `p5-direction-tokens.spec.ts:275-281` (`it('tailwind.css mappe le clair sur les tokens et ne fige plus de couleurs .dark')`):
     - Asserts `tailwind.css` contains `color-scheme: dark;`.
  4. `p5-direction-tokens.spec.ts:236-243` (`it('rayons Phase 3 : cartes 28, feuilles 36, contrôles 18, nav 32')`):
     - Asserts `--lkv-radius-sheet: 36px;` and `--lkv-radius-md: 18px;`.
     - In `bank.ts`, the unified concentric radii define `sheet: 44px` and `md: 20px`.
  5. `tokens-sync.spec.ts:6-12`:
     - Explicitly permits `#000000` via `.filter((h) => h.toLowerCase() !== '#ffffff' && h.toLowerCase() !== '#000000')`, conflicting with the zero pure-black rule (`#000`/`#000000`/`#101010`/`#121815`).
  6. `tokens-sync.spec.ts:23-32`:
     - Checks hardcoded legacy tokens in `src/styles/tokens.css` (`--lkv-primary-soft: #365233;`, `--lkv-success: #3D6038;`, etc.), which will be superseded by `tokens.generated.css`.

### 1.4 StatusBar Configuration in `src/lib/native/status-bar.ts` & `capacitor.config.ts`
- In `src/lib/native/status-bar.ts:58-69`:
  ```ts
  const STATUS_BAR_THEMES: Record<StatusBarTheme, { dark: boolean; color: string }> = {
    default: { dark: true, color: "#17402C" },
    compas: { dark: false, color: "#FBFAF6" },
  };
  export function statusBarThemeForPath(pathname: string | null | undefined): StatusBarTheme {
    if (!pathname) return "default";
    const light = ["/compas", "/kit-studio"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
    return light ? "compas" : "default";
  }
  ```
- In lines 88-92:
  `StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })`
- In Capacitor's API (`@capacitor/status-bar`):
  - `Style.Dark` sets **white / light icons/text** (intended for dark backgrounds).
  - `Style.Light` sets **black / dark icons/text** (intended for light backgrounds).
- Consequently, on all routes except `/compas` and `/kit-studio`, `dark: true` forces `Style.Dark`, rendering white status bar text on the light app canvas (`#FBFAF6`/`#F5F7F3`), making time, battery, and signal unreadable.
- In `capacitor.config.ts:70-74`, the default is also inverted:
  ```ts
  StatusBar: {
    style: "DARK" as any,
    backgroundColor: "#17402C",
    overlaysWebView: true,
  }
  ```

### 1.5 Z-Index Inversion: `--z-modal`
- In `src/styles/tokens.css:372-377`:
  ```css
  --z-dropdown: 10;
  --z-fab: 30;
  --z-modal: 55;      /* au-dessus sheet (50), sous command (60) */
  --z-popover: 65;
  --z-tooltip: 80;
  --z-emergency: 90;
  ```
- Later in `src/styles/tokens.css:803-810`, a revised 100-step scale was introduced:
  ```css
  --z-base: 1;
  --z-sticky: 100;
  --z-subbar: 200;
  --z-tabbar: 300;
  --z-hud: 400;
  --z-sheet: 500;
  --z-toast: 600;
  --z-alert: 700;
  ```
- `--z-modal` was **never redefined** in the new scale. It remained at `55`.
- Because `--z-modal: 55` is strictly less than `--z-tabbar: 300` and `--z-sheet: 500`, any modal or dialog (`ConfirmDialog`, `PromptDialog`) using `var(--z-modal)` is visually occluded behind sheets and bottom tab bars.

### 1.6 `--glass-rim` Collision: Color vs Box-Shadow
- In `src/styles/tokens.css:529-531`:
  ```css
  --glass-rim: rgba(255, 255, 255, 0.85);
  --glass-rim-color: rgba(255, 255, 255, 0.85);
  --glass-rim-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.22);
  ```
- But in later `:root` and `.dark` blocks (`tokens.css:747`, `tokens.css:785`, `tokens.css:847`):
  ```css
  --glass-rim: 0 0 0 0.5px rgba(0, 0, 0, 0.22);
  --glass-rim-color: rgba(0, 0, 0, 0.22);
  ```
- `--glass-rim` is overwritten with a `box-shadow` string!
- Multiple components (`EmptyState.tsx`, `InsetGroupedList.tsx`, `Card.tsx`, `SearchField.tsx`, `SubTabBar.tsx`, `checkout/page.tsx`, `RankingsHub.tsx`, `LiveTrackingPanel.tsx`) use `border-[color:var(--glass-rim)]` or `divide-[color:var(--glass-rim)]`.
- Because the browser receives `border-color: 0 0 0 0.5px rgba(...)`, the property fails CSS validation and is ignored, breaking borders across at least 8 key primitives.
- Meanwhile, `Button.tsx` and `Tabs.tsx` use `shadow-[var(--glass-rim)]` expecting a box shadow.

### 1.7 Official Demo Account Identification
- Verified via Supabase live database (`icxyvwzfjbflcbqukpfz`):
  - **UID**: `d5451f35-db9f-4575-9114-6d3b79550bbc`
  - **Email**: `demo@lkdv.app`
  - **Full Name**: `Léa Fontaine`
  - **Handle**: `lea.fontaine`
  - **Volume**: 18 hike sessions (matches screenshot `06-compte-bandeau.png` "18 sortie(s)"), 27 community posts, 12 equipment kits.
  - This is the exact account used by `/api/demo-login` and `/connexion`, and must be preserved during Lot 3 SQL cleanup.

---

## 2. Logic Chain

1. **Step 1: Test failure tracing**
   - Observation: `AssertionError: expected ... to contain ".select('signature_visibility')"` at line 251.
   - Code trace: `accountBootstrap.ts` was refactored in commit `10a71a0cce3c` to extract `persistSignatureVisibility` into `accountSignatureVisibility.ts`.
   - Inference: The test read `accountBootstrap.ts` expecting the raw `.select('signature_visibility')` query. The logic still exists and functions properly at runtime, but the static string check in the test file needs to inspect `accountSignatureVisibility.ts` (or both files).

2. **Step 2: Dark mode & test reconciliation tracing**
   - Observation: `p5-direction-tokens.spec.ts` relies on `.dark {` and dark palette tokens in `tokens.css`, plus dark mode theme initialization in `layout.tsx`.
   - Inference: When Lot 1 generates `tokens.generated.css` with single `:root` and removes `.dark`, `p5-direction-tokens.spec.ts` will fail unless updated to reflect the approved 100% Light-only Liquid Glass architecture.

3. **Step 3: Status bar contrast issue**
   - Observation: `STATUS_BAR_THEMES.default.dark` is `true`, passed into `StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })`.
   - Inference: On Capacitor, `Style.Dark` forces light status bar text. On light backgrounds (`#FBFAF6`), this causes complete loss of contrast. Switching default to `dark: false` (Style.Light) enforces dark icons on light surfaces.

4. **Step 4: Z-index stacking fault**
   - Observation: `--z-modal` is `55`, while `--z-tabbar` is `300` and `--z-sheet` is `500`.
   - Inference: Any element stacked with `var(--z-modal)` is placed below sheets and tab bar. Placing `--z-modal: 600` restores strict monotonicity: `hud (400) < sheet (500) < modal (600) < alert/island (700)`.

5. **Step 5: Glass rim token collision**
   - Observation: `--glass-rim` is initialized as a color at line 529, then re-assigned as a box-shadow at line 785.
   - Inference: Assigning a box-shadow string to `--glass-rim` invalidates `border-color: var(--glass-rim)`. Strict separation into `--glass-rim-color` (color) and `--glass-rim-shadow` (shadow), with `--glass-rim` pointing to `--glass-rim-color`, restores border styling while preserving shadows.

---

## 3. Caveats

- **No source modifications performed in this step**: In accordance with the Teamwork explorer read-only role, no changes were committed to `src/` or `tests/`. All solutions below are concrete recommendations for the implementer in Lot 0.
- **Vercel environment variables**: `DEMO_LOGIN_EMAIL` and `DEMO_LOGIN_PASSWORD` are managed on Vercel (`prj_AqYb1FBEcyNGTZMVimBJXRDulyXp`). The live database already maps `demo@lkdv.app` to UID `d5451f35-db9f-4575-9114-6d3b79550bbc`.
- **Vitest configuration warning**: When running Vitest, a deprecation warning about `__dirname` in `vitest.config.ts:50:25` is emitted by Vite (`configLoader: 'native'`). This warning is benign and does not affect test execution.

---

## 4. Conclusion & Recommended Minimal Fixes for Lot 0

### Fix 1: `tests/design/compte-profile-visibility.spec.ts` (Unblocking CI)
In `tests/design/compte-profile-visibility.spec.ts`:
- **Line 28**: Include `accountSignatureVisibility.ts` in the inspected files:
  ```ts
  // Before:
  const bootstrap = read('src/features/compte/data/accountBootstrap.ts');

  // After:
  const bootstrap = read('src/features/compte/data/accountBootstrap.ts');
  const signatureVisibility = read('src/features/compte/data/accountSignatureVisibility.ts');
  ```
- **Line 251**:
  ```ts
  // Before:
  expect(bootstrap).toContain(".select('signature_visibility')");

  // After:
  expect(signatureVisibility).toContain(".select('signature_visibility')");
  ```
- Alternatively, concatenate: `const bootstrap = read('src/features/compte/data/accountBootstrap.ts') + read('src/features/compte/data/accountSignatureVisibility.ts');` to maintain zero test logic changes.

### Fix 2: `src/lib/native/status-bar.ts` & `capacitor.config.ts` (StatusBar Contrast)
In `src/lib/native/status-bar.ts`:
- **Line 58-61**:
  ```ts
  // Before:
  const STATUS_BAR_THEMES: Record<StatusBarTheme, { dark: boolean; color: string }> = {
    default: { dark: true, color: "#17402C" },
    compas: { dark: false, color: "#FBFAF6" },
  };

  // After:
  const STATUS_BAR_THEMES: Record<StatusBarTheme, { dark: boolean; color: string }> = {
    default: { dark: false, color: "#FBFAF6" },
    compas: { dark: false, color: "#FBFAF6" },
  };
  ```
- **Line 6-12**: Default parameter `style: "dark" | "light" = "light"` with `Style.Light`.
- In `capacitor.config.ts:70-74`:
  ```ts
  StatusBar: {
    style: "LIGHT" as any,
    backgroundColor: "#FBFAF6",
    overlaysWebView: true,
  },
  ```

### Fix 3: `src/styles/tokens.css` (`--z-modal` Inversion)
- In `src/styles/tokens.css:374` and line 808-810:
  Update `--z-modal` to `600`:
  ```css
  --z-sheet: 500;
  --z-modal: 600;
  --z-toast: 700;
  --z-alert: 700;
  ```

### Fix 4: `src/styles/tokens.css` (`--glass-rim` Collision)
- In `src/styles/tokens.css:785-787`:
  ```css
  /* Before: */
  --glass-rim: 0 0 0 0.5px rgba(0, 0, 0, 0.22);
  --glass-rim-color: rgba(0, 0, 0, 0.22);
  --glass-rim-inner: inset 0 0 0 0.5px rgba(255, 255, 255, 0.45);

  /* After: */
  --glass-rim-color: rgba(23, 43, 36, 0.14);
  --glass-rim: var(--glass-rim-color);
  --glass-rim-shadow: 0 0 0 0.5px rgba(23, 43, 36, 0.14);
  --glass-rim-inner: inset 0 0 0 0.5px rgba(255, 255, 255, 0.45);
  ```
- In `Button.tsx` and `Tabs.tsx`, reference `shadow-[var(--glass-rim-shadow)]` where a shadow is expected, while keeping `border-[color:var(--glass-rim)]` valid for colors.

### Fix 5: Demo Account Safety Lock (Lot 3 preparation)
- Lock demo account UID `d5451f35-db9f-4575-9114-6d3b79550bbc` in SQL purge scripts: `WHERE id != 'd5451f35-db9f-4575-9114-6d3b79550bbc'`.

---

## 5. Verification Method

To verify these findings independently:

1. **Reproduce line 251 failure**:
   ```bash
   cd /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
   npm test -- tests/design/compte-profile-visibility.spec.ts
   ```
2. **Verify that `tests/design/` has only 1 failure**:
   ```bash
   npm test -- tests/design/
   ```
   Output: 44 passed, 1 failed (493 passed, 1 failed).
3. **Inspect the git commit that caused the split**:
   ```bash
   git show 10a71a0cce3c661b62b4931ac7f35bb9845bda2d -- src/features/compte/data/accountBootstrap.ts src/features/compte/data/accountSignatureVisibility.ts
   ```
4. **Inspect `--z-modal` values**:
   ```bash
   grep -n "z-modal" src/styles/tokens.css
   grep -n -E "(--z-sheet|--z-tabbar)" src/styles/tokens.css
   ```
5. **Inspect `--glass-rim` definitions**:
   ```bash
   grep -n "glass-rim:" src/styles/tokens.css
   ```
6. **Verify demo user in database**:
   Run the Supabase SQL query via MCP `execute_sql` on `icxyvwzfjbflcbqukpfz`:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'demo@lkdv.app';
   ```
   Returns `id: d5451f35-db9f-4575-9114-6d3b79550bbc`.
