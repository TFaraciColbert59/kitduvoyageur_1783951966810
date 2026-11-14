# Handoff Report: E2E Test Runner & Execution Environment Analysis

## 1. Observation

### 1.1 `package.json` Dependencies & Constraints
- **File**: `package.json`
- **Module type**: Line 233: `"type": "module"`. The repository uses native ES Modules.
- **Node & Runtime environment**: Node `v26.8.2` on macOS Darwin-arm64.
- **Installed Test Runners & Testing Libraries**:
  - `@playwright/test`: `^1.63.0` (line 180)
  - `@axe-core/playwright`: `^4.13.0` (line 173)
  - `vitest`: `^4.1.11` (line 218)
  - `@testing-library/react`: `^16.3.3` (line 183)
  - `@testing-library/dom`: `^10.4.2` (line 182)
  - `@testing-library/user-event`: `^14.6.7` (line 184)
  - `jsdom`: `^26.1.0` (line 206)
  - `tsx`: `^4.7.1` (line 214)
  - `wait-on`: `^9.1.0` (line 219)
- **Absence of Jest**: Jest is not installed in `dependencies` or `devDependencies`.
- **Node Test Runner**: Present natively via Node.js; already leveraged in script `cleanup:test` (`"node --test tests/cleanup/*.node-test.mjs"`, line 100).
- **Critical Configuration Protection**:
  - `package.json` lines 5–40 define `"rocketCritical"`:
    ```json
    "rocketCritical": {
      "dependencies": [ ... ],
      "devDependencies": [ ... ],
      "scripts": [
        "dev", "build", "start", "lint", "lint:fix", "format", "serve", "type-check", "test:e2e"
      ],
      "warning": "🚨 CRITICAL: DO NOT REMOVE OR MODIFY ABOVE DEPENDENCIES - Required for Next.js 15 TypeScript app functionality"
    }
    ```
  - `test:e2e` is registered in `rocketCritical.scripts` as `"test:e2e": "playwright test"`. It must not be removed or destructively edited.

### 1.2 Test Configuration Files & Directory Layout
- **Playwright Configurations**:
  - `playwright.config.ts`: Lines 34–54 define `testDir: './'` and explicit `testMatch` patterns targeting specific specs (`scripts/e2e/*.spec.ts`, `tests/e2e-kit-studio/*.spec.ts`, `tests/e2e/compte-drawer-v2.spec.ts`, `tests/e2e/carnet-v2*.spec.ts`, etc.).
  - Lines 100–112 in `playwright.config.ts`:
    ```ts
    webServer: process.env.PW_BASE_URL
      ? undefined
      : {
          command: 'npm run start',
          url: 'http://localhost:4028',
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            PORT: '4028',
            EXPLORER_V2_E2E: '1',
            NEXT_PUBLIC_EXPLORER_SCENES: '1',
          },
        },
    ```
  - `playwright.visual.config.ts`: Configured for `tests/visual`, runs `npm run dev` against port 4000.
  - Browser binaries installed in cache (`~/Library/Caches/ms-playwright`): `chromium-1248`, `chromium_headless_shell-1248`, `webkit-2359`.
  - Empirically observed behavior when running `npx playwright test tests/e2e/compte-drawer-v2.spec.ts`:
    - Launches `npm run start` on port 4028.
    - If live Supabase auth session (`LKDV_E2E_AUTH=1`) or specific window runtime handles (`__lkdvOpenSlot`) are not present, tests wait up to the default timeout (60 seconds) or fail.
- **Vitest Configurations**:
  - `vitest.config.ts`: Lines 10–47 configure `environment: 'node'`, `testTimeout: 30_000`, aliases `@/` to `src/`, mock for `server-only` (`tests/mocks/server-only.ts`), and setupFiles `['./tests/setup/no-network.ts', './tests/setup/jsdom-storage.ts']`.
  - Line 36 in `vitest.config.ts` explicitly excludes `tests/e2e/**`:
    ```ts
    exclude: [
      'node_modules/**',
      'tests/visual/!(glass-contract).spec.ts',
      'tests/a11y/e2e/**',
      'tests/ui/**',
      'tests/e2e/**',
      ...
    ]
    ```
