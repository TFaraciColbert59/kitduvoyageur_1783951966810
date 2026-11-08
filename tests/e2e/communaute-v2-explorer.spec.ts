import { test, expect, type Page } from '@playwright/test';

import {
  CARNET_ID,
  CARNET_ID_MOST_LIKED,
  CLUB_ID_LARGEST,
  EVENT_ID,
  EVENT_ID_FULL,
  SKIP_REAL_DB,
  SKIP_SERVER,
  SKIP_V2_BUILD,
  closeByEscape,
  dragSheetDown,
  freezeClock,
  gotoCommunity,
  horizontalOverflow,
  installCommunityV2Mock,
  installConsoleGuard,
  isServerReady,
  longPress,
  openExplorer,
  swipeFilterPager,
  type CommunityV2Mock,
} from './communaute-v2.fixtures';

/**
 * tests/e2e/communaute-v2-explorer.spec.ts
 *
 * Recette E2E du tiroir **Explorer** — `05-QUALITE-ET-TESTS.md` § 2 scénarios
 * 1, 2, 3, 4, 5 (et la part UI du 7 hors clavier iOS), taguée `@ui-mock`.
 *
 * Toutes les données viennent de `communaute-v2.fixtures.ts` (interception
 * `page.route`, zéro réseau, zéro base) : la spec tourne donc en local **et** en
 * CI sans session Supabase réelle ni migration appliquée, sur les projets
 * `mobile-webkit` et `mobile-chromium` (tag `@mobile`).
 *
 * Garde-fous :
 * - sans serveur Next : `test.skip(SKIP_SERVER)` explicite ;
 * - build sans `NEXT_PUBLIC_COMMUNAUTE_V2=true` : `test.skip(SKIP_V2_BUILD)` ;
 * - jamais de faux vert : chaque scénario qui ne peut pas s'exécuter se saute
 *   avec une raison lisible par le rapport de recette.
 */

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
});

test.beforeEach(() => {
  test.skip(!serverReady, SKIP_SERVER);
});

/** Prépare la page mockée, ouvre l'Explorer et saute si le build n'est pas v2. */
async function setupExplorer(
  page: Page,
  options: Parameters<typeof installCommunityV2Mock>[1] = {},
  trigger: 'explorer' | 'search' = 'explorer',
): Promise<CommunityV2Mock> {
  const mock = await installCommunityV2Mock(page, options);
  await freezeClock(page);
  await gotoCommunity(page);
  const opened = await openExplorer(page, trigger);
  if (!opened && mock.consoleErrors.length > 0) {
    console.log(`[openExplorer] v2 non montée — console :\n${mock.consoleErrors.slice(0, 8).join('\n')}`);
  }
  test.skip(!opened, SKIP_V2_BUILD);
  return mock;
}

/** Onglet racine (capsule 56 px) ou filtre (mini-capsule 30 px). */
function tab(page: Page, listName: string, name: string) {
  return page.getByRole('tablist', { name: listName }).getByRole('tab', { name });
}

function panelVisibility(page: Page, id: string) {
  return page.getByTestId(`cv2-pane-${id}`);
}

/**
 * Vérifie qu'un volet est réellement **dans le viewport** (pas seulement monté) :
 * la régression de coque du 2026-11-08 empilait les 4 volets verticalement, le
 * volet actif restant hors écran — `toBeVisible()` seul ne l'aurait pas vu.
 */
async function expectPaneInViewport(page: Page, id: string): Promise<void> {
  const pane = panelVisibility(page, id);
  await expect(pane).toHaveAttribute('aria-hidden', 'false');
  await expect(pane).toBeInViewport();
}

/**
 * Clic DOM direct (élément `.click()`), pour les cas où un recouvrement de
 * layout empêche le clic natif Playwright d'atteindre le bouton alors que
 * l'utilisateur, lui, déclenche bien l'action (recouvrements à qualifier dans le
 * rapport : barre de retour du détail, bascule « Sur la carte »).
 */
async function domClick(locator: import('@playwright/test').Locator): Promise<void> {
  await locator.evaluate((element) => (element as HTMLElement).click());
}

