import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Launching browser to verify POI markers on interactive map...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Test /carte-interactive
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();
  
  console.log(`Navigating to ${BASE}/carte-interactive...`);
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const cartePoisCount = await page.evaluate(() => {
    // Check POI markers (divIcon with emoji like 🏡, ⛰️, 💧, 👁️, ⛺, 📍)
    const poiMarkers = Array.from(document.querySelectorAll('.leaflet-marker-icon')).filter(el => {
      const text = el.textContent || '';
      return text.includes('🏡') || text.includes('⛰️') || text.includes('💧') || text.includes('👁️') || text.includes('⛺') || text.includes('📍');
    });

    const trailClusters = Array.from(document.querySelectorAll('.leaflet-marker-icon')).filter(el => {
      const text = el.textContent || '';
      return /^\d+$/.test(text.trim());
    });

    return {
      totalMarkers: document.querySelectorAll('.leaflet-marker-icon').length,
      poiMarkersCount: poiMarkers.length,
      trailClustersCount: trailClusters.length,
      samplePoiIcons: poiMarkers.slice(0, 5).map(el => el.textContent?.trim()),
    };
  });

  console.log('Results on /carte-interactive:', cartePoisCount);
  await page.screenshot({ path: 'carte_interactive_pois.png' });
  console.log('Screenshot saved: carte_interactive_pois.png');

  // Test mobile view
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/carte-interactive`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(3000);
  await mobilePage.screenshot({ path: 'carte_interactive_mobile_pois.png' });
  console.log('Mobile screenshot saved: carte_interactive_mobile_pois.png');

  // 2. Test /explorer
  console.log(`Navigating to ${BASE}/explorer...`);
  await page.goto(`${BASE}/explorer`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'explorer_map_pois.png' });
  console.log('Screenshot saved: explorer_map_pois.png');

  await browser.close();
  console.log('Verification completed successfully!');
})();
