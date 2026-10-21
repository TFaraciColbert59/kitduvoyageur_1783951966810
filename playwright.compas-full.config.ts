import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { PHONE } from './tests/e2e-compas-full/_lib/device';

/**
 * PLAN-100 phase 7 — banc de test COMPLET du Compas, EN LIGNE, sur un aperçu Vercel.
 *
 * Distinct du parcours hors réseau (`playwright.compas.config.ts`, job CI
 * `e2e-compas`) : ici tout est réel (Supabase, IA, Overpass, routage…), d'où
 * des délais longs et un quota de préparations respecté (6 / 10 min / personne).
 *
 * Variables :
 *   COMPAS_BASE_URL          aperçu à tester (obligatoire), ex. https://<déploiement>.vercel.app
 *   VERCEL_SHARE             jeton d'un lien partagé Vercel (aperçu protégé) ; jamais commité
 *   PLAYWRIGHT_CHROMIUM_PATH Chromium à utiliser (facultatif)
 *   COMPAS_WORKERS           nombre de workers (défaut 2 : un espace d'essai chacun)
 *   COMPAS_RUN_DIR           dossier du passage (défaut proof/compas-full/<date>)
 *   COMPAS_PREP_PER_PERSON / COMPAS_PREP_GLOBAL  plafonds de la file des préparations
 *
 * Lancer : npm run test:compas-full   (puis le rapport s'écrit seul dans le dossier du passage)
 */
const base = process.env.COMPAS_BASE_URL;
if (!base) throw new Error('[compas-full] COMPAS_BASE_URL (aperçu Vercel à tester) est requis.');

// Le dossier du passage est fixé UNE fois (processus principal) puis hérité par les workers.
if (!process.env.COMPAS_RUN_DIR) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  process.env.COMPAS_RUN_DIR = path.join(__dirname, 'proof/compas-full', stamp);
}
const RUN_DIR = process.env.COMPAS_RUN_DIR;
fs.mkdirSync(RUN_DIR, { recursive: true });

export default defineConfig({
  testDir: './tests/e2e-compas-full',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e-compas-full/global-setup.ts',
  globalTeardown: './tests/e2e-compas-full/global-teardown.ts',
  outputDir: path.join(RUN_DIR, 'test-results'),
  fullyParallel: false,
  workers: Number(process.env.COMPAS_WORKERS ?? 2),
  forbidOnly: !!process.env.CI,
  // Aucune reprise de test : un scénario qui ne passe qu'au deuxième essai est instable.
  // Les coupures réseau sont reprises DANS les aides (_lib/net.ts), et dites dans le journal.
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(RUN_DIR, 'report.json') }],
    ['html', { outputFolder: path.join(RUN_DIR, 'html'), open: 'never' }],
  ],
  // Une préparation réelle dure jusqu'à 330 s, et peut attendre son tour dans la file.
  timeout: 8 * 60_000,
  expect: { timeout: 30_000 },
  use: {
    // Le cadre de référence du projet : téléphone 393 × 852, densité 2, tactile.
    ...PHONE,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'compas-full' }],
});
