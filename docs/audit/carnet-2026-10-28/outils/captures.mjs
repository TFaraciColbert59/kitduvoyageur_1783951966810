// Captures des drawers / sous-drawers de la fiche carnet (usage interne).
// CKP_BASE=http://localhost:4233 CKP_TAG=avant node .ckp-shots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.CKP_BASE || 'http://localhost:4233';
const TAG = process.env.CKP_TAG || 'avant';
const CARNET = '/carnets/9ba890ca-e071-5ab8-8624-6bd8a471a6c1';
const OUT = process.env.CKP_OUT || `/tmp/ckp-shots/${TAG}`;
const ONLY = process.env.CKP_ONLY || 'all';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
});

const shot = async (name, clip) => {
  await page.waitForTimeout(360);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
};

async function goto(url, ready = '.ckp-mapzone') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(BASE + url, { waitUntil: 'commit', timeout: 90000 });
      await page.waitForSelector(ready, { timeout: 60000 });
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      await page.waitForTimeout(2500);
      await page.reload({ waitUntil: 'commit', timeout: 90000 }).catch(() => {});
    }
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const accept = page.getByRole('button', { name: 'Tout accepter' });
  for (let i = 0; i < 10; i += 1) {
    if (await accept.count()) {
      await accept.first().click().catch(() => {});
      break;
    }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1200);
}

/** Sonde : géométrie de la feuille et de son contenu. */
async function probe() {
  return page.evaluate(() => {
    const r = (v) => Math.round(v * 100) / 100;
    const box = (n) => {
      if (!n) return null;
      const b = n.getBoundingClientRect();
      return [r(b.x), r(b.y), r(b.width), r(b.height)];
    };
    const cs = (sel, props) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const s = getComputedStyle(n);
      return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
    };
    const de = document.documentElement;
    const sheet = document.querySelector('.ckp-card--drawer, .ckp-card');
    const body = document.querySelector('.ckp-drawer-body, .ckp-pages');
    const first = document.querySelector('.ckp-pane > *');
    return {
      viewport: [innerWidth, innerHeight],
      docScroll: [de.scrollWidth, de.scrollHeight],
      ok: de.scrollWidth === innerWidth && de.scrollHeight === innerHeight,
      sheet: box(sheet),
      sheetRadius: cs('.ckp-card--drawer', ['border-radius', 'background-image', 'backdrop-filter', 'box-shadow']),
      sheetBox: cs('.ckp-card--drawer', ['height', 'max-height', 'flex', 'display']),
      headBox: cs('.ckp-drawer-head', ['height']),
      paneBox: (() => {
        const n = document.querySelector('.ckp-drawer-body > *');
        if (!n) return null;
        const b = n.getBoundingClientRect();
        return { h: r(b.height), pad: getComputedStyle(n).padding, mt: getComputedStyle(n).marginTop };
      })(),
      barW: (() => {
        const i = document.querySelector('.ckp-hero-bar i');
        return i ? i.style.width : null;
      })(),
      grabber: box(document.querySelector('.ckp-grabber span')),
      close: box(document.querySelector('.ckp-drawer-close')),
      body: box(body),
      bodyPad: cs('.ckp-drawer-body', ['padding', 'padding-bottom']),
      bodyScroll: (() => {
        const n = document.querySelector('.ckp-drawer-body');
        return n ? [n.scrollHeight, n.clientHeight, n.scrollWidth, n.clientWidth] : null;
      })(),
      firstChild: box(first),
      lastChild: box(document.querySelector('.ckp-drawer-body > *:last-child')),
      inner: box(document.querySelector('.ckp-drawer-body > *')),
      sub: box(document.querySelector('.ckp-sub')),
      hero: box(document.querySelector('.ckp-stat-hero')),
      heroStyle: cs('.ckp-stat-hero b', ['font-size', 'font-weight', 'letter-spacing', 'line-height', 'color', 'font-variant-numeric']),
      unit: cs('.ckp-stat-unit', ['font-size', 'font-weight', 'color']),
      split: box(document.querySelector('.ckp-split')),
      row: box(document.querySelector('.ckp-stat-row')),
      rowStyle: cs('.ckp-stat-row', ['min-height', 'height', 'border-top-width']),
      keyStyle: cs('.ckp-stat-key', ['font-size', 'font-weight', 'color']),
      valStyle: cs('.ckp-stat-val', ['font-size', 'font-weight', 'color']),
      capsule: box(document.querySelector('.ckp-drawer-foot .ckp-capsule')),
      capsuleStyle: cs('.ckp-drawer-foot', ['right', 'bottom']),
      pagePad: cs('.ckp-page-pad', ['padding', 'gap']),
      texts: [...document.querySelectorAll('.ckp-pane h1, .ckp-pane h2, .ckp-pane h3, .ckp-pane p, .ckp-pane small, .ckp-pane span')]
        .map((n) => n.textContent?.trim())
        .filter((t) => t && t.length > 0)
        .slice(0, 60),
    };
  });
}

