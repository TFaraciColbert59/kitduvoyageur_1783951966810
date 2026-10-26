#!/usr/bin/env node
// scripts/design/design-fidelity.mjs
//
// Porte de fidélité de la grammaire Compte (verre Liquid Glass v8).
// Compare les ancres mesurées de la référence (430 × 932) au DOM rendu.
// Tolérance géométrique : ±1 px. Typographie et couleurs : exactes.
//
// Usage :
//   node scripts/design/design-fidelity.mjs [url] [--json]
//   npm run design:fidelity -- /pays/fr
//
// Sortie : une ligne par ancre (OK / ÉCART), puis le verdict. Code 1 si écart.

import { chromium } from 'playwright';

const rawArg = process.argv.slice(2).find((a) => a.startsWith('http') || (a.startsWith('/') && !a.includes('node')));
const base = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4001';
const url = rawArg?.startsWith('http') ? rawArg : `${base}${rawArg || '/pays/fr'}`;
const jsonOut = process.argv.includes('--json');

const VIEWPORT = { width: 430, height: 932 };
const TOL = 1;

/** Recette : la grammaire est vérifiée aux trois viewports du contrat (§7). */
const VIEWPORTS = [
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const ALL = process.argv.includes('--all');

/** Constantes mesurées sur /compte (production, compte démo), 25/10/2026. */
const ANCHORS = {
  locked: true,
  base: { fontSize: '14px', letterSpacing: '-0.14px', color: 'rgb(23, 43, 36)' },
  topBar: [12, 6, 406, 36],
  pillHeight: 34,
  buttons: { count: 3, width: 38, height: 38, radius: '50%' },
  card: { box: [12, 48, 406, 541.1], radius: '24px' },
  cardScroll: { padding: '8px 12px 56px', gap: '7px' },
  identity: [24, 56, 382, 68],
  stats: { count: 3, width: 101, height: 39, radius: '14px' },
  bio: { width: 378, fontSize: '12px', lineHeight: '15.6px' },
  rings: { width: 72, height: 56.4 },
  ring: { width: 44, height: 44, radius: '50%' },
  grid: { width: 406, gap: '2px' },
  tile: { width: 134, height: 134, radius: '2px' },
  selector: { width: 88, height: 30, radius: '9999px' },
  lens: { width: 41.5, height: 25 },
  bottomBar: [14, 868, 402, 48],
  bottomItem: { count: 5, width: 80, height: 44 },
};

const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const boxNear = (box, ref) => box.length === 4 && box.every((v, i) => near(v, ref[i]));

const browser = await chromium.launch();

async function runOne(vw) {
  const isPhone = vw.width < 768;
  const ctx = await browser.newContext({
    viewport: vw,
    deviceScaleFactor: 1,
    isMobile: isPhone,
    hasTouch: isPhone,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4000);
// Bandeau cookies hors périmètre : on le retire de la vue.
await page
  .getByRole('button', { name: /Refuser|Tout accepter/i })
  .first()
  .click({ timeout: 1500 })
  .catch(() => {});
await page.waitForTimeout(600);

const m = await page.evaluate(() => {
  const box = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)];
  };
  const cs = (sel, props) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const s = getComputedStyle(e);
    const o = {};
    for (const p of props) o[p] = s.getPropertyValue(p);
    return o;
  };
  const all = (sel) =>
    [...document.querySelectorAll(sel)].map((e) => {
      const r = e.getBoundingClientRect();
      return [+r.width.toFixed(1), +r.height.toFixed(1), getComputedStyle(e).borderRadius];
    });
  return {
    doc: { scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight },
    base: cs('.phone', ['font-size', 'letter-spacing', 'color']),
    topBar: box('.ig-top'),
    pill: box('.ig-handle'),
    buttons: all('.ig-top-btn'),
    card: box('.card.cs') || box('.card'),
    cardRadius: cs('.card.cs', ['border-radius']),
    cardScroll: cs('.card-scroll', ['padding', 'gap']),
    identity: box('.ig-header'),
    stats: all('.ig-stat'),
    bio: { box: box('.ig-bio-text'), ...cs('.ig-bio-text', ['font-size', 'line-height']) },
    rings: box('.ig-hl'),
    ring: { box: box('.ig-hl-ring'), ...cs('.ig-hl-ring', ['border-radius']) },
    grid: { box: box('.ig-grid-wrap'), gap: cs('.ig-grid-wrap', ['gap'])?.gap, gridGap: cs('.ig-grid', ['gap'])?.gap },
    tile: { box: box('.ig-tile'), ...cs('.ig-tile', ['border-radius']) },
    selector: { box: box('.ig-tabs'), ...cs('.ig-tabs', ['border-radius']) },
    lens: box('.ig-th'),
    bottomBar: box('.tb'),
    bottomItems: all('.tb button'),
    hasRings: Boolean(document.querySelector('.ig-hl-row')),
    infoRow: (() => {
      const e = document.querySelector('.lkdv-info-row');
      if (!e) return null;
      const c = getComputedStyle(e);
      return { display: c.display, height: Math.round(e.getBoundingClientRect().height) };
    })(),
    sectionPill: box('.lkdv-section-pill'),
  };
});

const colOffset = Math.round((vw.width - 430) / 2);
const rowOffset = Math.max(0, Math.round((vw.height - 932) / 2)); // centré si l'écran tient
const shift = (box) => (box ? [box[0] - colOffset, box[1] - rowOffset, box[2], box[3]] : null);
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail });

