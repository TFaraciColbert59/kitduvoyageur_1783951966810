import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
const urls = [];
page.on('response', async (res) => { if (res.url().includes('PostDrawer')) urls.push(res.url()); });
await page.goto('https://kitduvoyageur.faracitonyp.workers.dev/compte', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const tile = page.locator('.ig-tile').first(); await tile.click();
await page.waitForTimeout(1500);
console.log(urls);
for (const u of urls) { const txt = await (await fetch(u)).text(); console.log(u, 'author-pill', txt.includes('lkdv-post-panel-author'), 'postcard', txt.includes('PostCardSurface')); }
await browser.close();
