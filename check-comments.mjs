import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
const base = 'https://kitduvoyageur.faracitonyp.workers.dev';
const login = await page.request.post(base + '/api/demo-login');
console.log('login', login.status(), await login.text());
await page.goto(base + '/compte', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
console.log('url', page.url(), 'tiles', await page.locator('.ig-tile').count());
await page.locator('.ig-tile').first().click();
await page.waitForTimeout(1500);
console.log('drawer', await page.locator('.lkdv-post-drawer').count());
console.log([...await page.locator('.lkdv-post-drawer button').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')))].slice(0,12));
const comment = page.locator('button[aria-label^="Commenter"]');
if (await comment.count()) { await comment.click(); await page.waitForTimeout(800); }
const data = await page.evaluate(() => {
  const b = document.querySelector('.lkdv-post-panel-body');
  const p = document.querySelector('.lkdv-post-panel');
  const a = document.querySelector('.lkdv-post-panel-author');
  return {
    author: !!a,
    bodyTop: b?.getBoundingClientRect().top,
    bodyPad: b ? getComputedStyle(b).paddingTop : null,
    panelTop: p?.getBoundingClientRect().top,
    authorBottom: a?.getBoundingClientRect().bottom,
    close: document.querySelector('.lkdv-post-panel-close')?.getBoundingClientRect().toJSON(),
    firstComment: document.querySelector('.lkdv-comment')?.getBoundingClientRect().top,
  };
});
console.log(JSON.stringify(data, null, 2));
await page.screenshot({ path: '/tmp/clean-comments.png' });
await browser.close();
