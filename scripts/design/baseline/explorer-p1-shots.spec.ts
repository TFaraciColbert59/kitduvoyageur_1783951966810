import { test, type Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * QA visuelle P1 — collisions Explorer/carte (« après »).
 *
 * Protocole cookies (exigé P1 : le bandeau masquait la bottom pill en P0) :
 * consentement mocké en localStorage AVANT navigation (même clé/version que
 * `tests/visual/_helpers/prepareVisualPage.ts`) + repli dismiss (clic
 * « Refuser ») si le bandeau apparaît malgré tout. Aucune capture ne doit
 * montrer le bandeau cookies.
 *
 * Contexte navigateur NEUF par viewport (cache/état isolés) — un contexte
 * réutilisé servait des chunks périmés entre viewports.
 *
 * Matrice exacte : 393×852 · 430×932 · 412×915 · 1440×900, route /explorer,
 * JPEG q72 DPR 1, dans `docs/qa/final-ios27/phase-explorer/` (+ manifest).
 * Serveur attendu : `next dev -p 4028` (PW_BASE_URL) avec
 * NATIVE_TABBAR_ENABLED=false, comme la baseline P0.
 */

const VIEWPORTS = [
  { slug: 'explorer-393x852', width: 393, height: 852 },
  { slug: 'explorer-430x932', width: 430, height: 932 },
  { slug: 'explorer-412x915', width: 412, height: 915 },
  { slug: 'explorer-1440x900', width: 1440, height: 900 },
];

const OUT_DIR = path.join(process.cwd(), 'docs', 'qa', 'final-ios27', 'phase-explorer');

async function captureOne(browser: Browser, vp: { slug: string; width: number; height: number }) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.width < 768,
    hasTouch: vp.width < 768,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  // Consentement posé avant toute navigation : pas de bandeau dans les captures.
  await context.addInitScript(() => {
    localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
    );
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err: Error) => consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const file = path.join(OUT_DIR, `${vp.slug}.jpg`);
  let finalUrl = '';
  let title = '';
  let bannerVisible: boolean | null = null;
  let screenshot = '';
  try {
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Moteur legacy (Leaflet) par défaut — un moteur DOIT être monté.
    await page
      .waitForSelector('.leaflet-container, [data-testid="unified-explorer-map"]', { timeout: 45_000 })
      .catch(() => {});
    await page
      .waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 20_000 })
      .catch(() => {});
    // Repli dismiss : si le bandeau subsiste, le refuser avant la capture.
    const banner = page.getByRole('region', { name: 'Gestion des cookies' });
    if (await banner.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Refuser' }).first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    bannerVisible = await banner.isVisible().catch(() => false);
    await page.waitForTimeout(2800);
    finalUrl = page.url();
    title = await page.title();
    await page.screenshot({ path: file, type: 'jpeg', quality: 72, animations: 'disabled' });
    screenshot = path.relative(process.cwd(), file).split(path.sep).join('/');
  } catch (error) {
    consoleErrors.push(`capture: ${(error as Error).message.slice(0, 300)}`);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    await context.close();
  }
  return {
    slug: vp.slug,
    route: '/explorer',
    viewport: `${vp.width}x${vp.height}`,
    finalUrl,
    title,
    cookieBannerVisible: bannerVisible,
    consoleErrors,
    screenshot,
  };
}

test('P1 explorer — captures après (consent mocké, 4 viewports)', async ({ browser }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shots: Array<Record<string, unknown>> = [];
  for (const vp of VIEWPORTS) {
    shots.push(await captureOne(browser, vp));
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest-p1.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), shots }, null, 2)
  );

  // Gardes P1 : le bandeau cookies ne doit apparaître sur AUCUNE capture,
  // et chaque viewport doit avoir produit son fichier.
  for (const shot of shots) {
    if (shot.cookieBannerVisible === true) throw new Error(`bandeau cookies visible sur ${shot.slug}`);
    if (!shot.screenshot) throw new Error(`capture manquante : ${shot.slug}`);
  }
});
