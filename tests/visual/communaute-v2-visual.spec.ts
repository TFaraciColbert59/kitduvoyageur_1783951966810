import { test, expect, type Page } from '@playwright/test';

import {
  SKIP_SERVER,
  SKIP_V2_BUILD,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  installConsoleGuard,
  isServerReady,
  longPress,
  openCreate,
  openExplorer,
} from '../e2e/communaute-v2.fixtures';

/**
 * tests/visual/communaute-v2-visual.spec.ts
 *
 * Régression visuelle des deux tiroirs Communauté v2 en **390×844**, comparée
 * aux captures de la maquette (`audit-communaute-v2/maquette/*.png`). Les
 * captures sont produites sur données **mockées** (`@ui-mock`) : aucun réseau,
 * aucune base, dont reproductibles.
 *
 * Conventions du dépôt :
 * - références dans `tests/visual/communaute-v2-visual.spec.ts-snapshots/`,
 *   une par appel × projet (convention Playwright du dépôt) ;
 * - tolérance documentée : `maxDiffPixelRatio: 0.02` (2 % de pixels) sur un
 *   viewport 390×844, `animations: 'disabled'`, horloge figée au 2026-11-08 ;
 *   l'écart à la maquette est jugé à part (rapport de recette).
 *
 * Générer/mettre à jour les références (serveur v2 sur 4028) :
 *   PW_BASE_URL=http://127.0.0.1:4028 npx playwright test --config=playwright.visual.config.ts \
 *     tests/visual/communaute-v2-visual.spec.ts --project=iphone-14-pro-chromium --update-snapshots
 */

const VIEWPORT = { width: 390, height: 844 };

/** Clic DOM direct : la poignée de drag de la coque recouvre le bouton Retour
 * sur les gabarits mobiles (recouvrement à qualifier dans le rapport). */
async function domClick(locator: import('@playwright/test').Locator): Promise<void> {
  await locator.evaluate((element) => (element as HTMLElement).click());
}
const SHOT_OPTIONS = { animations: 'disabled' as const, maxDiffPixelRatio: 0.02 };

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
});

test.beforeEach(async ({ page }) => {
  test.skip(!serverReady, SKIP_SERVER);
  // Références générées sur macOS (`…-darwin.png`). Playwright indexe ses
  // snapshots par plateforme : la CI Linux exigerait des `…-linux.png` rendues
  // sur un runner Linux (polices/antialiasing différents). Tant que ces
  // références Linux ne sont pas produites/committées, la spec se saute en CI
  // avec raison explicite — jamais de faux rouge ni de faux vert (PREUVES.md).
  test.skip(
    Boolean(process.env.CI) && !process.env.LKDV_V2_VISUAL_LINUX,
    'Références visuelles v2 générées sur macOS (darwin) : produire les références Linux en CI ' +
      '(LKDV_V2_VISUAL_LINUX=1 --update-snapshots) ou les committer avant d’activer ce scan.',
  );
  await page.setViewportSize(VIEWPORT);
});

/**
 * Installe un mock neuf, fige l'horloge et ouvre /communaute. Un seul mock par
 * test (les routes Playwright sont LIFO : deux installations se
 * chevaucheraient) ; le garde console est conservé pour l'assertion finale.
 */
async function preparePage(
  page: Page,
  options: Parameters<typeof installCommunityV2Mock>[1] = {},
): Promise<void> {
  const guard = installConsoleGuard(page);
  await installCommunityV2Mock(page, options);
  await freezeClock(page);
  await gotoCommunity(page);
  (page as unknown as { __guard?: { errors: string[] } }).__guard = guard;
}

function guardErrors(page: Page): string[] {
  const errors = (page as unknown as { __guard?: { errors: string[] } }).__guard?.errors ?? [];
  // Artefacts du harnais (pas des bugs produit) : les tuiles de carte et les
  // médias distants sont simulés par des réponses neutres ; le décodeur d'image
  // du navigateur journalise alors « could not be decoded ».
  const harnessArtifacts = [
    /InvalidStateError: The source image could not be decoded/i,
    /Failed to load resource/i,
    /net::ERR_/i,
  ];
  return errors.filter((error) => !harnessArtifacts.some((pattern) => pattern.test(error)));
}

