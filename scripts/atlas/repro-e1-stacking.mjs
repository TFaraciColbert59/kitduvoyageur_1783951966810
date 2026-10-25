/**
 * E1 — Contrôles carte inutilisables sous le carrousel mobile : reproduction + preuve.
 *
 * Mesure brute (`elementFromPoint`) et taps réels Playwright aux centres de :
 *   - zoom « + » / zoom « − » (colonne droite du moteur ATLAS) ;
 *   - « Préparer » de la 1re carte du carrousel ;
 *   - CTA mobile « Explorer ma zone (vue locale) ».
 * Puis : tap réel zoom + → `window.__atlasTestMap.getZoom()` doit augmenter ;
 *        tap réel CTA → bascule globe ⇄ local (aria-label) ;
 *        tap réel « Préparer » → navigation /hub/depart.
 *
 * Prérequis : serveur DEV sur BASE_URL (le hook `__atlasTestMap` est dev-only).
 *   npm run dev   (port 4000)
 *
 * Usage :
 *   node scripts/atlas/repro-e1-stacking.mjs --phase=avant
 *   node scripts/atlas/repro-e1-stacking.mjs --phase=apres
 *
 * Sorties : docs/explorer-mobile/e1-<phase>.json + e1-<phase>.png + variantes par taille.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const phaseArg = process.argv.find((arg) => arg.startsWith('--phase='));
const PHASE = (phaseArg ? phaseArg.split('=')[1] : 'avant').toLowerCase();
const DOCS_DIR = path.join(process.cwd(), 'docs', 'explorer-mobile');
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
];

fs.mkdirSync(DOCS_DIR, { recursive: true });

async function tryTap(locator, timeout = 4_000) {
  try {
    await locator.tap({ timeout });
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).split('\n').slice(0, 3).join(' | ') };
  }
}

/** Sonde DOM exécutée dans la page : mesure tout ce qui sert au diagnostic E1. */
function collectProbe() {
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x * 10) / 10,
      y: Math.round(r.y * 10) / 10,
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
      top: Math.round(r.top * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      bottom: Math.round(r.bottom * 10) / 10,
      left: Math.round(r.left * 10) / 10,
    };
  };
  const describe = (el) => {
    if (!el) return null;
    return {
      tag: el.tagName,
      testid: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
      dataTrailId: el.getAttribute('data-trail-id'),
      classes: String(el.className || '').slice(0, 240),
      text: (el.textContent || '').trim().slice(0, 60),
    };
  };
  const styleOf = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      position: s.position,
      zIndex: s.zIndex,
      bottom: s.bottom,
      left: s.left,
      right: s.right,
      pointerEvents: s.pointerEvents,
      overflowX: s.overflowX,
      overflowY: s.overflowY,
    };
  };
  const stackingChain = (el) => {
    const chain = [];
    let node = el;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      if (s.position !== 'static' && s.zIndex !== 'auto') {
        chain.push({
          tag: node.tagName,
          testid: node.getAttribute('data-testid'),
          classes: String(node.className || '').slice(0, 140),
          position: s.position,
          zIndex: s.zIndex,
        });
      }
      node = node.parentElement;
    }
    return chain;
  };
  const probeAt = (target, label) => {
    if (!target) return { label, missing: true };
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const stack = document.elementsFromPoint(x, y);
    const top = stack[0] ?? null;
    const hitTestPass = top === target || (top ? target.contains(top) : false);
    return {
      label,
      point: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
      targetRect: rectOf(target),
      target: describe(target),
      hitTestPass,
      topmostIsTarget: top === target,
      topmostWithinTarget: top ? target.contains(top) : false,
      targetContainsTopmost: top ? top.contains(target) : false,
      topmost: describe(top),
      stackTop6: stack.slice(0, 6).map(describe),
      targetStackingChain: stackingChain(target),
    };
  };

  const zoomIn = document.querySelector('[aria-label="Zoom avant"]');
  const zoomOut = document.querySelector('[aria-label="Zoom arrière"]');
  const firstCard = document.querySelector('[data-trail-id]');
  const prepareBtn = firstCard
    ? Array.from(firstCard.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Préparer')
      )
    : null;
  const carouselScroller = firstCard ? firstCard.parentElement : null;
  let carouselWrapper = carouselScroller;
  while (carouselWrapper && getComputedStyle(carouselWrapper).position !== 'fixed') {
    carouselWrapper = carouselWrapper.parentElement;
  }
  const ctaWrap = document.querySelector('[data-atlas-primary-cta="mobile"]');
  const ctaButton = ctaWrap ? ctaWrap.querySelector('button') : null;
  const zoomColumn = document.querySelector('[data-atlas-controls="right"]');
  const mapRoot = document.querySelector('[data-testid="unified-explorer-map"]');
  const mapParent = mapRoot ? mapRoot.parentElement : null;

  const rectVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom <= innerHeight + 1 && r.top >= -1;
  };

  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    url: location.href,
    carouselCardCount: document.querySelectorAll('[data-trail-id]').length,
    probes: [
      probeAt(zoomIn, 'zoom+'),
      probeAt(zoomOut, 'zoom-'),
      prepareBtn && rectVisible(prepareBtn) ? probeAt(prepareBtn, 'preparer') : { label: 'preparer', missing: !prepareBtn, offscreen: Boolean(prepareBtn) },
      ctaButton && rectVisible(ctaButton) ? probeAt(ctaButton, 'cta-mobile') : { label: 'cta-mobile', missing: !ctaButton, offscreen: Boolean(ctaButton) },
    ],
    boxes: {
      carouselWrapper: carouselWrapper
        ? { rect: rectOf(carouselWrapper), style: styleOf(carouselWrapper), inlineStyle: carouselWrapper.getAttribute('style') }
        : null,
      carouselScroller: carouselScroller ? { rect: rectOf(carouselScroller), style: styleOf(carouselScroller) } : null,
      firstCard: firstCard ? { rect: rectOf(firstCard), style: styleOf(firstCard) } : null,
      ctaWrapper: ctaWrap ? { rect: rectOf(ctaWrap), style: styleOf(ctaWrap) } : null,
      ctaButton: ctaButton ? { rect: rectOf(ctaButton), style: styleOf(ctaButton) } : null,
      zoomColumn: zoomColumn ? { rect: rectOf(zoomColumn), style: styleOf(zoomColumn) } : null,
    },
    mapRoot: mapRoot
      ? {
          rect: rectOf(mapRoot),
          style: styleOf(mapRoot),
          parent: mapParent
            ? { classes: String(mapParent.className || '').slice(0, 200), style: styleOf(mapParent) }
            : null,
        }
      : null,
    cssVars: {
      explorerCarouselHeight: getComputedStyle(document.documentElement)
        .getPropertyValue('--explorer-carousel-height')
        .trim(),
      bottomTabBaseHeight: getComputedStyle(document.documentElement)
        .getPropertyValue('--bottom-tab-base-height')
        .trim(),
    },
  };
}

