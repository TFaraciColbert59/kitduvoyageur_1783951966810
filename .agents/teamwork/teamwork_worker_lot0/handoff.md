# Handoff Report — Lot 0: Unblocking & Prerequisites

## 1. Observation

### Initial Failures Observed
1. **Broken SPM Dependency in `ios/App/CapApp-SPM/Package.swift:15-23`**:
   Capacitor dependencies pointed to a non-existent directory `../../../../lkdv-p01-social/node_modules/@capacitor/*`.
2. **TypeScript Compilation Errors (`npx tsc --noEmit`)**:
   - `src/features/compas/v5/TripCard.tsx:144:51` & `198:46`: `Cannot find name 'formatKm'`.
   - `src/features/explorer-v2/sheet/SheetContent.tsx:1617:43`: `Property 'current' does not exist on type 'WeatherResponse'`.
   - `src/features/messaging/services/messagingService.ts:504:11`: `Type 'string | undefined' is not assignable to type 'string'` on `avatar_url`.
   - `src/features/messaging/services/messagingService.ts:576:5`: `Type 'string' is not assignable to type '"pending" | "active" | "rejected" | undefined'` on `status`.
3. **Vitest Design Suite Failure**:
   `tests/design/compte-profile-visibility.spec.ts:251`:
   `AssertionError: expected 'import type { SupabaseClient } from ...' to contain ".select('signature_visibility')"`.
4. **Z-Index Stacking Inversion**:
   In `src/styles/tokens.css:374`, `--z-modal: 55;` was strictly below `--z-tabbar: 300` and `--z-sheet: 500`.
5. **Glass Rim Token Collision**:
   `--glass-rim` in `src/styles/tokens.css:747, 785, 847` was defined as `0 0 0 0.5px rgba(...)` (a box-shadow), breaking components using `border-[color:var(--glass-rim)]`.
6. **Status Bar Style Inversion**:
   `STATUS_BAR_THEMES.default.dark` in `src/lib/native/status-bar.ts:58-69` was `true`, selecting `Style.Dark` (white icons) on a light canvas (`#FBFAF6`). Similarly, `capacitor.config.ts:70-74` had `style: "DARK"`.

---

## 2. Logic Chain

1. **SPM Path**: Reverting `Package.swift` paths to `../../../node_modules/@capacitor/*` aligns with the repository's local `node_modules` and eliminates the broken external dependency.
2. **TripCard Format**: `formatKm` is already exported by `src/features/compas/engine/format.ts`. Restoring `formatKm` to the import statement at line 7 resolves TS2304.
3. **SheetContent Weather**: `WeatherResponse` in `src/features/explorer-v2/data/hooks.ts` contains `hours: Array<{ time, temperature_c, wind_ms, symbol }>`. Accessing weather safely with fallback to `ctx.weather?.hours?.[0]` converts temperature, wind speed (`wind_ms * 3.6`), and weather symbol without runtime errors and satisfies TypeScript.
4. **Messaging Types**:
   - `UserProfileSummary.avatar_url` requires `string`. Using `profile.avatar_url || ''` guarantees a string.
   - `Conversation.status` expects `'active' | 'pending' | 'rejected' | undefined`. Explicitly asserting `as Conversation['status']` prevents TypeScript type widening to `string`.
5. **Compte Profile Visibility Test**:
   - Commit `10a71a0cce3c` refactored `persistSignatureVisibility` into `src/features/compte/data/accountSignatureVisibility.ts`.
   - Updating `tests/design/compte-profile-visibility.spec.ts` line 251 to verify that `.select('signature_visibility')` is present in either `accountBootstrap.ts` or `accountSignatureVisibility.ts` confirms the persistence query contract without breaking on modularization.
6. **Tokens Z-Index & Glass Rim**:
   - Setting `--z-modal: 600;` restores the strict monotone scale (`hud 400 < sheet 500 < modal 600 < alert 700`).
   - Defining `--glass-rim-color: rgba(23, 43, 36, 0.14)` and `--glass-rim-shadow: 0 0 0 0.5px rgba(23, 43, 36, 0.14)` and setting `--glass-rim: var(--glass-rim-color)` resolves the CSS type collision: elements using it as border color receive a valid color, while box-shadows use `--glass-rim-shadow`.
7. **StatusBar**:
   - Setting `dark: false` (Style.Light) and `backgroundColor: "#FBFAF6"` across `src/lib/native/status-bar.ts` and `capacitor.config.ts` ensures dark icons/text on the light app canvas.

---

## 3. Caveats

- **Scope boundaries preserved**: Only the 7 exclusively owned files specified in dispatch were modified. No changes were made to downstream files reserved for Lot 1–5.
- **Node local storage warning**: During `vitest`, Node emits an experimental warning about `localStorage`. This is benign and does not affect test execution.

---

## 4. Conclusion

All 7 tasks in Lot 0 have been executed with zero regressions:
1. `ios/App/CapApp-SPM/Package.swift`: Reverted to local relative path `../../../node_modules/@capacitor/*`.
2. `src/features/compas/v5/TripCard.tsx`: `formatKm` import restored.
3. `src/features/explorer-v2/sheet/SheetContent.tsx`: Safe weather extraction implemented.
4. `src/features/messaging/services/messagingService.ts`: `avatar_url` and `status` typing resolved.
5. `tests/design/compte-profile-visibility.spec.ts`: Test updated to check both bootstrap and modularized visibility file.
6. `src/styles/tokens.css`: `--z-modal` set to 600; `--glass-rim-color` and `--glass-rim-shadow` separated and collision fixed.
7. `src/lib/native/status-bar.ts` & `capacitor.config.ts`: Default style set to `Style.Light` with canvas `#FBFAF6`.

---

## 5. Verification Method

To independently verify all changes, run the following commands in the workspace root:

```bash
# 1. Verify single failing test fix
npx vitest run tests/design/compte-profile-visibility.spec.ts
# Result: 1 passed (14/14 tests)

# 2. Verify entire design test suite
npx vitest run tests/design/
# Result: 45 passed (494/494 tests)

# 3. Verify TypeScript cleanliness
npx tsc --noEmit
# Result: 0 errors
```
