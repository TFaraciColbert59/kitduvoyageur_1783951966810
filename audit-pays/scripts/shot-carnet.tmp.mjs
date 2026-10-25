import { chromium } from 'playwright';
const OUT='/Users/fr168256/lkdv-pays/audit-pays';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/carnets/b2000000-0000-0000-0000-000000000011',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(5000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(800);}}catch{}
await p.screenshot({ path: OUT+'/apres-carnet-fiche-430.png' });
// drawer Récit
await p.getByRole('button',{name:'Récit',exact:true}).first().click();
await p.waitForTimeout(900);
await p.screenshot({ path: OUT+'/apres-carnet-recit-430.png' });
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
// 1440
await p.setViewportSize({width:1440,height:900}); await p.waitForTimeout(1200);
await p.screenshot({ path: OUT+'/apres-carnet-1440.png' });
const m = await p.evaluate(()=>({ doc:[document.documentElement.scrollHeight, innerHeight], phone:(()=>{const e=document.querySelector('.phone'); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x,r.y,r.width,r.height];})() }));
console.log(JSON.stringify(m));
await b.close();
