#!/usr/bin/env node
// Mission Fusée — mesure reproductible des surfaces principales (avant/après).
// Complète `npm run perf:mobile` (Explorer seul, serveur local, WebKit + Chromium) : ici toutes les
// surfaces, à cache froid, avec session (connexion démo ou essai), sur un aperçu ou la production.
//
//   node scripts/perf/measure-surfaces.mjs <url-de-base> <dossier-de-sortie> [--runs 5] [--throttle]
//
// NO_LOGIN=1 : mesure sans session (surfaces publiques).
// Session : STORAGE_STATE=<fichier> réutilise une session (jamais committée) ; sinon « Essayer sans
// compte » (limité à 5 par heure et par adresse) puis création d'une aventure par le Compas, et la
// session est écrite dans <dossier>/storage-state.json. VERCEL_SHARE=<jeton> pour un aperçu protégé.
// Chaque passage part d'un contexte neuf (cache froid).
// --throttle : profil Lighthouse « mobile » (CPU ×4, RTT 150 ms, 1,6 Mbit/s descendant, 750 kbit/s montant).
// Sortie : <dossier>/measures.json + tableau médiane / p75 par surface (TTFB, FCP, LCP, CLS, octets JS).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!base || !outDir) {
  console.error('usage: node scripts/perf/measure-surfaces.mjs <url-de-base> <dossier> [--runs N] [--throttle]');
  process.exit(2);
}
const argv = process.argv.slice(2);
const RUNS = Number(argv[argv.indexOf('--runs') + 1]) > 0 && argv.includes('--runs') ? Number(argv[argv.indexOf('--runs') + 1]) : 5;
const THROTTLE = argv.includes('--throttle');
const SURFACES = (process.env.SURFACES || '/,/hub,/compas,/explorer,/compte,/communaute').split(',');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
);
const contextOptions = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
};
let context = await browser.newContext({
  ...contextOptions,
  ...(process.env.STORAGE_STATE ? { storageState: process.env.STORAGE_STATE } : {}),
});

// Cache froid : un contexte neuf par passage (mêmes cookies de session), comme une première visite.
async function newPage() {
  const state = fs.existsSync(path.join(outDir, 'storage-state.json'))
    ? path.join(outDir, 'storage-state.json')
    : process.env.STORAGE_STATE;
  const fresh = await browser.newContext({ ...contextOptions, ...(state ? { storageState: state } : {}) });
  const page = await fresh.newPage();
  page.__ctx = fresh;
  if (THROTTLE) {
    const cdp = await fresh.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  // LCP et CLS observés dès le début du document.
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, bootGone: null, hadBoot: false };
    // Écran de démarrage plein écran (.lkdv-boot) : le contenu n'est visible qu'à son effacement.
    const watchBoot = () => {
      const boot = document.querySelector('.lkdv-boot');
      if (boot) window.__perf.hadBoot = true;
      if (window.__perf.hadBoot && window.__perf.bootGone == null && (!boot || boot.getAttribute('data-phase') === 'leaving')) {
        window.__perf.bootGone = performance.now();
      }
    };
    new MutationObserver(watchBoot).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  return page;
}

