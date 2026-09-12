/**
 * FLUIDITÉ — F2/F3 : vérifications runtime réelles.
 * - F2 : options d'inertie dragPan réellement appliquées (lecture handler).
 * - F2 : haptique `selection` émis au franchissement de palier (navigator.vibrate
 *        espionné AVANT chargement), jamais en rafale.
 * - F3 : data-atlas-flying bascule pendant le geste, backdrop-filter des
 *        panneaux secondaires coupé en vol / restauré à l'arrêt.
 * - F3 : raster-fade-duration = 300 lu sur les 3 couches.
 *
 * Usage : node scripts/atlas/verify-fluidite-f2-f3.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.addInitScript(() => {
  window.__vibrations = [];
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (pattern) => {
      window.__vibrations.push(pattern);
      return true;
    },
  });
});

await page.goto('http://localhost:4000/explorer?atlas=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="unified-explorer-map"][data-atlas-ready="true"]', {
  timeout: 60_000,
});

console.log('=== F2.1 — inertie dragPan appliquée ===');
const inertia = await page.evaluate(() => {
  const handler = window.__atlasTestMap.dragPan;
  return { enabled: handler.isEnabled(), options: handler._inertiaOptions };
});
console.log(JSON.stringify(inertia, null, 2));

console.log('\n=== F3.1 — raster-fade-duration épinglé sur les 3 couches ===');
const fade = await page.evaluate(() => {
  const map = window.__atlasTestMap;
  return {
    topo: map.getPaintProperty('atlas-tile-topo', 'raster-fade-duration'),
    osm: map.getPaintProperty('atlas-tile-osm', 'raster-fade-duration'),
    satellite: map.getPaintProperty('atlas-tile-satellite', 'raster-fade-duration'),
  };
});
console.log(JSON.stringify(fade, null, 2));

console.log('\n=== F2.2 — haptique palier : zoom molette z1.6 → z5 (franchit world→continent) ===');
await page.evaluate(() => {
  window.__vibrations = [];
  window.__atlasTestMap.jumpTo({ center: [6.8, 45.9], zoom: 1.6 });
});
await page.waitForTimeout(800);
await page.mouse.move(720, 450);
for (let step = 0; step < 14; step += 1) {
  await page.mouse.wheel(0, -160);
  await page.waitForTimeout(90);
}
await page.waitForTimeout(900);
const afterZoomIn = await page.evaluate(() => ({
  zoom: window.__atlasTestMap.getZoom(),
  vibrations: window.__vibrations,
}));
console.log(JSON.stringify(afterZoomIn, null, 2));

console.log('\n=== F3.2 — data-atlas-flying + blur carte pays pendant/après gesture ===');
// Ouvre la carte pays (vrai .glass flouté) via un clic réel, puis mesure le blur.
await page.evaluate(() => {
  window.__atlasTestMap.jumpTo({ center: [6.8, 45.9], zoom: 5 });
});
await page.waitForTimeout(700);
const countryPoint = await page.evaluate(() => {
  const p = window.__atlasTestMap.project([10.4, 51.1]);
  return { x: p.x, y: p.y };
});
await page.mouse.click(countryPoint.x, countryPoint.y);
await page.waitForSelector('[data-atlas-country-card="true"]', { timeout: 5_000 });
await page.waitForTimeout(1_200);
const during = await page.evaluate(async () => {
  const map = window.__atlasTestMap;
  const root = document.querySelector('[data-testid="unified-explorer-map"]');
  const card = document.querySelector('[data-atlas-country-card] [data-atlas-glass="secondary"]');
  map.easeTo({ center: [4.5, 46.5], duration: 2200 });
  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    flying: root?.dataset.atlasFlying,
    cardBlur: card ? getComputedStyle(card).backdropFilter : '(carte absente)',
  };
});
const after = await page.evaluate(async () => {
  await new Promise((resolve) => setTimeout(resolve, 2400));
  const root = document.querySelector('[data-testid="unified-explorer-map"]');
  const card = document.querySelector('[data-atlas-country-card] [data-atlas-glass="secondary"]');
  return {
    flying: root?.dataset.atlasFlying,
    cardBlur: card ? getComputedStyle(card).backdropFilter : '(carte absente)',
  };
});
console.log('pendant  :', JSON.stringify(during));
console.log('après    :', JSON.stringify(after));
const legend = await page.evaluate(() => {
  const node = document.querySelector('[data-atlas-density-legend] [data-atlas-glass="secondary"]');
  return node ? getComputedStyle(node).backdropFilter : '(légende absente)';
});
console.log('légende backdrop-filter :', legend, '(pas de blur natif sur .glass-pill — rien à couper)');

console.log('\npageErrors: ' + JSON.stringify(errors));
await browser.close();
