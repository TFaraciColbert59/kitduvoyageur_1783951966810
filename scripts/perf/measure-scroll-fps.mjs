#!/usr/bin/env node
/**
 * Mesure réelle du défilement des fils (60 i/s cible) sur mobile (390×844, CPU ×4)
 * via Playwright + CDP (`requestAnimationFrame` deltas + trames manquées > 20 ms / > 33 ms).
 *
 * Usage :
 *   node scripts/perf/measure-scroll-fps.mjs --base-url http://localhost:4028 --storage-state <file> [--out <json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_ROUTES = ['/communaute', '/carnets', '/hub'];

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const baseUrl = getArg('--base-url', 'http://localhost:4028').replace(/\/+$/, '');
const storageState = getArg('--storage-state', null);
const outPath = getArg('--out', null);
const executablePath = [process.env.CHROME_PATH, DEFAULT_CHROME_PATH].find((p) => p && fs.existsSync(p));

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--disable-dev-shm-usage'],
});

const results = [];

for (const route of TARGET_ROUTES) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    serviceWorkers: 'block',
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const stats = await page.evaluate(async () => {
    // Trouver le vrai conteneur défilable (window ou overflow-y-auto le plus grand).
    const candidates = [document.scrollingElement, ...Array.from(document.querySelectorAll('main, section, div'))]
      .filter((el) => el && el.scrollHeight > el.clientHeight + 120);
    let scroller = document.scrollingElement;
    let bestOverflow = (scroller?.scrollHeight ?? 0) - (scroller?.clientHeight ?? 0);
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (el !== document.scrollingElement && !/(auto|scroll)/.test(style.overflowY)) continue;
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow > bestOverflow) {
        bestOverflow = overflow;
        scroller = el;
      }
    }

    const deltas = [];
    let last = performance.now();
    let running = true;
    const step = (now) => {
      deltas.push(now - last);
      last = now;
      if (running) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    // Défilement soutenu sur ~2,4 s (descente puis légère remontée, pas 48 px/trame).
    const startTs = performance.now();
    let dir = 1;
    while (performance.now() - startTs < 2400) {
      if (scroller) {
        const before = scroller.scrollTop;
        scroller.scrollTop += dir * 36;
        if (scroller.scrollTop === before && before > 0) dir = -1;
        else if (scroller.scrollTop <= 0) dir = 1;
      } else {
        window.scrollBy(0, dir * 36);
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    running = false;

    const clean = deltas.slice(2);
    const totalMs = clean.reduce((s, d) => s + d, 0);
    const avgMs = clean.length ? totalMs / clean.length : 0;
    const fps = avgMs > 0 ? Math.min(60, 1000 / avgMs) : 0;
    const droppedOver20 = clean.filter((d) => d > 20).length;
    const jankOver33 = clean.filter((d) => d > 33.4).length;
    const maxFrameMs = clean.length ? Math.max(...clean) : 0;
    const sorted = [...clean].sort((a, b) => a - b);
    const p95FrameMs = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;

    return {
      frames: clean.length,
      fps: Math.round(fps * 10) / 10,
      avgFrameMs: Math.round(avgMs * 10) / 10,
      p95FrameMs: Math.round(p95FrameMs * 10) / 10,
      maxFrameMs: Math.round(maxFrameMs * 10) / 10,
      droppedOver20,
      jankOver33,
      jankPct: clean.length ? Math.round((jankOver33 / clean.length) * 1000) / 10 : 0,
      scrollablePx: bestOverflow,
    };
  });

  console.info(
    `[scroll CPU×4] ${route.padEnd(14)} | ${String(stats.fps).padStart(5)} fps | avg ${stats.avgFrameMs}ms | p95 ${stats.p95FrameMs}ms | max ${stats.maxFrameMs}ms | >33ms: ${stats.jankOver33}/${stats.frames} (${stats.jankPct}%) | scroll ${stats.scrollablePx}px`,
  );
  results.push({ route, finalPath: new URL(page.url()).pathname, ...stats });

  await cdp.detach().catch(() => {});
  await context.close();
}

await browser.close();

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2));
}