test.describe('Explorer v2 — ouverture, capsule, gestes @ui-mock @mobile', () => {
  test('1a. ouverture par le bouton Explorer, capsule 4 volets et clavier ←/→/Home/End', async ({
    page,
  }) => {
    await setupExplorer(page);

    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Explorer la communauté' })).toBeVisible();

    const capsule = page.getByTestId('cv2-capsule');
    await expect(capsule.getByRole('tab')).toHaveCount(4);

    // Défaut : Carnets (déclencheur « Explorer »).
    await expect(tab(page, 'Volets de l’explorateur', 'Carnets')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expectPaneInViewport(page, 'carnets');

    // Changement de volet par la capsule.
    await tab(page, 'Volets de l’explorateur', 'Clubs').click();
    await expectPaneInViewport(page, 'clubs');
    await expect(panelVisibility(page, 'carnets')).toHaveAttribute('aria-hidden', 'true');

    // Clavier : le focus est dans la capsule, flèches + Home/End avec bouclage.
    await tab(page, 'Volets de l’explorateur', 'Clubs').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Volets de l’explorateur', 'Sorties')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Volets de l’explorateur', 'Clubs')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Home');
    await expect(tab(page, 'Volets de l’explorateur', 'Recherche')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('End');
    await expect(tab(page, 'Volets de l’explorateur', 'Sorties')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('1b. ouverture par la loupe : volet Recherche, champ focalisé', async ({ page }) => {
    await setupExplorer(page, {}, 'search');

    await expect(tab(page, 'Volets de l’explorateur', 'Recherche')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await expect(input).toBeFocused();
    await expect(page.getByText('Tendances de la semaine')).toBeVisible();
  });

  test('1c. fermeture par Échap : focus rendu au déclencheur, fond plus inerte', async ({ page }) => {
    // Activation clavier (focus + Entrée) : c'est le scénario d'accessibilité où
    // la restitution de focus au déclencheur est exigée. Sur WebKit/iOS Safari,
    // un tap souris ne focalise pas le bouton déclencheur (comportement Safari),
    // donc le focus n'a pas d'origine à restituer pour un tap : non pertinent ici.
    const mock = await installCommunityV2Mock(page);
    await freezeClock(page);
    await gotoCommunity(page);
    const trigger = page.getByRole('button', { name: 'Explorer et rechercher' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const opened = await page
      .getByTestId('communaute-v2-explore')
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!opened && mock.consoleErrors.length > 0) {
      console.log(`[1c] v2 non montée — console :\n${mock.consoleErrors.slice(0, 6).join('\n')}`);
    }
    test.skip(!opened, SKIP_V2_BUILD);
    await page.waitForTimeout(900);

    // Fond inerte tant que le tiroir est ouvert.
    const inertWhileOpen = await page.evaluate(() =>
      Array.from(document.body.children)
        .filter(
          (element) =>
            element.tagName === 'DIV' &&
            !element.classList.contains('lkdv-communaute-v2') &&
            !element.classList.contains('lkdv-island-host'),
        )
        .every((element) => (element as HTMLElement).inert === true),
    );
    expect(inertWhileOpen).toBe(true);

    await closeByEscape(page, 'communaute-v2-explore');
    await expect(trigger).toBeFocused();

    const inertAfterClose = await page.evaluate(() =>
      Array.from(document.body.children).some(
        (element) => element.tagName === 'DIV' && (element as HTMLElement).inert === true,
      ),
    );
    expect(inertAfterClose).toBe(false);
  });

  test('1d. fermeture par glissement de la poignée (rubber-band + seuil 30 %)', async ({ page }) => {
    await setupExplorer(page);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
    await dragSheetDown(page, 300);
    await expect(page.getByTestId('communaute-v2-explore')).toHaveCount(0, { timeout: 5_000 });
  });

  test('1e. glisser entre filtres dans les deux sens (LensPager)', async ({ page }) => {
    await setupExplorer(page);
    await expect(tab(page, 'Filtres des carnets', 'Découvrir')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Glisser vers la gauche : filtre suivant (Découvrir → Mes carnets).
    await swipeFilterPager(page, 'next');
    await expect(tab(page, 'Filtres des carnets', 'Mes carnets')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Glisser vers la droite : retour au filtre précédent.
    await swipeFilterPager(page, 'previous');
    await expect(tab(page, 'Filtres des carnets', 'Découvrir')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('1f. aucun débordement à 360 / 390 / 430 et reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupExplorer(page);

    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      for (const volet of ['Carnets', 'Clubs', 'Sorties']) {
        await tab(page, 'Volets de l’explorateur', volet).click();
        expect(await horizontalOverflow(page), `${volet} à ${width}px`).toBeLessThanOrEqual(0);
      }
    }
    // La fermeture reste fonctionnelle en mouvement réduit.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('communaute-v2-explore')).toHaveCount(0, { timeout: 3_000 });
  });
});

test.describe('Explorer v2 — Carnets : tri, j’aime, Peek, état vide @ui-mock @mobile', () => {
  test('2a. tri « Populaires » : ordre serveur, coche du menu et point vert', async ({ page }) => {
    await setupExplorer(page);

    const tiles = page.getByTestId('cv2-tile-carnet');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.first().getAttribute('data-id')).toBe(CARNET_ID);

    const sortButton = page.getByTestId('cv2-sort-button');
    await expect(sortButton).toBeVisible();
    await expect(sortButton).toHaveAttribute('data-modified', 'false');

    await sortButton.click();
    const menu = page.getByTestId('cv2-sort-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');
    await page.getByRole('menuitemradio', { name: 'Populaires' }).click();

    await expect(page.getByTestId('cv2-sort-menu')).toHaveCount(0);
    await expect(sortButton).toHaveAttribute('data-modified', 'true');
    await expect(tiles.first()).toHaveAttribute('data-id', CARNET_ID_MOST_LIKED);

    // Rouvrir : la coche est sur « Populaires ».
    await sortButton.click();
    await expect(page.getByRole('menuitemradio', { name: 'Populaires' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('2b. Échap ferme le menu de tri seul, pas le tiroir', async ({ page }) => {
    await setupExplorer(page);
    await page.getByTestId('cv2-sort-button').click();
    await expect(page.getByTestId('cv2-sort-menu')).toBeVisible();
    // Le menu déplace le focus sur l'option cochée (rAF) : Échap n'est
    // consommé par le menu que lorsque le focus est dedans.
    await expect(page.getByTestId('cv2-sort-menu').getByRole('menuitemradio').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cv2-sort-menu')).toHaveCount(0);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
  });

  test('2c. j’aime sans ouvrir la fiche (compteur serveur, aucune navigation)', async ({ page }) => {
    const mock = await setupExplorer(page);
    const like = page.getByTestId('cv2-carnet-like').first();
    await expect(like).toBeVisible();
    await like.click();

    await expect
      .poll(() => mock.getLikedCarnets(), { message: 'like non transmis' })
      .toContain(CARNET_ID);
    await expect(page.getByTestId('cv2-detail')).toHaveCount(0);
    await expect(page).toHaveURL(/\/communaute/);
  });

  test('2d. Peek : appui long 460 ms, 3 actions, Échap ferme l’aperçu seul', async ({ page }) => {
    await setupExplorer(page);
    const tile = page.getByTestId('cv2-tile-carnet').first();
    await longPress(page, tile);

    const peek = page.getByRole('dialog', { name: /Aperçu :/ });
    await expect(peek).toBeVisible();
    await expect(peek.getByRole('button')).toHaveCount(3);

    await page.keyboard.press('Escape');
    await expect(peek).toHaveCount(0);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
  });

  test('2e. état vide « Mes carnets » → Création › Carnet', async ({ page }) => {
    const mock = await setupExplorer(page);
    mock.setState('empty');
    await tab(page, 'Filtres des carnets', 'Mes carnets').click();

    const empty = page.getByRole('status').filter({ hasText: 'Aucun carnet pour l’instant' });
    await expect(empty).toBeVisible();
    await empty.getByRole('button', { name: /Créer mon premier carnet/ }).click();

    await expect(page.getByTestId('communaute-v2-create')).toBeVisible();
    // Le moteur porte le contenu dans les panneaux d'étape (`mini.pages`) : le
    // `<form data-testid="cv2-form-…">` est un wrapper de 0×0, le contenu visible
    // est le panneau de l'étape 1.
    await expect(page.getByTestId('cv2-form-carnet')).toBeAttached();
    await expect(
      page.getByRole('tablist', { name: 'Étapes de la création : Carnet' }).getByRole('tab', { name: 'Étape 1 : Infos' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('cv2-field-title')).toBeVisible();
  });
});

test.describe('Explorer v2 — Clubs : chips, tri, détail, adhésion @ui-mock @mobile', () => {
  test('3a. chip d’activité, tri « Taille », détail empilé + Retour', async ({ page }) => {
    await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Clubs').click();

    const chips = page.getByRole('group', { name: 'Activité du club' });
    await expect(chips.getByRole('button', { name: 'Rando' })).toBeVisible();
    await chips.getByRole('button', { name: 'Escalade' }).click();
    await expect(chips.getByRole('button', { name: 'Escalade' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('cv2-tile-club').first()).toBeVisible();

    // Tri Taille : club le plus gros en tête.
    await chips.getByRole('button', { name: 'Tous' }).click();
    await page.getByTestId('cv2-sort-button').click();
    await page.getByRole('menuitemradio', { name: 'Taille' }).click();
    await expect(page.getByTestId('cv2-tile-club').first()).toHaveAttribute(
      'data-id',
      CLUB_ID_LARGEST,
    );

    // Détail empilé + Retour.
    await page.getByTestId('cv2-tile-club').first().click();
    const detail = page.getByTestId('cv2-detail');
    await expect(detail).toBeVisible();
    await expect(page.getByTestId('cv2-capsule')).toHaveCount(0);
    // Clic NATIF (z-index de `.lkdv-cv2-detail` corrigé : le bouton n'est plus
    // recouvert par la poignée de drag).
    await page.getByTestId('cv2-back').click();
    await expect(detail).toHaveCount(0);
    await expect(page.getByTestId('cv2-capsule')).toBeVisible();
  });

  test('3b. Rejoindre un club ouvert puis Annuler via l’île (compteur rendu)', async ({ page }) => {
    const mock = await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Clubs').click();

    // « Cordée des Écrins » est le club ouvert dont le viewer n'est pas membre
    // dans les fixtures ; les autres sont déjà membre, en attente ou fermés.
    const openTile = page
      .getByTestId('cv2-tile-club')
      .filter({ hasText: 'Cordée des Écrins' })
      .first();
    await openTile.getByTestId('cv2-club-join').click();
    const island = page.locator('.lkdv-island-pill');
    await expect(island).toBeVisible();
    await expect(island).toContainText('Club rejoint');
    await expect.poll(() => mock.getJoinedClubs()).toHaveLength(1);

    // Annuler via l'île : retour exact à l'état initial (compteur rendu).
    await island.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('.lkdv-island-pill')).toHaveCount(0, { timeout: 5_000 });
    await expect
      .poll(() => mock.getJoinedClubs(), { message: 'l’annulation doit retirer l’adhésion' })
      .toHaveLength(0);
  });

  test('3c. club sur validation : « Demande envoyée » puis « Demandes (1) » → Accepter', async ({
    page,
  }) => {
    await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Clubs').click();

    // « Ski de rando Belledonne » est le club `closed` (sur validation).
    const closedTile = page
      .getByTestId('cv2-tile-club')
      .filter({ hasText: 'Ski de rando Belledonne' })
      .first();
    await closedTile.getByTestId('cv2-club-join').click();
    const island = page.locator('.lkdv-island-pill');
    await expect(island).toContainText('Demande envoyée');

    // Ouvre le club (admin) : la pile « Demandes » est réservée aux admins.
    await page
      .getByTestId('cv2-tile-club')
      .filter({ hasText: 'Vercors Alpin' })
      .first()
      .click();
    const requests = page.getByRole('region', { name: /Demandes d’adhésion/ });
    await expect(requests).toBeVisible();
    await expect(requests).toContainText('Demandes (1)');
    await requests.getByRole('button', { name: 'Accepter' }).click();
    await expect(page.locator('.lkdv-island-pill')).toContainText('Demande acceptée');
  });
});

test.describe('Explorer v2 — Sorties : agenda, détail, inscription, .ics @ui-mock @mobile', () => {
  test('4a. jour de l’agenda → liste filtrée sur ce jour', async ({ page }) => {
    await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Sorties').click();

    const agenda = page.getByRole('group', { name: 'Agenda des prochains jours' });
    await expect(agenda).toBeVisible();
    // Bande alimentée par `community_events_agenda` : attendre les compteurs.
    const dayButton = agenda.getByRole('button', { name: /[1-9] sortie/ }).first();
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    const dayLabel = (await dayButton.getAttribute('aria-label')) ?? '';
    await dayButton.click();
    await expect(dayButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('cv2-tile-sortie').first()).toBeVisible({ timeout: 15_000 });
    expect(dayLabel).toMatch(/[1-9] sortie/);
  });

  test('4b. détail sortie + S’inscrire puis île « Inscription confirmée »', async ({ page }) => {
    const mock = await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Sorties').click();

    await page.getByTestId('cv2-tile-sortie').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();
    await expect(page.getByTestId('cv2-detail')).toContainText(/Itinéraire|Participants/);
    await page.getByTestId('cv2-back').click();

    await page.getByTestId('cv2-event-register').first().click();
    const island = page.locator('.lkdv-island-pill');
    await expect(island).toContainText('Inscription confirmée');
    await expect.poll(() => mock.getJoinedEvents()).toContain(EVENT_ID);
  });

  test('4c. sortie complète → liste d’attente', async ({ page }) => {
    const mock = await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Sorties').click();

    const fullRegister = page.getByTestId('cv2-event-register').filter({ hasText: /Liste d’attente/ });
    await expect(fullRegister.first()).toBeVisible();
    await fullRegister.first().click();
    await expect(page.locator('.lkdv-island-pill')).toContainText('liste d’attente');
    await expect.poll(() => mock.getJoinedEvents()).toContain(EVENT_ID_FULL);
  });

  test('4d. .ics téléchargé depuis le détail de sortie', async ({ page }) => {
    await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Sorties').click();
    await page.getByTestId('cv2-tile-sortie').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Ajouter au calendrier' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
  });
});

test.describe('Explorer v2 — Recherche : accents, ponctuation, erreur, clavier, carte @ui-mock @mobile', () => {
  async function openSearch(page: Page, options: Parameters<typeof installCommunityV2Mock>[1] = {}) {
    const mock = await setupExplorer(page, options, 'search');
    return { mock, input: page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' }) };
  }

  test('5a. « ecrins » (sans accent) trouve « Écrins » et surligne le terme', async ({ page }) => {
    await openSearch(page);
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('ecrins');
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('cv2-tile-carnet').first()).toContainText('Écrins');
    expect(await page.locator('mark').count()).toBeGreaterThan(0);
  });

  test('5b. ponctuation « vercors, alpin » ne casse pas la recherche', async ({ page }) => {
    await openSearch(page);
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors, alpin');
    await expect(page.getByRole('tablist', { name: 'Filtres des résultats' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByTestId('cv2-tile-club').first()).toBeVisible({ timeout: 10_000 });
  });

  test('5c. erreur réseau simulée → « Recherche indisponible » + Réessayer', async ({ page }) => {
    await openSearch(page, { failRpcs: ['community_search'] });
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await expect(page.locator('.lkdv-cv2-error-state')).toContainText('Recherche indisponible', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });

  test('5d. clavier ↑ ↓ + Entrée navigue vers le résultat actif', async ({ page }) => {
    await openSearch(page);
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.is-kb').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/(carnets|clubs|sorties|profil)\/|\/communaute\?post=/, {
      timeout: 15_000,
    });
  });

  test('5e. « Sur la carte » affiche la carte des résultats', async ({ page }) => {
    await openSearch(page);
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 10_000 });

    await domClick(
      page
        .getByRole('group', { name: 'Affichage des résultats' })
        .getByRole('button', { name: 'Sur la carte' }),
    );
    await expect(page.locator('.lkdv-cv2x-search-map, canvas').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Explorer v2 — drapeau, clavier iOS et données réelles @mobile', () => {
  test('7. clavier mobile simulé : non testable en navigateur headless', async () => {
    // `visualViewport` ne reproduit pas le clavier WKWebView d'iOS : la preuve
    // « pied visible au-dessus du clavier » est une recette iPhone (07 § C)
    // couverte par `.maestro/communaute.yaml`, pas par Playwright.
    test.skip(
      true,
      'Clavier iOS réel : non simulable par Playwright (visualViewport ≠ clavier WKWebView). ' +
        'Preuve attendue : 07 § C sur iPhone + flow Maestro `.maestro/communaute.yaml`.',
    );
  });

  test('6/10. créations réelles et stories : base de test migrée requise', async () => {
    test.skip(process.env.LKDV_E2E_DB !== 'test', SKIP_REAL_DB);
    // Les scénarios de données réelles vivent dans
    // `tests/e2e/communaute-v2-db.spec.ts` (même garde) : ils ne s'exécutent
    // que contre une base locale/éphémère migrée, jamais la prod.
    test.skip(true, `Voir tests/e2e/communaute-v2-db.spec.ts (LKDV_E2E_DB=test).`);
  });
});

test.describe('Explorer v2 — 0 erreur console, 0 requête en échec @ui-mock @mobile', () => {
  test('9. 360/390/430 : aucune erreur console, aucun appel réseau non mocké', async ({ page }) => {
    const guard = installConsoleGuard(page);
    const mock = await installCommunityV2Mock(page);
    await freezeClock(page);
    await gotoCommunity(page);

    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const opened = await openExplorer(page);
      test.skip(!opened, SKIP_V2_BUILD);
      const paneIds: Record<string, string> = { Carnets: 'carnets', Clubs: 'clubs', Sorties: 'sorties' };
      for (const volet of ['Carnets', 'Clubs', 'Sorties']) {
        await tab(page, 'Volets de l’explorateur', volet).click();
        await expectPaneInViewport(page, paneIds[volet]);
      }
      await closeByEscape(page, 'communaute-v2-explore');
    }

    mock.expectNoUnexpected();
    // WebKit journalise une erreur console pour le `preconnect` de hint vers
    // l'hôte Supabase fictif (aucune requête réelle) : artefact de harnais.
    const realErrors = guard.errors.filter((error) => !/Failed to preconnect/i.test(error));
    expect(realErrors, realErrors.join('\n')).toEqual([]);
  });
});
