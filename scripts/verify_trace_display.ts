import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Testing trail trace display on click...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. /carte-interactive
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click on the first hike item in sidebar
  const hikeItem = page.locator('.divide-y > div').first();
  if (await hikeItem.count() > 0) {
    await hikeItem.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'verified_carte_interactive_trace.png' });
    console.log('Saved verified_carte_interactive_trace.png');
  }

  // 2. /explorer
  const pageExp = await context.newPage();
  await pageExp.goto(`${BASE}/explorer`, { waitUntil: 'domcontentloaded' });
  await pageExp.waitForTimeout(2000);

  // Click on a trail in explorer list
  const expHikeItem = pageExp.locator('.overflow-y-auto > div').first();
  if (await expHikeItem.count() > 0) {
    await expHikeItem.click();
    await pageExp.waitForTimeout(2500);
    await pageExp.screenshot({ path: 'verified_explorer_trace.png' });
    console.log('Saved verified_explorer_trace.png');
  }

  await browser.close();
  console.log('Trace verification finished!');
})();
