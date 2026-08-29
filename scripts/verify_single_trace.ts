import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req(
  'C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/.agents/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js'
);

const BASE = 'http://localhost:4000';

(async () => {
  console.log('Testing Single Trace behavior...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
  const page = await context.newPage();

  // 1. Initial load on /carte-interactive (0 traces visible, only clean pins)
  await page.goto(`${BASE}/carte-interactive`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'carte_interactive_no_trace_initial.png' });
  console.log('Saved carte_interactive_no_trace_initial.png');

  // 2. Click ONE hike -> Only this hike displays its GPS trace
  const firstHike = page.locator('.divide-y > div').first();
  if (await firstHike.count() > 0) {
    await firstHike.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'carte_interactive_single_trace_selected.png' });
    console.log('Saved carte_interactive_single_trace_selected.png');
  }

  // 3. Explorer map test
  const pageExplorer = await context.newPage();
  await pageExplorer.goto(`${BASE}/explorer`, { waitUntil: 'domcontentloaded' });
  await pageExplorer.waitForTimeout(2000);
  await pageExplorer.screenshot({ path: 'explorer_no_trace_initial.png' });
  console.log('Saved explorer_no_trace_initial.png');

  await browser.close();
  console.log('Verification completed!');
})();
