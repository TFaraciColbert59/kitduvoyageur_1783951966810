// Mesure Explorer : interface, premiers pixels de carte, carte interactive.
// Usage : node scripts/perf/measure-explorer.mjs <base> [runs]
import { chromium } from 'playwright';

const base = process.argv[2];
const runs = Number(process.argv[3] || 5);
if (!base) {
  console.error('usage: node scripts/perf/measure-explorer.mjs <base> [runs]');
  process.exit(2);
}
const browser = await chromium.launch();
const results = [];
for (let run = 0; run <= runs; run += 1) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    storageState: process.env.STORAGE_STATE,
  });
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
    window.__perf = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const t0 = Date.now();
  let error = null;
  try {
    await page.goto(`${base}/explorer`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    // La carte peut prendre > 20 s en mobile ralenti : on attend le repère.
    await page.waitForFunction(
      () => performance.getEntriesByName('map:interactive').length > 0,
      { timeout: 45_000 },
    ).catch(() => undefined);
    await page.waitForTimeout(1000);
  } catch (caught) {
    error = String(caught).slice(0, 200);
  }
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const mark = (name) => performance.getEntriesByName(name)[0]?.startTime ?? null;
    return {
      ttfb: nav?.responseStart ?? null,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      lcp: window.__perf.lcp || null,
      cls: window.__perf.cls,
      firstPaint: mark('map:first-paint'),
      interactive: mark('map:interactive'),
      canvas: Boolean(document.querySelector('canvas.maplibregl-canvas, .maplibregl-canvas')),
      path: location.pathname,
    };
  }).catch((caught) => ({ error: String(caught).slice(0, 120) }));
  results.push({ run, warmup: run === 0, wallMs: Date.now() - t0, error, ...data });
  await context.close();
}
await browser.close();
const q = (values, p) => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
};
const valid = results.filter((r) => !r.warmup && !r.error);
console.log(JSON.stringify(results, null, 2));
console.log('n=', valid.length,
  'TTFB méd/p75=', q(valid.map(r=>r.ttfb),0.5), '/', q(valid.map(r=>r.ttfb),0.75),
  'FCP méd/p75=', q(valid.map(r=>r.fcp),0.5), '/', q(valid.map(r=>r.fcp),0.75),
  'LCP méd/p75=', q(valid.map(r=>r.lcp),0.5), '/', q(valid.map(r=>r.lcp),0.75),
  'firstPaint méd/p75=', q(valid.map(r=>r.firstPaint),0.5), '/', q(valid.map(r=>r.firstPaint),0.75),
  'interactive méd/p75=', q(valid.map(r=>r.interactive),0.5), '/', q(valid.map(r=>r.interactive),0.75),
  'CLS max=', Math.max(0, ...valid.map(r=>r.cls)).toFixed(3));
