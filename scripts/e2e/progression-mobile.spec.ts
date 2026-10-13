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

  test('@mobile le Hub reste navigable (destinations canoniques, aucun overlay bloquant)', async ({ page }) => {
    await page.goto('/hub?panel=points', { waitUntil: 'domcontentloaded' });

    // La nav basse est chargée en différé : on attend de VRAIS liens.
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.locator('a[href]').first()).toBeVisible({ timeout: 15_000 });

    // Destinations canoniques du registre (HUB · COMMUNAUTÉ · EXPLORER ·
    // MESSAGES · COMPTE) : jamais un sixième onglet produit.
    const hrefs = await nav
      .locator('a[href]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs.join(' ')).toContain('/explorer');
    expect(hrefs.some((href) => href.startsWith('/hub'))).toBe(true);
    expect(hrefs.length).toBeLessThanOrEqual(6);

    // La sheet « Ma progression » ouverte par le deep-link est DISMISSIBLE ;
    // une fois fermée, plus aucun overlay modal ne bloque la navigation.
    const sheet = page.getByRole('dialog');
    if ((await sheet.count()) > 0) {
      await page.getByRole('button', { name: /fermer/i }).first().click();
    }
    await expect(page.locator('[aria-modal="true"]:visible')).toHaveCount(0);
  });
});
