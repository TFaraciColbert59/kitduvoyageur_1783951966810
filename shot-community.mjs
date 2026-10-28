import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await p.request.post(base+'/api/demo-login');await p.goto(base+'/communaute',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/community-live.png',fullPage:false});
console.log(await p.evaluate(()=>[...document.querySelectorAll('.lkdv-post-media-glass')].slice(0,2).map(e=>({html:e.outerHTML.slice(0,500),rect:e.getBoundingClientRect().toJSON()}))));
await b.close();
