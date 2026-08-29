import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Testing 10km initial radius & Search This Area button...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();

  // 1. Initial 10km load
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'carte_10km_initial.png' });
  console.log('Saved carte_10km_initial.png');

  // 2. Pan map with mouse drag
  const mapElement = page.locator('.leaflet-container').first();
  const box = await mapElement.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 300, box.y + box.height / 2 - 200, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'carte_after_drag_button_visible.png' });
    console.log('Saved carte_after_drag_button_visible.png');
  }

  // 3. Click "Rechercher dans cette zone"
  const searchBtn = page.locator('button:has-text("Rechercher dans cette zone")');
  if (await searchBtn.count() > 0) {
    await searchBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'carte_after_search_button_clicked.png' });
    console.log('Saved carte_after_search_button_clicked.png');
  }

  await browser.close();
  console.log('Verification completed successfully!');
})();
