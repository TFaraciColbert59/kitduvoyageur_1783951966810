// A/B Communauté : même session, même throttling, serveurs baseline et après.
// Usage : node scripts/perf/ab-community.mjs <urlBaseline> <urlAfter> [runs]
import { chromium } from 'playwright';

const [baseline, after] = process.argv.slice(2);
const runs = Number(process.argv[4] || 6);
if (!baseline || !after) {
  console.error('usage: node scripts/perf/ab-community.mjs <baseline> <after> [runs]');
  process.exit(2);
}
const servers = [
  { name: 'baseline', base: baseline },
  { name: 'after', base: after },
];
const browser = await chromium.launch();
const contextOptions = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  storageState: process.env.STORAGE_STATE,
};

async function measure(server, warmup) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, lcpTag: null, lcpSrc: null, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.lcp = entry.startTime;
        window.__perf.lcpTag = entry.element?.tagName ?? null;
        window.__perf.lcpSrc = entry.element?.currentSrc || entry.element?.src || null;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`${server.base}/communaute`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(8000);
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    return {
      lcp: window.__perf.lcp,
      lcpTag: window.__perf.lcpTag,
      lcpSrc: window.__perf.lcpSrc ? String(window.__perf.lcpSrc).slice(0, 140) : null,
      cls: window.__perf.cls,
      ttfb: nav?.responseStart ?? null,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      posts: document.querySelectorAll('.lkdv-feed-post').length,
      images: document.images.length,
      nextImages: [...document.images].filter((img) => (img.currentSrc || img.src).includes('/_next/image')).length,
      videoBytes: resources.filter((r) => /\.webm/.test(r.name)).reduce((sum, r) => sum + (r.transferSize || 0), 0),
      imageBytes: resources
        .filter((r) => r.initiatorType === 'img' || /_next\/image/.test(r.name))
        .reduce((sum, r) => sum + (r.transferSize || 0), 0),
      path: location.pathname,
    };
  });
  await context.close();
  return { server: server.name, warmup, ...data };
}

for (const server of servers) await measure(server, true);

const results = [];
for (let i = 0; i < runs; i += 1) {
  const order = i % 2 === 0 ? servers : [...servers].reverse();
  for (const server of order) results.push(await measure(server, false));
}

const q = (values, p) => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
};
console.log(JSON.stringify(results, null, 2));
for (const name of ['baseline', 'after']) {
  const valid = results.filter((r) => r.server === name && r.posts > 0);
  console.log(
    name,
    'n=', valid.length,
    'LCP méd/p75=', q(valid.map((r) => r.lcp), 0.5), '/', q(valid.map((r) => r.lcp), 0.75),
    'FCP méd=', q(valid.map((r) => r.fcp), 0.5),
    'TTFB méd=', q(valid.map((r) => r.ttfb), 0.5),
    'CLS max=', Math.max(0, ...valid.map((r) => r.cls)).toFixed(3),
    'images=', q(valid.map((r) => r.imageBytes), 0.5),
    'video=', q(valid.map((r) => r.videoBytes), 0.5),
  );
}
await browser.close();
