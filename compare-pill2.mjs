import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await p.request.post(base+'/api/demo-login');await p.goto(base+'/compte',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
for(let i=0;i<10;i++){await p.locator('.ig-tile').nth(i).click();await p.waitForTimeout(800);if(await p.locator('.lkdv-post-media-glass').count())break;await p.keyboard.press('Escape');await p.waitForTimeout(250);}
console.log(await p.evaluate(()=>{const e=document.querySelector('.lkdv-post-media-glass');const b=e?.querySelector('button');return {rect:e?.getBoundingClientRect().toJSON(),style:e?{right:getComputedStyle(e).right,bottom:getComputedStyle(e).bottom,padding:getComputedStyle(e).padding,gap:getComputedStyle(e).gap}:null,btn:b?{rect:b.getBoundingClientRect().toJSON(),transition:getComputedStyle(b).transition,font:getComputedStyle(b).font}:null}}));
await p.screenshot({path:'/tmp/drawer-pill-final.png'});await b.close();
