import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(4500);
try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(900);}}catch{}
await p.getByRole('button',{name:/Tout voir/i}).first().click();
await p.waitForTimeout(900);
await p.screenshot({path:'/Users/fr168256/lkdv-pays/audit-pays/fr-drawer-details-430.png'});
const m = await p.evaluate(()=> [...document.querySelectorAll('.sw-wrap')].map((w)=>{const s=w.querySelector('.sheet'); const r=w.getBoundingClientRect(); const b=s.getBoundingClientRect(); const cs=getComputedStyle(s); return { det:w.getAttribute('data-det'), wrap:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], sheet:[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)], vis:cs.visibility, text:(s.innerText||'').replace(/\s+/g,' ').slice(0,90) };}));
console.log(JSON.stringify(m));
await b.close();
