import { capture } from '../_lib/fixtures';
import { aiState, expectNoHorizontalScroll, openStart, prepareButton, requestBox, stepButton } from '../_lib/compas';
import { BASE_URL } from '../_lib/env';
import { gotoRetry } from '../_lib/net';
import { coverInert, expect, test } from '../commun/_fx';

/**
 * Étape « Départ » : le Compas vide (`/compas?nouvelle=1`) et le choix du voyage. Aucune
 * préparation n'est lancée ici (le lot « Où » le fait) : la demande est saisie, lue, précisée.
 * Les contrôles qui exigent deux comptes ou un compte non anonyme sont dits non testables dans
 * `docs/compas/phase7/constats/depart-commun-verdict.md`.
 */
const START = 'src/features/compas/components/CompasStart.tsx::CompasStart';
const startId = (key: string, tag = 'button') => `${START}::${tag}::${key}`;
// Le nom accessible d'une tuile commence par le nom de son icône (« footprints Randonnée ») : on la retrouve par son libellé.
const tile = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.cp-precise .cp-tile').filter({ has: page.locator('span', { hasText: new RegExp(`^${name}$`) }) });
const understoodRow = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.cp-fsum .cp-fr').filter({ has: page.locator('.cp-fr__l', { hasText: label }) });

const TILES: Array<[string, string]> = [
  ['Randonnée', 'hiking'],
  ['Trek', 'trekking'],
  ['Vélo', 'cycling'],
  ['Road trip', 'roadtrip'],
  ['City trip', 'citytrip'],
  ['Plage', 'beach'],
  ['Ski', 'ski'],
];
const MORE_TILES: Array<[string, string]> = [
  ['Trail', 'trail'],
  ['Course à pied', 'running'],
  ['Bivouac', 'bivouac'],
  ['Alpinisme', 'mountaineering'],
  ['Escalade', 'climbing'],
  ['Eau', 'water'],
  ['Van', 'vanlife'],
  ['Culturel', 'cultural'],
  ['Bushcraft', 'bushcraft'],
  ['Mixte', 'mixed'],
];

