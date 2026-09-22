import { test, type Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * QA visuelle P2 — routes Communauté (« avant » puis « après »).
 *
 * Protocole cookies (exigé P0/P1 : le bandeau masquait la bottom pill) :
 * consentement mocké en localStorage AVANT navigation (même clé/version que
 * `tests/visual/_helpers/prepareVisualPage.ts`) + repli dismiss (clic
 * « Refuser ») si le bandeau apparaît malgré tout. Aucune capture ne doit
 * montrer le bandeau cookies.
 *
 * Contexte navigateur NEUF par capture (cache/état isolés).
 *
 * Phase pilotée par env : P2_PHASE=avant|apres (défaut : avant).
 * Matrice exacte : 393×852 · 430×932 · 412×915 · 1440×900,
 * routes /communaute · /clubs · /avis, JPEG q72 DPR 1,
 * dans `docs/qa/final-ios27/phase-communaute/<phase>/` (+ manifest).
 * Serveur attendu : `next dev -p 4028` (PW_BASE_URL) avec
 * NATIVE_TABBAR_ENABLED=false, comme les baselines P0/P1.
 *
 * Exécution (une seule fois, projet neutre) :
 *   PW_BASE_URL=http://localhost:4028 P2_PHASE=avant npx playwright test \
 *     --config=playwright.baseline.config.ts --project=desktop-1440 \
 *     scripts/design/baseline/communaute-p2-shots.spec.ts
 */

const PHASE = process.env.P2_PHASE === 'apres' ? 'apres' : 'avant';

const VIEWPORTS = [
  { slug: '393x852', width: 393, height: 852 },
  { slug: '430x932', width: 430, height: 932 },
  { slug: '412x915', width: 412, height: 915 },
  { slug: '1440x900', width: 1440, height: 900 },
];

const ROUTES = [
  { slug: 'communaute', path: '/communaute', ready: 'Communauté' },
  { slug: 'clubs', path: '/clubs', ready: 'Club' },
  { slug: 'avis', path: '/avis', ready: 'avis de la communauté' },
];

const OUT_DIR = path.join(process.cwd(), 'docs', 'qa', 'final-ios27', 'phase-communaute', PHASE);

async function captureOne(
  browser: Browser,
  route: { slug: string; path: string; ready: string },
  vp: { slug: string; width: number; height: number }
) {
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

  const file = path.join(OUT_DIR, `${route.slug}-${vp.slug}.jpg`);
  let finalUrl = '';
  let title = '';
  let bannerVisible: boolean | null = null;
  let screenshot = '';
  try {
    await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Contenu route : meilleur effort, jamais bloquant (états vides acceptés).
    await page
      .getByRole('heading', { name: route.ready })
      .first()
      .waitFor({ timeout: 20_000 })
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
    slug: `${route.slug}-${vp.slug}`,
    route: route.path,
    viewport: `${vp.width}x${vp.height}`,
    finalUrl,
    title,
    cookieBannerVisible: bannerVisible,
    consoleErrors,
    screenshot,
  };
}

test(`P2 communaute — captures ${PHASE} (consent mocké, 3 routes x 4 viewports)`, async ({
  browser,
}) => {
  // 12 captures (compil dev à froid sur 3 routes) : budget large, P1 = 4 captures.
  test.setTimeout(540_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shots: Array<Record<string, unknown>> = [];
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      shots.push(await captureOne(browser, route, vp));
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, '..', `manifest-p2-${PHASE}.json`),
    JSON.stringify({ phase: PHASE, capturedAt: new Date().toISOString(), shots }, null, 2)
  );

  // Gardes P2 : le bandeau cookies ne doit apparaître sur AUCUNE capture,
  // et chaque route x viewport doit avoir produit son fichier.
  for (const shot of shots) {
    if (shot.cookieBannerVisible === true)
      throw new Error(`bandeau cookies visible sur ${shot.slug}`);
    if (!shot.screenshot) throw new Error(`capture manquante : ${shot.slug}`);
  }
});
