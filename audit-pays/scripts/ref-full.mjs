import { chromium } from 'playwright';
import fs from 'node:fs';
const url = process.argv[2];
const out = process.argv[3];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR', timezoneId:'Europe/Paris' });
const p = await ctx.newPage();
await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(7000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(700);}}catch{}
const m = await p.evaluate(()=>{
  const st=(s)=>{const e=document.querySelector(s); if(!e) return null; const c=getComputedStyle(e); const o={}; ['font-size','font-weight','letter-spacing','line-height','color','background-image','background-color','backdrop-filter','box-shadow','border','border-radius','padding','gap','height','width','display','grid-template-columns','text-transform','font-variant-numeric'].forEach(k=>o[k]=c.getPropertyValue(k)); return o;};
  const box=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const root=document.querySelector('.phone');
  const vars={}; const rs=getComputedStyle(root);
  ['--label','--label2','--label3','--sep','--fill','--fill2','--fill3','--tint','--accent','--subtle','--mint','--good','--warn','--bad','--info','--water','--ga','--gb','--la','--page','--on-page','--muted-page','--rule','--sf'].forEach(v=>vars[v]=rs.getPropertyValue(v).trim());
  return {
    url: location.href, vars,
    doc:[document.documentElement.scrollHeight, innerHeight],
    phone: box('.phone'), top: box('.top'), mapzone: box('.mapzone'),
    topBar: box('.ig-top'), pill: {box:box('.ig-handle'), ...st('.ig-handle')},
    btn: st('.ig-top-btn'), card: {box:box('.card.cs'), ...st('.card.cs')},
    scroll: st('.card-scroll'), header: box('.ig-header'),
    avi: st('.ig-avi-wrap'), aviIn: st('.ig-avi-in'),
    stat: {box:box('.ig-stat'), ...st('.ig-stat')},
    statNum: st('.ig-stat b'), statLbl: st('.ig-stat span'),
    bioTop: st('.ig-bio-top'), bioText: st('.ig-bio-text'), bioStats: st('.ig-bio-stats'),
    hl: {box:box('.ig-hl'), ...st('.ig-hl')}, hlRing: st('.ig-hl-ring'), hlIn: st('.ig-hl-in'), hlLbl: st('.ig-hl span:last-child'),
    grid: {box:box('.ig-grid-wrap'), ...st('.ig-grid-wrap')}, gridIn: st('.ig-grid'), tile: st('.ig-tile'),
    tabs: {box:box('.ig-tabs'), ...st('.ig-tabs')}, th: st('.ig-th'), tabsBtn: st('.ig-tabs button'),
    tb: {box:box('.tb'), ...st('.tb')}, tbBtn: st('.tb button'), tbLbl: st('.tb button span'),
    text:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,220),
  };
});
fs.writeFileSync(out, JSON.stringify(m,null,2));
await p.screenshot({ path: out.replace('.json','.png') });
console.log('saved', out, 'doc', m.doc, 'text', m.text.slice(0,120));
await b.close();