test.describe('Visuel v2 — tiroir Explorer 390×844 @ui-mock @mobile', () => {
  test('volets, tri, détails et états', async ({ page }) => {
    await preparePage(page);
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();

    await expect(page).toHaveScreenshot('explorer-carnets.png', SHOT_OPTIONS);

    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Clubs' }).click();
    await expect(page.getByTestId('cv2-pane-clubs')).toHaveAttribute('aria-hidden', 'false');
    await expect(page).toHaveScreenshot('explorer-clubs.png', SHOT_OPTIONS);

    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Sorties' }).click();
    await expect(page.getByTestId('cv2-pane-sorties')).toHaveAttribute('aria-hidden', 'false');
    await expect(page).toHaveScreenshot('explorer-sorties.png', SHOT_OPTIONS);

    // Menu de tri ouvert (Carnets).
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Carnets' }).click();
    await page.getByTestId('cv2-sort-button').click();
    await expect(page.getByTestId('cv2-sort-menu')).toBeVisible();
    await expect(page).toHaveScreenshot('explorer-carnets-tri-menu.png', SHOT_OPTIONS);
    await page.keyboard.press('Escape');

    // Détail club.
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Clubs' }).click();
    await page.getByTestId('cv2-tile-club').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();
    await expect(page).toHaveScreenshot('explorer-detail-club.png', SHOT_OPTIONS);
    await domClick(page.getByTestId('cv2-back'));

    // Détail sortie.
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Sorties' }).click();
    await page.getByTestId('cv2-tile-sortie').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();
    await expect(page).toHaveScreenshot('explorer-detail-sortie.png', SHOT_OPTIONS);

    expect(guardErrors(page)).toEqual([]);
  });

  test('recherche et Peek', async ({ page }) => {
    await preparePage(page);
    test.skip(!(await openExplorer(page, 'search')), SKIP_V2_BUILD);

    await expect(page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Recherche' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveScreenshot('explorer-recherche-accueil.png', SHOT_OPTIONS);

    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('explorer-recherche-resultats.png', SHOT_OPTIONS);

    // Peek sur la première tuile.
    await page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' }).fill('');
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Carnets' }).click();
    const tile = page.getByTestId('cv2-tile-carnet').first();
    await longPress(page, tile);
    await expect(page.getByRole('dialog', { name: /Aperçu :/ })).toBeVisible();
    await expect(page).toHaveScreenshot('explorer-peek.png', SHOT_OPTIONS);

    expect(guardErrors(page)).toEqual([]);
  });
});

test.describe('Visuel v2 — tiroir Explorer : états @ui-mock @mobile', () => {
  test('état vide et état erreur', async ({ page }) => {
    await preparePage(page, { state: 'empty' });
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);

    const capsule = page.getByRole('tablist', { name: 'Volets de l’explorateur' });
    await capsule.getByRole('tab', { name: 'Carnets' }).click();
    await expect(page.getByText('Aucun carnet à découvrir')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('explorer-etat-vide.png', SHOT_OPTIONS);

    // État erreur : RPC en échec (nouveau contexte de mock impossible sur la
    // même page sans empiler les routes ; on recharge avec le mock d'état).
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await preparePage(page, { state: 'error' });
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);
    await expect(page.getByText('Carnets indisponibles')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveScreenshot('explorer-etat-erreur.png', SHOT_OPTIONS);
  });
});

test.describe('Visuel v2 — tiroir Création 390×844 @ui-mock @mobile', () => {
  test('étape 1 des 6 types, erreurs, confirmation', async ({ page }) => {
    await preparePage(page);
    test.skip(!(await openCreate(page, 'post')), SKIP_V2_BUILD);
    await expect(page.getByTestId('communaute-v2-create')).toBeVisible();
    await expect(page).toHaveScreenshot('creation-publication-e1.png', SHOT_OPTIONS);

    const capsule = page.getByRole('tablist', { name: 'Type de création' });
    const kinds: Array<[string, string]> = [
      ['Story', 'story'],
      ['Carnet', 'carnet'],
      ['Sortie', 'sortie'],
      ['Kit', 'kit'],
      ['Club', 'club'],
    ];
    for (const [label, slug] of kinds) {
      await capsule.getByRole('tab', { name: label }).click();
      // Le wrapper du moteur est de 0×0 : le contenu visible est le panneau de
      // l'étape 1, capturé par la référence.
      await expect(page.getByTestId(`cv2-form-${slug}`)).toBeAttached();
      await expect(
        page
          .getByRole('tablist', { name: `Étapes de la création : ${label}` })
          .getByRole('tab')
          .first(),
      ).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveScreenshot(`creation-${slug}-e1.png`, SHOT_OPTIONS);
    }

    // Étape 2 de Publication en erreur (une seule fois) + confirmation.
    await capsule.getByRole('tab', { name: 'Publication' }).click();
    await page.getByRole('radio', { name: /Billet/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByTestId('cv2-error-summary')).toBeVisible();
    await expect(page).toHaveScreenshot('creation-publication-e2-erreurs.png', SHOT_OPTIONS);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog', { name: 'Fermer sans publier ?' })).toBeVisible();
    await expect(page).toHaveScreenshot('creation-confirmation-fermeture.png', SHOT_OPTIONS);

    expect(guardErrors(page)).toEqual([]);
  });
});