if (process.env.VERCEL_SHARE) {
  const p = await context.newPage();
  await p.goto(`${base}/?_vercel_share=${process.env.VERCEL_SHARE}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await p.close();
}

if (!process.env.STORAGE_STATE && !process.env.NO_LOGIN) {
  const page = await context.newPage();
  await page.goto(`${base}/connexion?next=/compas`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  if (process.env.COMPAS_DEMO) {
    // Connexion démo (lien `/api/demo-login`, aperçus où DEMO_AUTO_LOGIN=true) : compte partagé,
    // mesure en lecture seule — aucune aventure n'est créée.
    // Même destination que le lien « Connexion démo » (GET → session posée → redirection).
    await page.goto(`${base}/api/demo-login`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForURL((u) => !u.pathname.startsWith('/connexion') && !u.pathname.startsWith('/api/'), { timeout: 90_000 });
  } else {
    await page.getByRole('button', { name: /^Essayer sans compte$/ }).first().click({ timeout: 60_000 });
    await page.waitForURL((u) => u.pathname.startsWith('/compas'), { timeout: 90_000 });
  }
  // Une aventure active, pour que le Compas et le HUB aient du contenu réel (essai sans compte seulement).
  if (!process.env.COMPAS_DEMO) await createAdventure(page);
  await context.storageState({ path: path.join(outDir, 'storage-state.json') });
  await page.close();
  console.info('session prête');
}

async function createAdventure(page) {
  await page.goto(`${base}/compas?nouvelle=1`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  const refuse = page.getByRole('button', { name: 'Refuser' });
  if (await refuse.isVisible().catch(() => false)) await refuse.click().catch(() => undefined);
  const box = page.locator('textarea').first();
  await box.waitFor({ timeout: 60_000 });
  const go = page.getByRole('button', { name: 'Préparer mon aventure' });
  const say = process.env.PHRASE || 'Trois jours de randonnée dans le massif des Bauges en juin, à deux';
  for (let k = 0; k < 5 && !(await go.isEnabled().catch(() => false)); k += 1) {
    await box.fill('');
    await box.pressSequentially(say, { delay: 10 });
    await page.waitForTimeout(1500);
  }
  await go.click({ timeout: 30_000 });
  await page
    .getByText(/Ton aventure est prête|Préparation interrompue|Préparation arrêtée/)
    .first()
    .waitFor({ timeout: 330_000 });
}

const results = [];
for (const surface of SURFACES) {
  for (let run = 0; run < RUNS + 1; run += 1) {
    // Premier passage = préchauffage (fonction froide, caches CDN) : mesuré mais exclu des stats.
    const page = await newPage();
    const t0 = Date.now();
    let error = null;
    try {
      await page.goto(`${base}${surface}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      // Certaines surfaces gardent des connexions ouvertes : `load` plafonné, jamais bloquant.
      await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(THROTTLE ? 4000 : 2000);
    } catch (e) {
      error = String(e).slice(0, 200);
    }
    // Lecture plafonnée : une page qui sature le fil principal (carte WebGL logicielle) ne bloque pas la mesure.
    const m = await Promise.race([
      page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return {
          ttfb: nav ? nav.responseStart : null,
          domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
          load: nav ? nav.loadEventEnd : null,
          fcp: fcp ? fcp.startTime : null,
          lcp: window.__perf?.lcp || null,
          // Contenu réellement visible : effacement de l'écran de démarrage s'il existe, sinon LCP.
          visible: window.__perf?.hadBoot ? window.__perf.bootGone : window.__perf?.lcp || null,
          cls: window.__perf?.cls ?? null,
          // Octets JS réellement transférés (compressés), scripts du document et chargés ensuite.
          jsBytes: performance
            .getEntriesByType('resource')
            // Jusqu'à la fin du chargement : exclut les préchargements des pages suivantes.
            .filter((r) => (r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name)) && (!nav || r.startTime <= nav.loadEventEnd))
            .reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0),
          finalPath: location.pathname,
        };
      }),
      new Promise((resolve) => setTimeout(() => resolve({ error: 'metrics-timeout' }), 20_000)),
    ]).catch(() => ({}));
    results.push({ surface, run, warmup: run === 0, wallMs: Date.now() - t0, error, ...m });
    await page.__ctx.close();
  }
}
await browser.close();

fs.writeFileSync(path.join(outDir, 'measures.json'), JSON.stringify({ base, throttle: THROTTLE, runs: RUNS, at: new Date().toISOString(), results }, null, 2));

const q = (arr, p) => {
  const s = arr.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return null;
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]);
};
console.info(`\n${base} — ${THROTTLE ? 'mobile ralenti (CPU ×4, 150 ms, 1,6 Mbit/s)' : 'sans ralentissement'} — ${RUNS} passages (hors préchauffage)`);
console.info('surface      | TTFB méd/p75 | FCP méd/p75 | LCP méd/p75 | visible méd/p75 | CLS max | JS Ko | arrivée');
for (const surface of SURFACES) {
  const rs = results.filter((r) => r.surface === surface && !r.warmup && !r.error);
  const row = [
    surface.padEnd(12),
    `${q(rs.map((r) => r.ttfb), 0.5)}/${q(rs.map((r) => r.ttfb), 0.75)}`.padStart(12),
    `${q(rs.map((r) => r.fcp), 0.5)}/${q(rs.map((r) => r.fcp), 0.75)}`.padStart(11),
    `${q(rs.map((r) => r.lcp), 0.5)}/${q(rs.map((r) => r.lcp), 0.75)}`.padStart(11),
    `${q(rs.map((r) => r.visible), 0.5)}/${q(rs.map((r) => r.visible), 0.75)}`.padStart(15),
    String(Math.max(0, ...rs.map((r) => r.cls ?? 0)).toFixed(3)).padStart(7),
    String(Math.round((q(rs.map((r) => r.jsBytes), 0.5) ?? 0) / 1024)).padStart(5),
    rs[0]?.finalPath ?? 'échec',
  ];
  console.info(row.join(' | '));
}
