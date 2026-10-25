import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT='/Users/fr168256/lkdv-pays/audit-pays'; fs.mkdirSync(OUT,{recursive:true});
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR', timezoneId:'Europe/Paris' });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(5000);
try{const x=p.getByRole('button',{name:/Refuser/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(400);}}catch{}
await p.screenshot({path:OUT+'/fr-apercu-430.png'});
const SECTIONS=[['presentation','Aperçu'],['destinations','Incontournables'],['activites','Activités'],['culture','Culture'],['gastronomie','Gastronomie'],['hebergements','Hébergements'],['pratique','Pratique'],['communaute','Communauté']];
const res={};
for(const [key,label] of SECTIONS){
  await p.getByRole('button',{name:label,exact:true}).first().click({timeout:5000}).catch(()=>{});
  await p.waitForTimeout(900);
  await p.screenshot({path:`${OUT}/fr-${key}-430.png`});
  res[key]=await p.evaluate(()=>{
    const g=document.querySelector('.ig-grid-wrap');
    const tiles=document.querySelectorAll('.ig-tile').length;
    const rows=document.querySelectorAll('.ig-grid-wrap .li').length;
    const txt=(g?.innerText||'').replace(/\s+/g,' ').trim().slice(0,160);
    return { tiles, rows, txt, scroll: document.documentElement.scrollHeight };
  });
}
console.log(JSON.stringify({res, errs:errs.slice(0,4)},null,1));
await b.close();
