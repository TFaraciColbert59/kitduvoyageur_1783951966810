#!/usr/bin/env node
/**
 * Captures de parité visuelle — crm/scripts/capture-screens.mjs
 *
 * Capture chaque écran du registre `tests/support/screens.json` à 1440 × 1040 et
 * 390 × 844 dans `crm/bundle/etat/preuves/visuel/`, écrit un manifeste (dimensions,
 * statut HTTP, date) et un rapport de différences justifiées.
 *
 * Usage :
 *   node scripts/capture-screens.mjs                     # localhost:4100 (serveur déjà lancé)
 *   CRM_BASE_URL=https://…vercel.app node scripts/capture-screens.mjs
 *
 * Identifiants de test (jamais un compte réel) :
 *   CRM_TEST_EMAIL, CRM_TEST_PASSWORD, CRM_TEST_TOTP_SECRET
 *
 * Codes de sortie : 0 = tout capturé ; 2 = captures partielles (identifiants absents) ;
 * 1 = échec. La production est refusée.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { totpCodes } from '../tests/support/totp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'bundle/etat/preuves/visuel');
const SCREENS_FILE = path.join(ROOT, 'tests/support/screens.json');
const PRODUCTION_HOSTS = ['lekitduvoyageur.fr', 'crm.lekitduvoyageur.fr'];

const DEMO_IDS = {
  case_id: 'demo-post-report',
  member_id: 'demo-member',
  order_id: 'demo-order',
  request_id: 'demo-request',
  sos_id: 'demo-sos'
};

function loadEnv() {
  for (const name of ['.env.local', '.env.test.local']) {
    const file = path.join(ROOT, name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      let value = rawValue.trim();
      if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function resolveBaseUrl() {
  const url = process.env.CRM_BASE_URL ?? 'http://localhost:4100';
  const host = new URL(url).hostname;
  if (PRODUCTION_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
    throw new Error(`Refus : les captures ne visent pas la production (${host}).`);
  }
  return url;
}

function resolveRoute(route) {
  return route.replace(/\{\{(\w+)\}\}/g, (_, key) => DEMO_IDS[key] ?? 'demo');
}

function pngSize(file) {
  const buffer = readFileSync(file);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function signIn(page, base, creds) {
  await page.goto(`${base}/connexion`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  const totp = page.locator('input[name="code"]');
  if (await totp.count()) {
    const [code, previous] = totpCodes(creds.totpSecret);
    await totp.fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    if (!(await page.locator('[data-testid="app-shell"]').count())) {
      await page.fill('input[name="code"]', previous);
      await page.click('button[type="submit"]');
    }
  }
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 20_000 });
}

async function main() {
  loadEnv();
  const base = resolveBaseUrl();
  const registry = JSON.parse(readFileSync(SCREENS_FILE, 'utf8'));
  const creds =
    process.env.CRM_TEST_EMAIL && process.env.CRM_TEST_PASSWORD && process.env.CRM_TEST_TOTP_SECRET
      ? {
          email: process.env.CRM_TEST_EMAIL,
          password: process.env.CRM_TEST_PASSWORD,
          totpSecret: process.env.CRM_TEST_TOTP_SECRET
        }
      : null;

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const manifest = [];
  let partial = false;

  for (const viewport of registry.viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.id === 'mobile' ? 3 : 1,
      isMobile: viewport.id === 'mobile',
      hasTouch: viewport.id === 'mobile',
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris'
    });
    const page = await context.newPage();

    if (creds) {
      try {
        await signIn(page, base, creds);
      } catch (error) {
        console.error(`Connexion impossible : ${error.message.split('\n')[0]}`);
        partial = true;
      }
    }

    for (const screen of registry.screens) {
      const entry = {
        screen: screen.slug,
        route: screen.route,
        viewport: `${viewport.width}x${viewport.height}`,
        file: `${screen.slug}-${viewport.width}x${viewport.height}.png`,
        captured_at: new Date().toISOString(),
        status: 'captured'
      };
      if (screen.auth && !creds) {
        entry.status = 'skipped';
        entry.motif = 'identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET)';
        partial = true;
        manifest.push(entry);
        continue;
      }
      try {
        const response = await page.goto(`${base}${resolveRoute(screen.route)}`, { waitUntil: 'networkidle', timeout: 30_000 });
        entry.http_status = response ? response.status() : null;
        if (!response || response.status() >= 400) {
          entry.status = 'http-error';
          entry.motif = `HTTP ${entry.http_status ?? 'inconnu'}`;
          partial = true;
        }
        // Une capture d'erreur HTTP n'est pas une preuve de parité : on ne garde pas l'image.
        if (entry.status === 'captured') {
          const file = path.join(OUT, entry.file);
          await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
          const size = pngSize(file);
          entry.width = size.width;
          entry.height = size.height;
          if (size.width !== viewport.width || size.height !== viewport.height) {
            entry.status = 'wrong-size';
            partial = true;
          }
        }
      } catch (error) {
        entry.status = 'error';
        entry.motif = error.message.split('\n')[0];
        partial = true;
      }
      manifest.push(entry);
    }

    await context.close();
  }

  await browser.close();

  writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify({ base_url: base, manifest }, null, 2)}\n`, 'utf8');

  const differencesFile = path.join(ROOT, 'tests/visuel/differences.json');
  const differences = JSON.parse(readFileSync(differencesFile, 'utf8'));
  const captured = manifest.filter((entry) => entry.status === 'captured').length;
  const skipped = manifest.filter((entry) => entry.status !== 'captured');
  const lines = [
    '# Parité visuelle — captures et différences justifiées',
    '',
    `- Base : ${base}`,
    `- Captures : ${captured} / ${manifest.length}`,
    `- Non capturé : ${skipped.length}`,
    `- Date : ${new Date().toISOString()}`,
    '',
    '## Différences globales',
    '',
    '| ID | Différence constatée | Justification |',
    '| --- | --- | --- |',
    ...differences.globales.map((entry) => `| ${entry.id} | ${entry.difference} | ${entry.justification} |`),
    '',
    '## Différences par écran',
    '',
    '| Écran | ID | Différence constatée | Justification |',
    '| --- | --- | --- | --- |',
    ...Object.entries(differences.ecrans).flatMap(([screen, entries]) =>
      entries.map((entry) => `| ${screen} | ${entry.id} | ${entry.difference} | ${entry.justification} |`)
    ),
    ''
  ];
  if (skipped.length) {
    lines.push('## Non capturé', '', '| Écran | Taille | Statut | Motif |', '| --- | --- | --- | --- |');
    for (const entry of skipped) {
      lines.push(`| ${entry.screen} | ${entry.viewport} | ${entry.status} | ${entry.motif ?? ''} |`);
    }
    lines.push('');
  }
  writeFileSync(path.join(OUT, 'RAPPORT-DIFFERENCES.md'), lines.join('\n'), 'utf8');

  console.log(`captures : ${captured}/${manifest.length} → ${path.relative(ROOT, OUT)}`);
  if (skipped.length) console.log(`non capturé : ${skipped.length} (voir RAPPORT-DIFFERENCES.md)`);
  process.exit(partial ? 2 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
