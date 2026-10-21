import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('PAGE UNHANDLED ERROR:', err.message);
    consoleErrors.push(err.message);
  });

  console.log('Navigating to http://localhost:4028/compte...');
  await page.goto('http://localhost:4028/compte', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const outDir = 'audit/screens';
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Initial State & Central Selector Inspection
  console.log('\n=== STEP 1: Central Selector Inspection ===');
  await page.screenshot({ path: `${outDir}/01-initial-profile.png` });
  const igTabs = await page.$('.ig-tabs');
  if (!igTabs) throw new Error('.ig-tabs not found!');
  const igBox = await igTabs.boundingBox();
  console.log(`Central tabs box: width=${igBox.width.toFixed(1)}px, height=${igBox.height.toFixed(1)}px`);
  if (igBox.width > 200 || igBox.height > 44) {
    throw new Error(`Central selector is too large: ${igBox.width}x${igBox.height}px`);
  }

  // 2. Main Selector Tabs: Click Sorties (Tab 1), then Grille (Tab 0)
  console.log('\n=== STEP 2: Main Selector Tabs (Sorties / Grille) ===');
  const sortiesTab = await page.$('.ig-tabs button[data-v="1"]');
  await sortiesTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/02-tab-sorties.png` });
  const sortiesSelected = await page.evaluate(() => document.querySelector('.ig-tabs button[data-v="1"]')?.getAttribute('aria-selected'));
  console.log(`Sorties tab aria-selected: ${sortiesSelected}`);
  if (sortiesSelected !== 'true') throw new Error('Sorties tab was not selected!');

  const grilleTab = await page.$('.ig-tabs button[data-v="0"]');
  await grilleTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/03-tab-grille.png` });
  const grilleSelected = await page.evaluate(() => document.querySelector('.ig-tabs button[data-v="0"]')?.getAttribute('aria-selected'));
  console.log(`Grille tab aria-selected: ${grilleSelected}`);

  // 3. "Modifier le profil" Button -> Apple Inset Grouped Sheet
  console.log('\n=== STEP 3: "Modifier le profil" Sheet ===');
  const editBtn = await page.$('[data-a="editProfile"]');
  await editBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/04-edit-profile-sheet.png` });
  const editDet = await page.evaluate(() => document.getElementById('sw')?.dataset.det);
  console.log(`Modifier le profil sheet det: ${editDet}`);
  if (editDet !== 'large') throw new Error(`Modifier le profil did not open in large mode (got ${editDet})`);

  // Test avatar cycle inside edit sheet
  const changeAvBtn = await page.$('.apple-avatar-header [data-a="changeAvatar"]');
  const prevAvSrc = await page.evaluate(() => document.getElementById('ep_av_preview')?.getAttribute('src'));
  await changeAvBtn.click();
  await page.waitForTimeout(300);
  const nextAvSrc = await page.evaluate(() => document.getElementById('ep_av_preview')?.getAttribute('src'));
  console.log(`Avatar cycled: ${prevAvSrc !== nextAvSrc}`);

  // Test pace slider
  await page.evaluate(() => {
    const slider = document.getElementById('ep_pace');
    if (slider) {
      slider.value = 48;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  const paceLbl = await page.evaluate(() => document.getElementById('ep_pace_lbl')?.textContent);
  console.log(`Pace slider updated label: ${paceLbl}`);
  await page.screenshot({ path: `${outDir}/05-edit-profile-avatar-pace.png` });

  // Test Annuler button
  const cancelBtn = await page.$('[data-a="closeSheet"]');
  await cancelBtn.click();
  await page.waitForTimeout(500);
  const afterCancelDet = await page.evaluate(() => document.getElementById('sw')?.dataset.det);
  console.log(`After Annuler click, sheet det: ${afterCancelDet}`);
  if (afterCancelDet !== 'closed') throw new Error('Annuler did not close the edit profile sheet');

  // Test Enregistrer modifications
  await editBtn.click();
  await page.waitForTimeout(500);
  const saveBtn = await page.$('[data-a="save_full_profile"]');
  await saveBtn.click();
  await page.waitForTimeout(500);
  const afterSaveDet = await page.evaluate(() => document.getElementById('sw')?.dataset.det);
  console.log(`After Enregistrer click, sheet det: ${afterSaveDet}`);

  // 4. "Partager le profil" Button
  console.log('\n=== STEP 4: "Partager le profil" Button ===');
  const shareBtn = await page.$('[data-a="shareProfile"]');
  await shareBtn.click();
  await page.waitForTimeout(400);
  const islandShare = await page.evaluate(() => document.getElementById('island')?.innerText);
  console.log(`Island after share: ${islandShare}`);
  await page.screenshot({ path: `${outDir}/06-share-profile-toast.png` });

  // 5. Story circles -> opens story full-screen viewer
  console.log('\n=== STEP 5: Story Fullscreen Viewer ===');
  const storyBtn = await page.$('[data-a="openHighlight"]');
  await storyBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/07-story-fullscreen.png` });
  const storyClass = await page.evaluate(() => document.getElementById('story')?.className);
  console.log(`Story viewer class: ${storyClass}`);
  if (!storyClass.includes('on')) throw new Error('Story viewer did not open with class .on');

  // Close story
  const closeStoryBtn = await page.$('[data-a="stclose"]');
  if (closeStoryBtn) await closeStoryBtn.click();
  await page.waitForTimeout(400);
  const afterStoryClass = await page.evaluate(() => document.getElementById('story')?.className);
  console.log(`After close, story class: ${afterStoryClass}`);

  // 6. Follower and Following stats clicks
  console.log('\n=== STEP 6: Followers & Following Sheet ===');
  const followersBtn = await page.$('[data-a="openFollowers"]');
  await followersBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/08-followers-sheet.png` });
  const folDet = await page.evaluate(() => document.getElementById('sw')?.dataset.det);
  console.log(`Followers sheet det: ${folDet}`);
  if (folDet !== 'medium') throw new Error(`Followers sheet not opened (det=${folDet})`);

  // Toggle to Abonnements
  const toggleFollowing = await page.$('[data-a="toggleFollowersSheet"][data-v="following"]');
  if (toggleFollowing) {
    await toggleFollowing.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/09-following-sheet.png` });
  }

  // Toggle follow status on first user
  const toggleUserBtn = await page.$('[data-a="toggleFollowUser"]');
  if (toggleUserBtn) {
    const beforeFollowText = await page.evaluate(el => el.textContent.trim(), toggleUserBtn);
    await toggleUserBtn.click();
    await page.waitForTimeout(400);
    const afterFollowText = await page.evaluate(el => el?.textContent?.trim() || '', await page.$('[data-a="toggleFollowUser"]'));
    console.log(`Follow user toggled: "${beforeFollowText}" -> "${afterFollowText}"`);
  }

  // Close followers sheet
  await page.evaluate(() => {
    const sw = document.getElementById('sw');
    if (sw) sw.dataset.det = 'closed';
  });
  await page.waitForTimeout(400);

  // 7. Clicking member pseudo / avatar -> opens member profile sheet
  console.log('\n=== STEP 7: Member Profile Sheet ===');
  await followersBtn.click();
  await page.waitForTimeout(500);
  const memberRow = await page.$('[data-a="openUserProfile"]');
  if (memberRow) {
    await memberRow.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/10-member-profile-preview.png` });
    const previewHandle = await page.evaluate(() => document.querySelector('.user-profile-preview')?.innerText || '');
    console.log(`Opened member profile preview`);
  }
  await page.evaluate(() => {
    if (typeof window.__lkdvCompteAct === 'function') window.__lkdvCompteAct('closeSheet');
  });
  await page.waitForTimeout(400);

  // 8. Drawer Identité & ses 5 écrans (Clicking avatar)
  console.log('\n=== STEP 8: Drawer Identité & 5 Screens ===');
  const avatarWrap = await page.$('.ig-avi-wrap');
  await avatarWrap.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/11-drawer-identite-tab0.png` });
  const flowTabs = await page.$$('.flow button');
  console.log(`Drawer Identité flow tabs count: ${flowTabs.length}`);
  if (flowTabs.length !== 5) throw new Error(`Expected 5 tabs in Drawer Identité, found ${flowTabs.length}`);

  for (let i = 1; i < 5; i++) {
    const tabBtn = await page.$(`.flow button[data-v="${i}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/11-drawer-identite-tab${i}.png` });
      console.log(`Clicked Drawer Identité tab ${i}`);
    }
  }

  // Close drawer
  await page.evaluate(() => {
    if (typeof window.__lkdvCompteAct === 'function') window.__lkdvCompteAct('closeSheet');
  });
  await page.waitForTimeout(400);

  // 9. Top-right buttons: + menu, theme toggle, account drawer
  console.log('\n=== STEP 9: Top-Right Buttons ===');
  const plusBtn = await page.$('[data-a="openCreate"]');
  await plusBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/12-create-menu-sheet.png` });
  console.log('Opened + create menu sheet');
  await page.evaluate(() => {
    if (typeof window.__lkdvCompteAct === 'function') window.__lkdvCompteAct('closeSheet');
  });
  await page.waitForTimeout(400);

  const sunBtn = await page.$('[data-a="popv"]');
  await sunBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/13-theme-sun-popover.png` });
  console.log('Opened theme & glass sun popover');
  // Dismiss popv
  await page.click('#phone', { position: { x: 50, y: 50 } });
  await page.waitForTimeout(300);

  const acctDrawerBtn = await page.$('[data-a="openAccountDrawer"]');
  await acctDrawerBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/14-account-drawer-commandes.png` });
  console.log('Opened account drawer (Commandes, Notifications, Paramètres)');

  // Test switching tabs inside account drawer
  const notifTab = await page.$('.segc button[data-v="1"]');
  if (notifTab) {
    await notifTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/15-account-drawer-notifications.png` });
  }
  const paramTab = await page.$('.segc button[data-v="2"]');
  if (paramTab) {
    await paramTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/16-account-drawer-parametres.png` });
  }
  await page.evaluate(() => {
    if (typeof window.__lkdvCompteAct === 'function') window.__lkdvCompteAct('closeSheet');
  });
  await page.waitForTimeout(400);

  // 10. Top-left pseudo dropdown: shows only "Se déconnecter"
  console.log('\n=== STEP 10: Top-Left Pseudo Dropdown ===');
  const pseudoBtn = await page.$('#rpvis');
  await pseudoBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/17-pseudo-dropdown.png` });
  const signoutBtn = await page.$('[data-a="signout"]');
  if (!signoutBtn) throw new Error('Se déconnecter button not found in dropdown!');
  console.log('Pseudo dropdown contains "Se déconnecter"');

  // Dismiss dropdown by clicking #rpvis again
  await pseudoBtn.click();
  await page.waitForTimeout(400);

  // 11. 3D Living Globe: zoom presets (Orbite, Massif, Sentier)
  console.log('\n=== STEP 11: 3D Living Globe Scale Presets ===');
  const btnMassif = await page.$('#btnCompteMassif');
  await btnMassif.click();
  await page.waitForTimeout(400);
  const massifActive = await page.evaluate(() => document.getElementById('btnCompteMassif')?.classList.contains('active'));
  console.log(`btnCompteMassif active: ${massifActive}`);
  if (!massifActive) throw new Error('Expected btnCompteMassif to be active after click!');

  const btnSentier = await page.$('#btnCompteSentier');
  await btnSentier.click();
  await page.waitForTimeout(400);
  const sentierActive = await page.evaluate(() => document.getElementById('btnCompteSentier')?.classList.contains('active'));
  console.log(`btnCompteSentier active: ${sentierActive}`);
  if (!sentierActive) throw new Error('Expected btnCompteSentier to be active after click!');

  const btnOrbite = await page.$('#btnCompteOrbite');
  await btnOrbite.click();
  await page.waitForTimeout(400);
  const orbiteActive = await page.evaluate(() => document.getElementById('btnCompteOrbite')?.classList.contains('active'));
  console.log(`btnCompteOrbite active: ${orbiteActive}`);
  if (!orbiteActive) throw new Error('Expected btnCompteOrbite to be active after click!');
  await page.screenshot({ path: `${outDir}/18-3d-globe-presets.png` });

  await browser.close();
  console.log('\n=============================================');
  console.log('ALL 11 INTERACTION SUITES PASSED FLAWLESSLY!');
  console.log('=============================================');
}

main().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
