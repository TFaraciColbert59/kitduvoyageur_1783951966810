import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4000/pays/fr', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(3500);
const r = await p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const mobile = [...document.querySelectorAll('[class*="md:hidden"]')].sort((a,b)=>((b.innerText||'').length)-(a.innerText||'').length)[0];
  const glass = [...mobile.querySelectorAll('.glass')].filter(vis);
  return { glassCount: glass.length, glassBoxes: glass.slice(0,8).map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];}), visibleFocus: [...document.querySelectorAll('button,a[href],input')].filter(vis).length };
});
console.log(JSON.stringify(r));
await b.close();
