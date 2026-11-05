import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  console.log('Navigating to Kit Studio with Inventaire drawer...');
  await page.goto('http://127.0.0.1:4028/hub?studio=1&drawer=inventaire', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Accept cookies if visible
  try {
    const btn = page.getByRole('button', { name: 'Tout accepter' });
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  console.log('Taking screen_studio_drawer_light.png...');
  await page.screenshot({
    path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_studio_drawer_light.png',
    fullPage: false
  });

  console.log('Navigating to Kit Studio with Personnaliser drawer...');
  await page.goto('http://127.0.0.1:4028/hub?studio=1&drawer=personnaliser', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('Taking screen_studio_personnaliser_light.png...');
  await page.screenshot({
    path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_studio_personnaliser_light.png',
    fullPage: false
  });

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
