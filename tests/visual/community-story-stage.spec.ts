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
