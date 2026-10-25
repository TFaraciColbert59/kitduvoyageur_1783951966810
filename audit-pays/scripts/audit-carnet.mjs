import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT='/Users/fr168256/lkdv-pays/audit-pays';
const routes = [
  ['carnets-hub','/carnets'],
  ['carnet-fiche','/carnets/b2000000-0000-0000-0000-000000000011'],
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
for (const [name, route] of routes) {
  const r = await p.goto('http://127.0.0.1:4001'+route,{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForTimeout(4500);
  try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2000})){await x.click(); await p.waitForTimeout(600);}}catch{}
  await p.screenshot({ path: `${OUT}/avant-${name}-430.png` });
  const m = await p.evaluate(()=>{
    const box=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return [+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
    const cs=(s,ps)=>{const e=document.querySelector(s); if(!e) return null; const st=getComputedStyle(e); const o={}; ps.forEach(k=>o[k]=st.getPropertyValue(k)); return o;};
    return {
      doc:[document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth],
      title: document.title,
      hasPhone: !!document.querySelector('.phone'),
      card: box('.card.cs'), cardCs: cs('.ckp-card, .carnet-profile-card, .card', ['border-radius','background-image','backdrop-filter']),
      topbar: box('.ckp-topbar'), topbarCs: cs('.ckp-topbar', ['height','padding']),
      classes: [...new Set([...document.querySelectorAll('*')].flatMap(e=>[...e.classList]))].filter(c=>/^(ckp|ig|card|tb|sw|phone|glass|carnet)/.test(c)).slice(0,50),
      btnCount: [...document.querySelectorAll('button,a[href]')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>2&&r.height>2;}).length,
      h1: [...document.querySelectorAll('h1')].map(e=>e.textContent.trim().slice(0,40)),
      bodyFont: cs('body',['font-size','color']),
      text: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,220),
    };
  });
  fs.writeFileSync(`${OUT}/avant-${name}-430.json`, JSON.stringify(m,null,2));
  console.log('##', name, 'http', r?.status(), 'doc', m.doc.join('/'), 'phone', m.hasPhone);
  console.log('   card', JSON.stringify(m.card), 'topbar', JSON.stringify(m.topbar), m.topbarCs?.height);
  console.log('   classes', m.classes.slice(0,24).join(' '));
  console.log('   h1', JSON.stringify(m.h1), 'btns', m.btnCount, 'font', JSON.stringify(m.bodyFont));
  console.log('   txt', m.text.slice(0,160));
}
console.log('errs', errs.slice(0,3));
await b.close();
