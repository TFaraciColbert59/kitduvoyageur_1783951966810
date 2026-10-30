import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
const base='https://kitduvoyageur.faracitonyp.workers.dev';
await page.request.post(base+'/api/demo-login');
await page.goto(base+'/compte',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2500);
console.log(await page.evaluate(()=>({
  floating: !!document.querySelector('.lkdv-floating-tabbar'),
  labels: [...document.querySelectorAll('.lkdv-floating-tabbar a')].map(a=>a.textContent.trim()),
  old: [...document.querySelectorAll('.tabbar .tb a,.tabbar .tb button')].map(a=>a.textContent.trim()),
  styles: [...document.styleSheets].map(s=>s.href).filter(Boolean).slice(-5),
})));
await page.screenshot({path:'/tmp/live-nav.png'});
await browser.close();
