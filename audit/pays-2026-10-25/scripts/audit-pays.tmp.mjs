import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/Users/fr168256/lkdv/audit/pays-2026-10-25/avant';
const BASE = 'http://127.0.0.1:4000';
const SECTIONS = ['presentation','destinations','activites','culture','gastronomie','hebergements','pratique','communaute'];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
  locale: 'fr-FR', timezoneId: 'Europe/Paris',
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 240)); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));

await page.goto(BASE + '/pays/fr', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4000);

// Cookies : refuser pour dégager la vue
try {
  const refuse = page.getByRole('button', { name: /Refuser/i }).first();
  if (await refuse.isVisible({ timeout: 3000 })) { await refuse.click(); await page.waitForTimeout(800); }
} catch {}

const inventory = await page.evaluate(() => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const cs = (el, props) => { const s = getComputedStyle(el); const o = {}; props.forEach((p) => (o[p] = s.getPropertyValue(p))); return o; };
  const btns = [...document.querySelectorAll('button, a[href], [role="button"]')].map((el) => ({
    tag: el.tagName.toLowerCase(),
    href: el.getAttribute('href') || undefined,
    text: txt(el),
    aria: el.getAttribute('aria-label') || undefined,
    box: box(el),
    cls: (el.className || '').toString().slice(0, 90),
  })).filter((b) => b.box[2] > 0 && b.box[3] > 0);
  const sections = [...document.querySelectorAll('section, [data-section]')].map((el) => ({ tag: el.tagName, id: el.id || el.getAttribute('data-section'), text: txt(el).slice(0, 60) }));
  const main = document.querySelector('main') || document.body;
  const cards = [...main.querySelectorAll('.glass, .glass-sub-card')].map((el) => ({ box: box(el), text: txt(el).slice(0, 70) }));
  return {
    buttons: btns,
    buttonCount: btns.length,
    sections,
    cards,
    docScroll: document.documentElement.scrollHeight,
    bodyFont: cs(document.body, ['font-family', 'font-size', 'color', 'background-color']),
    glassStyle: (() => { const g = document.querySelector('.glass'); return g ? cs(g, ['background', 'background-image', 'backdrop-filter', 'box-shadow', 'border-radius', 'border']) : null; })(),
    pillStyle: (() => { const g = document.querySelector('.glass-pill'); return g ? { box: box(g), ...cs(g, ['background', 'border-radius', 'font-size', 'font-weight', 'color', 'text-transform']) } : null; })(),
    capsuleBtn: (() => { const g = document.querySelector('.glass-capsule-btn'); return g ? { box: box(g), ...cs(g, ['background', 'background-image', 'border-radius', 'height', 'font-size', 'font-weight', 'color', 'box-shadow']) } : null; })(),
    upperTabs: [...document.querySelectorAll('[data-tab], nav button')].slice(0, 20).map((el) => ({ text: txt(el).slice(0, 20), box: box(el), ...cs(el, ['font-size', 'font-weight', 'text-transform', 'border-radius', 'background']) })),
  };
});
fs.writeFileSync(path.join(OUT, 'inventaire-dom.json'), JSON.stringify(inventory, null, 2));

const perSection = {};
for (const s of SECTIONS) {
  await page.evaluate((sec) => window.dispatchEvent(new CustomEvent('pays-detail-tab-change', { detail: sec })), s);
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `section-${s}-430-haut.png`) });
  await page.screenshot({ path: path.join(OUT, `section-${s}-430-full.png`), fullPage: true });
  perSection[s] = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const mc = [...main.querySelectorAll('.glass')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim());
    return {
      scrollHeight: document.documentElement.scrollHeight,
      blocks: mc.length,
      empties: mc.filter((t) => t.length === 0).length,
      textLen: (main.innerText || '').replace(/\s+/g, ' ').trim().length,
      firstBlocks: mc.slice(0, 6).map((t) => t.slice(0, 90)),
      zeroStates: [...main.querySelectorAll('*')].filter((e) => /aucun|aucune|vide|indisponible/i.test((e.textContent || '').slice(0, 120)) && e.children.length === 0).map((e) => (e.textContent || '').trim().slice(0, 100)).slice(0, 5),
    };
  });
}
fs.writeFileSync(path.join(OUT, 'sections-mesures.json'), JSON.stringify({ perSection, logs }, null, 2));
console.log(JSON.stringify({ buttonCount: inventory.buttonCount, docScroll: inventory.docScroll, sections: Object.fromEntries(Object.entries(perSection).map(([k, v]) => [k, { h: v.scrollHeight, blocks: v.blocks, empties: v.empties, len: v.textLen }])) }, null, 2));
await browser.close();
