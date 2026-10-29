// Captures + sonde de la fiche carnet (recette des lots B-F). Usage interne.
// CKP_TAG=avant CKP_BASE=http://localhost:4233 node /tmp/ckp-lot.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.CKP_BASE || 'http://localhost:4233';
const TAG = process.env.CKP_TAG || 'avant';
const OUT = process.env.CKP_OUT || `/tmp/ckp-lot/${TAG}`;
const ONLY = process.env.CKP_ONLY || 'all';
const CARNET = '/carnets/9ba890ca-e071-5ab8-8624-6bd8a471a6c1';

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
  if (m.type() === 'error') errors.push(m.text().slice(0, 180));
});

const shot = async (name) => {
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

const probe = async (label) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.waitForSelector('.ckp-screen', { timeout: 30000 });
      await page.waitForTimeout(600);
      return await page.evaluate((tag) => {
    const r = (v) => Math.round(v * 100) / 100;
    const box = (n) => {
      if (!n) return null;
      const b = n.getBoundingClientRect();
      return [r(b.x), r(b.y), r(b.width), r(b.height)];
    };
    const de = document.documentElement;
    const cs = (sel, props) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const s = getComputedStyle(n);
      return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
    };
    const bad = [];
    const screen = document.querySelector('.ckp-screen');
    const clipped = (n) => {
      let p = n.parentElement;
      while (p && p !== document.documentElement) {
        const s = getComputedStyle(p);
        if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible') return true;
        p = p.parentElement;
      }
      return false;
    };
    for (const n of screen ? screen.querySelectorAll('*') : []) {
      const b = n.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.right <= innerWidth + 0.5 && b.left >= -0.5 && b.bottom <= innerHeight + 0.5 && b.top >= -0.5) continue;
      if (clipped(n)) continue;
      bad.push({
        sel: n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).join('.') : ''),
        box: box(n),
        pos: getComputedStyle(n).position,
      });
    }
    return {
      tag,
      viewport: [innerWidth, innerHeight],
      docScroll: [de.scrollWidth, de.scrollHeight],
      ok: de.scrollWidth === innerWidth && de.scrollHeight === innerHeight,
      sheet: box(document.querySelector('.ckp-card--drawer')),
      sheetRadius: cs('.ckp-card--drawer', ['border-radius', 'background-image', 'backdrop-filter', 'box-shadow']),
      body: box(document.querySelector('.ckp-drawer-body')),
      bodyPad: cs('.ckp-drawer-body', ['padding', 'padding-bottom']),
      grabber: box(document.querySelector('.ckp-grabber span')),
      close: box(document.querySelector('.ckp-drawer-close')),
      capsule: box(document.querySelector('.ckp-drawer-foot .ckp-capsule')),
      hero: box(document.querySelector('.ckp-hero')),
      heroNum: cs('.ckp-hero-num', ['font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-variant-numeric', 'color']),
      unit: cs('.ckp-hero-unit', ['font-size', 'font-weight', 'color']),
      sub: cs('.ckp-hero-sub', ['font-size', 'font-weight', 'line-height', 'font-variant-numeric']),
      field: box(document.querySelector('.ckp-field')),
      fieldStyle: cs('.ckp-field', ['height', 'border-radius', 'background-color', 'padding', 'border-width', 'border-color']),
      fieldLabel: cs('.ckp-field-label', ['font-size', 'font-weight', 'color', 'letter-spacing', 'text-transform', 'line-height']),
      fieldValue: cs('.ckp-field-value', ['font-size', 'font-weight', 'color', 'width', 'text-align', 'font-variant-numeric', 'line-height', 'direction']),
      groupGap: cs('.ckp-group', ['gap', 'row-gap']),
      bar: box(document.querySelector('.ckp-hero-bar')),
      barBottom: box(document.querySelector('.ckp-lowerbar, .tb')),
      bad: bad.slice(0, 8),
    };
      }, label);
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(1500);
      await page.waitForSelector('.ckp-screen', { timeout: 60000 }).catch(() => {});
    }
  }
  return null;
};

const measures = {};

async function gotoAsk() {
  await page.goto(BASE + CARNET, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForSelector('.ckp-mapzone', { timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 12; i += 1) {
    const accept = page.getByRole('button', { name: 'Tout accepter' });
    if (await accept.count()) {
      await accept.first().click().catch(() => {});
      break;
    }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1400);
}

async function openStats() {
  await page.locator('.ckp-stat').first().click();
  await page.waitForSelector('.ckp-card--drawer', { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function subTab(label) {
  await page.locator(`.ckp-sub button[aria-label="${label}"]`).first().click();
  await page.waitForTimeout(460);
}

await page.setViewportSize({ width: 430, height: 932 });
await gotoAsk();

if (ONLY === 'all' || ONLY === 'card') {
  await shot('carte');
  measures.card = await probe('carte');
}

if (ONLY === 'all' || ONLY === 'stats') {
  await openStats();
  await shot('stats-distance');
  measures.distance = await probe('distance');
  await subTab('Dénivelé');
  await shot('stats-elevation');
  await subTab('Jours');
  await shot('stats-days');
  measures.days = await probe('days');
  await page.locator('.ckp-drawer-body').evaluate((n) => n.scrollTo({ top: 260 }));
  await shot('stats-days-scrolled');
  await page.locator('.ckp-drawer-body').evaluate((n) => n.scrollTo({ top: 0 }));
  await page.waitForTimeout(300);
}

if (ONLY === 'all' || ONLY === 'share') {
  if (!(await page.locator('.ckp-card--drawer').count())) await openStats();
  await page.locator('.ckp-drawer-foot [role="tab"]').nth(1).click();
  await page.waitForTimeout(600);
  await shot('share');
  measures.share = await probe('share');
}

if (ONLY === 'all' || ONLY === 'pages') {
  if (await page.locator('.ckp-card--drawer').count()) {
    await page.locator('.ckp-drawer-close').click();
    await page.waitForTimeout(600);
  }
  await page.getByLabel('Plus d’options').click();
  await page.waitForTimeout(400);
  await page.getByText('Commentaires').click();
  await page.waitForTimeout(700);
  await shot('comments');
  measures.comments = await probe('comments');
  await page.getByLabel('Plus d’options').click();
  await page.waitForTimeout(400);
  await page.getByText('J’aime', { exact: true }).click();
  await page.waitForTimeout(700);
  await shot('likes');
  measures.likes = await probe('likes');
  if (await page.getByText('Gérer le carnet').count()) {
    await page.getByLabel('Plus d’options').click();
    await page.waitForTimeout(400);
    await page.getByText('Gérer le carnet').click();
    await page.waitForTimeout(700);
    await shot('manage');
    measures.manage = await probe('manage');
  }
}

// Débordement : feuille ouverte, trois viewports.
if (!(await page.locator('.ckp-card--drawer').count())) {
  await page.locator('.ckp-card-scroll').evaluate((n) => n.scrollTo({ top: 0 })).catch(() => {});
  await page.evaluate(() => location.reload());
  await gotoAsk();
  await openStats();
}
for (const [w, h] of [
  [430, 932],
  [768, 1024],
  [1440, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  measures[`overflow-${w}`] = await probe(`overflow-${w}`);
  await shot(`viewport-${w}`);
}

fs.writeFileSync(path.join(OUT, 'mesure.json'), JSON.stringify({ measures, errors }, null, 2));
console.log(JSON.stringify({ out: OUT, errors: errors.slice(0, 5), ok: Object.fromEntries(Object.entries(measures).map(([k, v]) => [k, `${v.docScroll}/${v.viewport} ${v.ok}`])) }, null, 2));
await browser.close();
