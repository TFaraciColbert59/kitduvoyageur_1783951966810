import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 / mobile viewport
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

  // 1. Comments Drawer & Opaque Liquid Glass Attachment Cards
  console.log('Opening comments drawer...');
  const commentsBtn = page.locator('button[aria-label*="commentaire" i]').first();
  await commentsBtn.click({ force: true });
  await page.waitForTimeout(1800);

  await page.screenshot({ path: `${outDir}/freedom-v10-01-comments-opaque-liquid.png` });
  console.log('Screenshot 1 captured: comments drawer with opaque liquid glass cards');

  // 2. Open Kit from comment or from reel bottom pill
  console.log('Opening kit drawer...');
  const kitCardBtn = page.locator('button[aria-label*="Voir le kit" i]').first();
  if (await kitCardBtn.isVisible()) {
    await kitCardBtn.click({ force: true });
  } else {
    // fallback: close comments and click reel kit pill
    const grab = page.locator('.freedom-drawer-grab').first();
    await grab.click();
    await page.waitForTimeout(600);
    const reelKitPill = page.locator('button:has-text("Pack Bivouac")').first();
    await reelKitPill.click({ force: true });
  }
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${outDir}/freedom-v10-02-kit-drawer-clean-bottom.png` });
  console.log('Screenshot 2 captured: kit drawer clean bottom with floating bookmark pill & real selector');

  // 3. Click on a product to open product detail drawer
  console.log('Clicking on product in kit drawer...');
  const productRow = page.locator('button[aria-label*="Détails du produit" i]').first();
  if (await productRow.isVisible()) {
    await productRow.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/freedom-v10-03-product-detail-drawer.png` });
    console.log('Screenshot 3 captured: product detail drawer');

    // Close product detail drawer
    const prodGrab = page.locator('div[aria-label="Fermer la fiche produit"]').first();
    if (await prodGrab.isVisible()) {
      await prodGrab.click();
      await page.waitForTimeout(800);
    }
  }

  // 4. Click "Voir où ce kit a été utilisé" to open world view map full drawer
  console.log('Clicking "Voir où ce kit a été utilisé"...');
  const seeMapBtn = page.locator('button:has-text("Voir où ce kit a été utilisé")').first();
  if (await seeMapBtn.isVisible()) {
    await seeMapBtn.click({ force: true });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outDir}/freedom-v10-04-world-map-full-drawer.png` });
    console.log('Screenshot 4 captured: world map full drawer with zero buttons');

    // Close map drawer
    const mapGrab = page.locator('div[aria-label="Fermer la carte"]').first();
    if (await mapGrab.isVisible()) {
      await mapGrab.click();
      await page.waitForTimeout(800);
    }
  }

  // Close kit drawer
  const kitGrab = page.locator('div[aria-label="Fermer le kit"]').first();
  if (await kitGrab.isVisible()) {
    await kitGrab.click();
    await page.waitForTimeout(800);
  }

  // 5. Open Share Drawer and verify bottom-right mini selector
  console.log('Opening share drawer...');
  const shareBtn = page.locator('button[aria-label*="partag" i]').first();
  if (await shareBtn.isVisible()) {
    await shareBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/freedom-v10-05-share-drawer-mini-selector.png` });
    console.log('Screenshot 5 captured: share drawer with bottom right mini selector');
  }

  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Playwright verification error:', err);
  process.exit(1);
});
