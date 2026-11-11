import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import {
  freezeClock,
  horizontalOverflow,
  installCommunityV2Mock,
  waitForHydration,
} from './communaute-v2.fixtures';

/**
 * Recette Playwright du hub `/carnets` (lot L4 « Carnets de bord »).
 *
 * Le serveur Next est celui du banc de fidélité : build fixtures
 * (`tests/fidelity/build.sh`) + `tests/fidelity/server/fixture-supabase.cjs`
 * (carnets en route / préparation / rentré, avec et sans photo, pays, likes,
 * moments photos, suivis du lecteur). Le navigateur est simulé par
 * `installCommunityV2Mock` (aucune requête ne sort, aucune base réelle).
 *
 * Config : `tests/fidelity/hub.config.ts` (4 projets : 390×844 et 430×932,
 * clair et sombre). Captures : `docs/audit/carnets-hub-2026-11-11/`.
 *
 * Ce que la spec prouve, pour chaque taille et chaque thème :
 * 1. `/carnets` rend le titre, la capsule de filtres, la bande « En route
 *    maintenant » et les cartes du fixture (photo, mosaïque, tampon pays) ;
 * 2. chaque filtre répond, « Suivis »/« Les miens » sont vides pour un visiteur
 *    (état vide, jamais un écran muet) ;
 * 3. le j'aime envoie bien POST/DELETE `carnet_likes` et met à jour le compteur ;
 * 4. ouvrir une carte mène à la fiche `/carnets/{id}` qui rend sans erreur ;
 * 5. la lentille Équipage › Suivre affiche progression, battements et résumé du
 *    soir (lot L2) sans casser la fiche ;
 * 6. cibles tactiles ≥ 44 px, aucun débordement horizontal, contraste AA du
 *    titre de couverture sur la photo (voile), console propre, réseau sans
 *    4xx/5xx évitables.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolvePath(HERE, '../..');
const SHOTS = join(REPO, 'docs/audit/carnets-hub-2026-11-11');
const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' });

/** Carnet « Tour des Écrans » de la fiche (scénarios existants du banc). */
const CARNET_ID = '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
/** Carnets du hub servis par le fixture serveur. */
const EN_ROUTE_ID = '00000000-0000-4000-8000-00000000a001';
const EN_ROUTE_PHOTOS_ID = '00000000-0000-4000-8000-00000000a002';
const MINE_ID = '00000000-0000-4000-8000-00000000a006';

/**
 * Bruit de harnais connu, hors périmètre du hub : sur la fiche Carnet (surface
 * livrée avant ce lot), le profil d'altitude décode des tuiles DEM ; le harnais
 * de recette répond aux images externes par un GIF 1×1, d'où ce message console
 * (`createImageBitmap`). Constaté aussi dans le banc de fidélité, qui ne teste
 * pas la console. On l'ignore UNIQUEMENT après navigation vers la fiche ; le hub
 * lui-même est vérifié console vide sans filtre.
 */
const HARNESS_IMAGE_DECODE = /source image could not be decoded/;

/** Ce que la scène doit montrer d'après le fixture (jamais recopié de l'écran). */
const EXPECTED = {
  route: 2,
  followed: 3,
  world: 8,
  mine: 3,
};

type HubRole = 'member' | 'anonymous';

interface OpenedHub {
  mock: Awaited<ReturnType<typeof installCommunityV2Mock>>;
  badResponses: string[];
}

function isShotDisabled(): boolean {
  return process.env.HUB_SKIP_SHOTS === '1';
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (isShotDisabled()) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: join(SHOTS, `${name}-${testInfo.project.name}.png`),
    animations: 'disabled',
    caret: 'hide',
  });
}

