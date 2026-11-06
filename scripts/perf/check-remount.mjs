// Vérifie les remontages et le changement de compte sur le fil Communauté.
// Usage : node scripts/perf/check-remount.mjs <base>
import { chromium } from 'playwright';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/perf/check-remount.mjs <base>');
  process.exit(2);
}
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  storageState: process.env.STORAGE_STATE,
});
const page = await context.newPage();
let feedRequests = 0;
page.on('request', (request) => {
  if (request.url().includes('/rest/v1/community_posts')) feedRequests += 1;
});

await page.goto(`${base}/communaute`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(3000);
const first = feedRequests;
await page.goto(`${base}/hub`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(2000);
await page.goBack({ waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(3000);
const afterBack = feedRequests;

// Déconnexion : les cookies de session disparaissent, le fil doit se recharger
// sans conserver les états like/favori du compte précédent.
await context.clearCookies();
feedRequests = 0;
await page.goto(`${base}/communaute`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(3000);
const afterLogout = feedRequests;
const guestText = await page.locator('body').innerText();

console.log(JSON.stringify({
  firstLoadRequests: first,
  afterBackRequests: afterBack,
  remountRequests: afterBack - first,
  afterLogoutRequests: afterLogout,
  guestSeesLoginPrompt: /Connectez-vous|Créez un compte/i.test(guestText),
}, null, 2));
await browser.close();
