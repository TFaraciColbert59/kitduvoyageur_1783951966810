#!/usr/bin/env node
/**
 * Compte les requêtes réseau au démarrage de /explorer (P9-07, budget ≤ 12 hors
 * tuiles). Les tuiles (fond, DEM) et les ressources statiques Next ne comptent
 * pas : le budget porte sur les appels de données.
 */
import { chromium } from 'playwright';

const base = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:4028').split('=')[1];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const dataRequests = [];
page.on('request', (request) => {
  const url = new URL(request.url());
  const isTile = /tiles\.openfreemap\.org\/planet|elevation-tiles-prod|s3\.amazonaws\.com/.test(url.href);
  const isStatic = url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/') || /\.(png|jpg|webp|svg|woff2?|css|js|mjs)$/.test(url.pathname);
  const isExternal = url.origin !== new URL(base).origin;
  // Préchargements de liens Next (`?_rsc=`) et document initial : ce ne sont
  // pas des appels de données.
  const isPrefetch = url.searchParams.has('_rsc');
  const isDocument = request.resourceType() === 'document';
  if (isTile || isStatic || isExternal || isPrefetch || isDocument) return;
  dataRequests.push(`${request.method()} ${url.pathname}${url.search}`);
});

await page.addInitScript(() => {
  window.localStorage.setItem(
    'lkdv_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
  );
});
await page.goto(`${base}/explorer?v2=1&scene=lieu`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.xp-sheet', { timeout: 45_000 });
await page.waitForTimeout(6000);
await browser.close();

const unique = [...new Set(dataRequests)];
console.log(`requêtes de données au démarrage : ${unique.length} (budget 12)`);
for (const request of unique) console.log('  ' + request);
if (unique.length > 12) {
  console.log('\n❌ budget dépassé');
  process.exit(1);
}
console.log('\n✅ budget respecté');
