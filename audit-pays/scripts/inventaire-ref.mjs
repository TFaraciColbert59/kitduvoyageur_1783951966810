import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/Users/fr168256/lkdv-pays/audit-pays/inventaire';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'https://kitduvoyageur.faracitonyp.workers.dev/compte';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(9000);
try {
  const x = p.getByRole('button', { name: /Refuser|Tout accepter/i }).first();
  if (await x.isVisible({ timeout: 2500 })) { await x.click(); await p.waitForTimeout(900); }
} catch {}

const PROPS = ['font-size','font-weight','letter-spacing','line-height','color','background-image','background-color','background-size','background-position','backdrop-filter','box-shadow','border','border-radius','padding','gap','display','grid-template-columns','grid-template-rows','opacity','transform','filter','overflow','z-index','text-transform','font-variant-numeric'];

async function styleOf(sel) {
  return p.evaluate(({ s, props }) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const c = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const o = { box: [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)] };
    for (const k of props) o[k] = c.getPropertyValue(k);
    return o;
  }, { s: sel, props: PROPS });
}

const inv = {};

inv.main = {};
for (const [k, sel] of Object.entries({
  phone: '.phone', bg: '.bg', top: '.top', topbar: '.ig-top', pill: '.ig-handle', gbtn: '.ig-top-btn',
  card: '.card.cs', cardScroll: '.card-scroll', header: '.ig-header', avi: '.ig-avi-wrap', aviIn: '.ig-avi-in',
  stat: '.ig-stat', statNum: '.ig-stat b', statLbl: '.ig-stat span', bioTop: '.ig-bio-top', bioCcs: '.ig-bio-cc',
  bioText: '.ig-bio-text', hlRow: '.ig-hl-row', hl: '.ig-hl', hlRing: '.ig-hl-ring', hlIn: '.ig-hl-in',
  gridWrap: '.ig-grid-wrap', grid: '.ig-grid', tile: '.ig-tile', tabsFloat: '.ig-tabs-float', tabs: '.ig-tabs',
  th: '.ig-th', mapzone: '.mapzone', map: '.map', tb: '.tb', tbBtn: '.tb button', lens: '.tb .lens',
  sheetWrap: '.sw-wrap', sheet: '.sheet', popover: '.popv',
})) inv.main[k] = await styleOf(sel);

inv.rings = await p.evaluate(() => {
  const list = [...document.querySelectorAll('.ig-hl')];
  return list.map((e) => {
    const img = e.querySelector('img');
    return { label: (e.innerText || '').trim(), hasCover: Boolean(img), cover: img ? img.getAttribute('src')?.slice(0, 90) : null };
  });
});

inv.bar = await p.evaluate(() => {
  const tb = document.querySelector('.tb');
  const items = tb ? [...tb.querySelectorAll('button')] : [];
  return {
    labels: items.map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()),
    cls: items.map((e) => String(e.className)),
    html: tb ? tb.outerHTML.replace(/\s+/g, ' ').slice(0, 500) : null,
  };
});

await p.screenshot({ path: `${OUT}/01-ecran.png` });

/* Drawer compte */
await p.locator('.ig-top-btn').nth(2).click();
await p.waitForTimeout(1800);
inv.drawer = {};
inv.drawer.det = await p.evaluate(() => document.querySelector('.sw-wrap')?.getAttribute('data-det'));
inv.drawer.wrap = await styleOf('.sw-wrap');
inv.drawer.sheet = await styleOf('.sheet');
inv.drawer.grab = await styleOf('.sheet .grab');
inv.drawer.rowTitle = await styleOf('.sheet .ttl');
inv.drawer.rowSub = await styleOf('.sheet .s2');
inv.drawer.entries = await p.evaluate(() => {
  const list = [...document.querySelectorAll('.sheet button, .sheet a, .sheet .li')].slice(0, 14);
  return list.map((e) => ({ text: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 44), cls: String(e.className).slice(0, 40) }));
});
inv.drawer.phone = await p.evaluate(() => {
  const ph = document.querySelector('.phone');
  const tb = document.querySelector('.tabbar');
  return { sheetOpen: ph?.getAttribute('data-sheet-open'), tabbarOpacity: tb ? getComputedStyle(tb).opacity : null };
});
await p.screenshot({ path: `${OUT}/02-drawer-compte.png` });
await p.keyboard.press('Escape');
await p.waitForTimeout(900);

/* Popover */
await p.locator('.ig-top-btn').nth(1).click();
await p.waitForTimeout(1300);
inv.popover = await styleOf('.popv');
await p.screenshot({ path: `${OUT}/03-popover.png` });
await p.keyboard.press('Escape');
await p.waitForTimeout(700);

/* Sélecteur */
inv.selector = await p.evaluate(() => {
  const list = [...document.querySelectorAll('.ig-tabs button')];
  return list.map((e) => ({ label: e.getAttribute('aria-label'), selected: e.getAttribute('aria-selected') }));
});
inv.tabs = await styleOf('.ig-tabs');
inv.tabsLens = await styleOf('.ig-th');
await p.locator('.ig-tabs button').nth(1).click();
await p.waitForTimeout(1600);
await p.screenshot({ path: `${OUT}/04-selecteur-etat2.png` });
inv.tabsLens2 = await styleOf('.ig-th');
inv.gridState2 = await styleOf('.ig-grid-wrap');
await p.locator('.ig-tabs button').nth(0).click();
await p.waitForTimeout(1000);

/* Carte + contrôles */
inv.mapControls = await p.evaluate(() => {
  const sels = ['.map-scale-selector', '.mctl', '.map-badge-3d', '.lkdv-map-attribution', '.maplibregl-ctrl-top-right'];
  const out = [];
  for (const s of sels) {
    const e = document.querySelector(s);
    if (!e) { out.push({ sel: s, absent: true }); continue; }
    const r = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    out.push({ sel: s, box: [+r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)], bg: c.backgroundImage.slice(0, 80), bf: c.backdropFilter, radius: c.borderRadius, display: c.display, opacity: c.opacity });
  }
  return out;
});
await p.screenshot({ path: `${OUT}/05-carte.png` });

await p.locator('.mgrab').click().catch(() => {});
await p.waitForTimeout(1600);
inv.mapBig = { phoneCls: await p.evaluate(() => document.querySelector('.phone')?.className), top: await styleOf('.top'), mapzone: await styleOf('.mapzone') };
await p.screenshot({ path: `${OUT}/06-carte-agrandie.png` });

fs.writeFileSync(`${OUT}/inventaire.json`, JSON.stringify(inv, null, 2));
console.log('OK', Object.keys(inv).join(','), '| erreurs:', errs.length);
await b.close();
