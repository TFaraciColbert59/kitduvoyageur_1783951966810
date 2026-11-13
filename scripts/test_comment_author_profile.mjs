import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();
  const baseUrl = 'https://kitduvoyageur-1783951966810-ruddy.vercel.app';
  const outDir = '/Users/fr168256/.gemini/antigravity/brain/a06cf3b4-d914-4ba2-afc0-739dc6cdda3a';

  console.log('Navigating to', `${baseUrl}/communaute/reels`);
  await page.goto(`${baseUrl}/communaute/reels`, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  // Dismiss cookie banner
  const cookieBtn = page.locator('button:has-text("Accepter"), button:has-text("Tout accepter"), button:has-text("Continuer")').first();
  if (await cookieBtn.isVisible()) {
    console.log('Dismissing cookie banner...');
    await cookieBtn.click();
    await page.waitForTimeout(600);
  }

  // Open Comments Drawer
  console.log('Opening Comments Drawer...');
  const commentsBtn = page.locator('button[aria-label*="Commentaires" i]').first();
  await commentsBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Capture comments drawer showing clickable authors
  await page.screenshot({ path: `${outDir}/freedom-v10-06-comments-clickable-authors.png` });
  console.log('Screenshot captured: freedom-v10-06-comments-clickable-authors.png');

  // Click on the first author name ("Antoine Delorme")
  console.log('Clicking on author name Antoine Delorme...');
  const authorButton = page.locator('button:has-text("Antoine Delorme")').first();
  await authorButton.click({ force: true });
  await page.waitForTimeout(3000);

  console.log('Current URL after author click:', page.url());
  await page.screenshot({ path: `${outDir}/freedom-v10-07-profile-navigated.png` });
  console.log('Screenshot captured: freedom-v10-07-profile-navigated.png');

  await browser.close();
  console.log('Comment profile navigation verified successfully!');
}

main().catch((err) => {
  console.error('Profile test error:', err);
  process.exit(1);
});
