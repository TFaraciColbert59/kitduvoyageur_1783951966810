import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4000/pays/fr', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(3500);
try { const x = p.getByRole('button', { name: /Refuser/i }).first(); if (await x.isVisible({ timeout: 2000 })) await x.click(); } catch {}
const g = await p.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], radius: s.borderRadius, fs: s.fontSize, tt: s.textTransform, bg: s.backgroundColor, color: s.color }; };
  const mobile = [...document.querySelectorAll('[class*="md:hidden"]')].sort((a,b)=>((b.innerText||'').length)-(a.innerText||'').length)[0];
  const q = (sel) => { const e = mobile?.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], radius: s.borderRadius, fs: s.fontSize, tt: s.textTransform, color: s.color, bg: s.backgroundColor }; };
  return {
    headerLink: q('a[href="/pays"]'),
    hero: q('.glass.relative'),
    statsWrap: (()=>{const cells=mobile?.querySelectorAll('.glass-sub-card')||[];if(!cells.length)return null;const e=cells[0].parentElement.parentElement;const r=e.getBoundingClientRect();return {box:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],radius:getComputedStyle(e).borderRadius};})(),
    statCell: q('.glass-sub-card'),
    sectionTitle: q('h3'),
    aiBanner: q('.glass.p-4'),
    pagePaddingBottom: getComputedStyle(mobile).paddingBottom,
    bodyFs: getComputedStyle(document.body).fontSize,
    tabRow: box('nav[aria-label]'),
    bottomBarHeight: (() => { const e=[...document.querySelectorAll('a[href="/compte"]')][0]?.closest('div'); return e? e.getBoundingClientRect().height : null; })(),
    docH: document.documentElement.scrollHeight,
  };
});
console.log(JSON.stringify(g, null, 2));
await b.close();
