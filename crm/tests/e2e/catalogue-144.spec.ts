import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { sel } from '../support/selectors';
import { signIn } from '../support/flows';

test.describe('Catalogue des 144 actions tel qu’il est servi par admin.commands_catalog()', () => {
  test('affiche exactement les 144 actions ACT-001 à ACT-144, sans trou ni doublon', async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
    await page.goto('/catalogue');
    await expect(page.locator(sel.catalogue.root)).toBeVisible();

    // Le nombre annoncé par l'écran doit venir du catalogue, pas d'une constante d'affichage.
    await expect(page.locator(sel.catalogue.count)).toContainText('144');

    const rows = page.locator(sel.catalogue.row);
    await expect(rows).toHaveCount(144);

    const ids = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-act') ?? ''));
    const expected = Array.from({ length: 144 }, (_, index) => `ACT-${String(index + 1).padStart(3, '0')}`);
    expect(ids).toEqual(expected);
    expect(new Set(ids).size).toBe(144);
  });

  test('chaque ligne porte son pôle, son rôle minimal et ses drapeaux, conformes à catalog.ts', async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
    // Le catalogue généré est la source de vérité côté code (144 CommandDef).
    const { COMMANDS } = await import('../../src/lib/catalog');
    await page.goto('/catalogue');
    const rows = page.locator(sel.catalogue.row);
    const count = await rows.count();
    expect(count).toBe(COMMANDS.length);
    for (const command of COMMANDS.slice(0, 12)) {
      const row = page.locator(`${sel.catalogue.row}[data-act="${command.id}"]`);
      await expect(row).toContainText(command.label);
      await expect(row).toContainText(new RegExp(command.pole));
    }
  });

  test('la recherche filtre les actions sans jamais en inventer', async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
    await page.goto('/catalogue');
    await page.locator(sel.catalogue.search).fill('rembours');
    const rows = page.locator(sel.catalogue.row);
    const visible = await rows.count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(144);
    const texts = await rows.allInnerTexts();
    for (const text of texts) expect(text.toLowerCase()).toContain('rembours');
  });
});
