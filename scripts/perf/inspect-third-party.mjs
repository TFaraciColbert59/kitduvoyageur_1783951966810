// Troisièmes scripts et polices réellement chargés au premier affichage.
// Usage : node scripts/perf/inspect-third-party.mjs <base>
import { chromium } from 'playwright';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/perf/inspect-third-party.mjs <base>');
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
const thirdPartyHosts = /googletagmanager|google-analytics|rocket\.new|travelpayouts|hcaptcha|stripe|sentry|hotjar|clarity|facebook|tiktok|doubleclick/;
for (const path of ['/', '/hub', '/compas', '/compte', '/explorer']) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(5000);
  const data = await page.evaluate((regexSource) => {
    const regex = new RegExp(regexSource);
    const entries = performance.getEntriesByType('resource');
    const byHost = new Map();
    for (const entry of entries) {
      try {
        const host = new URL(entry.name).hostname;
        if (host === location.hostname) continue;
        const current = byHost.get(host) ?? { count: 0, bytes: 0 };
        current.count += 1;
        current.bytes += entry.transferSize || 0;
        byHost.set(host, current);
      } catch {
        /* URL non standard */
      }
    }
    const fonts = entries
      .filter((entry) => /\.woff2?(\?|$)/.test(entry.name))
      .map((entry) => ({ name: entry.name.split('/').pop(), bytes: entry.transferSize || 0, start: Math.round(entry.startTime) }));
    return {
      path: location.pathname,
      thirdParty: [...byHost.entries()]
        .filter(([host]) => regex.test(host))
        .map(([host, value]) => ({ host, ...value })),
      fonts,
    };
  }, thirdPartyHosts.source);
  console.log(JSON.stringify(data));
}
await browser.close();