- **Existing Test Suites**:
  - `tests/messaging/messagingUtils.spec.ts`: Ran in 203ms with `npx vitest run tests/messaging/messagingUtils.spec.ts` (7 passed).
  - `tests/challenger-lot4-stress.spec.tsx`: Uses `// @vitest-environment jsdom`, `@testing-library/react`, and React mocks. Ran 16 tests in 1.84s with exit code 0.
  - `tests/adversarial-lot2-web-primitives.test.tsx`: Uses `// @vitest-environment jsdom` to stress test `Sheet`, `SegmentedControl`, `SubCapsuleTabs`, and drawers.
  - `tests/design/tokens-sync.spec.ts`: Ran in 166ms with `npx vitest run tests/design/tokens-sync.spec.ts` (3 passed).
  - `scripts/verify/ci_invariants.mjs`: Standalone Node.js verification script, ran in 2.9s and exited with code 0 (`rg` is missing, so native JS file traversals are needed).
  - `scripts/generate-design-bank.mjs --check`: Ran in 1.2s and exited with code 0.

### 1.3 Target Messagerie & Design System Codebase
- `src/design/bank.ts` and `scripts/generate-design-bank.mjs` compile design tokens to Web, CSS, Tailwind, and Swift (`ios/App/App/DesignTokens.generated.swift`).
- `src/app/messagerie/page.tsx` renders `MessagesScreen` with `currentUserId` and `currentUserProfile` from `useAuth()`.
- `src/components/messaging/MessagesScreen.tsx` imports:
  - `useConversations(userId)`: if `!userId`, sets conversations to `[]` and `loading = false` without throwing.
  - `SubCapsuleTabs` for filtering tabs (`Toutes`, `Directs`, `Groupes`, `Demandes`).
  - `ComposerMenuSheet` and `ConversationOptionsSheet` as dynamic sheets.
  - `SharedPostEmbed` for embedded posts.

---

## 2. Logic Chain

1. **Deterministic Exit Codes**:
   - The test runner must return exit code `0` when all tests pass, and non-zero (`1`) when any test fails.
   - Vitest natively produces exit code `0` on 100% pass and `1` on any failure.
   - A Node.js runner script (`tests/e2e/runner.mjs`) can execute the test runner, capture the exit status, format the results, and invoke `process.exit(code)` deterministically.

2. **Speed & Reliability vs. Server Lifecycle Flakiness**:
   - Browser-based Playwright execution against Next.js (`npm run start` or `npm run dev`) has known hazards: port collision on 4028 or 4000, 60-second timeouts if external Supabase sessions are missing, slow startup (15–60s), and heavy background processes.
   - In contrast, Vitest with `@vitest-environment jsdom` and `@testing-library/react` executes tests hermetically in Node.js in 1 to 3 seconds total.
   - It can evaluate AST and token constraints (`bank.ts`, `tokens.css`, `DesignTokens.generated.swift`), render full React components (`MessagesScreen`, `ComposerMenuSheet`, `ConversationOptionsSheet`, `NewConversationModal`), simulate user events (clicks, touch, tab switching), inspect DOM trees and computed CSS classes, and verify hook states (`useConversations`) without needing a live network or server.

3. **Isolation from Existing Vitest & Playwright Configurations**:
   - Because `vitest.config.ts` excludes `tests/e2e/**`, standard `npm test` ignores files in `tests/e2e/`.
   - Because `playwright.config.ts` uses an explicit `testMatch` array rather than a glob on `tests/e2e/**`, newly added tier test files in `tests/e2e/tiers/` will not be accidentally executed by `npm run test:e2e`.
   - Creating a dedicated configuration `vitest.e2e.config.ts` (or `tests/e2e/vitest.e2e.config.ts`) allows running the entire Tiers 1–4 test suite in complete isolation.

