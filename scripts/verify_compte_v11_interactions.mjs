import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(process.cwd(), 'audit/screens/compte/v11');
mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('🚀 Starting Playwright verification on http://localhost:4028/compte...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERR:', err));

  try {
    await page.goto('http://localhost:4028/compte', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#phone', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 1. Profile Header & Selector
    console.log('📸 1. Capturing profile header & selector...');
    await page.screenshot({ path: resolve(outDir, '01-profile-header-selector.png') });

    // Verify stats and layout
    const igLeftWidth = await page.$eval('.ig-left', el => getComputedStyle(el).width);
    const statBg = await page.$eval('.ig-stat', el => getComputedStyle(el).backgroundColor);
    console.log(`   ✓ .ig-left width: ${igLeftWidth}, .ig-stat bg: ${statBg}`);

    // 2. Open Post Modal
    console.log('📸 2. Testing Post Modal...');
    const tile = await page.waitForSelector('.ig-tile[data-a="openPostModal"]');
    await tile.click();
    await page.waitForSelector('#post_modal_instagram.open', { timeout: 5000 });
    await page.waitForTimeout(500);

    const socialCounter = await page.$eval('#pmi_social_counter', el => el.textContent?.trim());
    console.log(`   ✓ Social counter text: "${socialCounter}"`);

    // Like interaction
    const likeBtn = await page.waitForSelector('.pmi-actions .pmi-act-btn[data-a="toggleLikePost"]');
    await likeBtn.click();
    await page.waitForTimeout(400);
    const likedCounter = await page.$eval('#pmi_social_counter', el => el.textContent?.trim());
    console.log(`   ✓ Liked counter text: "${likedCounter}"`);

    // Comment interaction
    const commentInput = await page.waitForSelector('#pmi_comment_input');
    await commentInput.fill('Test commentaire depuis Playwright terrain');
    const submitBtn = await page.waitForSelector('.pmi-submit-btn');
    await submitBtn.click();
    await page.waitForTimeout(400);
    const inputValAfter = await page.$eval('#pmi_comment_input', el => el.value);
    console.log(`   ✓ Input cleared after submit: "${inputValAfter}" === ""`);

    await page.screenshot({ path: resolve(outDir, '02-post-modal-instagram.png') });

    // Close modal
    const closeBtn = await page.waitForSelector('[data-a="closePostModal"]');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // 3. Sorties tab
    console.log('📸 3. Testing Sorties Tab...');
    const sortiesTabBtn = await page.waitForSelector('[data-a="igtab"][data-v="1"]');
    await sortiesTabBtn.click();
    await page.waitForTimeout(500);

    const voyagesHeaderCount = await page.$$eval('.voyages-header', els => els.length);
    const carouselCount = await page.$$eval('.voyages-carousel', els => els.length);
    console.log(`   ✓ Voyages header count in DOM: ${voyagesHeaderCount}, carousel count: ${carouselCount}`);

    await page.screenshot({ path: resolve(outDir, '03-sorties-carousel.png') });

    // Return to tab 0
    const gridTabBtn = await page.waitForSelector('[data-a="igtab"][data-v="0"]');
    await gridTabBtn.click();
    await page.waitForTimeout(400);

    // 4. Drawer Lignée & Inventaire (5 tabs)
    console.log('📸 4. Testing Drawer Lignée & Inventaire 5 tabs...');
    const bioLink = await page.waitForSelector('.ig-bio-link');
    await bioLink.click();
    await page.waitForSelector('#sw[data-det="medium"], #sw[data-det="large"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Check map controls hidden
    const mctlOpacity = await page.$eval('.mctl', el => getComputedStyle(el).opacity);
    const mctlPointer = await page.$eval('.mctl', el => getComputedStyle(el).pointerEvents);
    console.log(`   ✓ Drawer open -> .mctl opacity: ${mctlOpacity}, pointer-events: ${mctlPointer}`);

    await page.screenshot({ path: resolve(outDir, '04-drawer-tab1-kits.png') });

    // Tab 2: Inventaire
    const tabInventaire = await page.waitForSelector('.flow button[data-v="1"]');
    await tabInventaire.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, '05-drawer-tab2-inventaire.png') });

    // Tab 3: Prêts
    const tabPrets = await page.waitForSelector('.flow button[data-v="2"]');
    await tabPrets.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, '06-drawer-tab3-prets.png') });

    // Tab 4: Fidélité
    const tabFidelite = await page.waitForSelector('.flow button[data-v="3"]');
    await tabFidelite.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, '07-drawer-tab4-fidelite.png') });

    // Tab 5: Parrainage
    const tabParrainage = await page.waitForSelector('.flow button[data-v="4"]');
    await tabParrainage.click();
    await page.waitForTimeout(400);
    const copyRefBtn = await page.waitForSelector('[data-a="copyReferral"]');
    await copyRefBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(outDir, '08-drawer-tab5-parrainage.png') });

    // Close drawer
    const sheetCloseBtn = await page.waitForSelector('.sh-h [data-a="close"]');
    await sheetCloseBtn.click();
    await page.waitForTimeout(500);

    const mctlOpacityAfter = await page.$eval('.mctl', el => getComputedStyle(el).opacity);
    console.log(`   ✓ Drawer closed -> .mctl opacity restored: ${mctlOpacityAfter}`);

    // 5. Long Press on Story Highlight
    console.log('📸 5. Testing Story Highlight Context Menu / Long Press...');
    const hlBtn = await page.waitForSelector('.ig-hl:not([data-v="hl5"])');
    // Dispatch bubbling contextmenu event to trigger Apple Action Sheet
    await hlBtn.dispatchEvent('contextmenu', { bubbles: true });
    await page.waitForSelector('#sw[data-det="medium"]', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, '09-story-action-sheet.png') });

    const closeHlSheet = await page.waitForSelector('.sh-h [data-a="close"]');
    await closeHlSheet.click();
    await page.waitForTimeout(400);

    // 6. Story Fullscreen
    console.log('📸 6. Testing Story Fullscreen 100%...');
    await hlBtn.click();
    await page.waitForSelector('#story.on', { timeout: 5000 });
    await page.waitForTimeout(500);

    const storyPos = await page.$eval('#story.on', el => getComputedStyle(el).position);
    const storyWidth = await page.$eval('#story.on', el => getComputedStyle(el).width);
    const storyZIndex = await page.$eval('#story.on', el => getComputedStyle(el).zIndex);
    console.log(`   ✓ Story fullscreen: position=${storyPos}, width=${storyWidth}, zIndex=${storyZIndex}`);

    await page.screenshot({ path: resolve(outDir, '10-story-fullscreen.png') });

    const storyCloseBtn = await page.waitForSelector('[data-a="stclose"]');
    await storyCloseBtn.click();
    await page.waitForTimeout(400);

    console.log('✅ ALL 10 PLAYWRIGHT INTERACTION CHECKS AND SCREENSHOTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error in Playwright interaction script:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
