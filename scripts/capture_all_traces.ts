import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Capturing all visible hiking traces across maps...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. /carte-interactive
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'carte_interactive_all_traces.png' });
  console.log('Saved carte_interactive_all_traces.png');

  // 2. /explorer
  const pageExplorer = await context.newPage();
  await pageExplorer.goto(`${BASE}/explorer`, { waitUntil: 'domcontentloaded' });
  await pageExplorer.waitForTimeout(3000);
  await pageExplorer.screenshot({ path: 'explorer_all_traces.png' });
  console.log('Saved explorer_all_traces.png');

  await browser.close();
  console.log('Done!');
})();
