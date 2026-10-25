import { chromium } from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await p.request.post(base+'/api/demo-login');await p.goto(base+'/compte',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
for(let i=0;i<10;i++){await p.locator('.ig-tile').nth(i).click();await p.waitForTimeout(700);if(await p.locator('button[aria-label^="Commenter"]').count()){await p.locator('button[aria-label^="Commenter"]').click();break;}await p.keyboard.press('Escape');await p.waitForTimeout(250);}
await p.waitForTimeout(600);
console.log(await p.evaluate(()=>({panelTop:document.querySelector('.lkdv-post-panel')?.getBoundingClientRect().top, bodyPad:document.querySelector('.lkdv-post-panel-body')?getComputedStyle(document.querySelector('.lkdv-post-panel-body')).paddingTop:null, first:document.querySelector('.lkdv-comment')?.getBoundingClientRect().top, author:!!document.querySelector('.lkdv-post-panel-author'), close:document.querySelector('.lkdv-post-panel-close')?.getBoundingClientRect().toJSON()})));
await p.screenshot({path:'/tmp/panel-top-bg.png'});await b.close();
