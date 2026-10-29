import { expect, test } from '@playwright/test';
import { installCommunityFeedFixture } from './_helpers/communityFeedFixture';

// PNG 1×1 : suffisant pour un aperçu local.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('Story : le média prend la place du fond, seule la flèche reste, puis étape suivante', async ({ page }, testInfo) => {
  const fixture = await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  const dialog = page.getByRole('dialog', { name: 'Créer dans l’application' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name: 'Story', exact: true }).click();

  await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: PNG });

  const stage = dialog.locator('.lkdv-story-stage');
  await expect(stage).toBeVisible();
  const [dialogBox, stageBox] = await Promise.all([dialog.boundingBox(), stage.boundingBox()]);
  expect(Math.round(stageBox!.width)).toBe(Math.round(dialogBox!.width));
  expect(Math.round(stageBox!.height)).toBe(Math.round(dialogBox!.height));

  // Un seul bouton sur le plein fond : la flèche, en bas à droite.
  await expect(stage.locator('button')).toHaveCount(1);
  const next = stage.getByRole('button', { name: 'Continuer' });
  const nextBox = await next.boundingBox();
  expect(nextBox!.x + nextBox!.width).toBeGreaterThan(dialogBox!.x + dialogBox!.width - 40);
  expect(nextBox!.y + nextBox!.height).toBeGreaterThan(dialogBox!.y + dialogBox!.height - 40);
  await expect(page.locator('.lkdv-create-stepbar')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('story-plein-fond.png') });

  await next.click();
  await expect(stage).toHaveCount(0);
  await expect(dialog.getByLabel('Légende')).toBeVisible();
});

/** Glissement tactile réel (CDP) sur un élément. */
async function touchSwipe(page: import('@playwright/test').Page, selector: string, dx: number) {
  const box = await page.locator(selector).first().boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const y = box!.y + box!.height / 2;
  const x0 = box!.x + box!.width / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 6; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 6, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('Glissement : étape incomplète = rebond sans avancer ; étape complète = avance', async ({ page }) => {
  const fixture = await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  const dialog = page.getByRole('dialog', { name: 'Créer dans l’application' });
  await dialog.getByRole('tab', { name: 'Story', exact: true }).click();

  const activeStep = () => dialog.locator('.lkdv-create-step-pane[data-step-id]').first().getAttribute('data-step-id');
  await expect.poll(activeStep).toBe('media');

  // Aucun média : glisser à gauche est bloqué, la feuille rebondit.
  await touchSwipe(page, '.lkdv-create-step-pane', -160);
  await expect(dialog.locator('.lkdv-create-step-pane').first()).toHaveAttribute('data-bounce', 'left');
  await expect.poll(activeStep).toBe('media');

  // Média choisi → on passe par la flèche, puis glisser à droite revient, à gauche réavance.
  await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: PNG });
  await dialog.locator('.lkdv-story-stage').getByRole('button', { name: 'Continuer' }).click();
  await expect.poll(activeStep).toBe('edit');
  await touchSwipe(page, '.lkdv-create-step-pane', 160);
  await expect.poll(activeStep).toBe('media');
});
