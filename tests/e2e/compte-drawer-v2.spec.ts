import { test, expect, type Page } from '@playwright/test';

/**
 * Compte — drawer Profil v2 (tâche 14).
 *
 * - Propriétaire : ouvre les 5 slots (`data-testid="slot-content"`), vérifie le
 *   sélecteur `.ig-tabs` et le swipe des lentilles.
 * - Visiteur d'un profil public : les slots restent visibles.
 * - Le cas « compte privé sans invitation » est couvert par le test unitaire
 *   `src/components/compte/drawer/__tests__/PrivateAccount.test.tsx` : il ne
 *   dépend ni d'un serveur ni d'une session.
 *
 * Environnement : la spec ne fabrique aucune donnée. Sans serveur joignable ou
 * sans session Supabase (`LKDV_E2E_AUTH=1`, `AUDIT_EMAIL`, `AUDIT_PASSWORD`),
 * elle se saute avec une raison explicite au lieu d'échouer.
 */

const AUTH_ENABLED = process.env.LKDV_E2E_AUTH === '1';
const EMAIL = process.env.AUDIT_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;

const SKIP_AUTH =
  'compte-drawer-v2 : session Supabase requise — activer LKDV_E2E_AUTH=1 avec ' +
  'AUDIT_EMAIL et AUDIT_PASSWORD. Aucun mock : la spec se saute sans session.';
const SKIP_SERVER =
  'compte-drawer-v2 : serveur Next injoignable sur PW_BASE_URL. ' +
  'La spec se saute au lieu d’échouer.';

const SLOTS: Array<{ id: string; label: string }> = [
  { id: 'vitrine', label: 'Vitrine' },
  { id: 'kit', label: 'Kit' },
  { id: 'prets', label: 'Prêts' },
  { id: 'souvenirs', label: 'Souvenirs' },
  { id: 'communaute', label: 'Communauté' },
];

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  if (!baseURL) return;
  try {
    const response = await request.get(baseURL, {
      timeout: 8_000,
      failOnStatusCode: false,
    });
    serverReady = response.status() < 500;
  } catch {
    serverReady = false;
  }
});

test.beforeEach(() => {
  test.skip(!serverReady, SKIP_SERVER);
});

async function login(page: Page) {
  await page.goto('/connexion');
  await page.locator('input[type="email"]:visible').first().fill(EMAIL!);
  await page.locator('input[type="password"]:visible').first().fill(PASSWORD!);
  await page.locator('main form:visible').first().locator('button[type="submit"]').click();
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).some((cookie) => cookie.name.includes('auth-token')),
      { timeout: 20_000, message: 'session Supabase non établie' }
    )
    .toBe(true);
}

async function openRuntime(page: Page, slot: string) {
  await page.waitForFunction(
    () => typeof (window as unknown as { __lkdvOpenSlot?: unknown }).__lkdvOpenSlot === 'function'
  );
  await page.evaluate((id) => {
    (window as unknown as { __lkdvOpenSlot: (value: string) => void }).__lkdvOpenSlot(id);
  }, slot);
  await expect(page.locator('#lkdv-slot-root .lkdv-slot-shell')).toBeVisible();
  await expect(page.getByTestId('slot-content')).toHaveCount(1);
}

async function openOwnerDrawer(page: Page) {
  await page.goto('/compte');
  await openRuntime(page, 'vitrine');
  await expect(page.locator('.lkdv-slot-shell')).toHaveAttribute('data-viewer', 'owner');
  await expect(page.locator('.lkdv-slot-selector.ig-tabs')).toBeVisible();
}

/**
 * Le runtime démo ne renseigne pas `S.profile.viewer` : sans session, l'hôte
 * retombe sur `owner`. Pour exercer la vraie branche visiteur, on enveloppe
 * `__lkdvMountSlot` et on force le viewer avant de laisser l'hôte monter.
 */
async function impersonateVisitor(page: Page) {
  await page.waitForFunction(
    () => typeof (window as unknown as { __lkdvMountSlot?: unknown }).__lkdvMountSlot === 'function'
  );
  await page.evaluate(() => {
    const runtime = window as unknown as {
      __lkdvMountSlot: (root: HTMLElement, slotId: string, state: Record<string, any>) => void;
      __lkdvVisitorPatched?: boolean;
    };
    if (runtime.__lkdvVisitorPatched) return;
    runtime.__lkdvVisitorPatched = true;
    const mount = runtime.__lkdvMountSlot;
    runtime.__lkdvMountSlot = (root, slotId, state) => {
      state.profile = state.profile ?? {};
      state.profile.viewer = 'visitor';
      state.profile.profileVisibility = 'public';
      state.profile.profile_visibility = 'public';
      mount(root, slotId, state);
    };
  });
}

