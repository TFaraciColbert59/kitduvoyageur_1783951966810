import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();
  
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on "Zoom avant" 7 times to zoom directly into the mountain massifs
  for (let i = 0; i < 7; i++) {
    const zoomInBtn = page.locator('button[title*="avant"], button:has-text("+")').first();
    if (await zoomInBtn.count() > 0) {
      await zoomInBtn.click();
      await page.waitForTimeout(400);
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'carte_pois_unclustered.png' });
  console.log('Unclustered POIs screenshot saved: carte_pois_unclustered.png');

  const visibleIcons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.leaflet-marker-icon')).map(el => el.textContent?.trim()).filter(Boolean);
  });
  console.log('Visible marker icons:', visibleIcons);

  await browser.close();
})();
