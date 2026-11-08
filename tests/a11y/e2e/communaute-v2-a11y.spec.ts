import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  SKIP_SERVER,
  SKIP_V2_BUILD,
  closeByEscape,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  isServerReady,
  openCreate,
  openExplorer,
} from '../../e2e/communaute-v2.fixtures';

/**
 * tests/a11y/e2e/communaute-v2-a11y.spec.ts
 *
 * Porte G6 (`05-QUALITE-ET-TESTS.md` § 1, `07-RECETTE` § A) — axe-core sur les
 * **deux tiroirs ouverts** de la Communauté v2 : capsule, mini-capsule, menu de
 * tri ouvert, détail empilé, Peek, formulaire à chaque étape/état d'erreur.
 * Critère : zéro violation `critical` ou `serious`.
 *
 * Surface mockée (`@ui-mock`) : aucun serveur Supabase, aucune donnée réelle.
 * Commande locale (build v2 démarré sur 4028) :
 *   PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
 *     tests/a11y/e2e/communaute-v2-a11y.spec.ts --project=iphone-14-pro
 *
 * `color-contrast` est désactivé comme dans les autres scans du dépôt : le verre
 * translucide des tiroirs fausse l'échantillonnage axe du fond ; le contraste
 * réel est mesuré par `npm run audit:contrast` (jetons).
 */

const AXE_DISABLED_RULES = ['color-contrast'];

/** Clic DOM direct : la poignée de drag de la coque recouvre le bouton Retour
 * sur certaines tailles d'écran (recouvrement à qualifier dans le rapport) —
 * le clic natif Playwright est refusé, le clic utilisateur déclenche l'action. */
async function domClick(locator: import('@playwright/test').Locator): Promise<void> {
  await locator.evaluate((element) => (element as HTMLElement).click());
}

test.setTimeout(150_000);

interface BlockingViolation {
  id: string;
  impact: string | null;
  help: string;
  targets: string[];
}

async function blockingViolations(page: Page): Promise<BlockingViolation[]> {
  const results = await new AxeBuilder({ page }).disableRules(AXE_DISABLED_RULES).analyze();
  return results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      help: violation.help,
      targets: violation.nodes.slice(0, 4).map((node) => node.target.join(' ')),
    }));
}

async function expectNoCriticalSerious(page: Page, surface: string): Promise<void> {
  const blocking = await blockingViolations(page);
  expect(
    blocking,
    `${surface} : ${blocking.length} violation(s) critique(s)/sérieuse(s)\n` +
      blocking.map((violation) => `- ${violation.id} [${violation.impact}] ${violation.help} → ${violation.targets.join(' | ')}`).join('\n'),
  ).toEqual([]);
}

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
});

test.beforeEach(() => {
  test.skip(!serverReady, SKIP_SERVER);
});

async function prepare(page: Page, options: Parameters<typeof installCommunityV2Mock>[1] = {}) {
  await installCommunityV2Mock(page, options);
  await freezeClock(page);
  await gotoCommunity(page);
}

test.describe('a11y — tiroir Explorer @ui-mock', () => {
  test('capsule + 4 volets + mini-capsule + menu de tri', async ({ page }) => {
    await prepare(page);
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);

    await expectNoCriticalSerious(page, 'Explorer › Carnets');

    const capsule = page.getByRole('tablist', { name: 'Volets de l’explorateur' });
    for (const volet of ['Recherche', 'Clubs', 'Sorties']) {
      await capsule.getByRole('tab', { name: volet }).click();
      await expectNoCriticalSerious(page, `Explorer › ${volet}`);
    }

    await capsule.getByRole('tab', { name: 'Carnets' }).click();
    await page.getByTestId('cv2-sort-button').click();
    await expect(page.getByTestId('cv2-sort-menu')).toBeVisible();
    await expectNoCriticalSerious(page, 'Explorer › menu de tri ouvert');
    await page.keyboard.press('Escape');
  });

  test('détails empilés, recherche et Peek', async ({ page }) => {
    await prepare(page);
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);

    // Détail club.
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Clubs' }).click();
    await page.getByTestId('cv2-tile-club').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();
    await expectNoCriticalSerious(page, 'Explorer › détail club');
    await domClick(page.getByTestId('cv2-back'));

    // Détail sortie.
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Sorties' }).click();
    await page.getByTestId('cv2-tile-sortie').first().click();
    await expect(page.getByTestId('cv2-detail')).toBeVisible();
    await expectNoCriticalSerious(page, 'Explorer › détail sortie');
    await domClick(page.getByTestId('cv2-back'));

    // Recherche : accueil + résultats.
    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Recherche' }).click();
    await expectNoCriticalSerious(page, 'Explorer › Recherche (accueil)');
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible({ timeout: 10_000 });
    await expectNoCriticalSerious(page, 'Explorer › Recherche (résultats)');
  });

  test('Peek (aperçu appui long) et états vide/erreur', async ({ page }) => {
    await prepare(page);
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);

    const tile = page.getByTestId('cv2-tile-carnet').first();
    const box = await tile.boundingBox();
    if (!box) throw new Error('tuile carnet sans boîte visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await expect(page.getByRole('dialog', { name: /Aperçu :/ })).toBeVisible();
    await expectNoCriticalSerious(page, 'Explorer › Peek');
    await page.keyboard.press('Escape');
    await closeByEscape(page, 'communaute-v2-explore');

    // État erreur (RPC en échec simulé).
    await prepare(page, { state: 'error' });
    test.skip(!(await openExplorer(page)), SKIP_V2_BUILD);
    await expect(page.getByRole('alert').or(page.getByText('Carnets indisponibles')).first()).toBeVisible({ timeout: 10_000 });
    await expectNoCriticalSerious(page, 'Explorer › état erreur');
  });
});

test.describe('a11y — tiroir Création @ui-mock', () => {
  const KINDS = ['Publication', 'Story', 'Carnet', 'Sortie', 'Kit', 'Club'] as const;

  test('formulaire à l’étape 1 des 6 types', async ({ page }) => {
    await prepare(page);
    test.skip(!(await openCreate(page, 'post')), SKIP_V2_BUILD);

    const capsule = page.getByRole('tablist', { name: 'Type de création' });
    for (const kind of KINDS) {
      await capsule.getByRole('tab', { name: kind }).click();
      await expectNoCriticalSerious(page, `Création › ${kind} › étape 1`);
    }

    // Étape 2 de Publication avec erreurs affichées une seule fois.
    await capsule.getByRole('tab', { name: 'Publication' }).click();
    await page.getByRole('radio', { name: /Billet/ }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByTestId('cv2-error-summary')).toBeVisible();
    await expectNoCriticalSerious(page, 'Création › Publication › étape 2 en erreur');

    // Confirmation de fermeture (alertdialog avec piège de focus).
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog', { name: 'Fermer sans publier ?' })).toBeVisible();
    await expectNoCriticalSerious(page, 'Création › confirmation de fermeture');
  });
});
