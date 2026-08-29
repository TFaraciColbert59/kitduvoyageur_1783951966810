import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Testing Viewport LOD & debounced pan/zoom...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();

  // 1. Initial overview (France level, low item count)
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'carte_lod_overview.png' });
  console.log('Saved carte_lod_overview.png');

  // 2. Zoom in to a regional view (e.g. Alps)
  const zoomInBtn = page.locator('button[title="Zoom avant"]').first();
  if (await zoomInBtn.count() > 0) {
    await zoomInBtn.click();
    await page.waitForTimeout(400);
    await zoomInBtn.click();
    await page.waitForTimeout(400);
    await zoomInBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'carte_lod_zoomed.png' });
    console.log('Saved carte_lod_zoomed.png');
  }

  // 3. Explorer map test
  const pageExp = await context.newPage();
  await pageExp.goto(`${BASE}/explorer`, { waitUntil: 'domcontentloaded' });
  await pageExp.waitForTimeout(2000);
  await pageExp.screenshot({ path: 'explorer_lod_overview.png' });
  console.log('Saved explorer_lod_overview.png');

  await browser.close();
  console.log('Done!');
})();
