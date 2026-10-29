#!/usr/bin/env node
/**
 * Mesures de performance de l'Explorer (P9-02 → P9-04).
 *
 * Trois mesures dans un seul passage :
 *   1. **Trames** pendant un mouvement de caméra (médiane, p95, i/s) ;
 *   2. **Tâches longues** (> 50 ms) sur la séquence — équivalent INP observable
 *      sans interaction réelle ;
 *   3. **Mémoire** : tas JS avant/après une activité simulée (10 min par défaut),
 *      avec un échantillon toutes les 30 s.
 *
 * Sortie JSON (`docs/explorer-v2/preuves/perf-<date>.json`) + code 1 si un
 * budget est dépassé. Les budgets « trames » ne sont appliqués que si le
 * navigateur rend en GPU (sur un runner sans GPU, la valeur est informative :
 * SwiftShader ne mesure pas le produit).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, fallback) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};

const base = arg('base', 'http://localhost:4028');
const durationS = Number(arg('duration', '600'));
const outPath = arg('out', 'docs/explorer-v2/preuves/perf.json');

const browser = await chromium.launch({
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.addInitScript(() => {
  window.localStorage.setItem(
    'lkdv_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
  );
});

const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Tracing.start', {
  categories: 'devtools.timeline,disabled-by-default-devtools.timeline',
  transferMode: 'ReturnAsStream',
});

await page.goto(`${base}/explorer?v2=1&scene=lieu`, { waitUntil: 'commit', timeout: 60_000 });
await page.waitForSelector('.xp-map[data-ready="1"]', { timeout: 60_000 });
await page.waitForTimeout(2500);

// 1. Trames pendant un mouvement de caméra réel.
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    window.__frames.push(now - last);
    last = now;
    if (window.__frames.length < 240) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.evaluate(() => {
  const pin = document.querySelector('.xp-pin');
  if (pin) pin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(3000);
const frames = await page.evaluate(() => window.__frames ?? []);

const sorted = frames.filter((value) => value > 0).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
const fps = median > 0 ? 1000 / median : 0;
const gpu = await page.evaluate(() => {
  const canvas = document.querySelector('.xp-map canvas');
  const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
  if (!gl) return { renderer: 'aucun contexte', software: true };
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'inconnu';
  return { renderer, software: /swiftshader|software|llvmpipe/i.test(renderer) };
});

// 2. Activité simulée + mémoire.
await page.goto(`${base}/explorer?v2=1&scene=course`, { waitUntil: 'commit', timeout: 60_000 });
await page.waitForSelector('.xp-activity-pill', { timeout: 60_000 });
await page.waitForTimeout(1500);

const heap = [];
const sampleHeap = async () => {
  const metrics = await cdp.send('Performance.getMetrics');
  const used = metrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  const total = metrics.metrics.find((metric) => metric.name === 'JSHeapTotalSize')?.value ?? 0;
  heap.push({ at: Date.now(), usedBytes: Math.round(used), totalBytes: Math.round(total) });
};

await sampleHeap();
const start = Date.now();
let lat = 45.9237;
let lng = 6.8694;
while ((Date.now() - start) / 1000 < durationS) {
  await page.evaluate(
    ([lat0, lng0]) => {
      let la = lat0;
      let ln = lng0;
      for (let index = 0; index < 10; index += 1) {
        la += 0.00009;
        ln += 0.00006;
        window.__xpPushFix?.({ t: Date.now() + index * 1000, lat: la, lng: ln, ele: 1035 + index, acc: 6, speed: 1.4 });
      }
    },
    [lat, lng],
  );
  lat += 0.0009;
  lng += 0.0006;
  await page.waitForTimeout(30_000);
  await sampleHeap();
}
await sampleHeap();

const trace = await cdp.send('Tracing.end').catch(() => null);
const traceData = await new Promise((resolve) => {
  const chunks = [];
  cdp.on('Tracing.dataCollected', (event) => chunks.push(...event.value));
  cdp.on('Tracing.tracingComplete', () => resolve(chunks));
  setTimeout(() => resolve(chunks), 5000);
});
await browser.close();

const first = heap[0]?.usedBytes ?? 0;
const last = heap[heap.length - 1]?.usedBytes ?? 0;
const growthMb = (last - first) / (1024 * 1024);
const maxGrowthMb = Math.max(...heap.map((point) => (point.usedBytes - first) / (1024 * 1024)), 0);
const longTasks = traceData.filter(
  (event) => event.name === 'RunTask' && (event.dur ?? 0) > 50_000,
).length;

const report = {
  measuredAt: new Date().toISOString(),
  base,
  durationS,
  frames: {
    samples: sorted.length,
    medianMs: Math.round(median * 10) / 10,
    p95Ms: Math.round(p95 * 10) / 10,
    fps: Math.round(fps * 10) / 10,
    worstMs: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
  },
  gpu,
  longTasks,
  memory: { samples: heap.length, growthMb: Math.round(growthMb * 10) / 10, maxGrowthMb: Math.round(maxGrowthMb * 10) / 10, heap },
};

mkdirSync(join(process.cwd(), 'docs/explorer-v2/preuves'), { recursive: true });
writeFileSync(join(process.cwd(), outPath), JSON.stringify(report, null, 2), 'utf8');

console.log(`trames     : ${report.frames.fps} i/s médian · p95 ${report.frames.p95Ms} ms · ${report.frames.samples} échantillons`);
console.log(`GPU        : ${gpu.renderer}${gpu.software ? ' (logiciel)' : ''}`);
console.log(`tâches > 50 ms : ${longTasks}`);
console.log(`mémoire    : +${report.memory.growthMb} Mo (pic +${report.memory.maxGrowthMb} Mo) sur ${heap.length} mesures`);

const failures = [];
if (!gpu.software && fps < 55) failures.push(`trames ${fps.toFixed(1)} i/s < 55`);
if (maxGrowthMb > 40) failures.push(`mémoire +${maxGrowthMb.toFixed(1)} Mo > 40`);
if (longTasks > 40) failures.push(`${longTasks} tâches longues > 40`);
if (gpu.software) console.log('⚠ trames non concluantes : rendu logiciel (pas de GPU)');
if (failures.length) {
  console.error(`\n❌ ${failures.join(' · ')}`);
  process.exit(1);
}
console.log('\n✅ budgets respectés');
