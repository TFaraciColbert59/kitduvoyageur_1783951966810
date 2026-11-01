import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:4028/hub...');
  await page.goto('http://127.0.0.1:4028/hub', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Dismiss cookie banner if present
  try {
    const acceptCookies = page.getByRole('button', { name: 'Tout accepter' });
    if (await acceptCookies.isVisible({ timeout: 2000 })) {
      await acceptCookies.click();
      console.log('Accepted cookie banner.');
      await page.waitForTimeout(600);
    }
  } catch (e) {
    console.log('No cookie banner or already dismissed.');
  }

  // 1. Hub Home screen
  console.log('Taking screen_hub_home.png...');
  await page.screenshot({
    path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_hub_home.png',
    fullPage: false
  });

  // 2. Click backpack to enter Kit Studio
  console.log('Clicking backpack (data-testid="hub-hotspot-kit")...');
  const bagHotspot = page.locator('[data-testid="hub-hotspot-kit"]');
  if (await bagHotspot.isVisible()) {
    await bagHotspot.click();
  } else {
    await page.goto('http://127.0.0.1:4028/hub?studio=1', { waitUntil: 'networkidle' });
  }

  await page.waitForSelector('[data-testid="kit-studio-view"]', { timeout: 10000 });
  await page.waitForTimeout(1500);

  console.log('Taking screen_kit_studio.png...');
  await page.screenshot({
    path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_kit_studio.png',
    fullPage: false
  });

  // 3. Open Inventaire drawer in Kit Studio
  console.log('Opening Inventaire drawer...');
  const invBtn = page.locator('[data-testid="studio-open-drawer-inventaire"]');
  if (await invBtn.isVisible()) {
    await invBtn.click();
    await page.waitForTimeout(1200);
  }

  console.log('Taking screen_kit_studio_drawer.png...');
  await page.screenshot({
    path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_kit_studio_drawer.png',
    fullPage: false
  });

  // 4. Test opening Itinéraire drawer from Hub
  await page.goto('http://127.0.0.1:4028/hub', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const itBtn = page.locator('[data-testid="hub-hotspot-itineraire"]');
  if (await itBtn.isVisible()) {
    await itBtn.click();
    await page.waitForTimeout(1000);
    console.log('Taking screen_drawer_itineraire.png...');
    await page.screenshot({
      path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_drawer_itineraire.png',
      fullPage: false
    });
  }

  // 5. Test opening Groupe drawer from Hub
  await page.goto('http://127.0.0.1:4028/hub', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const grpBtn = page.locator('[data-testid="hub-hotspot-groupe"]');
  if (await grpBtn.isVisible()) {
    await grpBtn.click();
    await page.waitForTimeout(1000);
    console.log('Taking screen_drawer_groupe.png...');
    await page.screenshot({
      path: '/Users/fr168256/.gemini/antigravity/brain/036beff1-48b0-411a-8d20-0ad40be46494/screen_drawer_groupe.png',
      fullPage: false
    });
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
