import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:430,height:932}});const base='https://kitduvoyageur.faracitonyp.workers.dev';
await page.request.post(base+'/api/demo-login');await page.goto(base+'/compte',{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
const n=await page.locator('.ig-tile').count();
for(let i=0;i<Math.min(n,10);i++){
  await page.locator('.ig-tile').nth(i).click(); await page.waitForTimeout(900);
  const labels=await page.locator('.lkdv-post-drawer button').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')));
  console.log(i, labels.filter(Boolean).slice(0,8));
  if(labels.some(l=>l&&l.startsWith('Commenter'))){await page.locator('button[aria-label^="Commenter"]').click();await page.waitForTimeout(700);break;}
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
console.log(await page.evaluate(()=>({author:!!document.querySelector('.lkdv-post-panel-author'), panel:!!document.querySelector('.lkdv-post-panel'), pad:document.querySelector('.lkdv-post-panel-body')?getComputedStyle(document.querySelector('.lkdv-post-panel-body')).paddingTop:null, panelTop:document.querySelector('.lkdv-post-panel')?.getBoundingClientRect().top, close:document.querySelector('.lkdv-post-panel-close')?.getBoundingClientRect().toJSON(), first:document.querySelector('.lkdv-comment')?.getBoundingClientRect().top})));
await page.screenshot({path:'/tmp/live-comments2.png'});await browser.close();
