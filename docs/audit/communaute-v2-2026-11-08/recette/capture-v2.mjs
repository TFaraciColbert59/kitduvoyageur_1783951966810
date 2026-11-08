#!/usr/bin/env node
/**
 * Recette — capture des tiroirs Communauté v2 (`NEXT_PUBLIC_COMMUNAUTE_V2=true`).
 *
 * Orchestrateur : produit les captures 390×844 de la production du travail dans
 * `docs/audit/communaute-v2-2026-11-08/recette/captures-v2/` à partir du
 * harnais d'intégration des fondations
 * (`docs/audit/communaute-v2-2026-11-08/integration/capture.mjs`), puis met à
 * jour les références de régression visuelle Playwright si `--visual` est passé.
 *
 * Prérequis :
 *   1. build avec la v2 (le drapeau est figé au build)
 *        NEXT_PUBLIC_COMMUNAUTE_V2=true \
 *        NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
 *        npm run build
 *   2. serveur sur 4028 : `npm run start`
 *   3. tout le réseau est simulé par `integration/network.mjs` (aucune donnée réelle)
 *
 * Usage :
 *   node docs/audit/communaute-v2-2026-11-08/recette/capture-v2.mjs
 *   node .../capture-v2.mjs --visual          # + référence visuelle Playwright
 *   node .../capture-v2.mjs --only explorer   # groupe unique (accumule)
 *   node .../capture-v2.mjs --base http://127.0.0.1:4028 --tag run2
 *
 * Sorties :
 *   recette/captures-v2/*.png          captures de production du travail
 *   recette/captures-v2/MANIFEST.json  horodatage, base, succès/échecs
 *   (--visual) tests/visual/communaute-v2-visual.spec.ts-snapshots/ références
 *
 * Si le serveur ne répond pas, le script sort en erreur EXPLICITE (code 2) sans
 * rien inventer : la recette ne fabrique jamais de preuve sans exécution.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const INTEGRATION = join(REPO, 'docs/audit/communaute-v2-2026-11-08/integration');
const RECETTE_OUT = join(HERE, 'captures-v2');

const args = process.argv.slice(2);
const value = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const BASE = value('--base', process.env.CV2_BASE_URL ?? 'http://127.0.0.1:4028');
const ONLY = value('--only');
const TAG = value('--tag', '');
const WITH_VISUAL = args.includes('--visual');

mkdirSync(RECETTE_OUT, { recursive: true });

async function checkServer() {
  try {
    const response = await fetch(BASE, { redirect: 'manual' });
    // 3xx = middleware /connexion (serveur vivant) ; 5xx = serveur cassé.
    if (response.status >= 500) return `HTTP ${response.status}`;
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

const failure = await checkServer();
if (failure) {
  console.error(
    `\n[capture-v2] Serveur injoignable sur ${BASE} (${failure}).\n` +
      "Lance d'abord : NEXT_PUBLIC_COMMUNAUTE_V2=true npm run start, puis relance le script.\n" +
      'Aucune capture écrite : pas de preuve sans exécution.',
  );
  process.exit(2);
}

console.log(`[capture-v2] serveur OK ${BASE} — harnais d'intégration : ${INTEGRATION}`);

const integrationArgs = [join(INTEGRATION, 'capture.mjs'), '--base', BASE];
if (ONLY) integrationArgs.push('--only', ONLY);
if (TAG) integrationArgs.push('--tag', TAG);

const run = spawnSync(process.execPath, integrationArgs, { cwd: REPO, stdio: 'inherit' });
if (run.status !== 0) {
  console.error(`[capture-v2] harnais d'intégration en échec (code ${run.status}) : voir ${INTEGRATION}/_failures.json`);
}

const integrationCaptures = join(INTEGRATION, 'captures');
let copied = 0;
if (existsSync(integrationCaptures)) {
  for (const file of readdirSync(integrationCaptures)) {
    if (!file.endsWith('.png')) continue;
    copyFileSync(join(integrationCaptures, file), join(RECETTE_OUT, file));
    copied += 1;
  }
}

let visual = 'non demandé';
if (WITH_VISUAL) {
  const visualRun = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      '--config=playwright.visual.config.ts',
      'tests/visual/communaute-v2-visual.spec.ts',
      '--project=iphone-14-pro-chromium',
      '--update-snapshots',
    ],
    { cwd: REPO, stdio: 'inherit', env: { ...process.env, PW_BASE_URL: BASE } },
  );
  visual = visualRun.status === 0 ? 'références mises à jour' : `échec (code ${visualRun.status})`;
}

const failuresPath = join(INTEGRATION, '_failures.json');
let integrationFailures = [];
if (existsSync(failuresPath)) {
  try {
    integrationFailures = JSON.parse(readFileSync(failuresPath, 'utf8'));
  } catch {
    integrationFailures = [{ error: 'JSON illisible' }];
  }
}

writeFileSync(
  join(RECETTE_OUT, 'MANIFEST.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      base: BASE,
      only: ONLY,
      tag: TAG || null,
      capturesCopied: copied,
      integrationFailures,
      visual,
      note:
        'Captures produites sur données mockées (integration/fixtures.mjs) : aucun compte réel, ' +
        'aucune requête réseau. Les cases 07 § A qui exigent la base réelle/aperçu migré restent ' +
        '« non testable ici » (J-08 : migrations non appliquées en prod).',
    },
    null,
    2,
  )}\n`,
);

console.log(`\n[capture-v2] ${copied} capture(s) → ${RECETTE_OUT}`);
console.log(`[capture-v2] manifeste : ${join(RECETTE_OUT, 'MANIFEST.json')}`);
if (integrationFailures.length > 0) {
  console.error(`[capture-v2] ATTENTION : ${integrationFailures.length} scénario(s) en échec — voir _failures.json`);
  process.exitCode = 1;
}
