import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = 'http://127.0.0.1:4001/compte';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(6000);
// masquer le bandeau cookies s'il existe
try { const r = p.getByRole('button', { name: /Refuser/i }).first(); if (await r.isVisible({ timeout: 2000 })) { await r.click(); await p.waitForTimeout(500); } } catch {}

const data = await p.evaluate(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return [ +r.x.toFixed(1), +r.y.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1) ]; };
  const cs = (el, props) => { const s = getComputedStyle(el); const o = {}; for (const k of props) o[k] = s.getPropertyValue(k); return o; };
  const one = (sel) => document.querySelector(sel);
  const all = (sel) => [...document.querySelectorAll(sel)];
  const root = one('.phone') || one('[class*="phone"]') || document.body.firstElementChild;
  const topBar = one('.ig-top');
  const card = one('.card.cs') || one('.card');
  const scroll = one('.card-scroll');
  const header = one('.ig-header');
  const stats = all('.ig-stat');
  const bio = one('.ig-bio-text') || one('.ig-bio');
  const hl = all('.ig-hl');
  const ring = one('.ig-hl-ring');
  const grid = one('.ig-grid-wrap');
  const tile = one('.ig-tile');
  const tabs = one('.ig-tabs');
  const lens = one('.ig-th');
  const tb = one('.tb');
  const tbBtn = all('.tb button');
  const pill = one('.ig-handle');
  const topBtns = all('.ig-top-btn');
  const bg = one('.bg');
  const mapzone = one('.mapzone');
  const top = one('.top');
  const rootCs = root ? cs(root, ['font-size','letter-spacing','color','font-family','background-color','width','height','overflow','position']) : null;
  const varNames = ['--label','--label2','--label3','--sep','--fill','--fill2','--fill3','--tint','--tint-ink','--accent','--subtle','--mint','--good','--warn','--bad','--info','--water','--ga','--gb','--la','--page','--on-page','--muted-page','--rule','--sf'];
  const vars = {};
  if (root) { const s = getComputedStyle(root); for (const v of varNames) vars[v] = s.getPropertyValue(v).trim(); }
  return {
    rootSelector: root ? root.className.toString().slice(0, 80) : null,
    rootCs,
    vars,
    doc: { scrollHeight: document.documentElement.scrollHeight, innerHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth },
    top: top ? box(top) : null,
    topCs: top ? cs(top, ['padding','gap','display','flex-direction']) : null,
    topBar: topBar ? box(topBar) : null,
    topBarCs: topBar ? cs(topBar, ['display','justify-content','gap','margin-bottom']) : null,
    pill: pill ? { box: box(pill), ...cs(pill, ['font-size','font-weight','letter-spacing','color','background','border-radius','padding','height']) } : null,
    topBtns: topBtns.map((e) => ({ box: box(e), radius: getComputedStyle(e).borderRadius, bg: getComputedStyle(e).backgroundColor })),
    card: card ? { box: box(card), radius: getComputedStyle(card).borderRadius, bg: getComputedStyle(card).background.slice(0, 200), backdrop: getComputedStyle(card).backdropFilter, shadow: getComputedStyle(card).boxShadow.slice(0, 300) } : null,
    scroll: scroll ? { box: box(scroll), padding: getComputedStyle(scroll).padding, gap: getComputedStyle(scroll).gap, overflow: getComputedStyle(scroll).overflow } : null,
    header: header ? box(header) : null,
    stats: stats.map((e) => box(e)),
    statCs: stats[0] ? cs(stats[0], ['border-radius','padding','font-size']) : null,
    bio: bio ? { box: box(bio), ...cs(bio, ['font-size','line-height','letter-spacing','color','font-weight']) } : null,
    hl: hl.map((e) => box(e)).slice(0, 8),
    ring: ring ? { box: box(ring), radius: getComputedStyle(ring).borderRadius } : null,
    grid: grid ? { box: box(grid), gap: getComputedStyle(grid).gap, radius: getComputedStyle(grid).borderRadius } : null,
    tile: tile ? { box: box(tile), radius: getComputedStyle(tile).borderRadius } : null,
    tabs: tabs ? { box: box(tabs), radius: getComputedStyle(tabs).borderRadius, padding: getComputedStyle(tabs).padding } : null,
    lens: lens ? box(lens) : null,
    tb: tb ? { box: box(tb), radius: getComputedStyle(tb).borderRadius, padding: getComputedStyle(tb).padding, position: getComputedStyle(tb).position } : null,
    tbBtns: tbBtn.map((e) => ({ box: box(e), text: (e.innerText||'').replace(/\s+/g,' ').trim().slice(0,20) })),
    bg: bg ? { box: box(bg), size: getComputedStyle(bg).backgroundSize, pos: getComputedStyle(bg).backgroundPosition } : null,
    mapzone: mapzone ? box(mapzone) : null,
    tabLabels: all('.tb button').map((e) => (e.innerText||'').replace(/\s+/g,' ').trim()),
    html: document.documentElement.outerHTML.length,
    allClasses: [...new Set([...document.querySelectorAll('*')].flatMap((e) => [...e.classList]))].filter((c) => /^(ig-|tb|card|lkdv|sheet|sw-|scrim|popv|mapzone|top|bg|phone)/.test(c)).slice(0, 60),
  };
});
fs.writeFileSync('/Users/fr168256/lkdv-pays/ref-local-mesure.json', JSON.stringify(data, null, 2));
console.log(JSON.stringify(data, null, 1).slice(0, 6000));
await b.close();
