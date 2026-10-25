import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte',{waitUntil:'domcontentloaded',timeout:90000});
await p.waitForTimeout(6000);
// ouvrir un drawer via le bouton "Commandes, notifications…" (3e bouton rond)
await p.locator('.ig-top-btn').nth(2).click().catch(()=>{});
await p.waitForTimeout(1500);
const out = await p.evaluate(() => {
  const w = document.querySelector('.sw-wrap');
  const s = document.querySelector('#sheet') || w?.querySelector('.sheet');
  const clean = (h) => h.replace(/data:image\/[^"']{40,}/g,'data:IMG').replace(/\s+/g,' ');
  return { det: w?.getAttribute('data-det'), phone: document.querySelector('.phone')?.getAttribute('data-sheet-open'), sheet: s ? clean(s.outerHTML).slice(0, 1600) : null };
});
console.log(JSON.stringify(out, null, 1).slice(0, 2400));
await b.close();