/** Traque les réponses 4xx/5xx évitables (documents, xhr et fetch). */
function trackBadResponses(page: Page): string[] {
  const bad: string[] = [];
  page.on('response', (response) => {
    const type = response.request().resourceType();
    if (!['document', 'xhr', 'fetch'].includes(type)) return;
    if (response.status() >= 400) {
      const url = new URL(response.url());
      bad.push(`${response.status()} ${response.request().method()} ${url.origin}${url.pathname}`);
    }
  });
  return bad;
}

async function openHub(
  page: Page,
  baseURL: string,
  options: { role?: HubRole; clock?: boolean; clockTime?: string; path?: string } = {},
): Promise<OpenedHub> {
  const origin = new URL(baseURL).origin;
  const mock = await installCommunityV2Mock(page, {
    role: options.role ?? 'member',
    appOrigin: origin,
  });
  await page.addInitScript((value) => localStorage.setItem('lkdv_cookie_consent', value), CONSENT);
  // `clockTime` : horloge figée à une date précise (comme le banc carnet) ;
  // `clock` seul = FIXED_NOW des fixtures Communauté (2026-11-08).
  if (options.clockTime) await page.clock.install({ time: new Date(options.clockTime) });
  else if (options.clock) await freezeClock(page);
  const badResponses = trackBadResponses(page);
  await page.goto(options.path ?? `${origin}/carnets`, { waitUntil: 'domcontentloaded' });
  return { mock, badResponses };
}

/** Ouvre le hub de la recette et attend l'écran rendu (filtres hydratés). */
async function openRenderedHub(
  page: Page,
  baseURL: string,
  options: { role?: HubRole; clock?: boolean; clockTime?: string; path?: string } = {},
): Promise<OpenedHub> {
  const opened = await openHub(page, baseURL, options);
  await page.locator('[data-testid="lkdh-filter-route"]').first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await page.waitForLoadState('load').catch(() => undefined);
  await waitForHydration(page, '[data-testid="lkdh-filter-route"]');
  await page.waitForTimeout(250);
  return opened;
}

function filterButton(page: Page, id: string) {
  return page.locator(`[data-testid="lkdh-filter-${id}"]`);
}

function cards(page: Page) {
  return page.locator('[data-testid="lkdh-carnet"]');
}

async function selectFilter(page: Page, id: string): Promise<void> {
  await filterButton(page, id).click();
  await expect(filterButton(page, id)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(150);
}

/* ── Contraste AA du texte sur la photo (voile) ───────────────────────────── */

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Contraste réel du titre de couverture : capture de la carte, puis luminance
 * des pixels dans la boîte du titre. Le fond du voile est la médiane (le texte
 * n'occupe qu'une minorité de la boîte) ; le texte est le 95ᵉ centile.
 */
async function coverTitleContrast(page: Page): Promise<{ ratio: number; fontSize: number }> {
  const cover = page.locator('.lkdh-cover').first();
  const title = page.locator('.lkdh-cover-title').first();
  await cover.scrollIntoViewIfNeeded();
  const [coverBox, titleBox] = await Promise.all([cover.boundingBox(), title.boundingBox()]);
  if (!coverBox || !titleBox) throw new Error('cover/title introuvables pour le contraste');
  const shot = await cover.screenshot({ animations: 'disabled', caret: 'hide' });
  const png = PNG.sync.read(shot);
  const x0 = Math.max(0, Math.round(titleBox.x - coverBox.x));
  const y0 = Math.max(0, Math.round(titleBox.y - coverBox.y));
  const x1 = Math.min(png.width, Math.round(x0 + titleBox.width));
  const y1 = Math.min(png.height, Math.round(y0 + titleBox.height));
  const luminances: number[] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * png.width + x) * 4;
      const a = png.data[index + 3];
      if (a < 250) continue;
      luminances.push(
        relativeLuminance(png.data[index], png.data[index + 1], png.data[index + 2]),
      );
    }
  }
  if (luminances.length === 0) throw new Error('aucun pixel opaque dans la boîte du titre');
  luminances.sort((a, b) => a - b);
  const background = luminances[Math.floor(luminances.length * 0.5)];
  const text = luminances[Math.min(luminances.length - 1, Math.floor(luminances.length * 0.95))];
  const fontSize = Number.parseFloat(
    await title.evaluate((element) => getComputedStyle(element).fontSize),
  );
  return { ratio: contrastRatio(text, background), fontSize };
}

