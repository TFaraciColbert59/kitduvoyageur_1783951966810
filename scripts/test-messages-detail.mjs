import { chromium } from 'playwright';
import path from 'path';

const outDir = '/Users/fr168256/.gemini/antigravity/brain/300ae8c4-e8be-4c9c-81d0-469627fe0c2c';
const baseUrl = 'https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  console.log('Logging in via demo-login...');
  await page.goto(`${baseUrl}/api/demo-login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Navigating to /messagerie...');
  await page.goto(`${baseUrl}/messagerie`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click on Thomas Mercier conversation
  console.log('Clicking on conversation Thomas Mercier...');
  const thomas = page.locator('text=Thomas Mercier').first();
  if (await thomas.isVisible()) {
    await thomas.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'screen-messages-thomas.png') });
    console.log('Saved screen-messages-thomas.png');

    // Click on user profile/avatar in top card
    const userHeader = page.locator('button:has-text("Thomas Mercier"), .mheader-title, [class*="avatar"]').first();
    if (await userHeader.isVisible()) {
      console.log('Clicking on user header...');
      await userHeader.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'screen-messages-profile-drawer.png') });
      console.log('Saved screen-messages-profile-drawer.png');
    }
  }

  await browser.close();
  console.log('Done messages detail test!');
}

run().catch(console.error);
