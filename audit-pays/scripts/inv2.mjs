import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT='/Users/fr168256/lkdv-pays/audit-pays/inventaire';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('https://kitduvoyageur.faracitonyp.workers.dev/compte',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(8000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(800);}}catch{}
const bg = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('body, body > div, .lkv-app-background, .lkdv-compte-v8, .stage, .phone').forEach((e) => {
    const c = getComputedStyle(e);
    if (c.backgroundImage !== 'none' || c.filter !== 'none') {
      const r = e.getBoundingClientRect();
      out.push({ cls: String(e.className).slice(0,50) || e.tagName, box:[r.x,r.y,r.width,r.height], bgImage: c.backgroundImage.slice(0,120), bgSize: c.backgroundSize, bgPos: c.backgroundPosition, filter: c.filter, opacity: c.opacity, position: c.position, inset: c.inset });
    }
  });
  return out;
});
// drawer: segmented nav + bouton
await p.locator('.ig-top-btn').nth(2).click();
await p.waitForTimeout(1800);
const d = await p.evaluate(() => {
  const sheet = document.querySelector('.sheet');
  const seg = sheet?.querySelector('.lkdv-drawer-seg, .segc, nav, [role="tablist"]');
  const btnP = sheet?.querySelector('.lkdv-compte-btn.primary');
  const btnG = sheet?.querySelector('.lkdv-compte-btn.ghost');
  const cs = (e, props) => { if(!e) return null; const c=getComputedStyle(e); const r=e.getBoundingClientRect(); const o={box:[+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)]}; props.forEach(k=>o[k]=c.getPropertyValue(k)); return o; };
  const P=['font-size','font-weight','letter-spacing','color','background-image','background-color','backdrop-filter','box-shadow','border','border-radius','padding','gap','display','opacity','height'];
  return {
    sheetChildren: sheet ? [...sheet.children].map(e => String(e.className).slice(0,40) || e.tagName) : null,
    seg: cs(seg, P),
    primary: cs(btnP, P),
    ghost: cs(btnG, P),
    stepper: cs(sheet?.querySelector('.lkdv-compte-steps, .steps'), P),
    cardInDrawer: cs(sheet?.querySelector('.lkdv-drawer-shell > div, .lkdv-compte-card'), P),
  };
});
fs.writeFileSync(`${OUT}/inventaire-2.json`, JSON.stringify({ bg, drawer: d }, null, 2));
console.log(JSON.stringify({ bg: bg.slice(0,4), drawer: d }, null, 1).slice(0, 3500));
await b.close();