/* ── Tests ────────────────────────────────────────────────────────────────── */

test.describe('hub /carnets — rendu, filtres, j’aime, carte', () => {
  test('rendu du hub : titre, filtres, bande en route, cartes, cibles et contraste', async ({
    page,
    baseURL,
  }, testInfo) => {
    const { mock, badResponses } = await openRenderedHub(page, baseURL as string);

    // En-tête et capsule de filtres (maquette écran 1).
    await expect(page.locator('.lkdh-eyebrow').first()).toHaveText('Carnets de bord');
    await expect(page.locator('h1.lkdh-title')).toContainText('aventures');
    await expect(filterButton(page, 'route')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid^="lkdh-filter-"]')).toHaveCount(4);

    // Bande « En route maintenant » : seulement les carnets en cours.
    const liveBand = page.locator('[data-testid="lkdh-live-band"]');
    await expect(liveBand).toBeVisible();
    await expect(page.locator('[data-testid="lkdh-live-mini"]')).toHaveCount(EXPECTED.route);
    await expect(page.locator(`[data-testid="lkdh-live-mini"][data-id="${EN_ROUTE_ID}"]`)).toContainText(
      /En route · J4 sur 9/,
    );

    // Filtre d'ouverture « En route » : les deux carnets du fixture.
    await expect(cards(page)).toHaveCount(EXPECTED.route);
    for (const card of await cards(page).all()) {
      await expect(card).toHaveAttribute('data-phase', 'en_route');
    }

    // Carte à photo : titre, tampon pays, pastille vivante, métriques, j'aime.
    const photoCard = page.locator(`[data-testid="lkdh-carnet"][data-id="${EN_ROUTE_ID}"]`);
    await expect(photoCard.locator('.lkdh-cover-title')).toHaveText('Crêtes du Queyras, sans se presser');
    await expect(photoCard.locator('.lkdh-live')).toContainText(/En route · J4 sur 9/);
    await expect(photoCard.locator('.lkdh-stamp')).toContainText('FR');
    await expect(photoCard.locator('.lkdh-metrics')).toContainText('4/9');
    await expect(photoCard.locator('.lkdh-metrics')).toContainText('61');
    await expect(photoCard.locator('.lkdh-metrics')).toContainText('+4 120');
    await expect(photoCard.locator('.lkdh-foot-author')).toHaveText('par Nora Chevalier');
    await expect(photoCard.locator('[data-testid="lkdh-carnet-like"]')).toHaveAttribute(
      'aria-label',
      'Retirer mon j’aime : 128',
    );

    // Carte sans photo mais avec moments : mosaïque de repli (aucune image cassée).
    const mosaicCard = page.locator(`[data-testid="lkdh-carnet"][data-id="${EN_ROUTE_PHOTOS_ID}"]`);
    await expect(mosaicCard.locator('.lkdh-mosaic-cell')).toHaveCount(3);

    // Cibles tactiles ≥ 44 px (tokens --lkv-touch-min) et pas de débordement.
    const targets = await page.evaluate(() => {
      const measure = (selector: string) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 48),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
      return {
        filters: measure('[data-testid^="lkdh-filter-"]'),
        likes: measure('[data-testid="lkdh-carnet-like"]'),
        comments: measure('.lkdh-comments'),
        cta: measure('.lkdh-cta'),
      };
    });
    const tooSmall = Object.entries(targets).flatMap(([kind, list]) =>
      list
        .filter((target) => target.width < 44 || target.height < 44)
        .map((target) => `${kind} « ${target.label} » ${target.width}×${target.height}`),
    );
    expect(tooSmall, 'cibles tactiles < 44 px').toEqual([]);
    expect(await horizontalOverflow(page), 'débordement horizontal du hub').toBeLessThanOrEqual(0);

    // Contraste AA du titre sur photo (30 px = « grand texte » : seuil 3,0).
    const contrast = await coverTitleContrast(page);
    expect(contrast.fontSize, 'taille du titre de couverture').toBeGreaterThanOrEqual(24);
    expect(
      contrast.ratio,
      `contraste du titre sur la couverture : ${contrast.ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);

    await capture(page, testInfo, 'hub-accueil');

    expect(mock.consoleErrors, 'console navigateur propre').toEqual([]);
    expect(badResponses, 'réseau sans 4xx/5xx évitables').toEqual([]);
  });

  test('filtres : chaque onglet répond, « Suivis » et « Les miens » sont alimentés', async ({
    page,
    baseURL,
  }, testInfo) => {
    const { mock, badResponses } = await openRenderedHub(page, baseURL as string);

    await selectFilter(page, 'followed');
    await expect(cards(page)).toHaveCount(EXPECTED.followed);
    for (const card of await cards(page).all()) {
      const label = await card.locator('[data-testid="lkdh-carnet-link"]').getAttribute('aria-label');
      expect(label, 'carte des suivis : auteur suivi').toMatch(/par (Nora Chevalier|Léo Barbier)/);
    }
    await capture(page, testInfo, 'hub-filtre-suivis');

    await selectFilter(page, 'world');
    await expect(cards(page)).toHaveCount(EXPECTED.world);
    await capture(page, testInfo, 'hub-filtre-monde');

    await selectFilter(page, 'mine');
    await expect(cards(page)).toHaveCount(EXPECTED.mine);
    await expect(page.locator(`[data-testid="lkdh-carnet"][data-id="${MINE_ID}"]`)).toBeVisible();
    for (const card of await cards(page).all()) {
      await expect(card.locator('.lkdh-foot-author')).toHaveText('par Camille Rey');
    }
    await capture(page, testInfo, 'hub-filtre-miens');

    await selectFilter(page, 'route');
    await expect(cards(page)).toHaveCount(EXPECTED.route);
    await expect(page.locator('[data-testid="lkdh-empty"]')).toHaveCount(0);

    expect(mock.consoleErrors, 'console navigateur propre').toEqual([]);
    expect(badResponses, 'réseau sans 4xx/5xx évitables').toEqual([]);
  });

  test('sans session : le hub renvoie vers la connexion (route protégée)', async ({
    page,
    baseURL,
  }) => {
    // `/carnets` fait partie des routes d'app : le middleware exige une session.
    await openHub(page, baseURL as string, { role: 'signed-out' });
    await page.waitForURL(/\/connexion/, { timeout: 15_000 });
    expect(page.url()).toContain('next=%2Fcarnets');
    await expect(page.locator('body')).toContainText(/connexion|connecter/i);
  });
});

test.describe('hub /carnets — états vide et erreur (même build, serveur d’état)', () => {
  test('état vide : capsule et un message par filtre, aucun écran muet', async ({
    page,
  }, testInfo) => {
    const emptyBase = process.env.HUB_EMPTY_URL ?? 'http://127.0.0.1:4031';
    const { mock, badResponses } = await openRenderedHub(page, emptyBase);
    const empty = page.locator('[data-testid="lkdh-empty"]');

    // Sans le moindre carnet, l'ouverture tombe sur « Monde » et son état vide.
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator('[data-testid="lkdh-live-band"]')).toHaveCount(0);
    await expect(filterButton(page, 'world')).toHaveAttribute('aria-pressed', 'true');
    await expect(empty).toHaveAttribute('data-filter', 'world');
    await expect(empty.locator('h2')).toHaveText('Aucun carnet public à afficher');

    await selectFilter(page, 'route');
    await expect(empty).toHaveAttribute('data-filter', 'route');
    await expect(empty.locator('h2')).toHaveText('Aucun carnet en route pour le moment');
    // Le second geste de l'état « En route » ramène au filtre Monde.
    await page.getByRole('button', { name: 'Voir tous les carnets' }).click();
    await expect(filterButton(page, 'world')).toHaveAttribute('aria-pressed', 'true');

    await selectFilter(page, 'followed');
    await expect(empty.locator('h2')).toHaveText('Aucun carnet de vos suivis');
    await capture(page, testInfo, 'hub-etat-vide-suivis');

    await selectFilter(page, 'mine');
    await expect(empty.locator('h2')).toHaveText('Votre premier carnet vous attend');
    await capture(page, testInfo, 'hub-etat-vide-miens');

    expect(mock.consoleErrors, 'console navigateur propre').toEqual([]);
    expect(badResponses, 'réseau sans 4xx/5xx évitables').toEqual([]);
  });

  test('état erreur : alerte lisible et bouton « Réessayer » qui rejoue la lecture', async ({
    page,
  }, testInfo) => {
    const errorBase = process.env.HUB_ERROR_URL ?? 'http://127.0.0.1:4032';
    // État d'erreur : l'écran n'a pas de capsule de filtres, il n'y a donc rien
    // à attendre de ce côté — on attend l'alerte elle-même.
    const { mock, badResponses } = await openHub(page, errorBase);
    // `.lkdh-error` seul : `[role="alert"]` matche aussi l'annonceur de route Next.
    const alert = page.locator('section.lkdh-error[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert.locator('h2')).toHaveText('Les carnets n’ont pas pu être chargés');
    const retry = page.getByRole('button', { name: 'Réessayer' });
    await expect(retry).toBeVisible();
    await capture(page, testInfo, 'hub-etat-erreur');

    // Réessayer = `router.refresh()` : la lecture serveur est rejouée (toujours en
    // erreur ici) sans page blanche ni exception.
    await retry.click();
    await page.waitForTimeout(1_500);
    await expect(alert).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');

    expect(mock.consoleErrors, 'console navigateur propre').toEqual([]);
    expect(badResponses, 'réseau sans 4xx/5xx évitables').toEqual([]);
  });
});

test.describe('hub /carnets — gestes', () => {
  test('j’aime : POST puis DELETE simulés, compteur et aria-pressed justes, carte ouverte', async ({
    page,
    baseURL,
  }, testInfo) => {
    const { mock, badResponses } = await openRenderedHub(page, baseURL as string);
    const like = page.locator(`[data-testid="lkdh-carnet-like"][data-id="${EN_ROUTE_PHOTOS_ID}"]`);
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await expect(like).toHaveAttribute('aria-label', 'J’aime : 64');

    const posted = page.waitForRequest(
      (request) => request.url().includes('/rest/v1/carnet_likes') && request.method() === 'POST',
      { timeout: 10_000 },
    );
    await like.click();
    const postRequest = await posted;
    expect(postRequest.postData() ?? '').toContain(EN_ROUTE_PHOTOS_ID);
    expect(postRequest.postData() ?? '').toContain('reaction');
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(like).toHaveAttribute('aria-label', 'Retirer mon j’aime : 65');
    await capture(page, testInfo, 'hub-jaime-actif');

    const deleted = page.waitForRequest(
      (request) => request.url().includes('/rest/v1/carnet_likes') && request.method() === 'DELETE',
      { timeout: 10_000 },
    );
    await like.click();
    await deleted;
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await expect(like).toHaveAttribute('aria-label', 'J’aime : 64');

    // Hub seul (avant navigation) : console strictement vide.
    expect(mock.consoleErrors, 'console hub propre avant navigation').toEqual([]);

    // Ouvrir la carte du carnet en route (photo) : la fiche v2 doit rendre.
    await page.locator(`[data-testid="lkdh-carnet-link"][data-id="${EN_ROUTE_ID}"]`).click();
    await page.waitForURL(new RegExp(`/carnets/${EN_ROUTE_ID}`), { timeout: 15_000 });
    await page.locator('.lkdv-title-pill').first().waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.locator('body')).toContainText('Crêtes du Queyras');
    await capture(page, testInfo, 'hub-carte-ouverte');

    // Le hub a déjà été vérifié console vide ci-dessus ; après ouverture de la
    // fiche (surface hors lot), on ne garde que le bruit de décodage des tuiles
    // DEM du harnais (voir HARNESS_IMAGE_DECODE).
    expect(
      mock.consoleErrors.filter((error) => !HARNESS_IMAGE_DECODE.test(error)),
      'console propre hors bruit de tuiles DEM du harnais',
    ).toEqual([]);
    expect(badResponses, 'réseau sans 4xx/5xx évitables').toEqual([]);
  });
});

test.describe('fiche carnet — lentille Équipage › Suivre (lot L2)', () => {
  test('progression, battements et résumé du soir rendus', async ({ page, baseURL }, testInfo) => {
    const mock = await installCommunityV2Mock(page, {
      role: 'member',
      appOrigin: baseURL as string,
    });
    await page.addInitScript((value) => localStorage.setItem('lkdv_cookie_consent', value), CONSENT);
    // Même horloge que le banc carnet : jour 4 du carnet de test, « en route ».
    await page.clock.install({ time: new Date('2026-07-16T12:00:00+02:00') });
    const badResponses = trackBadResponses(page);

    await page.goto(`/carnets/${CARNET_ID}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.lkdv-title-pill').first().waitFor({ state: 'visible', timeout: 30_000 });
    await waitForHydration(page, '.lkdv-title-pill');
    await page.waitForTimeout(700);

    await page.getByRole('button', { name: 'Ouvrir le carnet' }).click();
    const drawer = page.locator('.lkdv-carnet-drawer');
    await drawer.waitFor({ state: 'visible', timeout: 15_000 });
    await drawer.getByRole('tab', { name: 'Équipage', exact: true }).click();
    await drawer.getByRole('tab', { name: 'Suivre', exact: true }).click();

    // 1. Progression : statut + barre accessible.
    const progress = page.getByRole('progressbar', { name: 'Progression du voyage' });
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuemin', '0');
    await expect(progress).toHaveAttribute('aria-valuemax', '100');
    await expect(progress).toHaveAttribute('aria-valuetext', /Jour 4 sur 4/);
    await expect(page.locator('.lkdv-suivi-prog-state')).toContainText('Jour 4/4');

    // 2. Battements : une barre par moment, groupe par jour.
    const beats = page.locator('.lkdv-suivi-beats [role="img"]');
    await expect(beats).toBeVisible();
    await expect(beats).toHaveAttribute('aria-label', 'Battements du voyage : 4 jours, 28 moments');

    // 3. Résumé du soir du dernier jour terminé (J3), avec la nuit.
    const evening = page.locator('.lkdv-suivi-evening');
    await expect(evening).toBeVisible();
    await expect(evening).toHaveAttribute('aria-label', 'Résumé du soir, jour 3');
    await expect(evening).toContainText('J3');
    await expect(evening).toContainText('22 km');
    await expect(evening).toContainText('+1 340 m');
    await expect(evening).toContainText('Bivouac au Lac de la Muzelle');

    await evening.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await capture(page, testInfo, 'suivi-lentille-suivre');

    // Fiche = surface livrée hors lot : même bruit de tuiles DEM du harnais.
    expect(
      mock.consoleErrors.filter((error) => !HARNESS_IMAGE_DECODE.test(error)),
      'console propre hors bruit de tuiles DEM du harnais',
    ).toEqual([]);
    expect(badResponses, 'réseau sans 4xx/5xx évitables').toEqual([]);
  });
});
