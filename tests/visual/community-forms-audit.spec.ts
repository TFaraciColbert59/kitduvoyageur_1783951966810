import { expect, test } from '@playwright/test';
import { installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/** Audit : chaque formulaire de création, chaque étape — débordement vertical et capture. */
for (const kind of ['Story', 'Carnet', 'Sortie', 'Kit', 'Club']) {
  test(`audit ${kind}`, async ({ page }, testInfo) => {
    const fixture = await installCommunityFeedFixture(page);
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
    await fixture.signIn();
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    const dialog = page.getByRole('dialog', { name: 'Créer dans l’application' });
    await dialog.getByRole('tab', { name: kind, exact: true }).click();
    await page.waitForTimeout(600);
    const steps = dialog.locator('[role="tablist"][aria-label="Étapes de création"] [role="tab"]');
    const n = await steps.count();
    const shots = Math.max(n, 1);
    for (let i = 0; i < shots; i++) {
      if (n) await steps.nth(i).click({ force: true });
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>('.lkdv-embedded-form, .lkdv-drawer-body').forEach((el) => {
          if (el.scrollHeight > el.clientHeight + 2) out.push(`${el.className.toString().slice(0, 30)} sh=${el.scrollHeight} ch=${el.clientHeight}`);
        });
        return out;
      });
      console.log(`AUDIT ${kind} ${i + 1}/${n}: ${m.length ? m.join(' | ') : 'ok'}`);
      await page.screenshot({ path: testInfo.outputPath(`${kind}-${i + 1}.png`) });
    }
  });
}
