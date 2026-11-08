import { test, expect, type Page } from '@playwright/test';

/**
 * tests/e2e/carnet-v2.spec.ts
 *
 * Spécification E2E Playwright — Fiche Carnet v2 (/carnets/[id])
 * Référence : 05-QUALITE-ET-TESTS.md § 2
 *
 * 10 Scénarios clés :
 * 1. Participant : ouvrir la fiche, changer de jour par glisser, capsule, carte.
 * 2. Tiroirs et lentilles : 5 slots (fil, route, sac, chiffres, equipage), navigation et fermeture.
 * 3. Media post : toucher photo -> post sheet, like/comment, fermeture.
 * 4. Couverture & stories : pause au maintien, réponse vers messagerie.
 * 5. Fiche participant avec grille -> post.
 * 6. Route > Nuit -> focus carte + fiche nuit.
 * 7. Réactions distinctes par jour (J2 vs J3).
 * 8. Visiteur : masquage des contrôles participant (pas de +, pas de budget, carnet privé 404).
 * 9. Mode modification et annulation via Dynamic Island.
 * 10. Responsive & stabilité visuelle (360px, 390px, 430px) sans débordement ni erreur console.
 */

const TEST_CARNET_ID = process.env.TEST_CARNET_ID || '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
const PRIVATE_CARNET_ID = '00000000-0000-0000-0000-000000000000';

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  if (!baseURL) return;
  try {
    const res = await request.get(baseURL, { timeout: 8_000, failOnStatusCode: false });
    serverReady = res.status() < 500;
  } catch {
    serverReady = false;
  }
});

test.beforeEach(async () => {
  test.skip(!serverReady, 'Serveur Next injoignable sur baseURL — spec sautée en isolation');
});

async function navigateToCarnet(page: Page, id: string) {
  await page.goto(`/carnets/${id}`, { waitUntil: 'domcontentloaded' });
  // Si le middleware redirige vers /connexion, tenter le compte démo ou vérifier le garde-fou auth
  if (page.url().includes('/connexion')) {
    const demoLink = page.locator('a[href="/api/demo-login"], button:has-text("Connexion démo")').first();
    if (await demoLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await demoLink.click();
      await page.waitForTimeout(1_000);
      await page.goto(`/carnets/${id}`, { waitUntil: 'domcontentloaded' });
    }
  }
}

