import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('tests/visual/baseline');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch();
  
  // Desktop
  const pageDesktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Capturing desktop / ...');
  await pageDesktop.goto('http://localhost:4028/', { waitUntil: 'networkidle' });
  await pageDesktop.screenshot({ path: path.join(outDir, 'home-desktop.png'), fullPage: false });

  console.log('Capturing desktop /materiel ...');
  await pageDesktop.goto('http://localhost:4028/materiel', { waitUntil: 'networkidle' });
  await pageDesktop.screenshot({ path: path.join(outDir, 'materiel-desktop.png'), fullPage: false });
  await pageDesktop.close();

  // Mobile iPhone 14 Pro
  const pageMobile = await browser.newPage({
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true
  });

  console.log('Capturing mobile / ...');
  await pageMobile.goto('http://localhost:4028/', { waitUntil: 'networkidle' });
  await pageMobile.screenshot({ path: path.join(outDir, 'home-mobile.png'), fullPage: false });

  console.log('Capturing mobile /materiel ...');
  await pageMobile.goto('http://localhost:4028/materiel', { waitUntil: 'networkidle' });
  await pageMobile.screenshot({ path: path.join(outDir, 'materiel-mobile.png'), fullPage: false });
  await pageMobile.close();

  await browser.close();
  console.log('Baseline screenshots saved to', outDir);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
