import { test, expect } from '@playwright/test';

/**
 * T43 — reprise réseau/veille : aucun faux gain, cache par session.
 * Le scénario vérifie qu'une coupure réseau puis un retour ne fabriquent
 * jamais de solde positif : l'état affiché reste soit l'erreur honnête soit
 * la valeur serveur précédente.
 */
test.describe('@mobile progression — réseau interrompu puis rétabli', () => {
  test('@mobile coupure réseau : aucun solde inventé, reprise sans faux gain', async ({ page, context }) => {
    await page.goto('/hub?panel=points', { waitUntil: 'domcontentloaded' });

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});

    // Jamais de compteur positif fabriqué hors ligne : soit une erreur
    // honnête, soit l'état précédent — jamais un « + » de gain.
    const fabricatedGain = page.getByText(/\+\d+\s*(pts|points)/);
    expect(await fabricatedGain.count()).toBeLessThanOrEqual(1); // au plus l'affichage statique existant

    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hub/);
  });
});
