import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // 1. Mobile test
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(2500);
  await mobilePage.screenshot({ path: 'carte_mobile_clean_layout.png' });
  console.log('Saved carte_mobile_clean_layout.png');

  // 2. Click a POI on desktop and take screenshot
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Click on a POI marker directly using evaluation
  await page.evaluate(() => {
    const markers = Array.from(document.querySelectorAll('.leaflet-marker-icon'));
    const poi = markers.find(m => {
      const t = m.textContent || '';
      return t.includes('🏡') || t.includes('⛰️') || t.includes('💧') || t.includes('👁️') || t.includes('⛺') || t.includes('📍');
    });
    if (poi) {
      (poi as HTMLElement).click();
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'carte_poi_rich_card.png' });
  console.log('Saved carte_poi_rich_card.png');

  await browser.close();
})();
