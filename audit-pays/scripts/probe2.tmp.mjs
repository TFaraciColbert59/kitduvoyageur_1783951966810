import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(5000);
try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(1500);}}catch{}
const info = await p.evaluate(() => {
  const hits = [];
  document.querySelectorAll('*').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.y < 840 || r.y > 920 || r.width === 0) return;
    const s = getComputedStyle(e);
    const bf = s.backdropFilter || s.webkitBackdropFilter;
    const bg = s.backgroundImage + s.backgroundColor;
    if ((bf && bf !== 'none') || /green|109, 143|91, 127/.test(bg) || s.filter !== 'none') {
      hits.push({ tag: e.tagName, cls: (e.className||'').toString().slice(0,60), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], bf: bf.slice(0,40), filter: s.filter, bg: bg.slice(0,60), op: s.opacity });
    }
  });
  return { hits, cookie: !!document.querySelector('[class*="cookie" i]'), offline: !!document.querySelector('[class*="offline" i]') };
});
console.log(JSON.stringify(info, null, 1).slice(0, 3000));
await p.screenshot({ path: '/Users/fr168256/lkdv-pays/audit-pays/bar-after-wait.png', clip: { x: 0, y: 840, width: 430, height: 92 } });
await b.close();
