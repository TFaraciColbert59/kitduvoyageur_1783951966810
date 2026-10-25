import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Testing Pan & Search in this area button...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();

  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Zoom in or out to trigger moveend
  const zoomIn = page.locator('button[title="Zoom avant"]').first();
  await zoomIn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'carte_rechercher_btn_visible.png' });
  console.log('Saved carte_rechercher_btn_visible.png');

  // Click on "Rechercher dans cette zone"
  const searchBtn = page.locator('button:has-text("Rechercher dans cette zone")');
  if (await searchBtn.count() > 0) {
    console.log('Found search button, clicking...');
    await searchBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'carte_after_rechercher_clicked.png' });
    console.log('Saved carte_after_rechercher_clicked.png');
  } else {
    console.log('Search button not found');
  }

  await browser.close();
})();