check('Écran verrouillé', m.doc.scrollHeight === (vw.height >= 932 ? vw.height : 932), `${m.doc.scrollHeight} pour un écran de ${vw.height >= 932 ? vw.height : 932}`);
check('Base typo', m.base && m.base['font-size'] === ANCHORS.base.fontSize && m.base['letter-spacing'] === ANCHORS.base.letterSpacing && m.base.color === ANCHORS.base.color, JSON.stringify(m.base));
check('Barre haute', m.topBar && boxNear(shift(m.topBar), ANCHORS.topBar), JSON.stringify(m.topBar));
check('Pilule h34', m.pill && near(m.pill[3], ANCHORS.pillHeight), JSON.stringify(m.pill));
check('3 boutons 38', m.buttons.length === 3 && m.buttons.every((b) => near(b[0], 38) && near(b[1], 38) && b[2] === '50%'), JSON.stringify(m.buttons));
check('Carte 406×541 r24', m.card && boxNear(shift(m.card), ANCHORS.card.box) && m.cardRadius?.['border-radius'] === ANCHORS.card.radius, `${JSON.stringify(m.card)} r=${m.cardRadius?.['border-radius']}`);
check('Scroll interne', m.cardScroll && m.cardScroll.padding === ANCHORS.cardScroll.padding && m.cardScroll.gap === ANCHORS.cardScroll.gap, JSON.stringify(m.cardScroll));
check('Identité 382×68', m.identity && boxNear(shift(m.identity), ANCHORS.identity), JSON.stringify(m.identity));
check('3 stats 101×39 r14', m.stats.length === 3 && m.stats.every((s) => near(s[0], ANCHORS.stats.width) && near(s[1], ANCHORS.stats.height) && s[2] === ANCHORS.stats.radius), JSON.stringify(m.stats));
check('Bio 378 12/15,6', m.bio.box && near(m.bio.box[2], ANCHORS.bio.width) && m.bio['font-size'] === ANCHORS.bio.fontSize && m.bio['line-height'] === ANCHORS.bio.lineHeight, JSON.stringify(m.bio));
// Variante « sans stories » : les sections vivent dans le sélecteur de la carte.
if (m.hasRings) {
  check('Anneaux 72×56', m.rings && near(m.rings[2], ANCHORS.rings.width) && near(m.rings[3], ANCHORS.rings.height), JSON.stringify(m.rings));
  check('Anneau 44 r50', m.ring.box && near(m.ring.box[2], 44) && near(m.ring.box[3], 44) && m.ring['border-radius'] === '50%', JSON.stringify(m.ring));
} else {
  check('Sélecteur de section', m.sectionPill && near(m.sectionPill[3], 30), JSON.stringify(m.sectionPill));
  check('Sélecteur ancré dans la carte', m.sectionPill && m.sectionPill[1] > 500 && m.sectionPill[1] < 932, JSON.stringify(m.sectionPill));
}
const gridGapOk = m.grid?.gridGap ? m.grid.gridGap === ANCHORS.grid.gap : true; // pas de grille en vue cartes
check('Grille 406 gap 2', m.grid.box && near(m.grid.box[2], ANCHORS.grid.width) && gridGapOk, JSON.stringify({ box: m.grid.box, gap: m.grid.gridGap || m.grid.gap }));
const tileOk = !m.tile.box || (near(m.tile.box[2], ANCHORS.tile.width) && near(m.tile.box[3], ANCHORS.tile.height) && m.tile['border-radius'] === ANCHORS.tile.radius);
check('Tuile 134 r2 (si grille photo)', tileOk, JSON.stringify(m.tile));
if (m.hasRings) {
  check('Sélecteur 88×30', m.selector.box && near(m.selector.box[2], ANCHORS.selector.width) && near(m.selector.box[3], ANCHORS.selector.height) && m.selector['border-radius'] === ANCHORS.selector.radius, JSON.stringify(m.selector));
  check('Lentille 41,5×25', m.lens && near(m.lens[2], ANCHORS.lens.width) && near(m.lens[3], ANCHORS.lens.height), JSON.stringify(m.lens));
}
check('Barre basse 402×48', m.bottomBar && boxNear(shift(m.bottomBar), ANCHORS.bottomBar), JSON.stringify(m.bottomBar));
check('5 items 80×44', m.bottomItems.length === ANCHORS.bottomItem.count && m.bottomItems.every((b) => near(b[0], ANCHORS.bottomItem.width) && near(b[1], ANCHORS.bottomItem.height)), JSON.stringify(m.bottomItems));
check('Rangée d’info alignée', !m.infoRow || (m.infoRow.display === 'flex' && m.infoRow.height >= 32), JSON.stringify(m.infoRow));
check('Zéro erreur console', errors.length === 0, errors.slice(0, 2).join(' | ') || 'aucune');

await ctx.close();
  return { vw, status: resp?.status(), results };
}

const runs = [];
for (const vw of ALL ? VIEWPORTS : [VIEWPORT]) runs.push(await runOne(vw));
await browser.close();

const results = runs.flatMap((r) => r.results.map((x) => ({ ...x, name: `${x.name}` })));
const failed = results.filter((r) => !r.ok);
if (jsonOut) {
  console.log(JSON.stringify({ url, runs }, null, 2));
} else {
  for (const run of runs) {
    console.log(`\nFIDÉLITÉ — ${url} @ ${run.vw.width}×${run.vw.height}\n`);
    for (const r of run.results) console.log(`${r.ok ? '  OK  ' : ' ÉCART'} ${r.name.padEnd(30)} ${r.ok ? '' : r.detail}`);
    const ko = run.results.filter((r) => !r.ok).length;
    console.log(`  → ${run.results.length - ko}/${run.results.length} ancres conformes${ko ? ` — ${ko} écart(s)` : ''}`);
  }
  console.log('');
}
process.exit(failed.length ? 1 : 0);
