import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:768,height:1024}, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/pays/fr',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(4000);
const r = await p.evaluate(()=>{
  const out=[]; let n=document.querySelector('.phone');
  while(n && n.tagName!=='HTML'){ const b=n.getBoundingClientRect(); const s=getComputedStyle(n); out.push({tag:n.tagName, cls:(n.className||'').toString().slice(0,40), box:[b.x,b.y,b.width,b.height], pos:s.position, top:s.top, margin:s.marginTop, padding:s.paddingTop}); n=n.parentElement; }
  return out;
});
console.log(JSON.stringify(r,null,1).slice(0,2500));
await b.close();
