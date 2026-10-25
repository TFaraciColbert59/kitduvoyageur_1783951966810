import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(5000);
try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(1200);}}catch{}
await p.screenshot({ path:'/Users/fr168256/lkdv-pays/audit-pays/bar-with-lens.png', clip:{x:0,y:840,width:430,height:92} });
// désactiver la lentille de la barre
await p.evaluate(() => { const tb=document.querySelector('.tb'); tb.style.setProperty('backdrop-filter','none','important'); });
await p.waitForTimeout(400);
await p.screenshot({ path:'/Users/fr168256/lkdv-pays/audit-pays/bar-no-lens.png', clip:{x:0,y:840,width:430,height:92} });
await b.close();
