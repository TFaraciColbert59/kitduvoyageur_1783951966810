import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await p.request.post(base+'/api/demo-login');await p.goto(base+'/compte',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
await p.locator('.ig-hl').first().click();await p.waitForTimeout(700);
console.log(await p.evaluate(()=>({story:document.querySelector('.story')?.className, author:document.querySelector('.st-head .lkdv-post-author')?.getBoundingClientRect().toJSON(), name:document.querySelector('.st-head .lkdv-post-author-line b')?.textContent, options:document.querySelector('.st-options-btn')?.getBoundingClientRect().toJSON(), closeX:!!document.querySelector('.st-x'), engage:document.querySelector('.st-engage')?.getBoundingClientRect().toJSON()})));
await p.screenshot({path:'/tmp/story-hud.png'});await b.close();