4. **Preservation of Critical Scripts**:
   - Modifying `test:e2e` in `package.json` violates the `"rocketCritical"` policy.
   - Adding a dedicated npm script, such as `"test:e2e:tiers": "node tests/e2e/runner.mjs"` (or `"test:e2e:opaque": "node tests/e2e/runner.mjs"`), preserves `rocketCritical` completely while giving team agents a single command to execute the full suite.

5. **Accommodating All 4 Tiers**:
   - **Tier 1 (Feature Coverage - min 60 tests)**: Verifies F1–F12 requirements in isolation.
   - **Tier 2 (Boundary & Corner Cases - min 60 tests)**: Verifies edge cases, extreme values, empty states, malformed payloads.
   - **Tier 3 (Cross-Feature Combinations - min 12 tests)**: Verifies pairwise interactions between tokens, headers, split view, bottom sheets, and realtime hooks.
   - **Tier 4 (Real-World Scenarios - min 6 tests)**: Verifies end-to-end user journeys simulating the iPhone 16 Pro experience.
   - Total: >= 138 tests. All can execute cleanly via the unified runner.

---

## 3. Caveats

- **Visual Bounding Rects in jsdom**: In jsdom, layout geometry (e.g. `element.getBoundingClientRect()`) returns `0` unless mocked or styled via explicit layout properties. For layout checks (e.g., verifying that the bottom sheet is not at `y=114..386` or that `msplit` and `mpill` do not collide), assertions should verify the CSS class properties, style rules, inline styles, DOM hierarchy, and container detachment rather than uncomputed browser layout pixels, OR use helper shims that compute layout offsets.
- **Dual Verification Mode**: While the Vitest jsdom suite is the primary deterministic engine for CI and sub-agent automated gates, an optional Playwright companion config (`playwright.messagerie.config.ts`) can be provided for runs against a live Next.js server when browser rendering is desired.
- **No pure black rule in tests**: Test helpers, mock styles, and fixtures must also adhere to the zero pure black rule (`#000000`, `#0d1117`).

---

## 4. Conclusion & Recommended Architecture

### 4.1 Recommended Test Runner Architecture
We recommend a **Dual-Tier Deterministic Test Infrastructure**:
1. **Primary Deterministic Suite**: Vitest + jsdom + `@testing-library/react` + Node.js token/AST verifier, orchestrated by `tests/e2e/runner.mjs` using `vitest.e2e.config.ts`.
   - **Execution time**: < 5 seconds for all 138+ tests.
   - **Exit code**: `0` on all pass, `1` on failure.
   - **Dependencies**: 100% already installed.
2. **Companion Browser Suite (Optional/Physical Device)**: Playwright config (`playwright.messagerie.config.ts`) configured specifically for iPhone 16 Pro viewport (`402 × 874 pt`, `@3x`), runnable with `npm run start` or `npm run dev`.

### 4.2 Exact File Layout Proposal
```
tests/e2e/
├── runner.mjs                             # Master runner script (node tests/e2e/runner.mjs)
├── vitest.e2e.config.ts                   # Dedicated Vitest config for Tiers 1-4
├── helpers/
│   ├── e2e-fixtures.ts                    # Mock conversations, messages, user profiles, realtime emitter
│   ├── e2e-assertions.ts                  # Domain assertions (contrast WCAG, no-pure-black, de-collision)
│   └── mock-router.ts                     # Mock Next.js navigation & router tracking
├── tiers/
│   ├── tier1-features.spec.ts             # Tier 1: Feature Coverage (F1..F12, >= 60 tests)
│   ├── tier2-boundary.spec.ts             # Tier 2: Boundary & Corner Cases (F1..F12, >= 60 tests)
│   ├── tier3-combinations.spec.ts         # Tier 3: Cross-Feature Combinations (>= 12 tests)
│   └── tier4-scenarios.spec.ts            # Tier 4: Real-World Scenarios (>= 6 tests)
└── playwright/                            # Optional live browser verification
    ├── playwright.messagerie.config.ts    # Playwright config for iPhone 16 Pro 402x874
    └── messagerie-iphone16pro.spec.ts     # Playwright E2E browser spec
```

