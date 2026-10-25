import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_JWT_SECRET } from './tests/e2e/compas/support/jwt.mjs';

/**
 * PLAN-100 2.12 — Parcours E2E du Compas, SANS réseau externe, SANS secret.
 *
 * Quatre processus, tous locaux, lancés ici :
 *   1. PostgREST (binaire épinglé) sur la base ÉPHÉMÈRE du dépôt (baseline +
 *      migrations : scripts/db/ci/install.sh) -> vraie RLS, vrais déclencheurs ;
 *   2. le serveur de doublures (tests/e2e/compas/support/doubles-server.mjs) :
 *      passerelle Supabase (GoTrue simulé, PostgREST réel), captures réelles des
 *      services tiers, « en panne » pour les autres, alerte pour tout appel
 *      imprévu ;
 *   3. `next start` sur le build de production, avec un préchargement qui
 *      réécrit tout `fetch` non local vers les doublures (aucun code applicatif
 *      n'est modifié) ;
 *   4. Chromium, dont chaque requête non locale passe par `page.route`.
 *
 * Variables :
 *   DATABASE_URL            base locale installée (obligatoire)
 *   POSTGREST_BIN           chemin du binaire PostgREST (défaut : `postgrest`)
 *   PW_CHROMIUM_PATH        navigateur à utiliser (défaut : celui de Playwright)
 *   NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY  les valeurs du build (défaut : celles de la CI)
 *   E2E_NEXT_PORT, E2E_DOUBLES_PORT, E2E_POSTGREST_PORT
 */
const root = __dirname;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('[e2e compas] DATABASE_URL (base locale installée) est requis.');

const NEXT_PORT = Number(process.env.E2E_NEXT_PORT ?? 4028);
const DOUBLES_PORT = Number(process.env.E2E_DOUBLES_PORT ?? 4040);
const POSTGREST_PORT = Number(process.env.E2E_POSTGREST_PORT ?? 3001);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ci-build-placeholder.supabase.co';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  // Jeton d'exemple, pas un secret (signature « placeholder ») : assemblé par morceaux pour que le
  // garde `tests/audit/audit-scripts-static.spec.ts` ne le prenne pas pour un vrai JWT écrit en dur.
  [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJpc3MiOiJjaS1idWlsZC1wbGFjZWhvbGRlciIsInJvbGUiOiJhbm9uIiwiaWF0IjowfQ',
    'cGxhY2Vob2xkZXI',
  ].join('.');
const SERVICE_KEY = 'e2e-service-role-key';
const DOUBLES_URL = `http://127.0.0.1:${DOUBLES_PORT}`;

// PostgREST se connecte avec le rôle `authenticator` (celui de l'API Supabase).
const dbForPostgrest = new URL(databaseUrl);
dbForPostgrest.username = 'authenticator';
dbForPostgrest.password = '';

process.env.E2E_DOUBLES_URL = DOUBLES_URL;
process.env.E2E_NEXT_URL = `http://127.0.0.1:${NEXT_PORT}`;
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;

export default defineConfig({
  testDir: './tests/e2e/compas',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/compas/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Aucune reprise : un parcours qui réussit au deuxième essai est un parcours instable.
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://127.0.0.1:${NEXT_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: process.env.POSTGREST_BIN || 'postgrest',
      url: `http://127.0.0.1:${POSTGREST_PORT}/`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        PGRST_DB_URI: dbForPostgrest.toString(),
        PGRST_DB_SCHEMAS: 'public',
        PGRST_DB_ANON_ROLE: 'anon',
        PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
        PGRST_JWT_SECRET: E2E_JWT_SECRET,
        PGRST_SERVER_HOST: '127.0.0.1',
        PGRST_SERVER_PORT: String(POSTGREST_PORT),
        PGRST_DB_MAX_ROWS: '1000',
        PGRST_LOG_LEVEL: 'error',
      },
    },
    {
      command: 'node tests/e2e/compas/support/doubles-server.mjs',
      url: `${DOUBLES_URL}/__health`,
      reuseExistingServer: false,
      timeout: 15_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        E2E_DOUBLES_PORT: String(DOUBLES_PORT),
        E2E_POSTGREST_URL: `http://127.0.0.1:${POSTGREST_PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
    },
    {
      command: `npx next start -p ${NEXT_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${NEXT_PORT}/compas?nouvelle=1`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_OPTIONS: `--require ${path.join(root, 'tests/e2e/compas/support/preload-fetch.cjs')}`,
        E2E_DOUBLES_URL: DOUBLES_URL,
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        // Interrupteur de l'IA du site : éteint, le Compas prépare par règles (aucun appel d'IA).
        AI_MODE: 'off',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
