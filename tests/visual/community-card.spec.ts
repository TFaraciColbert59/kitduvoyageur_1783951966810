import { expect, test, type Page } from '@playwright/test';
import { installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/**
 * Contrat mesuré de la Communauté (430 × 932) : la page est figée, seul le fil
 * défile, et le drawer Créer est une carte en place aux mesures du Compte.
 */

async function openCreate(page: Page) {
  const fixture = await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  const card = page.locator('.lkdv-cd');
  await expect(card).toBeVisible();
  return card;
}

const pageScrolls = (page: Page) =>
  page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollHeight - window.innerHeight;
  });

test.describe('Communauté — page figée, carte-drawer', () => {
  test('la page ne défile pas, seul le fil défile', async ({ page }) => {
    const fixture = await installCommunityFeedFixture(page);
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
    void fixture;

    expect(await pageScrolls(page)).toBeLessThanOrEqual(1);
    const main = await page.locator('.lkdv-feed-main').evaluate((el) => getComputedStyle(el).overflowY);
    expect(main).toBe('auto');
    const others = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.lkdv-feed-shell, .lkdv-feed-column, .lkdv-feed-body, .lkdv-feed-under')].map(
        (el) => getComputedStyle(el).overflowY,
      ),
    );
    for (const overflow of others) expect(['visible', 'hidden']).toContain(overflow);
  });

  test('le drawer Créer est une carte aux mesures du Compte', async ({ page }, testInfo) => {
    const card = await openCreate(page);
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    if (viewport && viewport.width === 430) expect(Math.round(box!.width)).toBe(406);
    expect(await card.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('24px');

    const grab = await page.locator('.lkdv-cd-grab').boundingBox();
    expect(Math.round(grab!.height)).toBe(18);

    const capsule = await page.locator('.lkdv-drawer-tabs').boundingBox();
    expect(Math.round(capsule!.height)).toBe(48);
    if (viewport && viewport.width === 430) expect(Math.round(capsule!.width)).toBe(378);

    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toBeVisible();
    // Icônes seules : aucun libellé texte visible dans la capsule.
    const visibleText = await page.locator('.lkdv-drawer-tabs').evaluate((el) => (el as HTMLElement).innerText.trim());
    expect(visibleText).toBe('');

    expect(await pageScrolls(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('community-create-card.png') });
  });

  test('la sous-capsule de 30 px ne sert que la Publication', async ({ page }) => {
    await openCreate(page);
    const secondary = page.locator('.lkdv-drawer-secondary .ig-tabs');
    await expect(secondary).toBeVisible();
    expect(Math.round((await secondary.boundingBox())!.height)).toBe(30);
    await expect(secondary.getByRole('tab')).toHaveCount(4);

    await page.getByRole('tab', { name: 'Carnet' }).click();
    await expect(page.locator('.lkdv-drawer-secondary')).toHaveCount(0);
  });

  test('chaque volet de création tient dans la carte sans défiler', async ({ page }) => {
    await openCreate(page);
    for (const name of ['Publication', 'Carnet', 'Sortie', 'Kit', 'Club', 'Story']) {
      // Publication est déjà active à l'ouverture : un re-clic fermerait le drawer.
      if (name !== 'Publication') await page.getByRole('tab', { name, exact: true }).click();
      const pane = page.getByRole('tabpanel', { name, exact: true });
      await expect(pane.locator('.lkdv-wz')).toBeVisible();
      const overflow = await pane.evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(overflow, `volet ${name}`).toBeLessThanOrEqual(1);
    }
  });

  test('Échap, poignée et re-clic sur l’onglet actif ferment le drawer', async ({ page }) => {
    const card = await openCreate(page);
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);

    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    await expect(page.locator('.lkdv-cd')).toBeVisible();
    await page.locator('.lkdv-cd-grab').click();
    await expect(page.locator('.lkdv-cd')).toHaveCount(0);

    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    await page.getByRole('tab', { name: 'Publication', exact: true }).click();
    await expect(page.locator('.lkdv-cd')).toHaveCount(0);
  });

  test('un formulaire en étapes valide, avance et garde le brouillon', async ({ page }) => {
    await openCreate(page);
    await page.getByRole('tab', { name: 'Sortie', exact: true }).click();
    const pane = page.getByRole('tabpanel', { name: 'Sortie', exact: true });
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.getByRole('alert')).toContainText('Donne un titre');

    await pane.getByLabel('Titre').fill('Lac Blanc au lever du jour');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.getByText('Où & quand')).toBeVisible();
    await expect(pane.getByLabel('Lieu')).toBeVisible();

    // Fermer puis rouvrir : la saisie est restaurée depuis le brouillon local.
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    await page.getByRole('tab', { name: 'Sortie', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: 'Sortie', exact: true }).getByLabel('Titre')).toHaveValue(
      'Lac Blanc au lever du jour',
    );
  });
});
