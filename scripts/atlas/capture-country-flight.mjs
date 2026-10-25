/**
 * FLUIDITÉ — F1 : capture de vols pays réels (clics souris sur la carte,
 * jamais simulés) avec horodatage précis : durée exacte via `moveend`,
 * série zoom échantillonnée à 25 ms → preuve de la trajectoire Van Wijk
 * et de la modulation de vitesse (courte distance vs globe lointain).
 *
 * Usage : node scripts/atlas/capture-country-flight.mjs
 * (serveur dev :4000 requis ; captures → docs/fluidite/f1-vol-*.png)
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function loadAtlas(center, zoom) {
  await page.goto('http://localhost:4000/explorer?atlas=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="unified-explorer-map"][data-atlas-ready="true"]', {
    timeout: 60_000,
  });
  if (center) {
    await page.evaluate(
      async ([lng, lat, z]) => {
        const map = window.__atlasTestMap;
        map.jumpTo({ center: [lng, lat], zoom: z });
        await new Promise((resolve) => setTimeout(resolve, 700));
      },
      [center[0], center[1], zoom]
    );
  }
}

async function armFlightProbe() {
  await page.evaluate(() => {
    window.__flightProbe = { done: false };
    const map = window.__atlasTestMap;
    const t0 = performance.now();
    const samples = [];
    const interval = setInterval(() => {
      samples.push({ t: Math.round(performance.now() - t0), z: Number(map.getZoom().toFixed(3)) });
    }, 25);
    const finish = () => {
      if (window.__flightProbe.done) return;
      clearInterval(interval);
      window.__flightProbe = {
        done: true,
        durationMs: Math.round(performance.now() - t0),
        samples,
        endZoom: Number(map.getZoom().toFixed(3)),
        endCenter: map.getCenter(),
      };
    };
    map.once('moveend', finish);
    setTimeout(finish, 16_000);
  });
}

async function clickCountryAt(lng, lat) {
  const point = await page.evaluate(
    ([x, y]) => {
      const p = window.__atlasTestMap.project([x, y]);
      return { x: p.x, y: p.y };
    },
    [lng, lat]
  );
  await page.mouse.click(point.x, point.y);
}

async function flight(name, action, options = {}) {
  await armFlightProbe();
  await action();
  await page.waitForFunction(() => window.__flightProbe?.done === true, null, {
    timeout: 20_000,
  });
  const probe = await page.evaluate(() => window.__flightProbe);
  const zooms = probe.samples.map((s) => s.z);
  const minZoom = Math.min(...zooms);
  const maxZoom = Math.max(...zooms);
  const formatted = probe.samples
    .filter((_, index) => index % 8 === 0)
    .map((s) => `${s.z.toFixed(2)}`)
    .join(' → ');
  console.log(`\n--- ${name} ---`);
  console.log(`durée moveend: ${probe.durationMs} ms · échantillons: ${probe.samples.length}`);
  console.log(`zoom départ ${zooms[0].toFixed(2)} · creux ${minZoom.toFixed(2)} · sommet ${maxZoom.toFixed(2)} · fin ${probe.endZoom.toFixed(2)}`);
  console.log(`fin center: ${probe.endCenter.lng.toFixed(2)}, ${probe.endCenter.lat.toFixed(2)}${options.expected ? ` (attendu ≈ ${options.expected})` : ''}`);
  console.log(`atterrissage zoom 4.6 : ${Math.abs(probe.endZoom - 4.6) < 0.05 ? 'OK' : `ÉCART ${probe.endZoom}`}`);
  console.log(`série zoom (1 point / 200 ms): ${formatted}`);
  if (options.screenshotPrefix) {
    await page.screenshot({ path: `docs/fluidite/${options.screenshotPrefix}-atterrissage.png` });
  }
  return probe;
}

// --- Vol 1 : France → Allemagne (plat, court, pays sans centroïde densité) ---
await loadAtlas([2.3, 46.6], 5);
await flight('FR→DE z5 (plat, 1 387 km)', () => clickCountryAt(10.4, 51.1), {
  expected: '10.4, 51.1 (point tapé)',
  screenshotPrefix: 'f1-vol-fr-de',
});
await page.screenshot({ path: 'docs/fluidite/f1-vol-fr-de-decollage.png' });

// --- Vol 2 : globe (z1.2) → France, Europe visible ---
await loadAtlas([50, 30], 1.2);
await flight('Globe z1.2 → FR (Δzoom 3.4)', () => clickCountryAt(2.3, 46.6), {
  expected: '2.3, 46.6 (centroïde FR)',
  screenshotPrefix: 'f1-vol-globe-fr',
});

// --- Vol 3 : globe (z1.2) → France depuis le Pacifique (le plus long) ---
await loadAtlas([-100, 20], 1.2);
await flight('Pacifique z1.2 → FR (~7 000 km, Δzoom 3.4)', () => clickCountryAt(2.3, 46.6), {
  expected: '2.3, 46.6 (centroïde FR)',
  screenshotPrefix: 'f1-vol-pacifique-fr',
});

console.log('\npageErrors: ' + JSON.stringify(errors));
await browser.close();
