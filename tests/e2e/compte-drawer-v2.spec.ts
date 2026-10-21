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
