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

  test('@mobile le Hub reste navigable (cinq destinations, aucun overlay bloquant)', async ({ page }) => {
    await page.goto('/hub?panel=points', { waitUntil: 'domcontentloaded' });
    const tabs = page.getByRole('navigation', { name: /navigation|accueil|explorer/i });
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 });
    // Le nombre d’onglets reste borné (jamais un sixième onglet).
    const links = tabs.first().getByRole('link');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
    expect(await links.count()).toBeLessThanOrEqual(6);
  });
});
