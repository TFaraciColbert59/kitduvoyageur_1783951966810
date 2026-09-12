/**
 * E2/E3 — Repli « Explorer ma zone » sans GPS : reproduction + preuve.
 *
 * Deux scénarios, exécutés sans permission de géolocalisation :
 *   A. aucune position connue (aucun `lkdv_last_location`) :
 *      avant → le CTA plonge vers la vue initiale Chamonix (bbox sans sentier) ;
 *      après → la vue reste sur le globe + message glass non bloquant.
 *   B. dernière position en `localStorage` (`lkdv_last_location`) :
 *      après → le CTA plonge vers cette dernière position (zoom 12).
 *
 * Prérequis : serveur DEV sur BASE_URL (le hook `__atlasTestMap` est dev-only).
 *   npm run dev   (port 4000)
 *
 * Usage :
 *   node scripts/atlas/repro-e2-geoloc-fallback.mjs --phase=avant
 *   node scripts/atlas/repro-e2-geoloc-fallback.mjs --phase=apres
 *
 * Sorties : docs/explorer-mobile/e2-<phase>.json + e2-<phase>-<taille>.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const phaseArg = process.argv.find((arg) => arg.startsWith('--phase='));
const PHASE = (phaseArg ? phaseArg.split('=')[1] : 'avant').toLowerCase();
const DOCS_DIR = path.join(process.cwd(), 'docs', 'explorer-mobile');
const VIEWPORT = { name: '390x844', width: 390, height: 844 };

/** Dernière position de test (Paris) pour le scénario B. */
const LAST_KNOWN = { latitude: 48.8566, longitude: 2.3522 };

fs.mkdirSync(DOCS_DIR, { recursive: true });

async function tryTap(locator, timeout = 4_000) {
  try {
    await locator.tap({ timeout });
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).split('\n').slice(0, 3).join(' | ') };
  }
}

/** Sonde DOM exécutée dans la page : état carte + repli + stockage. */
function collectProbe() {
  const cta = document.querySelector('[data-atlas-primary-cta="mobile"] button');
  const notice = document.querySelector('[data-atlas-geoloc-notice]');
  const map = window.__atlasTestMap ?? null;
  const center = map ? map.getCenter() : null;
  const rounded = (value) => (value == null ? null : Math.round(value * 10_000) / 10_000);
  return {
    url: location.href,
    ctaLabel: cta ? cta.getAttribute('aria-label') : null,
    ctaText: cta ? (cta.textContent || '').trim() : null,
    noticePresent: Boolean(notice),
    noticeText: notice ? (notice.textContent || '').trim() : null,
    mapCenter: center ? { lat: rounded(center.lat), lng: rounded(center.lng) } : null,
    mapZoom: map ? Math.round(map.getZoom() * 100) / 100 : null,
    mapMinZoom: map ? map.getMinZoom() : null,
    trailCards: document.querySelectorAll('[data-trail-id]').length,
    lastLocationStorage: (() => {
      try {
        return localStorage.getItem('lkdv_last_location');
      } catch {
        return null;
      }
    })(),
  };
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    // Aucune permission : `navigator.geolocation` échoue (PERMISSION_DENIED).
    permissions: [],
    serviceWorkers: 'block',
  });
  await context.addInitScript(
    ({ storageValue }) => {
      try {
        localStorage.setItem(
          'lkdv_cookie_consent',
          JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
        );
        if (storageValue) localStorage.setItem('lkdv_last_location', storageValue);
        else localStorage.removeItem('lkdv_last_location');
      } catch {
        /* stockage indisponible — le bandeau sera accepté par clic */
      }
    },
    { storageValue: scenario.storageValue }
  );

  const page = await context.newPage();
  const entry = { scenario: scenario.id, label: scenario.label, pageErrors: [], hikeRequests: [] };
  page.on('pageerror', (error) => entry.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/hikes')) entry.hikeRequests.push(request.url());
  });

  await page.goto(`${BASE_URL}/explorer?atlas=1`, { waitUntil: 'domcontentloaded' });
  const acceptCookies = page.getByRole('button', { name: 'Tout accepter' });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click().catch(() => {});
  }

  await page.waitForSelector('[data-testid="unified-explorer-map"][data-atlas-ready="true"]', {
    timeout: 90_000,
  });
  // Laisse l'échec de géoloc initial se propager avant de mesurer.
  await page.waitForTimeout(1_500);

  entry.beforeTap = await page.evaluate(collectProbe);

  const cta = page.locator('[data-atlas-primary-cta="mobile"] button');
  entry.tap = await tryTap(cta, 4_000);
  if (!entry.tap.ok) {
    entry.tap.forcedDomClick = true;
    await cta.evaluate((el) => el.click());
  }

  // Fin du vol (1 600 ms) + stabilisation + requête viewport.
  await page.waitForTimeout(3_200);
  entry.afterTap = await page.evaluate(collectProbe);
  entry.screenshot = path.join(DOCS_DIR, `e2-${PHASE}-${scenario.id}.png`);
  await page.screenshot({ path: entry.screenshot });

  if (scenario.expectedCenter) {
    entry.centerDistanceKm = entry.afterTap.mapCenter
      ? Math.round(distanceKm(scenario.expectedCenter, entry.afterTap.mapCenter) * 10) / 10
      : null;
  }
  await context.close();
  return entry;
}

const browser = await chromium.launch();
const run = {
  phase: PHASE,
  baseUrl: BASE_URL,
  startedAt: new Date().toISOString(),
  scenarios: [],
};

run.scenarios.push(
  await runScenario(browser, {
    id: 'a-sans-gps',
    label: 'Sans GPS et sans dernière position — le CTA ne doit pas plonger vers Chamonix',
    storageValue: null,
  })
);

run.scenarios.push(
  await runScenario(browser, {
    id: 'b-last-known',
    label: 'Sans GPS mais dernière position en localStorage — le CTA plonge vers elle',
    storageValue: JSON.stringify({
      lat: LAST_KNOWN.latitude,
      lng: LAST_KNOWN.longitude,
      timestamp: Date.now(),
    }),
    expectedCenter: { lat: LAST_KNOWN.latitude, lng: LAST_KNOWN.longitude },
  })
);

run.finishedAt = new Date().toISOString();
const jsonPath = path.join(DOCS_DIR, `e2-${PHASE}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(run, null, 2), 'utf8');

for (const scenario of run.scenarios) {
  console.log(
    `\n[${PHASE}] ${scenario.scenario} — cta=${scenario.beforeTap.ctaLabel} → ${scenario.afterTap.ctaLabel}` +
      ` | center=${JSON.stringify(scenario.afterTap.mapCenter)} zoom=${scenario.afterTap.mapZoom}` +
      ` | cards=${scenario.afterTap.trailCards}` +
      ` | notice=${scenario.afterTap.noticePresent ? JSON.stringify(scenario.afterTap.noticeText) : 'absente'}` +
      (Number.isFinite(scenario.centerDistanceKm) ? ` | distanceParis=${scenario.centerDistanceKm}km` : '')
  );
}

console.log(`\nJSON  : ${jsonPath}`);
console.log(`Erreurs page : ${JSON.stringify(run.scenarios.flatMap((s) => s.pageErrors))}`);

await browser.close();
