// Capture headless des routes de référence (piège gitignore : jamais de mot "cache").
import { chromium } from 'playwright';

const routes = {
  pays:  '/pays/fr',
  materiel: '/materiel',
  compte: '/compte',
  voyages: '/voyages',
};
const base = process.env.LKDV_BASE || 'http://localhost:4000';

const tag = process.argv[2]; // ex: "avant-u1"

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const [name, path] of Object.entries(routes)) {
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(500);
    const shot = `docs/u-captures/${name}-${tag}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    const h = await page.evaluate(() => document.body.innerHTML.length);
    const t = await page.evaluate(() => document.title);
    console.log(JSON.stringify({ name, status: 'ok', shot, title: t, domLen: h }));
  } catch (e) {
    console.log(JSON.stringify({ name, status: 'ERR', msg: String(e).slice(0,120) }));
  }
}
await browser.close();
