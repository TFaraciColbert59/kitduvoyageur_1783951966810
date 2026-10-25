import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(4500);
try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(500);}}catch{}
const info = await p.evaluate(() => {
  const els = document.elementsFromPoint(215, 880).slice(0,6).map(e=>({ tag:e.tagName, cls:(e.className||'').toString().slice(0,50), op:getComputedStyle(e).opacity, bf:getComputedStyle(e).backdropFilter }));
  const lens = document.querySelector('.tb .lens');
  const ls = lens ? getComputedStyle(lens) : null;
  return { els, lens: ls ? { box: (()=>{const r=lens.getBoundingClientRect();return [r.x,r.y,r.width,r.height];})(), opacity: ls.opacity, bg: ls.background.slice(0,80), bf: ls.backdropFilter, display: ls.display, transform: ls.transform } : null };
});
console.log(JSON.stringify(info, null, 1));
await p.locator('.tb').screenshot({ path: '/Users/fr168256/lkdv-pays/audit-pays/bar-zoom.png' });
await b.close();
