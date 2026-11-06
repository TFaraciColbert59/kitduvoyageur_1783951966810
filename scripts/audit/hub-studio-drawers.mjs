#!/usr/bin/env node
/**
 * hub-studio-drawers.mjs — audit reproductible des 15 drawers Hub + Kit Studio.
 *
 * Usage :
 *   node scripts/audit/hub-studio-drawers.mjs \
 *     --base http://localhost:4000 \
 *     --out refonte-v2/notes/sdd-hub-studio/qa
 *
 * Prérequis : serveur local sur --base, Playwright installé dans le dépôt.
 * Le script tente une connexion démo (demo@lkdv.app) ; si elle échoue, il continue
 * en anonyme (le Hub est public, les données peuvent être vides).
 *
 * Sortie : un PNG par drawer + `audit.json` + tableau console.
 * Code 1 si un drawer ne s'ouvre pas ou si la feuille est trop basse.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const BASE = String(arg('base', 'http://localhost:4000')).replace(/\/$/, '');
const OUT = resolve(String(arg('out', 'refonte-v2/notes/sdd-hub-studio/qa')));
const MIN_SHEET_H = Number(arg('min-sheet', 240));
const DEMO_EMAIL = process.env.DEMO_LOGIN_EMAIL || 'demo@lkdv.app';
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD || 'DemoLKDV2026!';

const DRAWERS = [
  ['hub-itinerary', '/hub/itineraire', 'hub'],
  ['hub-groupe', '/hub/groupe', 'hub'],
  ['hub-depart', '/hub/depart', 'hub'],
  ['hub-docs', '/hub/documents', 'hub'],
  ['hub-budget', '/hub/budget', 'hub'],
  ['hub-journal', '/hub/journal', 'hub'],
  ['hub-safety', '/hub/securite', 'hub'],
  ['hub-gear', '/hub/kit-voyage', 'hub'],
  ['hub-checklist', '/hub/checklist', 'hub'],
  ['studio-inventaire', '/hub?studio=1&drawer=inventaire', 'studio'],
  ['studio-personnaliser', '/hub?studio=1&drawer=personnaliser', 'studio'],
  ['studio-statistiques', '/hub?studio=1&drawer=statistiques', 'studio'],
  ['studio-lignee', '/hub?studio=1&drawer=lignee', 'studio'],
  ['studio-insignes', '/hub?studio=1&drawer=insignes', 'studio'],
  ['studio-options', '/hub?studio=1&drawer=options', 'studio'],
];

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    return (await import('@playwright/test')).chromium;
  }
}

const chromium = await loadChromium();
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 1,
  locale: 'fr-FR',
});
const page = await context.newPage();
mkdirSync(OUT, { recursive: true });

async function login() {
  try {
    await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input[type="email"]').first().fill(DEMO_EMAIL, { timeout: 5000 });
    await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD, { timeout: 5000 });
    await page.getByRole('button', { name: 'Se connecter' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    return true;
  } catch {
    return false;
  }
}

const MEASURE = () => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const c = getComputedStyle(el);
    return {
      x: +r.x.toFixed(0),
      y: +r.y.toFixed(0),
      w: +r.width.toFixed(0),
      h: +r.height.toFixed(0),
      display: c.display,
      visibility: c.visibility,
      overflowY: c.overflowY,
      radius: c.borderRadius,
    };
  };
  const pane = document.querySelector('.lkdv-drawer-pane.active');
  const tabs = [...document.querySelectorAll('.lkdv-drawer-tabs [role="tab"]')];
  const secondary = [...document.querySelectorAll('.lkdv-drawer-secondary [role="tab"]')];
  return {
    title: document.title,
    url: location.pathname + location.search,
    studio: Boolean(document.querySelector('[data-testid="kit-studio-view"]')),
    sheet: rect('.hub-camp-drawer-sheet'),
    header: rect('.hub-camp-drawer-sheet > div'),
    tabs: rect('.lkdv-drawer-tabs'),
    tabCount: tabs.length,
    tabLabels: tabs.map((t) => t.getAttribute('aria-label')),
    secondary: rect('.lkdv-drawer-secondary'),
    secondaryCount: secondary.length,
    pane: rect('.lkdv-drawer-pane.active'),
    paneScroll: pane ? { scrollHeight: pane.scrollHeight, clientHeight: pane.clientHeight } : null,
    overlay: rect('.hub-camp-drawer-overlay'),
    drawerNav: rect('[data-studio-drawer-nav]'),
    bottomBar: rect('.lkdv-floating-tabbar'),
  };
};

const logged = await login();
console.log(`Connexion démo : ${logged ? 'ok' : 'anonyme'}`);

const report = [];
for (const [name, path, kind] of DRAWERS) {
  const row = { name, path, kind, ok: false, error: null, measures: null };
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.hub-camp-drawer-sheet', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/430-${name}.png`, scale: 'css' });
    const m = await page.evaluate(MEASURE);
    row.measures = m;
    row.ok = Boolean(m.sheet && m.sheet.h >= MIN_SHEET_H);
  } catch (err) {
    row.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  }
  report.push(row);
  const m = row.measures;
  console.log(
    `${row.ok ? 'ok  ' : 'FAIL'} ${name.padEnd(22)} sheet=${m?.sheet?.h ?? '—'}px tabs=${m?.tabCount ?? '—'} pane=${m?.paneScroll ? `${m.paneScroll.clientHeight}/${m.paneScroll.scrollHeight}` : '—'} secondary=${m?.secondaryCount ?? '—'} ${row.error ?? ''}`
  );
}

const failed = report.filter((r) => !r.ok);
writeFileSync(`${OUT}/audit.json`, JSON.stringify({ base: BASE, logged, minSheet: MIN_SHEET_H, report }, null, 2));
console.log(`\nRapport : ${OUT}/audit.json`);
console.log(`${report.length - failed.length}/${report.length} drawers ouverts (seuil ${MIN_SHEET_H}px)`);
await browser.close();
process.exit(failed.length ? 1 : 0);