test.describe('@etape:depart compas-vide', () => {
  test('capsule d’étapes : « Où » seule est ouverte, les quatre autres sont inertes et le disent', async ({ anonymousPage }) => {
    const { page, cover } = anonymousPage;
    await openStart(page);
    await expectNoHorizontalScroll(page);
    const steps = page.locator('.compas--start .cp-steps');
    await expect(steps.getByRole('button')).toHaveCount(5);

    await cover.click(
      steps.getByRole('button', { name: 'Où', exact: true }),
      'l’étape « Où » reste l’étape courante et le Compas reste vide',
      async () => {
        await expect(steps.getByRole('button', { name: 'Où', exact: true })).toHaveAttribute('aria-current', 'step');
        await expect(page.locator('.compas--start')).toHaveCount(1);
      },
      { control: startId('COMPAS_STEPS:ou') }
    );

    for (const [label, id] of [
      ['Nous', 'nous'],
      ['Résa', 'resa'],
      ['Verdict', 'verdict'],
      ['Kit', 'kit'],
    ] as const) {
      const b = steps.getByRole('button', { name: label, exact: true });
      await coverInert(
        cover,
        b,
        `« ${label} » est désactivée (raison dite : « Disponible dès le premier choix »), elle n’ouvre rien`,
        async () => {
          await expect(b).toBeDisabled();
          await expect(b).not.toHaveAttribute('aria-current', 'step');
          await expect(b).toHaveAttribute('title', 'Disponible dès le premier choix');
          await expect(page.locator('#cp-start-locked')).toHaveText('Disponible dès le premier choix');
          await expect(page.locator('.compas--start')).toHaveCount(1);
        },
        { control: startId(`COMPAS_STEPS:${id}`) }
      );
    }
    await capture(page, 'capsule');
  });

  test('« Ta demande » est lue à la frappe ; « Préciser » ouvre activités, durée et personnes', async ({ anonymousPage }) => {
    const { page, cover } = anonymousPage;
    await openStart(page);
    test.info().annotations.push({ type: 'IA', description: await aiState(page) });
    await expect(prepareButton(page)).toBeDisabled();

    await cover.type(
      requestBox(page),
      '4 jours en Chartreuse à 3',
      'la demande est lue : le résumé « ce que j’ai compris » apparaît et « Préparer » devient actif',
      async () => {
        await expect(page.locator('.cp-understood__h')).toBeVisible();
        await expect(page.locator('.cp-fsum')).toContainText('Chartreuse');
        await expect(prepareButton(page)).toBeEnabled();
      }
    );

    const details = page.locator('details.cp-precise');
    await cover.click(page.locator('details.cp-precise > summary'), 'le volet « Préciser » s’ouvre sur les activités', async () => {
      await expect(details).toHaveAttribute('open', '');
      await expect(tile(page, 'Randonnée')).toBeVisible();
    });

    // Les sept premières activités, avant « Plus ».
    await expect(page.locator('.cp-tile')).toHaveCount(TILES.length + 1);
    for (const [name, key] of TILES) {
      await cover.click(
        tile(page, name),
        `« ${name} » est choisie : la tuile est appuyée et la ligne « Activité » du résumé la dit, précisée`,
        async () => {
          await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'true');
          await expect(page.locator('.cp-tile[aria-pressed="true"]')).toHaveCount(1);
          const row = understoodRow(page, 'Activité');
          await expect(row).toContainText(name);
          await expect(row).toHaveAttribute('data-state', 'precise');
        },
        { control: startId(`ACTIVITY_ORDER:${key}`) }
      );
    }
    // Rappuyer sur la tuile choisie la retire (retour à l’activité lue dans la phrase).
    await cover.click(tile(page, 'Ski'), 'rappuyer sur la tuile choisie la retire : plus aucune activité précisée', () =>
      expect(page.locator('.cp-tile[aria-pressed="true"]')).toHaveCount(0)
    , { control: startId('ACTIVITY_ORDER:ski') });

    await cover.click(
      page.locator('.cp-precise .cp-tile').filter({ hasText: /^Plus$/ }),
      '« Plus » déplie toutes les activités et disparaît',
      async () => {
        await expect(page.locator('.cp-tile')).toHaveCount(TILES.length + MORE_TILES.length);
        await expect(page.locator('.cp-tile').filter({ hasText: /^Plus$/ })).toHaveCount(0);
      },
      { control: startId('compas.start.moreActivities') }
    );
    for (const [name, key] of MORE_TILES) {
      await cover.click(
        tile(page, name),
        `« ${name} » est choisie : la tuile est appuyée et le résumé la dit, précisée`,
        async () => {
          await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'true');
          await expect(page.locator('.cp-tile[aria-pressed="true"]')).toHaveCount(1);
          await expect(understoodRow(page, 'Activité')).toContainText(name);
          await expect(understoodRow(page, 'Activité')).toHaveAttribute('data-state', 'precise');
        },
        { control: startId(`ACTIVITY_ORDER:${key}`) }
      );
    }
    await capture(page, 'activites');
  });

  test('durée et personnes : « plus » et « moins » précisent le résumé, « auto » les rend', async ({ anonymousPage }) => {
    const { page, cover } = anonymousPage;
    await openStart(page);
    await requestBox(page).fill('un week-end à Annecy');
    await page.locator('details.cp-precise > summary').click();
    const rows = page.locator('.cp-precise__row');
    const days = rows.nth(0);
    const party = rows.nth(1);

    for (const [row, label, noun, ctrlOne, ctrlOther] of [
      [days, 'Durée', ['jour', 'jours'], '1 jour', '2 jours'],
      [party, 'Personnes', ['personne', 'personnes'], '1 personne', '2 personnes'],
    ] as const) {
      const out = row.locator('output');
      const more = row.getByRole('button', { name: `${label} : plus` });
      const less = row.getByRole('button', { name: `${label} : moins` });
      await expect(out).toHaveText('auto');
      await expect(less).toBeDisabled();
      await cover.click(
        more,
        `« ${label} : plus » passe de « auto » à ${ctrlOne}`,
        async () => {
          await expect(out).toHaveText(ctrlOne);
          await expect(less).toBeEnabled();
        },
        { control: startId('compas.start.stepperMore') }
      );
      await cover.click(
        more,
        `un second « ${label} : plus » passe à ${ctrlOther}`,
        () => expect(out).toHaveText(ctrlOther),
        { control: startId('compas.start.stepperMore') }
      );
      if (label === 'Durée') await expect(understoodRow(page, 'Durée')).toContainText(ctrlOther);
      await cover.click(
        less,
        `« ${label} : moins » revient à ${ctrlOne}`,
        async () => {
          await expect(out).toHaveText(ctrlOne);
        },
        { control: startId('compas.start.stepperLess') }
      );
      await cover.click(less, `« ${label} : moins » rend « auto »`, () => expect(out).toHaveText('auto'), {
        control: startId('compas.start.stepperLess'),
      });
      void noun;
    }
    await capture(page, 'durees');
  });
});

test.describe('@etape:depart accessibilite', () => {
  test('constat D-33 : une tuile d’activité se nomme par son libellé (« Randonnée »), pas par son icône (« footprints Randonnée »)', async ({ anonymousPage }) => {
    const { page } = anonymousPage;
    test.info().annotations.push({ type: 'constat', description: 'D-33' });
    await openStart(page);
    await page.locator('details.cp-precise > summary').click();
    const named = page.locator('.cp-precise').getByRole('button', { name: 'Randonnée', exact: true });
    expect(await page.locator('.cp-precise .cp-tile').first().getAttribute('title')).toBeTruthy();
    await expect(named, 'D-33 : le nom accessible de la tuile commence par le nom de son icône').toHaveCount(1);
  });
});

