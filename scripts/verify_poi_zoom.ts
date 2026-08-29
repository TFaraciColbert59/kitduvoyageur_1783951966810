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

  // Zoom into Mont Blanc area (45.83, 6.86, zoom 12)
  await page.evaluate(() => {
    const mapEl = document.querySelector('.leaflet-container');
    // @ts-ignore
    const map = (window as any).L?.map || (mapEl as any)?._leaflet_map;
    // Leaflet map instance can be accessed via DOM
    // @ts-ignore
    for (const k in mapEl) {
      // @ts-ignore
      if (k.startsWith('_leaflet_events') || k === '_leaflet_id') {
        // find map
      }
    }
  });

  // Let's use the search input or zoom buttons
  // Click on "Sommets" or search "Mont Blanc" in search input
  await page.fill('input[placeholder*="Chercher"]', 'Mont Blanc');
  await page.waitForTimeout(1000);

  // Click on the first search result
  const firstItem = page.locator('.divide-y > div').first();
  if (await firstItem.count() > 0) {
    await firstItem.click();
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: 'carte_mont_blanc_zoom.png' });
  console.log('Mont Blanc zoom screenshot saved: carte_mont_blanc_zoom.png');

  // Let's check markers visible at this zoom
  const markersAtZoom = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.leaflet-marker-icon')).map(el => el.textContent?.trim()).filter(Boolean);
  });
  console.log('Markers at zoom:', markersAtZoom);

  await browser.close();
})();
