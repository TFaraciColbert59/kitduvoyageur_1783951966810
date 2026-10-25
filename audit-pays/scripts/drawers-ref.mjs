import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT='/Users/fr168256/lkdv-pays/audit-pays/drawers';
fs.mkdirSync(OUT,{recursive:true});
const URL='https://kitduvoyageur.faracitonyp.workers.dev/compte';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto(URL,{waitUntil:'domcontentloaded',timeout:180000});
await p.waitForTimeout(9000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(800);}}catch{}
// ouvrir le drawer compte (3e bouton)
await p.locator('.ig-top-btn').nth(2).click();
await p.waitForTimeout(1800);
const lenses = await p.evaluate(() => [...document.querySelectorAll('.lkdv-drawer-nav button, .sheet nav button')].map((e,i)=>({i, label:e.getAttribute('aria-label')})));
console.log('lentilles:', JSON.stringify(lenses));
const count = lenses.length || 5;
for (let i=0;i<count;i++){
  await p.evaluate((idx)=>{ const btns=[...document.querySelectorAll('.lkdv-drawer-nav button, .sheet nav button')]; btns[idx]?.click(); }, i);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/drawer-${i}.png` });
  const info = await p.evaluate(()=>{
    const sheet=document.querySelector('.sheet');
    const title=sheet?.querySelector('.lkdv-sheet-title b, .sh-t b, h2, h3');
    return { title: title?title.textContent.trim().slice(0,60):null, text:(sheet?.innerText||'').replace(/\s+/g,' ').slice(0,220) };
  });
  console.log(i, JSON.stringify(info));
}
await b.close();