test.describe('@etape:depart sans-session', () => {
  test('sans session : « Connecte-toi » et « Préparer mon aventure » mènent à la connexion', async ({ anonymousPage }) => {
    const { page, cover } = anonymousPage;
    await gotoRetry(page, `${BASE_URL}/compas?nouvelle=1`);
    await expect(page.locator('.compas--start')).toBeVisible({ timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    await expect(page.locator('.cp-note').filter({ hasText: 'pour enregistrer ton aventure' })).toBeVisible();

    await cover.click(
      page.getByRole('link', { name: 'Connecte-toi', exact: true }),
      'le lien mène à /connexion et garde le retour au Compas',
      async () => {
        await page.waitForURL((u) => u.pathname.startsWith('/connexion'));
        expect(new URL(page.url()).searchParams.get('next')).toBe('/compas');
      },
      { control: startId('compas.start.signInLink', 'a') }
    );

    await gotoRetry(page, `${BASE_URL}/compas?nouvelle=1`);
    await expect(page.locator('.compas--start')).toBeVisible({ timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    await page.getByRole('textbox', { name: 'Ta demande' }).fill('');
    await page.getByRole('textbox', { name: 'Ta demande' }).pressSequentially('3 jours dans le Vercors à 2', { delay: 10 });
    await cover.click(
      prepareButton(page),
      'sans session, « Préparer mon aventure » ne crée rien et renvoie à /connexion',
      async () => {
        await page.waitForURL((u) => u.pathname.startsWith('/connexion'));
        expect(new URL(page.url()).searchParams.get('next')).toBe('/compas');
      },
      { control: startId('compas.start.creating') }
    );
  });

  test('mention de l’IA : « Ce qui lui est envoyé » mène à la politique de confidentialité (si l’IA est allumée)', async ({ anonymousPage }) => {
    const { page, cover } = anonymousPage;
    await gotoRetry(page, `${BASE_URL}/compas?nouvelle=1`);
    await expect(page.locator('.compas--start')).toBeVisible({ timeout: 90_000 });
    const state = await aiState(page);
    test.info().annotations.push({ type: 'IA', description: state });
    test.skip(state === 'éteinte', 'IA éteinte sur cet aperçu : la mention et son lien ne sont pas rendus (PLAN-100 5.3).');
    await expect(page.locator('.cp-ai')).toContainText('IA');
    await cover.click(
      page.locator('.cp-ai').getByRole('link', { name: 'Ce qui lui est envoyé' }),
      'le lien ouvre la politique de confidentialité',
      async () => {
        await page.waitForURL((u) => u.pathname.startsWith('/politique-confidentialite'));
      }
    );
  });
});

test.describe('@etape:depart choix-du-voyage', () => {
  test('aucune aventure active mais des voyages : on choisit, ou on crée une nouvelle aventure', async ({ page, cover, context, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    // Sans cookie d'aventure active, le Compas ouvre le voyage géolocalisé le plus récent. Le cookie du hub
    // posé sur « possession » (le choix explicite « aucune aventure ») donne exactement le cas « aucune
    // active, des voyages » : le choix du voyage.
    const url = new URL(BASE_URL);
    const possession = Buffer.from(JSON.stringify({ nature: 'possession' }), 'utf-8').toString('base64url');
    try {
      await context.addCookies([{ name: 'lkv_active_adventure', value: possession, domain: url.hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
      await gotoRetry(page, `${BASE_URL}/compas`);
      await expect(page.locator('.compas--empty')).toBeVisible({ timeout: 90_000 });
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await capture(page, 'choix');

      await cover.click(
        page.getByRole('link', { name: 'Nouvelle aventure' }),
        'le lien ouvre le Compas vide (?nouvelle=1)',
        async () => {
          await page.waitForURL((u) => u.search.includes('nouvelle=1'));
          await expect(page.locator('.compas--start')).toBeVisible();
        }
      );

      await gotoRetry(page, `${BASE_URL}/compas`);
      await expect(page.locator('.compas--empty')).toBeVisible({ timeout: 90_000 });
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
      await cover.click(
        page.locator('.cp-list .cp-row').first(),
        'toucher un voyage l’ouvre : le Compas complet remplace le choix',
        async () => {
          await expect(page.locator('.compas .cp-steps .cp-step').first()).toBeVisible({ timeout: 60_000 });
          await expect(page.locator('.compas--empty')).toHaveCount(0);
        }
      );
    } finally {
      // Le choix explicite est effacé : le compte de ce lot retrouve son voyage par défaut.
      await context.clearCookies({ name: 'lkv_active_adventure' });
    }
    await expect(stepButton(page, 'ou')).toBeVisible();
  });
});
