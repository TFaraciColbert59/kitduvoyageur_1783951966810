import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D14 — Voyages et sécurité (pôle CONF) — SOS', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-109 — SOS : prendre en charge, puis clore avec une note', async ({ page }) => {
    await page.goto('/sos/demo-sos-1');
    await expect(page.locator(sel.sos.root)).toBeVisible();
    await expect(page.locator(sel.sos.timeline)).toBeVisible();
    await page.locator(sel.sos.take).click();
    await expect(page.getByText(/pris en charge|vous suivez/i).first()).toBeVisible();
    await page.locator(sel.sos.close).click();
    await page.getByLabel(/note/i).fill('[TEST CRM] appel passé, personne en sécurité');
    await page.getByRole('button', { name: /^Clore/ }).click();
    await expectToast(page, /clos|clôtur/i);
    await expectJournalEntry(page, 'sos_ack_close', 'demo-sos-1');
  });

  test('ACT-108 — le tableau SOS de la file place les alertes en urgence haute', async ({ page }) => {
    await page.goto('/');
    const urgent = page.locator(`${sel.inbox.group}[data-group="urgence_haute"]`);
    await expect(urgent).toBeVisible();
    await expect(urgent.locator(sel.inbox.row).first()).toContainText(/SOS/i);
  });

  test('@mobile SOS sur téléphone : le 112 est visible et joignable sans défilement', async ({ page }) => {
    await page.goto('/sos/demo-sos-1');
    const call = page.locator(sel.sos.call112);
    await expect(call).toBeVisible();
    const box = await call.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(844);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(call).toHaveAttribute('href', /^tel:112$/);
    await expect(page.locator(sel.sos.position)).toBeVisible();
  });

  test('ACT-110 — un point de contrôle en retard apparaît dans « Délai bientôt »', async ({ page }) => {
    await page.goto('/');
    const soon = page.locator(`${sel.inbox.group}[data-group="delai_bientot"]`);
    await expect(soon).toBeVisible();
  });
});
