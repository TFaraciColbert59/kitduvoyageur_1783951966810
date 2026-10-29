#!/usr/bin/env node
/**
 * Fluidité et budget de trames pendant un mouvement de caméra (P9-03).
 *
 * Ouvre une scène, déclenche une révélation (mouvement caméra réel), échantillonne
 * `requestAnimationFrame` pendant 2,5 s et rapporte la médiane, le p95 et la
 * trame la plus longue. Budget : ≥ 55 i/s médian, aucune trame > 50 ms.
 */
import { chromium } from 'playwright';

const base = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:4028').split('=')[1];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.addInitScript(() => {
  window.localStorage.setItem(
    'lkdv_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
  );
});
await page.goto(`${base}/explorer?v2=1&scene=lieu`, { waitUntil: 'commit', timeout: 60_000 });
await page.waitForSelector('.xp-map[data-ready="1"]', { timeout: 60_000 });
await page.waitForTimeout(2500);

// Échantillonneur de trames.
await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    window.__frames.push(now - last);
    last = now;
    if (window.__frames.length < 220) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// Mouvement de caméra réel : révèle le premier repère.
await page.evaluate(() => {
  const pin = document.querySelector('.xp-pin');
  if (pin) pin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(2600);

const frames = await page.evaluate(() => window.__frames ?? []);
await browser.close();

const deltas = frames.filter((value) => value > 0).sort((a, b) => a - b);
if (deltas.length === 0) {
  console.error('aucune trame mesurée');
  process.exit(1);
}
const median = deltas[Math.floor(deltas.length / 2)];
const p95 = deltas[Math.floor(deltas.length * 0.95)];
const worst = deltas[deltas.length - 1];
const fps = 1000 / median;

console.log(`trames : ${deltas.length}`);
console.log(`  médiane ${median.toFixed(1)} ms → ${fps.toFixed(1)} i/s  (budget ≥ 55)`);
console.log(`  p95 ${p95.toFixed(1)} ms · pire ${worst.toFixed(1)} ms (budget ≤ 50 ms)`);

const ok = fps >= 55 && worst <= 50;
console.log(ok ? '\n✅ budget de trames respecté' : '\n❌ budget de trames dépassé');
if (!ok) process.exit(1);
