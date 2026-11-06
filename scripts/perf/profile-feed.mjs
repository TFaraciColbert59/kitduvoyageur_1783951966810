// Profil d'une longue session du fil Communauté : DOM, mémoire, scroll, vidéos.
// Usage : node scripts/perf/profile-feed.mjs <base> [maxScrolls]
import { chromium } from 'playwright';

const base = process.argv[2];
const maxScrolls = Number(process.argv[3] || 30);
if (!base) {
  console.error('usage: node scripts/perf/profile-feed.mjs <base> [maxScrolls]');
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
const requests = [];
page.on('request', (request) => {
  if (request.url().includes('/rest/v1/community_posts')) requests.push(request.url());
});
await page.goto(`${base}/communaute`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(4000);

const snapshots = [];
let previous = -1;
let stable = 0;
for (let index = 0; index < maxScrolls; index += 1) {
  try {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  } catch {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }
  await page.waitForTimeout(1200);
  let snapshot = null;
  for (let attempt = 0; attempt < 3 && !snapshot; attempt += 1) {
    try {
      snapshot = await page.evaluate(() => {
        const memory = performance.memory;
        return {
          posts: document.querySelectorAll('.lkdv-feed-post').length,
          nodes: document.querySelectorAll('*').length,
          videos: document.querySelectorAll('video').length,
          images: document.images.length,
          scrollHeight: document.documentElement.scrollHeight,
          scrollY: window.scrollY,
          heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
        };
      });
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  if (!snapshot) continue;
  snapshots.push({ index, ...snapshot });
  if (snapshot.posts === previous) stable += 1;
  else stable = 0;
  previous = snapshot.posts;
  if (stable >= 3) break;
}

const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames += 1;
        window.scrollBy(0, 40);
        if (performance.now() - start < 2000) requestAnimationFrame(tick);
        else resolve(Math.round((frames * 1000) / (performance.now() - start)));
      };
      requestAnimationFrame(tick);
    })
);
const resources = await page.evaluate(() => {
  const entries = performance.getEntriesByType('resource');
  return {
    webmBytes: entries.filter((entry) => /\.webm/.test(entry.name)).reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    imageBytes: entries
      .filter((entry) => entry.initiatorType === 'img' || /_next\/image/.test(entry.name))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    jsBytes: entries
      .filter((entry) => entry.initiatorType === 'script' || /\.js(\?|$)/.test(entry.name))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
  };
});
console.log(JSON.stringify({ snapshots, fps, resources, feedRequests: requests.length }, null, 2));
await browser.close();