const measures = {};

async function openStats() {
  await page.locator('.ckp-stat').first().click();
  await page.waitForSelector('.ckp-card--drawer', { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function subTab(label) {
  await page.locator('.ckp-sub button[aria-label="' + label + '"]').first().click();
  await page.waitForTimeout(420);
}

await page.setViewportSize({ width: 430, height: 932 });
await goto(CARNET);

if (ONLY === 'all' || ONLY === 'stats') {
  await openStats();
  await shot('stats-distance');
  measures['stats-distance'] = await probe();
  await subTab('Dénivelé');
  await shot('stats-elevation');
  await subTab('Jours');
  await shot('stats-days');
  measures['stats-days'] = await probe();
  // état défilé : le voile de coupure
  await page.locator('.ckp-drawer-body').evaluate((n) => n.scrollTo({ top: 200 }));
  await shot('stats-days-scrolled');
  await page.locator('.ckp-drawer-body').evaluate((n) => n.scrollTo({ top: 0 }));
  await page.waitForTimeout(300);
}

if (ONLY === 'all' || ONLY === 'share') {
  if (!(await page.locator('.ckp-card--drawer').count())) await openStats();
  await page.locator('.ckp-drawer-foot [role="tab"]', { hasText: /Partage/ }).first().click().catch(async () => {
    await page.locator('.ckp-drawer-foot [role="tab"]').nth(1).click();
  });
  await page.waitForTimeout(600);
  await shot('share');
  measures['share'] = await probe();
}

if (ONLY === 'all' || ONLY === 'pages') {
  if (await page.locator('.ckp-card--drawer').count()) {
    await page.locator('.ckp-drawer-close').click();
    await page.waitForTimeout(600);
  }
  await page.locator('.ckp-action').nth(0).click();
  await page.waitForTimeout(700);
  await shot('likes');
  measures['likes'] = await probe();
  await page.locator('.ckp-action').nth(1).click();
  await page.waitForTimeout(700);
  await shot('comments');
  measures['comments'] = await probe();
  await page.getByLabel('Plus d’options').click();
  await page.waitForTimeout(400);
  await page.getByText('Gérer le carnet').click();
  await page.waitForTimeout(700);
  await shot('manage');
  measures['manage'] = await probe();
}

// Débordement : drawer ouvert, trois viewports.
if (!(await page.locator('.ckp-card--drawer').count())) {
  await page.evaluate(() => document.querySelector('.ckp-card-scroll')?.scrollTo({ top: 0 }));
  await page.waitForTimeout(400);
  await openStats();
  await shot('drawer-reouvert');
}
for (const [w, h] of [
  [430, 932],
  [768, 1024],
  [1440, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(500);
  measures[`overflow-${w}`] = await probe();
  await shot(`viewport-${w}`);
}

fs.writeFileSync(path.join(OUT, 'mesure.json'), JSON.stringify({ measures, errors }, null, 2));
console.log(JSON.stringify({ out: OUT, errors: errors.slice(0, 6) }, null, 2));
await browser.close();
