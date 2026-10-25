import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(6000);
const r = await p.evaluate(() => {
  const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return { box: [b.x, b.y, b.width, b.height], left: s.left, right: s.right, bottom: s.bottom, top: s.top, width: s.width, height: s.height, position: s.position, transform: s.transform, padding: s.padding, marginLeft: s.marginLeft }; };
  return { tabbar: g('.tabbar'), tb: g('.tb') };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
