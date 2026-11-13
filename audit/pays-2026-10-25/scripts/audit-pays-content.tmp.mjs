import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/Users/fr168256/lkdv/audit/pays-2026-10-25/avant';
const BASE = 'http://127.0.0.1:4000';
const SECTIONS = ['presentation','destinations','activites','culture','gastronomie','hebergements','pratique','communaute'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();
const api = [];
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/') || u.includes('supabase.co/rest')) api.push({ status: r.status(), url: u.replace(BASE, '').slice(0, 150), method: r.request().method() });
});
await page.goto(BASE + '/pays/fr', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3500);
try { const b = page.getByRole('button', { name: /Refuser/i }).first(); if (await b.isVisible({ timeout: 2500 })) { await b.click(); await page.waitForTimeout(600); } } catch {}

const scan = async () => page.evaluate(() => {
  const cands = [...document.querySelectorAll('[class*="md:hidden"]')];
  const mobile = cands.sort((a,b)=>((b.innerText||'').length)-(a.innerText||'').length)[0] || document.body;
  const txt = (mobile?.innerText || '').replace(/\s+/g, ' ').trim();
  const headings = [...(mobile?.querySelectorAll('h1,h2,h3,h4,h5') || [])].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean);
  const imgs = [...(mobile?.querySelectorAll('img') || [])].map((i) => ({ src: (i.currentSrc || i.src || '').slice(0, 90), ok: i.complete && i.naturalWidth > 0 }));
  return {
    len: txt.length,
    placeholder: /Contenu en préparation|Aucun|indisponible|Bientôt|à venir/i.test(txt),
    placeholders: (txt.match(/Contenu en préparation[^.]*\.|Aucun[^.]*\.|Aucune[^.]*\./gi) || []).slice(0, 6),
    headings,
    imgCount: imgs.length,
    imgBroken: imgs.filter((i) => !i.ok).length,
    imgSrcs: [...new Set(imgs.map((i) => i.src.replace(/^.*\//, '').slice(0, 40)))].slice(0, 8),
    text: txt.slice(0, 500),
  };
});

const res = {};
for (const s of SECTIONS) {
  await page.evaluate((sec) => window.dispatchEvent(new CustomEvent('pays-detail-tab-change', { detail: sec })), s);
  await page.waitForTimeout(1600);
  res[s] = await scan();
}
fs.writeFileSync(OUT + '/sections-contenu.json', JSON.stringify({ res, api }, null, 2));
for (const [k, v] of Object.entries(res)) {
  console.log('---', k, 'len=' + v.len, 'imgs=' + v.imgCount, 'broken=' + v.imgBroken, 'placeholder=' + v.placeholder);
  console.log('   H:', v.headings.slice(0, 10).join(' | '));
  if (v.placeholders.length) console.log('   PH:', v.placeholders.join(' / '));
  console.log('   TXT:', v.text.slice(0, 260));
}
const uniq = {};
api.forEach((a) => { const k = a.status + ' ' + a.url.split('?')[0]; uniq[k] = (uniq[k] || 0) + 1; });
console.log('API:'); Object.entries(uniq).forEach(([k, n]) => console.log('  ', n + 'x', k));
await browser.close();
