import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await p.request.post(base+'/api/demo-login');await p.goto(base+'/compte',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
await p.locator('.ig-tile').nth(1).click();await p.waitForTimeout(900);
await p.locator('button[aria-label^="Partager"]').click();await p.waitForTimeout(700);
console.log(await p.evaluate(()=>({author:!!document.querySelector('.lkdv-post-panel-author'), panel:!!document.querySelector('.lkdv-post-panel'), panelTop:document.querySelector('.lkdv-post-panel')?.getBoundingClientRect().top, close:document.querySelector('.lkdv-post-panel-close')?.getBoundingClientRect().toJSON(), first:document.querySelector('.lkdv-post-panel-body')?.getBoundingClientRect().top})));
await p.screenshot({path:'/tmp/live-share2.png'});await b.close();
