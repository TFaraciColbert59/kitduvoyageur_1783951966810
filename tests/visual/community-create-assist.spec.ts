import { expect, test, type Page } from '@playwright/test';
import { AUTHOR_ID, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/**
 * Aides des formulaires de création : mots-clés, aperçu final, brouillon repris,
 * lieu avec suggestions, dates rapides et météo (Sortie), poids par catégorie et
 * essentiels manquants (Kit), contrôle du nom et phrases toutes prêtes (Club).
 */

function isoIn(days: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

async function openCreate(page: Page, tab: string) {
  await page.route('**/api/geocode?**', async (route) => {
    await route.fulfill({ json: { status: 'ok', matches: [{ id: 'g1', name: 'Chamonix-Mont-Blanc', context: 'Haute-Savoie', country: 'FR', lat: 45.9237, lon: 6.8694 }] } });
  });
  await page.route('**/api/weather/point?**', async (route) => {
    await route.fulfill({
      json: {
        daily: {
          time: [isoIn(0), isoIn(1), isoIn(2)],
          weather_code: [0, 0, 61],
          temperature_2m_min: [3, 4, 5],
          temperature_2m_max: [14, 15, 9],
          precipitation_probability_max: [5, 10, 80],
        },
        source: 'MET Norway',
      },
    });
  });
  const fixture = await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  await expect(page.locator('.lkdv-cd')).toBeVisible();
  if (tab !== 'Publication') await page.getByRole('tab', { name: tab, exact: true }).click();
  return page.getByRole('tabpanel', { name: tab, exact: true });
}

test('Publication : mots-clés en un geste et aperçu avant de publier', async ({ page }, testInfo) => {
  const pane = await openCreate(page, 'Publication');
  await page.locator('.lkdv-drawer-secondary').getByRole('tab', { name: 'Billet' }).click();
  await pane.getByLabel('Titre').fill('Nuit au refuge');
  await pane.getByLabel('Texte').fill('Coucher de soleil incroyable');
  await pane.getByRole('button', { name: '#bivouac' }).click();
  await expect(pane.getByLabel('Texte')).toHaveValue('Coucher de soleil incroyable #bivouac');
  await expect(pane.getByRole('button', { name: '#bivouac' })).toHaveCount(0);
  await pane.getByRole('button', { name: 'Suivant' }).click();
  const preview = pane.getByRole('figure', { name: 'Aperçu' });
  await expect(preview).toContainText('Nuit au refuge');
  await expect(preview).toContainText('Fil public');
  await page.screenshot({ path: testInfo.outputPath('publication-apercu.png') });
});

test('Sortie : lieu suggéré, date rapide, heure, météo prévue et aperçu', async ({ page }, testInfo) => {
  const pane = await openCreate(page, 'Sortie');
  await pane.getByLabel('Titre').fill('Lac Blanc au lever du jour');
  await pane.getByRole('radio', { name: 'Moyen' }).click();
  await pane.getByRole('button', { name: 'Suivant' }).click();
  await pane.getByLabel('Lieu de rendez-vous').fill('Chamonix');
  await pane.getByRole('option', { name: /Chamonix-Mont-Blanc/ }).click();
  await pane.getByRole('radio', { name: 'Demain' }).click();
  await expect(pane.getByLabel('Date')).toHaveValue(isoIn(1));
  await pane.getByLabel('Heure').fill('08:30');
  await expect(pane.locator('.lkdv-wz-note')).toContainText('Ensoleillé');
  await page.screenshot({ path: testInfo.outputPath('sortie-quand.png') });
  await pane.getByRole('button', { name: 'Suivant' }).click();
  await pane.getByRole('button', { name: 'Suivant' }).click();
  const preview = pane.getByRole('figure', { name: 'Aperçu' });
  await expect(preview).toContainText('Lac Blanc au lever du jour');
  await expect(preview).toContainText('8 h 30');
  await expect(preview).toContainText('Moyen');
  await expect(preview).toContainText('Chamonix-Mont-Blanc');
  await page.screenshot({ path: testInfo.outputPath('sortie-apercu.png') });
});

test('Kit : brouillon repris, poids par catégorie, essentiels manquants et aperçu', async ({ page }, testInfo) => {
  await page.addInitScript((userId) => {
    const slot = (key: string, name: string, category: string, weightG: number | null) => ({
      key, source: 'inventory', id: key, name, brand: null, category, weightG, image: null, ownershipId: null, productId: null,
    });
    localStorage.setItem(`lkdv:draft:community:kit:${userId}`, JSON.stringify({
      savedAt: Date.now(),
      value: {
        name: 'Kit hiver Vercors',
        season: 'hiver',
        slots: [slot('a', 'Tente Nammatj', 'Abri', 2400), slot('b', 'Sac Osprey 55', 'Portage', 1900), slot('c', 'Frontale', 'Éclairage', 85)],
        description: '',
        visibility: 'public',
      },
    }));
  }, AUTHOR_ID);
  const pane = await openCreate(page, 'Kit');
  await expect(pane.getByRole('status').filter({ hasText: 'Brouillon repris' })).toBeVisible();
  await pane.getByRole('button', { name: 'Suivant' }).click();
  const weights = pane.getByLabel('Poids par catégorie');
  await expect(weights).toContainText('Abri 2,4 kg');
  await expect(pane.getByRole('button', { name: 'Couchage' })).toBeVisible();
  await expect(pane.getByRole('button', { name: 'Vêtements chauds' })).toBeVisible();
  await expect(pane.getByRole('button', { name: 'Éclairage', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('kit-elements.png') });
  await pane.getByRole('button', { name: 'Suivant' }).click();
  await pane.getByRole('button', { name: 'Suivant' }).click();
  const preview = pane.getByRole('figure', { name: 'Aperçu' });
  await expect(preview).toContainText('Kit hiver Vercors');
  await expect(preview).toContainText('3 éléments');
  await expect(preview).toContainText('4,4 kg');
  await page.screenshot({ path: testInfo.outputPath('kit-apercu.png') });
});

test('Club : nom vérifié en direct, phrases toutes prêtes et aperçu', async ({ page }, testInfo) => {
  const pane = await openCreate(page, 'Club');
  await pane.getByLabel('Nom du club').fill('La Cordée du Vercors');
  await expect(pane.getByText('Nom disponible.')).toBeVisible();
  await pane.getByLabel('Activité').fill('Randonnée');
  await page.screenshot({ path: testInfo.outputPath('club-identite.png') });
  // L'image est obligatoire : on la fournit pour avancer.
  await pane.locator('input[type="file"]').first().setInputFiles({
    name: 'badge.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });
  await pane.getByRole('button', { name: 'Suivant' }).click();
  await pane.getByRole('button', { name: /Débutants bienvenus/ }).click();
  await expect(pane.getByLabel('L’esprit du club')).toHaveValue(/Débutants bienvenus/);
  await pane.getByRole('button', { name: 'Suivant' }).click();
  const preview = pane.getByRole('figure', { name: 'Aperçu' });
  await expect(preview).toContainText('La Cordée du Vercors');
  await expect(preview).toContainText('Randonnée');
  await page.screenshot({ path: testInfo.outputPath('club-apercu.png') });
});
