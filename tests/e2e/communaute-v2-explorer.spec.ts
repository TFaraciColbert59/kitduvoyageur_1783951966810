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
  activeElement,
  closeByEscape,
  dragLensPager,
  dragSheetDown,
  expectNotCovered,
  freezeClock,
  gotoCommunity,
  horizontalOverflow,
  installCommunityV2Mock,
  installConsoleGuard,
  isServerReady,
  longPress,
  openExplorer,
  pressEscapeAndExpectConsumed,
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
      for (const volet of ['Carnets', 'Clubs', 'Sorties', 'Recherche']) {
        await tab(page, 'Volets de l’explorateur', volet).click();
        expect(await horizontalOverflow(page), `${volet} à ${width}px`).toBeLessThanOrEqual(0);
      }
    }
    // La fermeture reste fonctionnelle en mouvement réduit.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('communaute-v2-explore')).toHaveCount(0, { timeout: 3_000 });
  });

  /**
   * FID-081 — preuve clavier : ordre de tabulation, piège de focus (Tab et
   * Shift+Tab bouclent), anneau `:focus-visible` 2 px (FID-058) et restitution
   * du focus au déclencheur après Échap. Le scénario 1c couvre déjà WebKit en
   * activation clavier ; ce test renforce l'ordre et le piège.
   */
  test('1g. focus clavier : piège Tab/Shift+Tab, anneau 2 px, restitution au déclencheur', async ({
    page,
    browserName,
  }) => {
    await installCommunityV2Mock(page);
    await freezeClock(page);
    await gotoCommunity(page);

    const trigger = page.getByRole('button', { name: 'Explorer et rechercher' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(900);

    const focusable = () =>
      page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="communaute-v2-explore"]');
        const nodes = Array.from(
          sheet?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter((node) => node.getClientRects().length > 0);
        const first = nodes[0] ?? null;
        const last = nodes[nodes.length - 1] ?? null;
        return {
          count: nodes.length,
          firstIsActive: first === document.activeElement,
          lastIsActive: last === document.activeElement,
          firstLabel: first ? (first.dataset.testid ?? first.getAttribute('aria-label') ?? first.textContent?.trim() ?? '') : '',
          lastLabel: last ? (last.dataset.testid ?? last.getAttribute('aria-label') ?? last.textContent?.trim() ?? '') : '',
        };
      });

    // Piège au bord haut : dernier focusable → Tab → premier.
    await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="communaute-v2-explore"]');
      const nodes = Array.from(
        sheet?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
      nodes[nodes.length - 1]?.focus();
    });
    await page.keyboard.press('Tab');
    expect((await focusable()).firstIsActive, 'Tab depuis le dernier doit boucler sur le premier').toBe(true);

    // Anneau visible (FID-058) sur un focus atteint au clavier.
    const outline = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(outline?.outlineStyle, 'anneau absent au clavier').toBe('solid');
    expect(parseFloat(outline?.outlineWidth ?? '0'), 'anneau < 2 px').toBeGreaterThanOrEqual(2);

    // Piège au bord bas : premier focusable → Shift+Tab → dernier.
    await page.keyboard.press('Shift+Tab');
    expect((await focusable()).lastIsActive, 'Shift+Tab depuis le premier doit boucler sur le dernier').toBe(true);

    if (browserName === 'webkit') {
      // Safari/WebKit (projet iPhone) n'inclut pas les liens dans l'ordre Tab
      // par défaut et sort transitoirement sur BODY entre deux sous-cycles :
      // l'ordre libre n'est donc pas comparable à Chromium. Le piège de bord
      // ci-dessus (les deux sens) et 1c (restitution du focus) couvrent WebKit.
    } else {
      // Ordre de tabulation : 30 Tab restent tous dans le tiroir, avec anneau visible.
      const visited = new Set<string>();
      for (let index = 1; index <= 30; index += 1) {
        await page.keyboard.press('Tab');
        const focused = await activeElement(page);
        expect(focused.inSheet, `Tab ${index} sort du tiroir (${focused.tag} ${focused.testid ?? ''})`).toBe(true);
        expect(focused.outlineStyle, `anneau absent sur Tab ${index}`).toBe('solid');
        expect(parseFloat(focused.outlineWidth), `anneau < 2 px sur Tab ${index}`).toBeGreaterThanOrEqual(2);
        visited.add(`${focused.tag}:${focused.testid ?? focused.ariaLabel ?? focused.text}`);
      }
      // Un vrai cycle : plusieurs arrêts distincts, pas un focus figé.
      expect(visited.size).toBeGreaterThanOrEqual(5);
    }

    await closeByEscape(page, 'communaute-v2-explore');
    await expect(trigger).toBeFocused();
  });

  /**
   * FID-079 — preuve du geste LensPager : seuil 48 px (`DEFAULT_SWIPE_THRESHOLD_PX`),
   * verrou d'axe à 8 px (`DEFAULT_MOVE_TOLERANCE_PX`) et vecteur vertical sans
   * changement. Le geste rejoue le contrat pointer du pager (voir `dragLensPager`).
   */
  test('1h. LensPager : sous-seuil 48 px inchangé, au-delà volet suivant, axe vertical ignoré', async ({ page }) => {
    await setupExplorer(page);
    const filter = (name: string) => tab(page, 'Filtres des carnets', name);
    const pagerIndex = () => page.locator('[data-lens-index]').last().getAttribute('data-lens-index');

    await expect(filter('Découvrir')).toHaveAttribute('aria-selected', 'true');
    expect(await pagerIndex()).toBe('0');

    // 1) Sous le seuil de 48 px : le volet ne change pas.
    await dragLensPager(page, { dx: -40, moves: 8 });
    await expect(filter('Découvrir')).toHaveAttribute('aria-selected', 'true');
    await expect(filter('Mes carnets')).toHaveAttribute('aria-selected', 'false');
    expect(await pagerIndex()).toBe('0');

    // 2) Au-delà de 48 px : volet suivant, même avec un premier mouvement < 8 px
    //    (tolérance d'axe : le verrou se pose au premier move qui la dépasse).
    await dragLensPager(page, { dx: -60, moves: 12 });
    await expect(filter('Mes carnets')).toHaveAttribute('aria-selected', 'true');
    expect(await pagerIndex()).toBe('1');

    // 3) Retour par glisser inverse (seuil franchi dans l'autre sens).
    await dragLensPager(page, { dx: 60 });
    await expect(filter('Découvrir')).toHaveAttribute('aria-selected', 'true');
    expect(await pagerIndex()).toBe('0');

    // 4) Vecteur vertical : |dy| > |dx| verrouille l'axe y → aucun changement,
    //    même si le déplacement horizontal dépasse 48 px.
    await dragLensPager(page, { dx: -160, dy: -170 });
    await expect(filter('Découvrir')).toHaveAttribute('aria-selected', 'true');
    expect(await pagerIndex()).toBe('0');
  });

  /** FID-082 — 360 px et 430 px : aucun débordement horizontal sur les 4 volets. */
  test('1i. 360 et 430 px : scrollWidth <= innerWidth sur les 4 volets', async ({ page }) => {
    await setupExplorer(page);
    for (const width of [360, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const volet of ['Carnets', 'Clubs', 'Sorties', 'Recherche']) {
        await tab(page, 'Volets de l’explorateur', volet).click();
        await page.waitForTimeout(400);
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(metrics.scrollWidth, `${volet} à ${width}px : débordement horizontal`).toBeLessThanOrEqual(
          metrics.innerWidth,
        );
      }
    }
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

  test('2d. Peek : appui long 460 ms, 4 actions dont Fermer, Échap ferme l’aperçu seul', async ({ page }) => {
    await setupExplorer(page);
    const tile = page.getByTestId('cv2-tile-carnet').first();
    await longPress(page, tile);

    const peek = page.getByRole('dialog', { name: /Aperçu :/ });
    await expect(peek).toBeVisible();
    // Maquette L1772 : `role=menu` et 4 `menuitem` (3 actions + « Fermer »).
    const actions = peek.getByRole('menu', { name: 'Actions' });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('menuitem')).toHaveCount(4);
    await expect(peek.getByRole('menuitem', { name: 'Fermer' })).toBeVisible();
    await expect(peek.locator('[data-cv2-peek-close]')).toHaveCSS('min-height', /44px|2\.75rem|44/);

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
    const emptyCta = empty.getByRole('button', { name: /Créer mon premier carnet/ });
    await expectNotCovered(page, emptyCta, { label: 'CTA état vide « Mes carnets »' });
    await emptyCta.click();

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
    // recouvert par la poignée de drag) — la garde le prouve au centre.
    await expectNotCovered(page, page.getByTestId('cv2-back'), { label: 'Retour détail club' });
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
    const openJoin = openTile.getByTestId('cv2-club-join');
    await expectNotCovered(page, openJoin, { label: 'Rejoindre un club ouvert' });
    await openJoin.click();
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
    const closedJoin = closedTile.getByTestId('cv2-club-join');
    await expectNotCovered(page, closedJoin, { label: 'Demander l’adhésion (club fermé)' });
    await closedJoin.click();
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
    await expectNotCovered(page, page.getByTestId('cv2-back'), { label: 'Retour détail sortie' });
    await page.getByTestId('cv2-back').click();

    const register = page.getByTestId('cv2-event-register').first();
    await expectNotCovered(page, register, { label: 'S’inscrire à une sortie' });
    await register.click();
    const island = page.locator('.lkdv-island-pill');
    await expect(island).toContainText('Inscription confirmée');
    await expect.poll(() => mock.getJoinedEvents()).toContain(EVENT_ID);
  });

  test('4c. sortie complète → liste d’attente', async ({ page }) => {
    const mock = await setupExplorer(page);
    await tab(page, 'Volets de l’explorateur', 'Sorties').click();

    const fullRegister = page.getByTestId('cv2-event-register').filter({ hasText: /Liste d’attente/ });
    await expect(fullRegister.first()).toBeVisible();
    await expectNotCovered(page, fullRegister.first(), { label: 'Liste d’attente' });
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

    // Garde-fou FID-001 : le repli de couverture (`.lkdv-cv2x-cover-fallback`,
    // positionné en absolu) doit rester DANS sa vignette 52×48. Sans
    // `position: relative` sur `.lkdv-cv2x-search-cover`, il s'étirait sur tout
    // le corps et masquait les résultats sans que `toBeVisible()` ne le voie.
    const fallbackBoxes = await page
      .locator('.lkdv-cv2x-cover-fallback')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })));
    for (const box of fallbackBoxes) {
      expect(box.w, 'repli de couverture échappé de sa vignette (largeur)').toBeLessThanOrEqual(60);
      expect(box.h, 'repli de couverture échappé de sa vignette (hauteur)').toBeLessThanOrEqual(56);
    }
    const covering = await page.evaluate(() => {
      const row = document.querySelector('.lkdv-cv2x-search-row');
      if (!row) return null;
      const r = row.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(20, r.height / 2));
      return { tag: top?.tagName ?? null, cls: (top as HTMLElement | null)?.className ?? null, inRow: row.contains(top) };
    });
    expect(covering?.inRow, `résultat recouvert par ${covering?.tag}.${covering?.cls}`).toBe(true);
    // FID-072/FID-074 : la garde générique couvre aussi le résultat cliquable.
    await expectNotCovered(page, page.getByTestId('cv2-tile-carnet').first(), {
      label: 'Résultat de recherche',
    });
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

    // Clic natif : la bascule n'est plus interceptée par le repli de couverture
    // (FID-001). Plus de clic DOM de contournement. La garde FID-074 le prouve
    // au centre avant le geste (la bascule est le CTA exact du P1).
    const mapToggle = page
      .getByRole('group', { name: 'Affichage des résultats' })
      .getByRole('button', { name: 'Sur la carte' });
    await expectNotCovered(page, mapToggle, { label: 'Bascule « Sur la carte »' });
    await mapToggle.click();
    await expect(page.locator('.lkdv-cv2x-search-map, canvas').first()).toBeVisible({ timeout: 15_000 });
  });

  /**
   * FID-074 — preuve de valeur de la garde : elle doit être ROUGE quand un
   * élément recouvre le CTA (même mécanisme que FID-001, où
   * `.lkdv-cv2x-cover-fallback` s'étirait sur le corps) et VERTE sur le build
   * actuel. On injecte un recouvrement DOM au runtime : aucun CSS de `src/`
   * n'est modifié.
   */
  test('5f. garde anti-recouvrement : rouge sur CTA recouvert, vert après retrait', async ({ page }) => {
    await openSearch(page);
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 10_000 });

    const mapToggle = page
      .getByRole('group', { name: 'Affichage des résultats' })
      .getByRole('button', { name: 'Sur la carte' });
    await expectNotCovered(page, mapToggle, { label: 'Bascule « Sur la carte » (saine)' });

    // Recouvrement de test : un calque plein cadre au-dessus de la bascule.
    await page.evaluate(() => {
      const toggle = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="group"][aria-label="Affichage des résultats"] button',
        ),
      ).find((button) => (button.textContent ?? '').includes('Sur la carte'));
      if (!toggle) throw new Error('bascule introuvable');
      const rect = toggle.getBoundingClientRect();
      const cover = document.createElement('div');
      cover.id = 'cv2-test-cover';
      cover.setAttribute('data-testid', 'cv2-test-cover');
      cover.style.cssText = [
        'position:fixed',
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        'z-index:2147483647',
        'background:rgba(224,80,28,.35)',
      ].join(';');
      document.body.appendChild(cover);
    });

    // La garde échoue bien (preuve qu'elle détecte la classe de FID-001).
    await expect(expectNotCovered(page, mapToggle, { label: 'Bascule recouverte (test)' })).rejects.toThrow(
      /RECOUVERT/,
    );

    await page.evaluate(() => document.getElementById('cv2-test-cover')?.remove());
    await expectNotCovered(page, mapToggle, { label: 'Bascule après retrait du recouvrement' });
  });
});

