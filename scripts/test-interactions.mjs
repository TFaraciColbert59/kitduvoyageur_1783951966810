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

  // 1. MESSAGES: Click on a conversation
  console.log('1. Interacting with Messages...');
  try {
    await page.goto(`${baseUrl}/messagerie`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    // Click on the first conversation item
    const firstConv = page.locator('.mitem, [class*="conversation"], .mthread-item').first();
    if (await firstConv.isVisible()) {
      console.log('Clicking first conversation...');
      await firstConv.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'screen-messages-conv-open.png') });
      console.log('Saved screen-messages-conv-open.png');
    }
  } catch (e) {
    console.error('Messages conv error:', e);
  }

  // 2. COMMUNAUTE: Click 3-dots, click comment
  console.log('2. Interacting with Communaute...');
  try {
    await page.goto(`${baseUrl}/communaute`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click 3-dots on first post
    const moreBtn = page.locator('.pmi-more-pill, .lkdv-feed-post-options').first();
    if (await moreBtn.isVisible()) {
      console.log('Clicking 3-dots options...');
      await moreBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, 'screen-communaute-options-open.png') });
      console.log('Saved screen-communaute-options-open.png');
    }

    // Click comment button
    const commentBtn = page.locator('button:has-text("9"), button[aria-label*="comment" i], .lkdv-post-media-glass button:nth-child(2)').first();
    if (await commentBtn.isVisible()) {
      console.log('Clicking comment button...');
      await commentBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, 'screen-communaute-comments-open.png') });
      console.log('Saved screen-communaute-comments-open.png');
    }
  } catch (e) {
    console.error('Communaute interaction error:', e);
  }

  // 3. COMPTE: Click profile avatar to open profile drawer
  console.log('3. Interacting with Compte...');
  try {
    await page.goto(`${baseUrl}/compte`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Click avatar
    const avatar = page.locator('.profile-avatar, .ig-avatar, [class*="avatar"]').first();
    if (await avatar.isVisible()) {
      console.log('Clicking profile avatar...');
      await avatar.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'screen-compte-profile-drawer.png') });
      console.log('Saved screen-compte-profile-drawer.png');
    }
  } catch (e) {
    console.error('Compte profile error:', e);
  }

  await browser.close();
  console.log('Done test interactions!');
}

run().catch(console.error);
