import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await p.request.post(base+'/api/demo-login');await p.goto(base+'/compte',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
for(let i=0;i<10;i++){await p.locator('.ig-tile').nth(i).click();await p.waitForTimeout(700);if(await p.locator('.lkdv-post-media-glass').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(250);}
console.log(await p.evaluate(()=>{const e=document.querySelector('.lkdv-post-media-glass');const b=e?.querySelector('button');return {rect:e?.getBoundingClientRect().toJSON(),style:e?{padding:getComputedStyle(e).padding,gap:getComputedStyle(e).gap,bg:getComputedStyle(e).backgroundImage,shadow:getComputedStyle(e).boxShadow}:null,btn:b?{rect:b.getBoundingClientRect().toJSON(),font:getComputedStyle(b).font,minw:getComputedStyle(b).minWidth,h:getComputedStyle(b).height}:null,buttons:e?[...e.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')):[]}}));
await p.screenshot({path:'/tmp/drawer-pill.png'});await b.close();
