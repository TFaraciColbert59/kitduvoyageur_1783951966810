import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('https://kitduvoyageur-1783951966810-izl5lz705.vercel.app/compte',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(8000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(700);}}catch{}
const m = await p.evaluate(()=>{
  const box=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const cs=(s,ps)=>{const e=document.querySelector(s); if(!e) return null; const st=getComputedStyle(e); const o={}; ps.forEach(k=>o[k]=st.getPropertyValue(k)); return o;};
  return {
    scaleSelector: box('.map-scale-selector'), scaleBtn: box('.map-scale-selector button'),
    mctl: box('.mctl'), mctlBtn: box('.mctl button'),
    badge: box('.map-badge-3d'), attribution: box('.lkdv-map-attribution'),
    map: box('.map'), mapRadius: cs('.map',['border-radius','overflow']),
    scaleCs: cs('.map-scale-selector',['border-radius','background-image','backdrop-filter','height']),
  };
});
console.log(JSON.stringify(m,null,1));
await b.close();