/**
 * FID-076 — états d'erreur des 3 volets et bandeau hors-ligne.
 * Un état d'erreur ne doit jamais dire « Aucun … » (confusion vide/erreur) ;
 * le hors-ligne conserve le dernier contenu affiché.
 */
test.describe('Explorer v2 — erreurs des volets et hors-ligne @ui-mock @mobile', () => {
  const PANES: Record<string, { id: string; title: string }> = {
    Carnets: { id: 'carnets', title: 'Carnets indisponibles' },
    Clubs: { id: 'clubs', title: 'Clubs indisponibles' },
    Sorties: { id: 'sorties', title: 'Sorties indisponibles' },
  };

  test('10a. Carnets/Clubs/Sorties en erreur : message dédié + Réessayer, jamais « Aucun … »', async ({
    page,
  }) => {
    const mock = await setupExplorer(page, { state: 'error' });

    for (const [volet, expected] of Object.entries(PANES)) {
      await tab(page, 'Volets de l’explorateur', volet).click();
      const pane = page.getByTestId(`cv2-pane-${expected.id}`);
      const error = pane.locator('.lkdv-cv2-error-state');
      await expect(error).toBeVisible({ timeout: 15_000 });
      await expect(error).toContainText(expected.title);
      await expect(error.getByRole('button', { name: 'Réessayer' })).toBeVisible();
      // L'erreur ne doit jamais emprunter le vocabulaire de l'état vide.
      await expect(error).not.toContainText('Aucun');
      await expect(pane.locator('.lkdv-cv2-empty'), `${volet} : état vide affiché à la place de l’erreur`).toHaveCount(
        0,
      );
    }

    // Les trois flux ont bien été sollicités (mock câblé, pas un faux vert).
    const feeds = mock.calls
      .filter((call) => call.kind === 'rpc')
      .map((call) => call.name)
      .filter((name) => /^community_(carnets|clubs|events)_feed$/.test(name));
    expect(new Set(feeds)).toEqual(
      new Set(['community_carnets_feed', 'community_clubs_feed', 'community_events_feed']),
    );
  });

  test('10b. une seule RPC en échec n’efface pas les autres volets', async ({ page }) => {
    await setupExplorer(page, { failRpcs: ['community_carnets_feed'] });

    // Carnets en erreur…
    await expect(page.getByTestId('cv2-pane-carnets').locator('.lkdv-cv2-error-state')).toContainText(
      'Carnets indisponibles',
      { timeout: 15_000 },
    );

    // …Clubs et Sorties restent servis normalement.
    await tab(page, 'Volets de l’explorateur', 'Clubs').click();
    await expect(page.getByTestId('cv2-tile-club').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cv2-pane-clubs').locator('.lkdv-cv2-error-state')).toHaveCount(0);

    await tab(page, 'Volets de l’explorateur', 'Sorties').click();
    await expect(page.getByTestId('cv2-tile-sortie').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cv2-pane-sorties').locator('.lkdv-cv2-error-state')).toHaveCount(0);
  });

  test('10c. hors-ligne : bandeau visible et dernier contenu conservé', async ({ page }) => {
    await setupExplorer(page);
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 15_000 });
    const tilesBefore = await page.getByTestId('cv2-tile-carnet').count();
    expect(tilesBefore).toBeGreaterThan(0);

    await page.context().setOffline(true);
    try {
      const banner = page.locator('.lkdv-cv2-offline');
      await expect(banner).toBeVisible({ timeout: 10_000 });
      await expect(banner).toContainText('Hors ligne');
      // « dernier contenu conservé » : les tuiles chargées restent affichées.
      await expect(page.getByTestId('cv2-tile-carnet')).toHaveCount(tilesBefore);
      await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible();
    } finally {
      await page.context().setOffline(false);
    }
    await expect(page.locator('.lkdv-cv2-offline')).toHaveCount(0, { timeout: 10_000 });
  });
});

