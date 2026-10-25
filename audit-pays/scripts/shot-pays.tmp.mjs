import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT='/Users/fr168256/lkdv-pays/audit-pays';
fs.mkdirSync(OUT,{recursive:true});
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,160));});
const r = await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(5000);
try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(400);}}catch{}
await p.screenshot({path:OUT+'/pays-fr-430.png'});
const m = await p.evaluate(()=>{
  const box=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [ +r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1) ];};
  return {
    status: document.querySelector('.phone')?.className,
    doc: [document.documentElement.scrollHeight, innerHeight],
    top: box('.top'), topBar: box('.ig-top'), pill: box('.ig-handle'), topBtns: document.querySelectorAll('.ig-top-btn').length,
    card: box('.card.cs'), scroll: box('.card-scroll'), header: box('.ig-header'),
    stats: [...document.querySelectorAll('.ig-stat')].map(e=>{const r=e.getBoundingClientRect();return [+r.width.toFixed(1),+r.height.toFixed(1)];}),
    bio: box('.ig-bio-text'), hl: box('.ig-hl'), ring: box('.ig-hl-ring'),
    grid: box('.ig-grid-wrap'), tile: box('.ig-tile'), tabs: box('.ig-tabs'), lens: box('.ig-th'),
    tb: box('.tb'), tbBtns: document.querySelectorAll('.tb button').length, mapzone: box('.mapzone'),
    font: getComputedStyle(document.querySelector('.phone')).fontSize,
    lensOn: document.querySelectorAll('.lens-on').length,
    filters: document.querySelectorAll('#lensdefs filter').length,
  };
});
console.log(JSON.stringify({http:r?.status(), ...m, errs:errs.slice(0,6)}, null, 1));
await b.close();
