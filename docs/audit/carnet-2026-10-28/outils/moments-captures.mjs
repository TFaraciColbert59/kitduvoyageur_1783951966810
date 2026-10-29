// Recette « Moments » : captures, mesures de la capsule, débordement, audit Communauté.
// Usage : node /tmp/ckp-moments.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.CKP_BASE || 'http://localhost:4317';
const CARNET = '/carnets/13072b4b-fa66-40d2-b30b-a66f8aabb2c2';
const OUT = process.env.CKP_OUT || '/tmp/ckp-moments';
fs.mkdirSync(OUT, { recursive: true });

const round = (v) => Math.round(v * 100) / 100;
const box = (n) => {
  if (!n) return null;
  const b = n.getBoundingClientRect();
  return { x: round(b.x), y: round(b.y), w: round(b.width), h: round(b.height) };
};

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

const report = {};

/* Une navigation client tardive peut détruire le contexte d'évaluation :
   on réessaie la sonde au lieu de tomber. */
const evalRetry = async (fn, arg) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await page.evaluate(fn, arg);
    } catch (error) {
      if (!/Execution context was destroyed|navigation/i.test(String(error))) throw error;
      await page.waitForTimeout(900);
    }
  }
  throw new Error('sonde impossible après 4 tentatives');
};

const openCarnet = async () => {
  await page.goto(`${BASE}${CARNET}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ckp-screen', { timeout: 60000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  /* Bandeau cookies : il masque le bas de la fiche sur chaque capture. */
  const accept = page.getByRole('button', { name: /Tout accepter/i });
  if (await accept.count()) {
    await accept.first().click().catch(() => {});
    await page.waitForTimeout(600);
  }
};

/* Drawer Moments ouvert sur une page de jour : la liste suit la page. */
const openMoments = async () => {
  await page.waitForSelector('.ckp-daypill-count', { timeout: 20000 });
  await page.click('.ckp-daypill-count');
  await page.waitForSelector('.ckp-pane-moments', { timeout: 20000 });
  await page.waitForTimeout(500);
};

const capsuleProbe = () =>
  evalRetry(() => {
    const r = (v) => Math.round(v * 100) / 100;
    const b = (n) => {
      if (!n) return null;
      const x = n.getBoundingClientRect();
      return { x: r(x.x), y: r(x.y), w: r(x.width), h: r(x.height) };
    };
    const capsule = document.querySelector('.ckp-drawer-foot .ckp-capsule');
    const lens = capsule?.querySelector(':scope > .ckp-th');
    const seg = capsule?.querySelector('.ckp-tabs button');
    const cs = capsule ? getComputedStyle(capsule) : null;
    const lensCs = lens ? getComputedStyle(lens) : null;
    return {
      capsule: b(capsule),
      lens: b(lens),
      lensOpacity: lensCs?.opacity ?? null,
      lensTransform: lensCs?.transform ?? null,
      lensRadius: lensCs?.borderRadius ?? null,
      segment: b(seg),
      n: capsule?.style.getPropertyValue('--n') ?? null,
      radius: cs?.borderRadius ?? null,
      background: cs?.backgroundColor ?? null,
      shadow: cs?.boxShadow ?? null,
      blur: cs?.backdropFilter ?? null,
      segments: [...(capsule?.querySelectorAll('.ckp-tabs button') ?? [])].map((n) => n.getAttribute('aria-label')),
    };
  });

/* --- 1. Page Posts, sans la liste des moments ------------------------------ */
await openCarnet();
await page.screenshot({ path: path.join(OUT, '01-posts-430.png') });
report.posts = await evalRetry(() => {
  const r = (v) => Math.round(v * 100) / 100;
  const grid = document.querySelector('.ckp-grid-wrap');
  const tile = document.querySelector('.ckp-tile');
  const gcs = grid ? getComputedStyle(grid) : null;
  const pill = document.querySelector('.ckp-daypill-count');
  return {
    momentListInCard: Boolean(document.querySelector('.ckp-dayinfo-moments, .ckp-dayinfo-moment')),
    grid: !!grid,
    gridColumns: gcs?.gridTemplateColumns ?? null,
    gridGap: gcs?.gap ?? null,
    tile: tile
      ? { w: r(tile.getBoundingClientRect().width), h: r(tile.getBoundingClientRect().height), radius: getComputedStyle(tile).borderRadius }
      : null,
    pill: pill
      ? {
          tag: pill.tagName,
          text: pill.textContent,
          label: pill.getAttribute('aria-label'),
          box: (() => {
            const b = pill.getBoundingClientRect();
            return { x: r(b.x), y: r(b.y), w: r(b.width), h: r(b.height) };
          })(),
          color: getComputedStyle(pill).color,
          font: getComputedStyle(pill).font,
        }
      : null,
  };
});

/* --- 2. Drawer Moments ----------------------------------------------------- */
await openMoments();
await page.screenshot({ path: path.join(OUT, '02-drawer-moments-430.png') });
await page.locator('.ckp-drawer-foot .ckp-capsule').screenshot({ path: path.join(OUT, '03-capsule-moments.png') });

report.moments = await evalRetry(() => {
  const r = (v) => Math.round(v * 100) / 100;
  const sheet = document.querySelector('.ckp-card--drawer');
  const head = document.querySelector('.ckp-drawer-head');
  const rows = [...document.querySelectorAll('.ckp-pane-moments .ckp-field')];
  const first = rows[0];
  const value = first?.querySelector('.ckp-field-value');
  const hairline = rows[1] ? getComputedStyle(rows[1], '::before') : null;
  const b = (n) => {
    if (!n) return null;
    const x = n.getBoundingClientRect();
    return { x: r(x.x), y: r(x.y), w: r(x.width), h: r(x.height) };
  };
  return {
    sheet: b(sheet),
    headButtons: head ? head.querySelectorAll('button').length : 0,
    headText: head ? head.textContent : null,
    headTitle: head ? !!head.querySelector('h1,h2,h3') : false,
    rows: rows.map((row) => ({
      label: row.querySelector('.ckp-field-label')?.textContent,
      value: row.querySelector('.ckp-field-value')?.textContent,
      box: b(row),
    })),
    rowHeight: first ? r(first.getBoundingClientRect().height) : null,
    valueColumn: value ? r(value.getBoundingClientRect().width) : null,
    valueTabular: value ? getComputedStyle(value).fontVariantNumeric : null,
    hairline: hairline ? { top: hairline.top, left: hairline.left, right: hairline.right, height: hairline.height, background: hairline.backgroundColor } : null,
    emptyState: Boolean(document.querySelector('.ckp-pane-moments .ckp-empty-state')),
  };
});
report.capsuleMoments = await capsuleProbe();

/* --- 3. Drawer Statistiques (référence) ------------------------------------ */
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('.ckp-stat[data-stat="distance"]');
await page.waitForSelector('.ckp-stats', { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, '04-drawer-stats-430.png') });
await page.locator('.ckp-drawer-foot .ckp-capsule').screenshot({ path: path.join(OUT, '05-capsule-stats.png') });
report.capsuleStats = await capsuleProbe();

/* --- 4. Débordement, drawer ouvert, trois viewports ------------------------ */
report.overflow = {};
for (const [w, h] of [
  [430, 932],
  [768, 1024],
  [1440, 900],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(600);
  report.overflow[`${w}x${h}`] = await evalRetry(() => {
    const de = document.documentElement;
    const body = document.body;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: Math.max(de.scrollWidth, body.scrollWidth),
      scrollHeight: Math.max(de.scrollHeight, body.scrollHeight),
      okX: Math.max(de.scrollWidth, body.scrollWidth) <= window.innerWidth,
      okY: Math.max(de.scrollHeight, body.scrollHeight) <= window.innerHeight,
    };
  });
  if (w !== 430) await page.screenshot({ path: path.join(OUT, `06-drawer-stats-${w}.png`) });
}

/* --- 4bis. Drawer ouvert sur une page de jour ----------------------------- */
await page.setViewportSize({ width: 430, height: 932 });
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.getByRole('tab', { name: 'Jour 2' }).click();
await page.waitForTimeout(500);
await openMoments();
await page.screenshot({ path: path.join(OUT, '09-drawer-moments-j2-430.png') });
report.momentsDay2 = await evalRetry(() =>
  [...document.querySelectorAll('.ckp-pane-moments .ckp-field')].map((row) => [
    row.querySelector('.ckp-field-label')?.textContent,
    row.querySelector('.ckp-field-value')?.textContent,
  ]),
);

/* --- 5. Drawer Moments aux autres viewports -------------------------------- */
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.click('.ckp-daypill-count');
await page.waitForSelector('.ckp-pane-moments', { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, '07-drawer-moments-768.png') });
report.overflow['768x1024-moments'] = await evalRetry(() => {
  const de = document.documentElement;
  return {
    scrollWidth: de.scrollWidth,
    innerWidth: window.innerWidth,
    scrollHeight: de.scrollHeight,
    innerHeight: window.innerHeight,
    okX: de.scrollWidth <= window.innerWidth,
    okY: de.scrollHeight <= window.innerHeight,
  };
});

/* --- 6. Audit du design system de la Communauté ---------------------------- */
await page.setViewportSize({ width: 430, height: 932 });
await page.goto(`${BASE}/communaute`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, '08-communaute-430.png') });
report.community = await evalRetry(() => {
  const pick = (sel, props) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    const out = { box: [Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100] };
    for (const p of props) out[p] = s.getPropertyValue(p);
    return out;
  };
  return {
    hasFeed: Boolean(document.querySelector('.lkdv-feed-shell')),
    feedPost: pick('.lkdv-feed-post', ['border-radius', 'box-shadow', 'background-color']),
    actions: pick('.pmi-post-actions', ['border-radius', 'padding', 'gap', 'background-image', 'box-shadow', 'backdrop-filter']),
    actionBtn: pick('.pmi-post-btn', ['border-radius', 'width', 'height', 'transition', 'color', 'background-color']),
    morePill: pick('.pmi-more-pill', ['border-radius', 'width', 'height', 'box-shadow', 'background-image']),
    author: pick('.lkdv-post-author', ['border-radius', 'min-height', 'padding', 'box-shadow', 'background-image']),
    gbtn: pick('.gbtn', ['border-radius', 'width', 'height', 'box-shadow', 'background-color']),
    text: pick('.lkdv-feed-post-text', ['font-family', 'font-size', 'font-weight', 'line-height', 'color']),
    pourtoi: pick('.lkdv-pourtoi-pill', ['height', 'border-radius', 'padding', 'font-size', 'font-weight', 'box-shadow']),
    count: pick('.lkdv-count', ['font-size', 'font-weight', 'font-variant-numeric', 'color']),
  };
});

report.consoleErrors = errors.slice(0, 10);
fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