const browser = await chromium.launch();
const run = {
  phase: PHASE,
  baseUrl: BASE_URL,
  startedAt: new Date().toISOString(),
  viewports: [],
  pageErrors: [],
};

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    geolocation: { latitude: 50.784, longitude: 2.666 },
    permissions: ['geolocation'],
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    } catch {
      /* stockage indisponible — le bandeau sera accepté par clic */
    }
  });
  const page = await context.newPage();
  const entry = { name: viewport.name, ...viewport, pageErrors: [] };
  page.on('pageerror', (error) => {
    entry.pageErrors.push(error.message);
    run.pageErrors.push(`${viewport.name}: ${error.message}`);
  });

  await page.goto(`${BASE_URL}/explorer?atlas=1`, { waitUntil: 'domcontentloaded' });

  const acceptCookies = page.getByRole('button', { name: 'Tout accepter' });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click().catch(() => {});
  }

  await page.waitForSelector('[data-testid="unified-explorer-map"][data-atlas-ready="true"]', {
    timeout: 90_000,
  });

  // Plongée vers la vue locale : tap réel, repli DOM si recouvert (preuve E1).
  const cta = page.locator('[data-atlas-primary-cta="mobile"] button');
  entry.dive = await tryTap(cta, 4_000);
  if (!entry.dive.ok) {
    entry.dive.forcedDomClick = true;
    await cta.evaluate((el) => el.click());
  } else {
    entry.dive.forcedDomClick = false;
  }

  await page.waitForSelector('[data-trail-id]', { timeout: 30_000 });
  await page.waitForTimeout(2_400); // fin du vol de plongée (1 600 ms) + stabilisation

  entry.measurements = await page.evaluate(collectProbe);
  entry.screenshot = path.join(DOCS_DIR, `e1-${PHASE}-${viewport.name}.png`);
  await page.screenshot({ path: entry.screenshot });

  const readZoom = async () => {
    try {
      return await page.evaluate(() =>
        window.__atlasTestMap ? window.__atlasTestMap.getZoom() : null
      );
    } catch {
      return null;
    }
  };

  // Tap réel zoom + → le zoom doit augmenter (critère n°4 du brief).
  const zoomInLocator = page.locator('[aria-label="Zoom avant"]');
  const zoomBefore = await readZoom();
  entry.zoomTap = await tryTap(zoomInLocator, 4_000);
  await page.waitForTimeout(600);
  const zoomAfter = await readZoom();
  entry.zoom = { before: zoomBefore, after: zoomAfter, worked: entry.zoomTap.ok && zoomBefore != null && zoomAfter != null && zoomAfter > zoomBefore + 0.3 };

  // Tap réel CTA → bascule globe ⇄ local (aller-retour, aria-label).
  const label0 = await cta.getAttribute('aria-label').catch(() => null);
  entry.ctaToggle = { labelStart: label0, taps: [], labels: [label0] };
  const toggleTap1 = await tryTap(cta, 4_000);
  await page.waitForTimeout(2_100);
  const label1 = await cta.getAttribute('aria-label').catch(() => null);
  entry.ctaToggle.taps.push(toggleTap1);
  entry.ctaToggle.labels.push(label1);
  const toggleTap2 = await tryTap(cta, 4_000);
  await page.waitForTimeout(1_600);
  const label2 = await cta.getAttribute('aria-label').catch(() => null);
  entry.ctaToggle.taps.push(toggleTap2);
  entry.ctaToggle.labels.push(label2);
  entry.ctaToggle.worked =
    toggleTap1.ok &&
    toggleTap2.ok &&
    ((label0?.includes('Explorer ma zone') && label1?.includes('Afficher le globe') && label2?.includes('Explorer ma zone')) ||
      (label0?.includes('Afficher le globe') && label1?.includes('Explorer ma zone') && label2?.includes('Afficher le globe')));

  // Tap réel « Préparer » de la 1re carte → navigation /hub/depart.
  const prepare = page.locator('[data-trail-id]').first().getByRole('button', { name: 'Préparer' });
  entry.prepareTap = await tryTap(prepare, 5_000);
  if (entry.prepareTap.ok) {
    try {
      await page.waitForURL(/\/hub\/depart\?/, { timeout: 10_000 });
      entry.prepareTap.navigated = true;
      entry.prepareTap.url = page.url();
    } catch {
      entry.prepareTap.navigated = false;
      entry.prepareTap.url = page.url();
    }
  } else {
    entry.prepareTap.navigated = false;
  }

  run.viewports.push(entry);
  console.log(
    `\n[${PHASE}] ${viewport.name} — probes: ${entry.measurements.probes
      .map((p) => `${p.label}=${p.missing ? 'absent' : p.hitTestPass ? 'OK' : `COUVERT par ${p.topmost?.tag}.${String(p.topmost?.classes || '').split(' ')[0]}`}`)
      .join(' | ')}`
  );
  console.log(
    `[${PHASE}] ${viewport.name} — diveTap=${entry.dive.ok} zoomTap=${entry.zoomTap.ok} zoom=${zoomBefore}→${zoomAfter} (worked=${entry.zoom.worked}) ctaToggle=${entry.ctaToggle.worked} prepareTap=${entry.prepareTap.ok} navigated=${entry.prepareTap.navigated}`
  );

  await context.close();
}

run.finishedAt = new Date().toISOString();
const jsonPath = path.join(DOCS_DIR, `e1-${PHASE}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(run, null, 2), 'utf8');

// Copie normalisée exigée par le brief (390×844 = référence).
const ref = path.join(DOCS_DIR, `e1-${PHASE}-390x844.png`);
const main = path.join(DOCS_DIR, `e1-${PHASE}.png`);
if (fs.existsSync(ref)) fs.copyFileSync(ref, main);

console.log(`\nJSON  : ${jsonPath}`);
console.log(`PNG   : ${main}`);
console.log(`Erreurs page : ${JSON.stringify(run.pageErrors)}`);

await browser.close();
