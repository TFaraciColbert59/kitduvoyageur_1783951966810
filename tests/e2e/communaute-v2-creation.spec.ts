import { test, expect, type Page } from '@playwright/test';

import {
  SKIP_REAL_DB,
  SKIP_SERVER,
  SKIP_V2_BUILD,
  expectNotCovered,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  isServerReady,
  openCreate,
  pressEscapeAndExpectConsumed,
  type CommunityV2Mock,
} from './communaute-v2.fixtures';

/**
 * tests/e2e/communaute-v2-creation.spec.ts
 *
 * Recette E2E du tiroir **Création** — `05-QUALITE-ET-TESTS.md` § 2 scénario 6
 * (`@ui-mock` : gestes, étapes, erreurs une seule fois, brouillon,
 * confirmation de fermeture, publication simulée par la RPC mockée).
 *
 * Les scénarios de création **réelles** (6 types contre une base migrée,
 * vérification en base) sont dans `communaute-v2-db.spec.ts`, gardés par
 * `LKDV_E2E_DB=test` : ils ne tournent jamais ici ni en prod.
 */

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
});

test.beforeEach(() => {
  test.skip(!serverReady, SKIP_SERVER);
});

async function setupCreate(
  page: Page,
  kind: 'post' | 'story' = 'post',
): Promise<CommunityV2Mock> {
  const mock = await installCommunityV2Mock(page);
  await freezeClock(page);
  await gotoCommunity(page);
  const opened = await openCreate(page, kind);
  if (!opened && mock.consoleErrors.length > 0) {
    console.log(`[openCreate] v2 non montée — console :\n${mock.consoleErrors.slice(0, 8).join('\n')}`);
  }
  test.skip(!opened, SKIP_V2_BUILD);
  return mock;
}

const KIND_LABELS: Record<string, { label: string; steps: string[] }> = {
  post: { label: 'Publication', steps: ['Étape 1 : Format', 'Étape 2 : Contenu', 'Étape 3 : Diffusion'] },
  story: { label: 'Story', steps: ['Étape 1 : Média', 'Étape 2 : Édition', 'Étape 3 : Diffusion'] },
  carnet: {
    label: 'Carnet',
    steps: ['Étape 1 : Infos', 'Étape 2 : Tracé', 'Étape 3 : Jours', 'Étape 4 : Partage'],
  },
  sortie: {
    label: 'Sortie',
    steps: [
      'Étape 1 : Activité et lieu',
      'Étape 2 : Itinéraire',
      'Étape 3 : Participants',
      'Étape 4 : Sécurité',
    ],
  },
  kit: { label: 'Kit', steps: ['Étape 1 : Inventaire', 'Étape 2 : Compléter', 'Étape 3 : Partager'] },
  club: {
    label: 'Club',
    steps: ['Étape 1 : Identité', 'Étape 2 : Univers', 'Étape 3 : Adhésion', 'Étape 4 : Publication'],
  },
};

