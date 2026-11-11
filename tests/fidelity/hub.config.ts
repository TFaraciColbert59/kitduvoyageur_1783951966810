import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Recette Playwright du hub `/carnets` (lot L4) — réutilise le MÊME build fixtures
 * et le MÊME serveur de substitution que le banc de fidélité
 * (`tests/fidelity/build.sh`, `server/fixture-supabase.cjs`) : aucun build ni
 * serveur de plus que nécessaire. Si le banc tourne déjà sur le port 4029, le
 * serveur est réutilisé (`reuseExistingServer`).
 *
 * Usage :
 *   bash tests/fidelity/build.sh
 *   npx playwright test --config=tests/fidelity/hub.config.ts
 * Les captures sont écrites dans docs/audit/carnets-hub-2026-11-11/.
 *
 * Variables : FIDELITY_PORT (4029), HUB_SIZE (« 390x844 », « 430x932 »),
 * HUB_THEME (« clair », « sombre »), HUB_SKIP_SHOTS=1 pour ne pas écrire les PNG.
 */

const PORT = Number(process.env.FIDELITY_PORT ?? 4029);
const BASE = `http://127.0.0.1:${PORT}`;
/** Serveurs du MÊME build qui rejouent uniquement les états vide/erreur du hub. */
const EMPTY_PORT = Number(process.env.FIDELITY_EMPTY_PORT ?? 4031);
const ERROR_PORT = Number(process.env.FIDELITY_ERROR_PORT ?? 4032);
const EMPTY_BASE = `http://127.0.0.1:${EMPTY_PORT}`;
const ERROR_BASE = `http://127.0.0.1:${ERROR_PORT}`;

// Lus par tests/e2e/communaute-v2.fixtures.ts (cookie de session, origine).
process.env.PW_BASE_URL = BASE;
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'fixture-anon-key';
process.env.HUB_EMPTY_URL = EMPTY_BASE;
process.env.HUB_ERROR_URL = ERROR_BASE;

const SIZES = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const THEMES = [
  { name: 'clair', colorScheme: 'light' as const },
  { name: 'sombre', colorScheme: 'dark' as const },
];

const wantedSize = process.env.HUB_SIZE;
const wantedTheme = process.env.HUB_THEME;

const projects = SIZES.filter((size) => !wantedSize || wantedSize === `${size.width}x${size.height}`).flatMap((size) =>
  THEMES.filter((theme) => !wantedTheme || wantedTheme === theme.name).map((theme) => ({
    name: `${size.width}x${size.height}-${theme.name}`,
    use: {
      ...devices['Desktop Chrome'],
      viewport: size,
      colorScheme: theme.colorScheme,
      deviceScaleFactor: 1,
    },
  })),
);

/** Commande du serveur fixtures (même build, même substitut Supabase). */
function serverCommand(port: number, extraEnv = ''): string {
  return [
    'NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_CARNET_V2=true',
    'NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key',
    'CIRCLE_NODE_TOTAL=1 NEXT_TELEMETRY_DISABLED=1',
    extraEnv,
    `NODE_OPTIONS="--max-old-space-size=4096 --require ${ROOT}tests/fidelity/server/fixture-supabase.cjs"`,
    `npx next start -p ${port}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export default defineConfig({
  testDir: '../e2e',
  testMatch: ['carnets-hub.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects,
  webServer: [
    {
      command: serverCommand(PORT),
      cwd: ROOT,
      url: `${BASE}/connexion`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: serverCommand(EMPTY_PORT, 'FIDELITY_HUB_STATE=empty'),
      cwd: ROOT,
      url: `${EMPTY_BASE}/connexion`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: serverCommand(ERROR_PORT, 'FIDELITY_HUB_STATE=error'),
      cwd: ROOT,
      url: `${ERROR_BASE}/connexion`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