test.describe('Compte — drawer propriétaire', () => {
  test.beforeEach(() => {
    test.skip(!AUTH_ENABLED || !EMAIL || !PASSWORD, SKIP_AUTH);
  });

  test('ouvre les 5 slots, une seule pane de contenu à la fois', async ({ page }) => {
    await login(page);
    await openOwnerDrawer(page);

    for (const slot of SLOTS) {
      await page
        .locator('.lkdv-slot-selector')
        .getByRole('tab', { name: slot.label, exact: true })
        .click();
      await expect(page.locator('.lkdv-slot-title')).toHaveText(slot.label);
      await expect(page.getByTestId('slot-content')).toHaveCount(1);
      await expect(page.locator(`.lkdv-slot-shell[data-slot="${slot.id}"]`)).toBeVisible();
    }
  });

  test('le swipe des lentilles passe à la lentille suivante', async ({ page }) => {
    await login(page);
    await openOwnerDrawer(page);

    const pager = page.locator('.lkdv-lens-pager');
    await expect(pager).toHaveAttribute('data-lens-index', '0');
    const box = await pager.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const y = box.y + Math.min(box.height / 2, 120);
    const startX = box.x + box.width * 0.75;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 90, y, { steps: 8 });
    await page.mouse.up();

    await expect(pager).toHaveAttribute('data-lens-index', '1');
    await expect(page.getByTestId('slot-content')).toHaveAttribute('data-lens', 'repost');
  });
});

test.describe('Compte — visiteur d’un profil public', () => {
  test('voit les slots publics, jamais le verrou privé', async ({ page }) => {
    await page.goto('/compte');
    await impersonateVisitor(page);
    await openRuntime(page, 'vitrine');

    await expect(page.locator('.lkdv-slot-shell')).toHaveAttribute('data-viewer', 'visitor');
    await expect(page.locator('.lkdv-slot-selector.ig-tabs')).toBeVisible();
    await expect(page.locator('.lkdv-slot-title')).toHaveText('Vitrine');
    await expect(page.getByTestId('slot-content')).toHaveCount(1);
    await expect(page.getByText('Compte privé · accès sur invitation')).toHaveCount(0);
  });
});

test.describe('Compte — invitation à un profil privé', () => {
  test('un visiteur non connecté est redirigé vers la connexion avec next', async ({ page }) => {
    const token = 'jeton-profil-e2e';
    const next = encodeURIComponent(`/invitation/profil/${token}`);

    await page.goto(`/invitation/profil/${token}`);

    await expect(page).toHaveURL(new RegExp(`/connexion\\?next=${next}`));
    await expect(page.locator('input[type="email"]:visible').first()).toBeVisible();
  });
});

/**
 * C1 — rails horizontaux dans le pager.
 *
 * À 390 px, un geste horizontal sur le rail des clubs doit rendre la main au
 * scroller (le pager passe en `touch-action:auto`), faire défiler le rail sans
 * changer de lentille, puis restaurer le `pan-y` du pager.
 *
 * `Input.dispatchTouchEvent` injecte un geste brut : Chromium ne rejoue pas la
 * cascade `touch-action` pour ce geste synthétique. L'assertion sur le style
 * inline est donc la garde réelle du correctif ; `scrollLeft` et l'index de
 * lentille valident le parcours observable.
 */
test.describe('Compte — pager tactile et rails', () => {
  test.beforeEach(() => {
    test.skip(!serverReady, SKIP_SERVER);
  });

  test('à 390 px, le rail des clubs défile sans changer de lentille', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CDP touch requis (Chromium)');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/compte');
    await openRuntime(page, 'communaute');
    await page.locator('.flow').getByRole('tab', { name: 'Clubs', exact: true }).click();
    // Laisse le snap de 250 ms terminer : un boundingBox pris pendant la
    // translation pointerait un point que le doigt n'atteindrait plus.
    await page.waitForTimeout(400);

    const rail = page.getByTestId('club-rail');
    const pager = page.locator('.lkdv-lens-pager');
    await expect(rail).toBeVisible();
    await expect(pager).toHaveAttribute('data-lens-index', '1');
    expect(await rail.getByTestId('club-card').count()).toBeGreaterThan(1);

    const box = await rail.getByTestId('club-card').first().boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Le premier card est visible : un point à 70 % de sa largeur reste dans
    // le viewport de 390 px (les cards suivantes débordent à droite).
    const x = box.x + Math.min(box.width * 0.7, 300);
    const y = box.y + box.height / 2;
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    await expect(pager).toHaveCSS('touch-action', 'auto');

    for (let step = 1; step <= 10; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x - step * 14, y, id: 1 }],
      });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(200);
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(pager).toHaveAttribute('data-lens-index', '1');

    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(pager).toHaveAttribute('data-lens-index', '1');
    await expect(pager).toHaveCSS('touch-action', 'pan-y');
  });
});
