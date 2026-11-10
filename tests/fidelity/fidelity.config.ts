import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Banc de fidélité — Communauté v2 et fiche Carnet v2 contre leurs maquettes.
 *
 * Un seul build (NEXT_PUBLIC_COMMUNAUTE_V2=true, NEXT_PUBLIC_CARNET_V2=true,
 * NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co, voir `tests/fidelity/build.sh`)
 * sert les deux surfaces. `next start` est lancé avec `server/fixture-supabase.cjs`
 * (substitut hermétique de Supabase côté serveur) ; le navigateur est simulé par
 * `tests/e2e/communaute-v2.fixtures.ts` (page.route). Les maquettes sont lues en
 * fichiers (`file://`), sans réseau.
 *
 * Variables : FIDELITY_PORT (4029), FIDELITY_SIZES (« 390x844,1440x900 »),
 * FIDELITY_THEMES (« clair,sombre »), FIDELITY_ONLY (regex d'identifiants),
 * FIDELITY_WORKERS (2), FIDELITY_REUSE (« 1 » : réutilise un serveur déjà lancé).
 *
 * Usage : `npx playwright test --config=tests/fidelity/fidelity.config.ts`
 * puis `node scripts/fidelity/report.mjs`.
 */

const PORT = Number(process.env.FIDELITY_PORT ?? 4029);
const BASE = `http://127.0.0.1:${PORT}`;

// Lus par tests/e2e/communaute-v2.fixtures.ts (cookie de session, origine) :
// à poser AVANT que les workers n'importent le module.
process.env.PW_BASE_URL = BASE;
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'fixture-anon-key';

const SIZES = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const THEMES = [
  { name: 'clair', colorScheme: 'light' as const },
  { name: 'sombre', colorScheme: 'dark' as const },
];

const wantedSizes = (process.env.FIDELITY_SIZES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const wantedThemes = (process.env.FIDELITY_THEMES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const projects = SIZES.flatMap((size) =>
  THEMES.filter((theme) => !wantedThemes.length || wantedThemes.includes(theme.name))
    .filter(() => !wantedSizes.length || wantedSizes.includes(`${size.width}x${size.height}`))
    .map((theme) => ({
      name: `${size.width}x${size.height}-${theme.name}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: size,
        colorScheme: theme.colorScheme,
        deviceScaleFactor: 1,
      },
    })),
);

export default defineConfig({
  testDir: '.',
  testMatch: ['fidelity.spec.ts', 'a11y-carnet.spec.ts'],
  fullyParallel: true,
  workers: Number(process.env.FIDELITY_WORKERS ?? 2),
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    serviceWorkers: 'block',
    trace: 'off',
  },
  projects,
  webServer: {
    command: [
      'NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_CARNET_V2=true',
      'NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key',
      'CIRCLE_NODE_TOTAL=1 NEXT_TELEMETRY_DISABLED=1',
      `NODE_OPTIONS="--max-old-space-size=4096 --require ${ROOT}tests/fidelity/server/fixture-supabase.cjs"`,
      `npx next start -p ${PORT}`,
    ].join(' '),
    cwd: ROOT,
    url: `${BASE}/connexion`,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
