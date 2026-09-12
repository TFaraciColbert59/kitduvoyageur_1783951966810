import { chromium } from 'playwright';

/**
 * PERF — capture réseau prefetch (preuve brute) :
 * liste toutes les requêtes /api/hikes déclenchées automatiquement au chargement
 * de / et /explorer, avec leurs paramètres (détecte les fetch sans viewport).
 *
 * Usage: node scripts/perf/capture-prefetch.mjs > docs/perf/prefetch-<avant|apres>.txt
 */
const targets = ['/', '/explorer'];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  geolocation: { latitude: 50.784, longitude: 2.666 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem(
    'lkdv_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
  );
});

for (const target of targets) {
  const hikes = [];
  const listener = (request) => {
    if (request.url().includes('/api/hikes')) hikes.push(request.url());
  };
  page.on('request', listener);
  await page.goto(`http://localhost:4000${target}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8_000);
  page.off('request', listener);
  console.log(`\n=== ${target} — requêtes /api/hikes : ${hikes.length} ===`);
  for (const url of hikes) console.log(url);
}

await browser.close();