test.describe('Création v2 — moteur commun, 6 types, étapes @ui-mock @mobile', () => {
  test('6a. ouverture par le +, capsule 6 types et mini-capsule d’étapes', async ({ page }) => {
    await setupCreate(page);

    await expect(page.getByTestId('communaute-v2-create')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Créer dans la communauté' })).toBeVisible();

    const capsule = page.getByRole('tablist', { name: 'Type de création' });
    await expect(capsule.getByRole('tab')).toHaveCount(6);
    await expect(page.getByTestId('cv2-form-post')).toBeAttached();

    // Défaut : Publication, étape 1 « Format » ; maquette : « Retour » visible mais
    // désactivé à la première étape (HTML L2715, FID-005).
    await expect(page.getByRole('tablist', { name: 'Étapes de la création : Publication' })).toBeVisible();
    await expect(
      page.getByRole('tablist', { name: 'Étapes de la création : Publication' }).getByRole('tab'),
    ).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retour' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Suivant' })).toBeVisible();

    // Chaque type a ses étapes exactes (`01` § 4.2).
    for (const [kind, config] of Object.entries(KIND_LABELS)) {
      await capsule.getByRole('tab', { name: config.label }).click();
      const form = page.getByTestId(`cv2-form-${kind}`);
      // Wrapper 0×0 : le contenu est porté par les panneaux d'étapes.
      await expect(form).toBeAttached();
      const steps = page.getByRole('tablist', {
        name: `Étapes de la création : ${config.label}`,
      });
      await expect(steps.getByRole('tab')).toHaveCount(config.steps.length);
      for (const stepLabel of config.steps) {
        await expect(steps.getByRole('tab', { name: stepLabel })).toHaveCount(1);
      }
      await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retour' })).toBeDisabled();
    }
  });

  test('6b. Suivant bloque avec focus sur le champ fautif, erreur affichée une seule fois', async ({
    page,
  }) => {
    await setupCreate(page);

    // Format « Billet » : titre + texte requis à l'étape Contenu.
    await page.getByRole('radio', { name: /Billet/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByTestId('cv2-form-post')).toHaveAttribute('data-step', '1');

    await page.getByRole('button', { name: 'Suivant' }).click();

    // Compteur en tête, sans répéter les messages.
    const summary = page.getByTestId('cv2-error-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/champs? à corriger/);

    // Chaque message est affiché une seule fois.
    await expect(page.getByText('Le titre est requis.')).toHaveCount(1);
    await expect(page.getByText('Le texte est requis.')).toHaveCount(1);

    // Le clic sur le compteur amène le focus sur le premier champ fautif.
    await summary.click();
    await expect(page.getByTestId('cv2-field-title').locator('input')).toBeFocused();

    // Corriger les deux champs fait disparaître le compteur et l'erreur.
    await page.getByTestId('cv2-field-title').locator('input').fill('Bivouac au Vercors');
    await page.getByTestId('cv2-field-content').locator('textarea').fill('Trois jours sur les crêtes.');
    // La revalidation des erreurs se fait au passage d'étape : le compteur
    // disparaît une fois le Suivant accepté.
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByTestId('cv2-form-post')).toHaveAttribute('data-step', '2');
    await expect(summary).toHaveCount(0);
  });

  test('6c. publication simulée : île « Publié », RPC create_community_post appelée, tiroir fermé', async ({
    page,
  }) => {
    const mock = await setupCreate(page);
    await page.getByRole('radio', { name: /Billet/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByTestId('cv2-field-title').locator('input').fill('Bivouac au Vercors');
    await page.getByTestId('cv2-field-content').locator('textarea').fill('Trois jours sur les crêtes.');
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByTestId('cv2-form-post')).toHaveAttribute('data-step', '2');

    await page.getByRole('button', { name: 'Publier' }).click();
    const island = page.getByTestId('cv2-island');
    await expect(island).toContainText('Publié', { timeout: 15_000 });
    await expect
      .poll(() => mock.calls.filter((call) => call.kind === 'rpc' && call.name === 'create_community_post'))
      .toHaveLength(1);
    await expect(page.getByTestId('communaute-v2-create')).toHaveCount(0, { timeout: 10_000 });
  });

  test('6d. confirmation de fermeture (piège de focus) puis brouillon restauré', async ({ page }) => {
    await setupCreate(page);
    await page.getByRole('radio', { name: /Billet/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByTestId('cv2-field-title').locator('input').fill('Bivouac au Vercors');
    // Laisse le brouillon débattu (400 ms) s'écrire avant la fermeture.
    await page.waitForTimeout(650);

    await page.keyboard.press('Escape');
    const confirm = page.getByRole('alertdialog', { name: 'Fermer sans publier ?' });
    await expect(confirm).toBeVisible();

    // Piège de focus : l'ouverture focalise « Continuer l'édition », Tab boucle
    // entre les deux boutons (jamais hors du dialogue).
    await expect(confirm.getByRole('button', { name: 'Continuer l’édition' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(confirm.getByRole('button', { name: 'Fermer' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(confirm.getByRole('button', { name: 'Continuer l’édition' })).toBeFocused();

    await confirm.getByRole('button', { name: 'Continuer l’édition' }).click();
    await expect(confirm).toHaveCount(0);

    // Fermeture réelle : le brouillon est écrit puis restauré à la réouverture.
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByTestId('communaute-v2-create')).toHaveCount(0, { timeout: 5_000 });

    await openCreate(page, 'post');
    const banner = page.getByTestId('cv2-draft-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Brouillon restauré');
    // FID-034 : « Effacer » ouvre la confirmation « Effacer le brouillon ? ».
    await banner.getByRole('button', { name: 'Effacer' }).click();
    const clearConfirm = page.getByRole('alertdialog', { name: 'Effacer le brouillon ?' });
    await expect(clearConfirm).toBeVisible();
    await clearConfirm.getByRole('button', { name: 'Effacer' }).click();
    await expect(banner).toHaveCount(0);
  });

  test('6e. étape 1 d’une story : champ média présent, diffusion non atteignable sans média', async ({
    page,
  }) => {
    await setupCreate(page, 'story');
    await expect(page.getByTestId('cv2-form-story')).toBeAttached();
    // Le champ média est le sélecteur de fichier natif (galerie) : présent.
    await expect(page.locator('input[type="file"]').first()).toBeAttached();
    await page.getByRole('button', { name: 'Suivant' }).click();
    // Média requis : l'étape ne s'ouvre pas, l'erreur est affichée une fois sous
    // le champ (le compteur de tête n'est rendu que pour les erreurs de champs
    // texte du moteur).
    await expect(page.getByTestId('cv2-form-story')).toHaveAttribute('data-step', '0');
    await expect(page.getByText('Ajoute une photo ou une vidéo.')).toHaveCount(1);
  });

  /**
   * FID-075 (niveau confirmation) — Échap hiérarchisé dans le tiroir Création :
   * 1 Échap ouvre/ferme UNIQUEMENT la confirmation, le tiroir et le contenu
   * survivent. Le niveau « tiroir » n'est atteint qu'après la fermeture réelle.
   */
  test('6f. Échap : confirmation de fermeture seule, le tiroir et le contenu survivent', async ({ page }) => {
    await setupCreate(page);
    await page.getByRole('radio', { name: /Billet/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    const title = page.getByTestId('cv2-field-title').locator('input');
    await title.fill('Bivouac au Vercors');
    // Laisse le brouillon débattu (400 ms) s'écrire avant la fermeture.
    await page.waitForTimeout(650);
    await expect(title).toBeFocused();

    // Niveau confirmation : Échap ouvre la confirmation, consommée par la coque.
    await pressEscapeAndExpectConsumed(page);
    const confirm = page.getByRole('alertdialog', { name: 'Fermer sans publier ?' });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Continuer l’édition' })).toBeFocused();

    // 2e Échap : ferme la confirmation SEULE, le tiroir reste ouvert et le
    // focus revient au champ déclencheur (nettoyage de l'effet de confirmation).
    await pressEscapeAndExpectConsumed(page);
    await expect(confirm).toHaveCount(0);
    await expect(page.getByTestId('communaute-v2-create')).toBeVisible();
    await expect(page.getByTestId('cv2-form-post')).toBeAttached();
    await expect(title).toBeFocused();

    // Le tiroir a survécu : un 3e Échap rouvre la confirmation (même contenu).
    await pressEscapeAndExpectConsumed(page);
    await expect(confirm).toBeVisible();
    await expect(title).toHaveValue('Bivouac au Vercors');
    await confirm.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByTestId('communaute-v2-create')).toHaveCount(0, { timeout: 10_000 });
  });

  /**
   * FID-074 — garde anti-recouvrement appliquée aux derniers champs et au
   * bouton final des formulaires cités par le P1/P2 : Story Média, Kit
   * Inventaire, Club Univers, Sortie Étape 1. Couvre la classe de régression
   * FID-001 (un descendant absolu qui s'échappe et intercepte le geste).
   */
  test('6g. derniers champs et bouton final non recouverts (Story, Kit, Club Univers, Sortie)', async ({
    page,
  }) => {
    await setupCreate(page);
    const capsule = page.getByRole('tablist', { name: 'Type de création' });
    const footNext = page.locator('.lkdv-cv2c-next');

    await expectNotCovered(page, footNext, { label: 'Pied de formulaire — Suivant (Publication)' });

    // Story — étape 1 « Média » : le champ média (galerie) est le dernier champ.
    await capsule.getByRole('tab', { name: 'Story' }).click();
    await expect(page.getByTestId('cv2-field-media')).toBeAttached();
    await expectNotCovered(page, page.getByTestId('cv2-field-media'), {
      label: 'Story Média — champ média',
    });
    await expectNotCovered(page, footNext, { label: 'Story Média — bouton final' });

    // Kit — étape 1 « Inventaire » : sélecteur d’objets.
    await capsule.getByRole('tab', { name: 'Kit' }).click();
    await expect(page.getByTestId('cv2-field-items')).toBeAttached();
    await expectNotCovered(page, page.getByTestId('cv2-field-items'), {
      label: 'Kit Inventaire — champ objets',
    });
    await expectNotCovered(page, footNext, { label: 'Kit Inventaire — bouton final' });

    // Club — maquette : activités + zone d'activité en étape 1 « Identité »
    // (FID-064), le dernier champ de l'étape 2 « Univers » est la description.
    await capsule.getByRole('tab', { name: 'Club' }).click();
    const clubName = page.getByTestId('cv2-field-name').locator('input');
    await expect(clubName).toBeVisible();
    await clubName.fill('Club des Crêtes');
    await page.getByRole('button', { name: 'Randonnée' }).first().click();
    const universZone = page.getByTestId('cv2-field-locationLabel').locator('input');
    await expect(universZone).toBeVisible();
    await expectNotCovered(page, universZone, { label: 'Club Identité — zone d’activité' });
    await page
      .getByRole('tablist', { name: 'Étapes de la création : Club' })
      .getByRole('tab', { name: /Étape 2/ })
      .click();
    await expect(page.getByTestId('cv2-form-club')).toHaveAttribute('data-step', '1');
    const clubDescription = page.getByTestId('cv2-field-description').locator('textarea');
    await expect(clubDescription).toBeVisible();
    await expectNotCovered(page, clubDescription, { label: 'Club Univers — description' });
    await expectNotCovered(page, footNext, { label: 'Club Univers — bouton final' });

    // Sortie — étape 1 : dernier champ = point de rendez-vous.
    await capsule.getByRole('tab', { name: 'Sortie' }).click();
    await expect(page.getByTestId('cv2-form-sortie')).toHaveAttribute('data-step', '0');
    const meeting = page.getByTestId('cv2-field-meetingPoint').locator('input');
    await expect(meeting).toBeVisible();
    await expectNotCovered(page, meeting, { label: 'Sortie Étape 1 — point de rendez-vous' });
    await expectNotCovered(page, footNext, { label: 'Sortie Étape 1 — bouton final' });
  });

  /** FID-082 — 360 px et 430 px : les 6 types à l’étape 1 sans débordement. */
  test('6h. 360 et 430 px : scrollWidth <= innerWidth sur les 6 types (étape 1)', async ({ page }) => {
    await setupCreate(page);
    const capsule = page.getByRole('tablist', { name: 'Type de création' });
    for (const width of [360, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const kind of ['Publication', 'Story', 'Carnet', 'Sortie', 'Kit', 'Club']) {
        await capsule.getByRole('tab', { name: kind }).click();
        await page.waitForTimeout(350);
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(
          metrics.scrollWidth,
          `${kind} à ${width}px : débordement horizontal (${metrics.scrollWidth} > ${metrics.innerWidth})`,
        ).toBeLessThanOrEqual(metrics.innerWidth);
      }
    }
  });
});

test.describe('Création v2 — données réelles (base migrée requise) @mobile', () => {
  test('6/10. création réelle des 6 types + vérification en base', async () => {
    test.skip(process.env.LKDV_E2E_DB !== 'test', SKIP_REAL_DB);
    test.skip(
      true,
      'Prête à tourner quand la base de test sera migrée : voir tests/e2e/communaute-v2-db.spec.ts.',
    );
  });
});