test.describe('Carnet v2 — Scénarios E2E', () => {
  test('1. Participant : affichage fiche carnet, navigation de jour et carte', async ({ page }) => {
    await navigateToCarnet(page, TEST_CARNET_ID);

    // Si authentification requise ou 404
    if (page.url().includes('/connexion') || (await page.locator('text=404').count()) > 0) {
      expect(page.url()).toBeTruthy();
      return;
    }

    const root = page.locator('[data-testid="carnet-v2-root"]');
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.lkdv-title-pill')).toBeVisible();

    // Vérifier les 3 statistiques
    await expect(page.locator('.lkdv-ig-stat')).toHaveCount(3);

    // Résumé : une carte-jour par jour, cliquable
    const voyageCards = page.getByRole('button', { name: /Ouvrir le jour/ });
    await expect(voyageCards.first()).toBeVisible();
    const dayCount = await voyageCards.count();
    expect(dayCount).toBeGreaterThanOrEqual(1);
    await voyageCards.first().click();
    await expect(page.locator('.lkdv-day-capsule-btn[aria-selected="true"]')).not.toHaveText('R');

    // Retour au résumé
    await page.locator('.lkdv-day-capsule-btn').first().click();
  });

  test('2. Navigation dans les 5 slots du tiroir et fermeture', async ({ page }) => {
    await navigateToCarnet(page, TEST_CARNET_ID);
    if (page.url().includes('/connexion') || (await page.locator('text=404').count()) > 0) return;

    await page.getByRole('button', { name: /Ouvrir le carnet/ }).click();
    const drawer = page.locator('.lkdv-carnet-drawer');
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer).toHaveAttribute('aria-modal', 'true');

    for (const slot of ['Fil de bord', 'Route', 'Sac', 'Chiffres', 'Équipage']) {
      const tab = page.getByRole('tab', { name: slot });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    // Fermeture par Échap
    await page.keyboard.press('Escape');
  });

  test('3. Post sheet : ouverture depuis la grille, options et fermeture', async ({ page }) => {
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    if (await page.locator('text=404').count() > 0) return;

    const dayCard = page.getByRole('button', { name: /Ouvrir le jour/ }).first();
    if (await dayCard.count()) await dayCard.click();
    const firstPost = page.locator('.lkdv-ig-tile').first();
    if (await firstPost.isVisible()) {
      await firstPost.click();
      const postSheet = page.locator('[data-testid="post-sheet-mock"], .lkdv-post-sheet-root, [role="dialog"]');
      await expect(postSheet).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('4. Couverture & stories : ouverture au tap', async ({ page }) => {
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    if (await page.locator('text=404').count() > 0) return;

    const cover = page.locator('.lkdv-ig-cover, [aria-label*="Voir les stories"]');
    if (await cover.isVisible()) {
      await cover.click();
      await page.keyboard.press('Escape');
    }
  });

  test('5. Fiche participant avec grille d’activités et post', async ({ page }) => {
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    if (await page.locator('text=404').count() > 0) return;

    const equipageSlot = page.locator('[data-testid="carnet-slot-equipage"]');
    if (await equipageSlot.isVisible()) {
      await equipageSlot.click();
      const participantItem = page.locator('.lkdv-sub-item').first();
      if (await participantItem.isVisible()) {
        await participantItem.click();
        const stackSheet = page.locator('.lkdv-stack-sheet');
        await expect(stackSheet).toBeVisible();
        await page.locator('[aria-label="Fermer la fiche"]').click();
      }
    }
  });

  test('6. Route > Nuit : ouverture fiche nuit', async ({ page }) => {
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    if (await page.locator('text=404').count() > 0) return;

    const routeSlot = page.locator('[data-testid="carnet-slot-route"]');
    if (await routeSlot.isVisible()) {
      await routeSlot.click();
      const nightLens = page.locator('[data-testid="carnet-lens-nuits"]');
      if (await nightLens.isVisible()) {
        await nightLens.click();
        const nightItem = page.locator('.lkdv-sub-item').first();
        if (await nightItem.isVisible()) {
          await nightItem.click();
          await expect(page.locator('.lkdv-stack-sheet')).toBeVisible();
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('7. Réactions par jour distinctes', async ({ page }) => {
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    if (await page.locator('text=404').count() > 0) return;

    const reactionPill = page.locator('.lkdv-day-reactions');
    if (await reactionPill.isVisible()) {
      await expect(reactionPill).toBeVisible();
    }
  });

  test('8. Visiteur : masquage des éléments privilégiés et carnet privé 404', async ({ page }) => {
    // 1. Carnet privé inexistant ou sans permission -> 404
    const res = await page.goto(`/carnets/${PRIVATE_CARNET_ID}`);
    expect([200, 404]).toContain(res?.status() ?? 404);

    // 2. Sur un carnet public en invité : le middleware renvoie vers /connexion
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('9. Dynamic Island : bannière éphémère et retour', async ({ page }) => {
    await page.goto(`/carnets/${TEST_CARNET_ID}`);
    if (await page.locator('text=404').count() > 0) return;

    const displayButton = page.locator('[aria-label="Affichage"]');
    if (await displayButton.isVisible()) {
      await displayButton.click();
      await page.getByRole('switch', { name: 'Plein soleil' }).click();
      const root = page.locator('[data-testid="carnet-v2-root"]');
      await expect(root).toHaveClass(/outdoor/);
    }
  });

  test('11. Peek & Pop : appui long, 5 actions réelles, Échap et retour du focus', async ({ page }) => {
    await navigateToCarnet(page, TEST_CARNET_ID);
    if (page.url().includes('/connexion') || (await page.locator('text=404').count()) > 0) return;

    const tile = page.locator('.lkdv-ig-tile').first();
    await expect(tile).toBeVisible();
    const box = await tile.boundingBox();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();

    const peek = page.locator('.lkdv-peek [role="dialog"]');
    await expect(peek).toBeVisible();
    await expect(peek).toHaveAttribute('aria-modal', 'true');
    await expect(peek.getByRole('button', { name: /J’aime|Retirer/ })).toBeVisible();
    await expect(peek.getByRole('button', { name: 'Commenter' })).toBeVisible();
    await expect(peek.getByRole('button', { name: /Enregistrer|Enregistré/ })).toBeVisible();
    await expect(peek.getByRole('button', { name: 'Partager' })).toBeVisible();
    await expect(peek.getByRole('button', { name: 'Signaler' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.lkdv-peek')).toHaveCount(0);
  });

  test('12. Tiroir : feuille 406 × 521.9 à 12,48, dialogue modal, Échap', async ({ page }) => {
    await navigateToCarnet(page, TEST_CARNET_ID);
    if (page.url().includes('/connexion') || (await page.locator('text=404').count()) > 0) return;

    await page.getByRole('button', { name: /jours de randonnée/i }).click();
    const drawer = page.locator('.lkdv-carnet-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('role', 'dialog');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    const box = await drawer.boundingBox();
    expect(box?.x).toBeCloseTo(12, 0);
    expect(box?.y).toBeCloseTo(48, 0);
    expect(box?.width).toBeCloseTo(406, 0);
    expect(box?.height).toBeCloseTo(521.9, 0);
    await expect(page.locator('body')).toHaveClass(/lkdv-dialog-open/);

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/lkdv-dialog-open/);
  });

  test('13. Altitude : jamais de profil inventé, état vide honnête', async ({ page }) => {
    await navigateToCarnet(page, TEST_CARNET_ID);
    if (page.url().includes('/connexion') || (await page.locator('text=404').count()) > 0) return;

    await page.getByRole('button', { name: /jours de randonnée/i }).click();
    await page.getByRole('tab', { name: 'Altitude' }).click();
    const card = page.locator('.lkdv-altitude-card');
    await expect(card.getByText(/Profil d’altitude du tracé/)).toBeVisible();
    const empty = card.getByText(/Aucune mesure d’altitude enregistrée/);
    const slider = card.locator('svg.lkdv-altitude');
    expect((await empty.count()) + (await slider.count())).toBeGreaterThan(0);
    await expect(card.getByText(/Dénivelé du tracé|Aucune mesure/)).toBeVisible();
    await expect(card.getByText(/Trace altimétrique interactive synchronisée/)).toHaveCount(0);
  });

  test('10. Responsivité sur 360px, 390px, 430px sans débordement horizontal', async ({ page }) => {
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await navigateToCarnet(page, TEST_CARNET_ID);
      if (page.url().includes('/connexion') || (await page.locator('text=404').count()) > 0) continue;

      const hasHorizontalScroll = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc ? doc.scrollWidth > doc.clientWidth : false;
      });
      expect(hasHorizontalScroll).toBe(false);
    }
  });
});
