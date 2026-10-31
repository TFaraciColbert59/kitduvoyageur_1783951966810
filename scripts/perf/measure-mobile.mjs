#!/usr/bin/env node
/**
 * Mesures de performance « mobile » reproductibles (labo) — Explorer.
 *
 * Deux profils :
 *   1. WebKit (moteur Safari) au viewport iPhone 16 Pro, sans bridage CPU ;
 *   2. Chromium iPhone 16 Pro avec CPU ×4 et réseau « Slow 4G » (CDP).
 *
 * Ce que ces chiffres sont : des mesures **labo émulées**, reproductibles, sur
 * un serveur de production local. Ce qu'elles ne sont pas : des mesures sur un
 * iPhone physique (voir `docs/cleanup/MOBILE_PERF.md` pour l'état du device).
 *
 * Usage : npm run perf:mobile -- [--url=http://127.0.0.1:4032] [--runs=3] [--out=fichier.json]
 */
import { chromium, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith('--url='));
const runsArg = args.find((a) => a.startsWith('--runs='));
const outArg = args.find((a) => a.startsWith('--out='));
const URL_BASE = urlArg ? urlArg.split('=')[1] : 'http://127.0.0.1:4032';
const RUNS = Math.max(1, Number(runsArg ? runsArg.split('=')[1] : 3));
const PATH = '/explorer';

const INIT_SCRIPT = () => {
  window.__perf = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__perf.lcp = Math.max(window.__perf.lcp, entry.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__perf.cls += entry.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__perf.longTasks += 1;
      window.__perf.longTaskMs += entry.duration;
    }
  }).observe({ type: 'longtask', buffered: true });
};

const MEASURE_SCRIPT = async () => {
  const nav = performance.getEntriesByType('navigation')[0] ?? {};
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]));
  const resources = performance.getEntriesByType('resource');
  const transferBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

  // Cadence rAF pendant 3 s : moyenne et p95 des intervalles inter-images.
  const deltas = await new Promise((resolve) => {
    const values = [];
    let last = performance.now();
    const started = last;
    function frame(now) {
      values.push(now - last);
      last = now;
      if (now - started < 3000) requestAnimationFrame(frame);
      else resolve(values);
    }
    requestAnimationFrame(frame);
  });
  const sorted = [...deltas].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const fps = p50 > 0 ? 1000 / p50 : 0;

  return {
    ttfb: nav.responseStart ? nav.responseStart - (nav.requestStart ?? 0) : 0,
    domContentLoaded: nav.domContentLoadedEventEnd ?? 0,
    load: nav.loadEventEnd ?? 0,
    fcp: paint['first-contentful-paint'] ?? 0,
    lcp: window.__perf.lcp,
    cls: window.__perf.cls,
    longTasks: window.__perf.longTasks,
    longTaskMs: window.__perf.longTaskMs,
    requests: resources.length,
    transferKb: Math.round(transferBytes / 1024),
    heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    frameP50ms: Number(p50.toFixed(2)),
    frameP95ms: Number(p95.toFixed(2)),
    fpsP50: Number(fps.toFixed(1)),
    frames: deltas.length,
  };
};

async function measure(browserType, label, throttle) {
  const results = [];
  for (let run = 0; run < RUNS; run += 1) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 402, height: 874 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'fr-FR',
      ignoreHTTPSErrors: true,
      // Le service worker du site recharge /explorer en boucle sur un build
      // local sans backend : on le désactive pour mesurer le rendu applicatif.
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(INIT_SCRIPT);
    if (throttle) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const startedAt = Date.now();
    try {
      await page.goto(`${URL_BASE}${PATH}`, { waitUntil: 'load', timeout: 90_000 });
      await page.waitForTimeout(3000);
      const metrics = await page.evaluate(MEASURE_SCRIPT);
      results.push({ ...metrics, wallMs: Date.now() - startedAt, title: await page.title() });
    } catch (error) {
      results.push({ error: error instanceof Error ? error.message.slice(0, 160) : 'erreur', wallMs: Date.now() - startedAt });
    } finally {
      await context.close();
      await browser.close();
    }
  }
  return { label, throttle: Boolean(throttle), runs: results };
}

const median = (values) => {
  const sorted = [...values].filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
};

const webkitResult = await measure(webkit, 'webkit-iphone16pro', false);
const chromiumResult = await measure(chromium, 'chromium-iphone16pro-cpu4x-slow4g', true);
const profiles = [webkitResult, chromiumResult];

const summary = profiles.map((profile) => {
  const ok = profile.runs.filter((r) => !r.error);
  return {
    label: profile.label,
    throttle: profile.throttle,
    runs: ok.length,
    errors: profile.runs.filter((r) => r.error).map((r) => r.error),
    lcpMs: median(ok.map((r) => r.lcp)),
    fcpMs: median(ok.map((r) => r.fcp)),
    ttfbMs: median(ok.map((r) => r.ttfb)),
    cls: median(ok.map((r) => r.cls)),
    longTasks: median(ok.map((r) => r.longTasks)),
    longTaskMs: median(ok.map((r) => r.longTaskMs)),
    requests: median(ok.map((r) => r.requests)),
    transferKb: median(ok.map((r) => r.transferKb)),
    heapMb: median(ok.map((r) => r.heapMb)),
    frameP50ms: median(ok.map((r) => r.frameP50ms)),
    frameP95ms: median(ok.map((r) => r.frameP95ms)),
    fpsP50: median(ok.map((r) => r.fpsP50)),
  };
});

const payload = { generatedAt: new Date().toISOString(), url: `${URL_BASE}${PATH}`, runs: RUNS, summary, profiles };
console.log(JSON.stringify(summary, null, 2));
if (outArg) {
  const path = outArg.split('=')[1];
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Résultats écrits dans ${path}`);
}
