import { chromium } from 'playwright';
import fs from 'node:fs';
const url = process.argv[2];
const out = process.argv[3] || '/tmp/measure.json';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR', timezoneId:'Europe/Paris' });
const p = await ctx.newPage();
await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(7000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(600);}}catch{}
const m = await p.evaluate(()=>{
  const box=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const cs=(s,ps)=>{const e=document.querySelector(s); if(!e) return null; const st=getComputedStyle(e); const o={}; ps.forEach(k=>o[k]=st.getPropertyValue(k)); return o;};
  const all=(s)=>[...document.querySelectorAll(s)].map(e=>{const r=e.getBoundingClientRect(); return [+r.width.toFixed(1),+r.height.toFixed(1),getComputedStyle(e).borderRadius];});
  return {
    url: location.href,
    doc:[document.documentElement.scrollHeight, innerHeight],
    base: cs('.phone',['font-size','letter-spacing','color']),
    top: box('.top'), topBar: box('.ig-top'), pill: box('.ig-handle'), buttons: all('.ig-top-btn'),
    card: box('.card.cs'), cardRadius: cs('.card.cs',['border-radius']),
    scroll: cs('.card-scroll',['padding','gap']),
    header: box('.ig-header'), stats: all('.ig-stat'),
    bio: {box: box('.ig-bio-text'), ...cs('.ig-bio-text',['font-size','line-height'])},
    rings: box('.ig-hl'), ring: box('.ig-hl-ring'),
    grid: box('.ig-grid-wrap'), tile: box('.ig-tile'),
    tabs: box('.ig-tabs'), lens: box('.ig-th'),
    tb: box('.tb'), tbItems: all('.tb button').length,
    mapzone: box('.mapzone'),
    classes: !!document.querySelector('.phone'),
    text: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,140),
  };
});
await p.screenshot({ path: out.replace('.json','.png') });
fs.writeFileSync(out, JSON.stringify(m,null,2));
console.log(JSON.stringify(m,null,1).slice(0,2000));
await b.close();
