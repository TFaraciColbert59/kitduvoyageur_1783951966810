import { test, type Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * QA visuelle P4 — balayage global tokens (« avant » / « après »).
 *
 * Protocole cookies (exigé) : consentement mocké en localStorage AVANT
 * navigation (même clé/version que `prepareVisualPage` et les specs P1/P3)
 * + repli dismiss (clic « Refuser ») si le bandeau apparaît malgré tout.
 * Aucune capture ne doit montrer le bandeau.
 *
 * Contexte navigateur NEUF par capture (cache/état isolés).
 * Matrice minimale exigée : 393×852 · 1440×900, JPEG q72 DPR 1,
 * dans `docs/qa/final-ios27/phase-tokens/<stage>/` (+ manifest).
 * Serveur attendu : `next dev -p 4028` relancé à neuf,
 * avec NATIVE_TABBAR_ENABLED=false.
 *
 * Usage :
 *   P4_STAGE=avant  npx playwright test --config=playwright.visual.config.ts scripts/design/baseline/phase-tokens-p4-shots.spec.ts
 *   P4_STAGE=apres  npx playwright test --config=playwright.visual.config.ts scripts/design/baseline/phase-tokens-p4-shots.spec.ts
 */

const STAGE = process.env.P4_STAGE === 'apres' ? 'apres' : 'avant';

const ROUTES = [
  { slug: 'recompenses', path: '/recompenses' },
  { slug: 'evenements', path: '/evenements' },
  { slug: 'feed', path: '/feed' },
  { slug: 'rapport-expedition', path: '/rapport-expedition' },
];

const VIEWPORTS = [
  { slug: '393x852', width: 393, height: 852 },
  { slug: '1440x900', width: 1440, height: 900 },
];

const OUT_DIR = path.join(process.cwd(), 'docs', 'qa', 'final-ios27', 'phase-tokens', STAGE);

async function captureOne(
  browser: Browser,
  route: { slug: string; path: string },
  vp: { slug: string; width: number; height: number },
) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.width < 768,
    hasTouch: vp.width < 768,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
      );
    } catch {
      /* origine opaque (about:blank) : le repli dismiss ci-dessous prend le relais */
    }
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err: Error) => consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const file = path.join(OUT_DIR, `${route.slug}-${vp.slug}.jpg`);
  let finalUrl = '';
  let title = '';
  let bannerVisible: boolean | null = null;
  let screenshot = '';
  try {
    await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);
    const banner = page.getByRole('region', { name: 'Gestion des cookies' });
    if (await banner.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Refuser' }).first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    bannerVisible = await banner.isVisible().catch(() => false);
    await page.waitForTimeout(800);
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
    slug: `${route.slug}-${vp.slug}`,
    route: route.path,
    viewport: vp.slug,
    finalUrl,
    title,
    cookieBannerVisible: bannerVisible,
    consoleErrors,
    screenshot,
  };
}

test(`P4 tokens — captures ${STAGE} (consent mocké, 4 routes x 2 viewports)`, async ({ browser }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shots: Array<Record<string, unknown>> = [];
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      shots.push(await captureOne(browser, route, vp));
    }
  }

  const consoleErrorCount = shots.reduce(
    (n, s) => n + (s.consoleErrors as string[]).length,
    0,
  );
  fs.writeFileSync(
    path.join(OUT_DIR, `manifest-p4-${STAGE}.json`),
    JSON.stringify(
      { capturedAt: new Date().toISOString(), stage: STAGE, consoleErrorCount, shots },
      null,
      2,
    ),
  );

  for (const shot of shots) {
    if (shot.cookieBannerVisible === true) throw new Error(`bandeau cookies visible sur ${shot.slug}`);
    if (!shot.screenshot) throw new Error(`capture manquante : ${shot.slug}`);
  }
  if (consoleErrorCount > 0) throw new Error(`${consoleErrorCount} erreur(s) console (voir manifest-p4-${STAGE}.json)`);
});
