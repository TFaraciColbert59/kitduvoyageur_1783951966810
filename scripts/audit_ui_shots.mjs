import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4000';
const OUT_DIR = path.resolve(process.cwd(), 'audit_shots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const routes = [
  { name: 'home', path: '/' },
  { name: 'materiel', path: '/materiel' },
  { name: 'progression', path: '/progression' },
  { name: 'boutique', path: '/boutique' },
  { name: 'carnets', path: '/carnets' },
  { name: 'carte', path: '/carte-interactive' },
  { name: 'connexion', path: '/connexion' },
  { name: 'dev_style', path: '/dev/style' },
];

async function run() {
  console.log('Lancement du diagnostic visuel multi-écrans...');
  const browser = await chromium.launch();
  
  // Desktop
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const desktopPage = await desktopContext.newPage();

  // Mobile (iPhone 14 Pro style: 393x852 with touch)
  const mobileContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();

  for (const r of routes) {
    console.log(`Capture route: ${r.path}...`);
    try {
      // Desktop
      await desktopPage.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await desktopPage.waitForTimeout(1500);
      await desktopPage.screenshot({ path: path.join(OUT_DIR, `${r.name}-desktop.png`), fullPage: false });

      // Mobile
      await mobilePage.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mobilePage.waitForTimeout(1500);
      await mobilePage.screenshot({ path: path.join(OUT_DIR, `${r.name}-mobile.png`), fullPage: false });
    } catch (err) {
      console.error(`Erreur sur route ${r.path}:`, err.message);
    }
  }

  await browser.close();
  console.log(`Captures terminées ! Enregistrées dans ${OUT_DIR}`);
}

run().catch(console.error);
