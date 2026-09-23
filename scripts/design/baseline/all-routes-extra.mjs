/* Complément : 9 URLs dynamiques à valeurs réelles/repli → docs/qa/all-routes/ */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4028';
const OUT_DIR = path.join(process.cwd(), 'docs/qa/all-routes');
const EXTRA = [
  '/clubs/trekkeurs-alpes',
  '/rejoindre/trekkeurs-alpes',
  '/pays/fr',
  '/voyages/corsica-gr20-groupe',
  '/voyages/corsica-gr20-groupe/itineraire',
  '/produit/occasion-tente-nemo-dagger',
  '/profil/demo',
  '/compte/demo',
  '/preparer-sentier/demo',
];
const slug = (r) => r.replace(/^\//, '').replace(/\//g, '-');

const browser = await chromium.launch();
const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'manifest.json'), 'utf8'));
for (const route of EXTRA) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  const entry = { route, viewport: '393x852' };
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    entry.http = resp ? resp.status() : null;
    await page.waitForTimeout(3000);
    const banner = page.getByRole('region', { name: 'Gestion des cookies' });
    if (await banner.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Refuser' }).first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    entry.finalUrl = page.url().replace(BASE, '');
    entry.title = await page.title();
    const file = path.join(OUT_DIR, `${slug(route)}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 70, animations: 'disabled' });
    entry.file = path.relative(process.cwd(), file).split(path.sep).join('/');
    entry.status = 'ok';
  } catch (e) { entry.status = 'failed'; entry.reason = String(e).slice(0, 300); }
  entry.consoleErrors = errors.length;
  const ix = manifest.findIndex((m) => m.route === route || m.route === route.replace(/^\/[^/]+/, (s) => s));
  manifest.push(entry);
  console.log(route, '→', entry.status, '|', entry.title, '|', entry.finalUrl);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('OK →', OUT_DIR);
