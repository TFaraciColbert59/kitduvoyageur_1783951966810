// Recette navigateur WebKit (Safari engine), distincte d'un test iPhone/Capacitor.
// Usage : node scripts/perf/smoke-webkit.mjs <base>
import { webkit } from 'playwright';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/perf/smoke-webkit.mjs <base>');
  process.exit(2);
}
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  storageState: process.env.STORAGE_STATE,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error).slice(0, 160)));
const results = [];
for (const path of ['/communaute', '/hub', '/compas', '/compte']) {
  errors.length = 0;
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => undefined);
  await page.waitForTimeout(4000);
  const data = await page.evaluate(() => ({
    path: location.pathname,
    posts: document.querySelectorAll('.lkdv-feed-post').length,
    videos: document.querySelectorAll('video').length,
    text: document.body.innerText.slice(0, 80),
  })).catch(() => ({ path: 'evaluate-failed' }));
  results.push({ requested: path, ...data, errors: errors.length ? errors.slice(0, 3) : 0 });
  await page.screenshot({ path: `/tmp/webkit-${path.replaceAll('/', '_') || 'root'}.png` });
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
