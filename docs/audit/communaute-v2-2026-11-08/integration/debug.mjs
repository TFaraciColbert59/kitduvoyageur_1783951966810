/**
 * Débogage ciblé du harnais d'intégration (une page, une ouverture Explorer).
 * Usage : node .../debug.mjs [--base http://127.0.0.1:4028]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { installFixtures, sessionCookieFor } from './network.mjs';

const base = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://127.0.0.1:4028';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  serviceWorkers: 'block',
});
await context.addCookies([sessionCookieFor(base)]);
const page = await context.newPage();
const failed = [];
const supa = [];
page.on('response', (response) => {
  const url = response.url();
  if (url.includes('/rest/v1/') || url.includes('/auth/v1/')) {
    supa.push({ status: response.status(), method: response.request().method(), url: url.slice(0, 180) });
  }
  if (response.status() >= 400) failed.push({ status: response.status(), url: url.slice(0, 180) });
});
page.on('pageerror', (error) => console.log('PAGEERROR:', String(error).slice(0, 400)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('CONSOLE:', message.text().slice(0, 300));
});
await installFixtures(page);

await page.goto(`${base}/communaute`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1500);
const explorerButton = page.locator('button[aria-label="Explorer et rechercher"]').first();
console.log('bouton Explorer:', await explorerButton.count());
await explorerButton.click();
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const panes = Array.from(document.querySelectorAll('.lkdv-cv2-pane'));
  const lensPanes = Array.from(document.querySelectorAll('.lkdv-lens-pane'));
  const body = document.querySelector('.lkdv-cv2-body');
  const firstPane = panes[0];
  const style = firstPane ? getComputedStyle(firstPane) : null;
  return {
    sheet: Boolean(document.querySelector('[data-testid="cv2-sheet"]')),
    paneCount: panes.length,
    lensPaneCount: lensPanes.length,
    bodyHtmlLength: body?.innerHTML.length ?? 0,
    bodyHtml: body?.innerHTML.slice(0, 1500) ?? null,
    panes: panes.map((pane) => ({
      testid: pane.getAttribute('data-testid'),
      cls: pane.className,
      text: pane.textContent?.slice(0, 80) ?? '',
      lines: pane.innerHTML.length,
    })),
    firstPaneText: firstPane?.textContent?.slice(0, 200) ?? null,
    firstPaneHtml: firstPane?.innerHTML.slice(0, 600) ?? null,
    firstPaneStyle: style
      ? {
          display: style.display,
          opacity: style.opacity,
          visibility: style.visibility,
          height: style.height,
          overflow: style.overflowY,
          color: style.color,
        }
      : null,
    skeletons: document.querySelectorAll('.lkdv-cv2-skeleton, .lkdv-cv2x-skel, .lkdv-slot-skeleton').length,
    empty: document.querySelectorAll('.lkdv-cv2-empty, .lkdv-cv2x-empty').length,
    errorText: document.querySelector('.lkdv-cv2-error-state, .lkdv-cv2x-error')?.textContent?.slice(0, 200) ?? null,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('--- réponses 4xx/5xx:');
for (const entry of failed.slice(0, 30)) console.log(entry.status, entry.url);
console.log('--- appels Supabase:');
for (const entry of supa.slice(0, 40)) console.log(entry.status, entry.method, entry.url);
const audit = await page.evaluate(() => {
  const style = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    let opacity = 1;
    let node = el;
    while (node && node !== document.documentElement) {
      opacity *= Number(getComputedStyle(node).opacity || 1);
      node = node.parentElement;
    }
    return {
      color: cs.color,
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage.slice(0, 80),
      opacity: cs.opacity,
      effOpacity: opacity,
      filter: cs.filter,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    };
  };
  const root = getComputedStyle(document.documentElement);
  return {
    theme: { htmlClass: document.documentElement.className, dark: root.getPropertyValue('--glass-bg-medium').trim() },
    sortButton: style('[data-testid="cv2-sort-button"]'),
    miniSlot: style('[data-testid="cv2-mini-capsule"]'),
    title: style('.lkdv-cv2-title'),
    meta: style('.lkdv-cv2-meta'),
    tile: style('.lkdv-cv2-tile'),
    featured: style('.lkdv-cv2-tile--wide'),
    sheet: style('.lkdv-cv2-sheet'),
    body: style('.lkdv-cv2-body'),
    activePane: style('.lkdv-cv2-pane--volet.active'),
    caretTitle: (() => { const el = document.querySelector('.lkdv-cv2x-carnet .lkdv-cv2-title'); if (!el) return null; const cs = getComputedStyle(el); return { color: cs.color, fontWeight: cs.fontWeight, fontSize: cs.fontSize, fontFamily: cs.fontFamily.slice(0,60) }; })(),
  };
});
console.log('--- TOKENS SCOPE:');
const tokenScope = await page.evaluate(() => {
  const sheet = document.querySelector('.lkdv-cv2-sheet');
  const layer = document.querySelector('.lkdv-communaute-v2');
  const read = (el) => { if (!el) return null; const cs = getComputedStyle(el); const pick = (name) => cs.getPropertyValue(name).trim(); return {
    '--label': pick('--label'), '--label2': pick('--label2'),
    '--lkv-text-primary': pick('--lkv-text-primary'),
    '--lkv-surface': pick('--lkv-surface'), '--lkv-surface-card': pick('--lkv-surface-card'),
    '--card-tint': pick('--card-tint'), '--glass-bg-medium': pick('--glass-bg-medium'),
    '--lkv-primary': pick('--lkv-primary'), '--lkv-secondary': pick('--lkv-secondary'),
    color: cs.color, fontFamily: cs.fontFamily.slice(0, 40), colorScheme: cs.colorScheme };
  };
  return {
    htmlAttrs: Array.from(document.documentElement.attributes).map((a) => a.name),
    html: read(document.documentElement),
    body: read(document.body),
    layer: read(layer),
    sheet: read(sheet),
    compteRoot: (() => { const el = document.querySelector('.lkdv-compte-v8'); return el ? read(el) : 'absent'; })(),
  };
});
console.log(JSON.stringify(tokenScope, null, 2));
console.log('--- AUDIT STYLES:', JSON.stringify(audit, null, 2));
// ouvre le menu de tri et audite son fond
await page.locator('[data-testid="cv2-sort-button"]').first().click();
await page.waitForTimeout(600);
const menuAudit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="cv2-sort-menu"]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    background: cs.backgroundColor,
    opacity: cs.opacity,
    backdrop: cs.backdropFilter,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    item: (() => { const item = el.querySelector('.lkdv-sort-item'); if (!item) return null; const ics = getComputedStyle(item); return { color: ics.color, bg: ics.backgroundColor, minHeight: ics.minHeight }; })(),
  };
});
console.log('--- MENU TRI:', JSON.stringify(menuAudit, null, 2));
await page.screenshot({ path: join(dirname(fileURLToPath(import.meta.url)), 'captures', '_debug-explorer.png') });
await browser.close();