/**
 * FID-075 — Échap hiérarchisé. Côté Explorer : menu de tri → peek → détail →
 * tiroir ; 1 Échap ferme 1 seul niveau, est consommée (`defaultPrevented`) et
 * le tiroir survit aux niveaux précédents. La confirmation de fermeture
 * (5e niveau) est couverte par `communaute-v2-creation.spec.ts` (6f) : elle
 * n'existe que dans le tiroir Création.
 */
test.describe('Explorer v2 — Échap hiérarchisé @ui-mock @mobile', () => {
  test('11a. menu de tri → peek → détail → tiroir : 1 Échap = 1 niveau', async ({ page }) => {
    await setupExplorer(page);

    // Niveau 1 — menu de tri : Échap le ferme, le tiroir reste ouvert.
    await page.getByTestId('cv2-sort-button').click();
    await expect(page.getByTestId('cv2-sort-menu')).toBeVisible();
    await expect(page.getByTestId('cv2-sort-menu').getByRole('menuitemradio').first()).toBeFocused();
    await pressEscapeAndExpectConsumed(page);
    await expect(page.getByTestId('cv2-sort-menu')).toHaveCount(0);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
    // Le menu rend le focus à son bouton (contrat SortMenuButton).
    expect((await activeElement(page)).testid).toBe('cv2-sort-button');

    // Niveau 2 — peek : Échap le ferme seul, la capsule et le fil restent.
    await longPress(page, page.getByTestId('cv2-tile-carnet').first());
    const peek = page.getByRole('dialog', { name: /Aperçu :/ });
    await expect(peek).toBeVisible();
    await pressEscapeAndExpectConsumed(page);
    await expect(peek).toHaveCount(0);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
    await expect(tab(page, 'Filtres des carnets', 'Découvrir')).toBeVisible();

    // Niveau 3 — détail empilé : Échap le ferme, la capsule revient.
    await tab(page, 'Volets de l’explorateur', 'Clubs').click();
    await page.getByTestId('cv2-tile-club').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();
    await expect(page.getByTestId('cv2-back')).toBeFocused();
    await pressEscapeAndExpectConsumed(page);
    await expect(page.getByTestId('cv2-detail')).toHaveCount(0);
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
    await expect(page.getByTestId('cv2-capsule')).toBeVisible();

    // Niveau 4 — le tiroir lui-même : Échap le ferme, focus au déclencheur.
    await pressEscapeAndExpectConsumed(page);
    await expect(page.getByTestId('communaute-v2-explore')).toHaveCount(0, { timeout: 5_000 });
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
