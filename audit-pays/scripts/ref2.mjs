import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'fr-FR' });
const p = await ctx.newPage();
await p.goto('https://kitduvoyageur.faracitonyp.workers.dev/compte',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(8000);
try{const x=p.getByRole('button',{name:/Refuser|Tout accepter/i}).first(); if(await x.isVisible({timeout:2500})){await x.click(); await p.waitForTimeout(700);}}catch{}
const m = await p.evaluate(()=>{
  const box=(e)=>{const r=e.getBoundingClientRect(); return [+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const cs=(e,ps)=>{const s=getComputedStyle(e); const o={}; ps.forEach(k=>o[k]=s.getPropertyValue(k)); return o;};
  const ring=document.querySelector('.ig-hl');
  const ringIn=document.querySelector('.ig-hl-in');
  const bars=[...document.querySelectorAll('nav')].filter(n=>/Navigation principale/i.test(n.getAttribute('aria-label')||''));
  const bar=bars[bars.length-1];
  return {
    ring: ring?{box:box(ring), ...cs(ring,['width','height'])}:null,
    ringIn: ringIn?{box:box(ringIn), ...cs(ringIn,['border-radius','overflow','background-image'])}:null,
    ringHtml: ring?ring.outerHTML.replace(/data:image\/[^"']{40,}/g,'data:IMG').replace(/\s+/g,' ').slice(0,700):null,
    bar: bar?{cls:bar.className, box:box(bar), ...cs(bar,['border-radius','padding','height','background-image','backdrop-filter'])}:null,
    barHtml: bar?bar.outerHTML.replace(/data:image\/[^"']{40,}/g,'data:IMG').replace(/\s+/g,' ').slice(0,900):null,
    barBtns: bar?[...bar.querySelectorAll('button,a')].map(e=>({box:box(e), text:(e.innerText||'').replace(/\s+/g,' ').trim(), aria:e.getAttribute('aria-label'), html:e.innerHTML.replace(/data:image\/[^"']{40,}/g,'data:IMG').replace(/\s+/g,' ').slice(0,160)})):null,
    ringsAll: [...document.querySelectorAll('.ig-hl')].map(e=>({t:(e.innerText||'').trim().slice(0,20), box:box(e)})),
  };
});
console.log(JSON.stringify(m,null,1).slice(0,5000));
await b.close();
