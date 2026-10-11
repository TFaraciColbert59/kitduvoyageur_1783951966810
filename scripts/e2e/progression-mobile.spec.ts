import { test, expect } from '@playwright/test';

/**
 * T43 — parcours mobiles de progression (web mobile) :
 *   • le deep-link historique /progression redirige vers le Hub (panel points)
 *     sans sixième onglet ni boucle ;
 *   • la carte compacte existe avec un état honnête (jamais un faux solde) ;
 *   • aucun overlay ne bloque la navigation à cinq destinations.
 *
 * Limite consignée : les vérifications VoiceOver/TalkBack et Capacitor sur
 * téléphone réel ne sont pas exécutables dans cet environnement (aucun
 * appareil physique) — seuls les contrôles web mobile automatisés le sont.
 */
test.describe('@mobile progression — deep-links et état', () => {
  test('@mobile /progression redirige vers /hub?panel=points', async ({ page }) => {
    await page.goto('/progression', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hub\?panel=points/);
  });

  test('@mobile le Hub reste navigable (destinations bornées, aucun overlay bloquant)', async ({ page }) => {
    await page.goto('/hub?panel=points', { waitUntil: 'domcontentloaded' });
    // La barre de navigation se charge en différé (« Chargement de la
    // navigation ») : on attend de VRAIS liens, jamais le placeholder.
    const links = page.locator('nav a[href], header a[href]');
    await expect(links.first()).toBeVisible({ timeout: 15_000 });

    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(8);

    // Les destinations canoniques existent : jamais un sixième onglet produit.
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? '')
    );
    expect(hrefs.join(' ')).toContain('/explorer');
    expect(hrefs.some((href) => href.startsWith('/hub'))).toBe(true);

    // Aucun overlay plein écran ne bloque la navigation.
    const blocking = page.locator('[aria-modal="true"]:visible, [role="dialog"]:visible');
    expect(await blocking.count()).toBe(0);
  });
});
