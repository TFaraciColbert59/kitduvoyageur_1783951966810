import { chromium } from 'playwright';
const OUT='/Users/fr168256/lkdv-pays/audit-pays';
const b = await chromium.launch();
for (const vp of [{n:'768',w:768,h:1024},{n:'1440',w:1440,h:900}]) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:1, locale:'fr-FR' });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForTimeout(4500);
  try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(700);}}catch{}
  await p.screenshot({path:`${OUT}/fr-${vp.n}.png`});
  const m = await p.evaluate(()=>{const ph=document.querySelector('.phone').getBoundingClientRect(); return {doc:[document.documentElement.scrollHeight, innerHeight], phone:[ph.x,ph.y,ph.width,ph.height], body:[document.body.scrollWidth]};});
  console.log(vp.n, JSON.stringify(m));
  await ctx.close();
}
await b.close();
