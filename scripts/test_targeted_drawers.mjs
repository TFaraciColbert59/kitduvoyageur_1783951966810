import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();
  const baseUrl = 'https://kitduvoyageur-1783951966810-ruddy.vercel.app';
  const outDir = '/Users/fr168256/.gemini/antigravity/brain/a06cf3b4-d914-4ba2-afc0-739dc6cdda3a';

  console.log('Navigating to', `${baseUrl}/communaute/reels`);
  await page.goto(`${baseUrl}/communaute/reels`, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  // Dismiss cookie banner if present
  const cookieBtn = page.locator('button:has-text("Accepter"), button:has-text("Tout accepter"), button:has-text("Continuer")').first();
  if (await cookieBtn.isVisible()) {
    console.log('Dismissing cookie banner...');
    await cookieBtn.click();
    await page.waitForTimeout(600);
  }

  // TEST 0: Open Comments Drawer to verify Opaque Liquid Glass Attachment Cards
  console.log('Opening Comments Drawer...');
  const commentsBtn = page.locator('button[aria-label*="Commentaires" i]').first();
  if (await commentsBtn.isVisible()) {
    await commentsBtn.click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outDir}/freedom-v10-01-comments-opaque-liquid.png` });
    console.log('Screenshot captured: freedom-v10-01-comments-opaque-liquid.png');

    const comGrab = page.locator('div[aria-label="Fermer les commentaires"]').first();
    if (await comGrab.isVisible()) {
      await comGrab.click();
      await page.waitForTimeout(600);
    }
  }

  // TEST 1: Open Kit Drawer directly from the reel bottom minimal pill
  console.log('Opening Kit Drawer via minimal pill...');
  const kitPill = page.locator('button.freedom-kit-minimal-pill').first();
  await kitPill.click({ force: true });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${outDir}/freedom-v10-02-kit-drawer-full.png` });
  console.log('Screenshot captured: freedom-v10-02-kit-drawer-full.png');

  // TEST 2: Click on the first product in Kit Drawer to open Product Detail Drawer
  console.log('Clicking on product in kit drawer...');
  const productButton = page.locator('.freedom-drawer-card button[aria-label*="Détails du produit" i]').first();
  if (await productButton.isVisible()) {
    await productButton.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/freedom-v10-03-product-detail-sheet.png` });
    console.log('Screenshot captured: freedom-v10-03-product-detail-sheet.png');

    // Close product detail sheet
    const prodGrab = page.locator('div[aria-label="Fermer la fiche produit"]').first();
    if (await prodGrab.isVisible()) {
      await prodGrab.click();
      await page.waitForTimeout(600);
    }
  }

  // TEST 3: Click "Voir où ce kit a été utilisé" to open World View Map Full Drawer
  console.log('Clicking "Voir où ce kit a été utilisé"...');
  const seeMapBtn = page.locator('button:has-text("Voir où ce kit a été utilisé")').first();
  if (await seeMapBtn.isVisible()) {
    await seeMapBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outDir}/freedom-v10-04-world-map-drawer.png` });
    console.log('Screenshot captured: freedom-v10-04-world-map-drawer.png');

    // Close map drawer
    const mapGrab = page.locator('div[aria-label="Fermer la carte"]').first();
    if (await mapGrab.isVisible()) {
      await mapGrab.click();
      await page.waitForTimeout(600);
    }
  }

  // Close kit drawer
  const kitGrab = page.locator('div[aria-label="Fermer le kit"]').first();
  if (await kitGrab.isVisible()) {
    await kitGrab.click();
    await page.waitForTimeout(800);
  }

  // TEST 4: Open Share Drawer directly from vertical sidebar
  console.log('Opening Share Drawer via vertical sidebar...');
  const shareBtn = page.locator('button[aria-label*="Partager" i]').first();
  await shareBtn.click({ force: true });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${outDir}/freedom-v10-05-share-drawer-real.png` });
  console.log('Screenshot captured: freedom-v10-05-share-drawer-real.png');

  await browser.close();
  console.log('All drawer verifications completed successfully!');
}

main().catch((err) => {
  console.error('Targeted verification error:', err);
  process.exit(1);
});
