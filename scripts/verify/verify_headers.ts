import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });

  // 1. Check /explorer header
  const pageExp = await context.newPage();
  await pageExp.goto(`${BASE}/explorer`, { waitUntil: 'domcontentloaded' });
  await pageExp.waitForTimeout(2000);
  await pageExp.screenshot({ path: 'verified_explorer_header.png' });
  console.log('Saved verified_explorer_header.png');

  // 2. Check /carte-interactive header
  const pageCarte = await context.newPage();
  await pageCarte.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await pageCarte.waitForTimeout(2000);
  await pageCarte.screenshot({ path: 'verified_carte_header.png' });
  console.log('Saved verified_carte_header.png');

  // 3. Check / header
  const pageHome = await context.newPage();
  await pageHome.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await pageHome.waitForTimeout(2000);
  await pageHome.screenshot({ path: 'verified_home_header.png' });
  console.log('Saved verified_home_header.png');

  await browser.close();
})();