### 4.3 Proposed Runner Commands
1. **Direct execution via Node**:
   ```bash
   node tests/e2e/runner.mjs
   ```
2. **Direct execution via Vitest CLI**:
   ```bash
   npx vitest run --config tests/e2e/vitest.e2e.config.ts
   ```
3. **Dedicated NPM Script in `package.json`**:
   Add to `scripts`:
   ```json
   "test:e2e:tiers": "node tests/e2e/runner.mjs"
   ```
   *(Preserves `rocketCritical.scripts` untouched while adding the explicit track script).*

### 4.4 Runner Implementation Sketch (`tests/e2e/runner.mjs`)
```javascript
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

console.log('🚀 Running LKDV E2E Opaque-Box Test Suite (Tiers 1-4)...');

// 1. Verify Design Bank Sync
console.log('📦 Step 1: Checking Design Bank Sync...');
const checkSync = spawnSync('node', ['scripts/generate-design-bank.mjs', '--check'], {
  cwd: root,
  stdio: 'inherit',
});
if (checkSync.status !== 0) {
  console.error('❌ Design bank out of sync! Run npm run design:generate first.');
  process.exit(1);
}

// 2. Execute Tiers 1-4 via Vitest
console.log('\n🧪 Step 2: Executing Tiers 1-4 Test Suites...');
const vitest = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'tests/e2e/vitest.e2e.config.ts'],
  { cwd: root, stdio: 'inherit' }
);

if (vitest.status === 0) {
  console.log('\n✅ All E2E Opaque-Box Tests Passed (Tiers 1-4)!');
  process.exit(0);
} else {
  console.error('\n❌ E2E Tests Failed.');
  process.exit(vitest.status ?? 1);
}
```

### 4.5 Configuration Sketch (`tests/e2e/vitest.e2e.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 30_000,
    setupFiles: [
      path.resolve(import.meta.dirname, '../setup/no-network.ts'),
      path.resolve(import.meta.dirname, '../setup/jsdom-storage.ts'),
    ],
    include: [
      path.resolve(import.meta.dirname, 'tiers/**/*.spec.ts'),
      path.resolve(import.meta.dirname, 'tiers/**/*.spec.tsx'),
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '../../src'),
      'server-only': path.resolve(import.meta.dirname, '../mocks/server-only.ts'),
    },
  },
});
```

---

## 5. Verification Method

To verify these findings and recommendations independently:

1. **Verify Installed Test Runner Versions**:
   ```bash
   cd /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
   npx vitest --version        # Expected: vitest/4.1.11
   npx playwright --version    # Expected: Version 1.63.0
   node -v                     # Expected: v26.8.2
   ```

2. **Verify React Component & jsdom Testing Speed**:
   ```bash
   cd /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
   npx vitest run tests/challenger-lot4-stress.spec.tsx
   ```
   *Expected outcome*: 16 tests pass in < 2 seconds with exit code 0.

3. **Verify Token Sync Execution**:
   ```bash
   cd /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
   npm run design:check
   ```
   *Expected outcome*: `All design bank generated artifacts are in sync with src/design/bank.ts.` (exit code 0).

4. **Verify Exit Code Behavior**:
   ```bash
   node -e 'const { spawnSync } = require("child_process"); const res = spawnSync("npx", ["vitest", "run", "tests/messaging/messagingUtils.spec.ts"]); console.log("Exit code:", res.status);'
   ```
   *Expected outcome*: `Exit code: 0`.

5. **Invalidation Conditions**:
   - If Vitest is upgraded to a breaking major version that drops jsdom support.
   - If `rocketCritical` constraints are removed, permitting arbitrary rewrite of `"test:e2e"`.
   - If the project introduces external binary dependencies required during test initialization that cannot be mocked.
