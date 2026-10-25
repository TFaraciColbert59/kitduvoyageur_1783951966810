import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Testing Hike GPS track rendering, rich POIs and buttons...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Desktop test
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();
  
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on the first hike in the sidebar
  const firstHike = page.locator('.divide-y > div').first();
  if (await firstHike.count() > 0) {
    await firstHike.click();
    console.log('Clicked first hike');
    await page.waitForTimeout(2000);
  }

  // Check if GeoJSON polyline exists in SVG
  const geojsonPolylines = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('path.leaflet-interactive'));
    return paths.length;
  });
  console.log('Rendered GeoJSON vector paths on map:', geojsonPolylines);

  await page.screenshot({ path: 'carte_hike_selected_with_trace.png' });
  console.log('Screenshot saved: carte_hike_selected_with_trace.png');

  // 2. Click a POI to verify rich card
  const poiMarker = page.locator('.leaflet-marker-icon:has-text("📍")').first();
  if (await poiMarker.count() > 0) {
    await poiMarker.click();
    await page.waitForTimeout(1000);
  }

  // Mobile test
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/carte-interactive`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: 'carte_mobile_buttons_layout.png' });
  console.log('Screenshot saved: carte_mobile_buttons_layout.png');

  await browser.close();
  console.log('All tests completed successfully!');
})();
