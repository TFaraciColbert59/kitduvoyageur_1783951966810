import type { Locator, Page } from '@playwright/test';

import type { Locate, Step } from './types';

/** Résout un localisateur déclaratif en `Locator` Playwright. */
export function resolve(page: Page, target: Locate): Locator {
  const nth = ('nth' in target && target.nth) || 0;
  if ('css' in target) return page.locator(target.css).nth(nth);
  const scope = 'within' in target && target.within ? page.locator(target.within) : page;
  if ('role' in target) {
    return scope
      .getByRole(target.role as Parameters<Page['getByRole']>[0], { name: target.name, exact: target.exact })
      .nth(nth);
  }
  return scope.getByText(target.text).nth(nth);
}

/** Joue les étapes dans l'ordre ; une étape qui échoue lève une erreur lisible. */
export async function playSteps(page: Page, steps: Step[], side: 'app' | 'maquette'): Promise<void> {
  for (const [index, step] of steps.entries()) {
    try {
      if ('click' in step) {
        await resolve(page, step.click).click({ timeout: 8_000 });
        await page.waitForTimeout(side === 'app' ? 450 : 350);
      } else if ('longPress' in step) {
        const box = await resolve(page, step.longPress).boundingBox({ timeout: 8_000 });
        if (!box) throw new Error('cible sans boîte');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(650);
        await page.mouse.up();
        await page.waitForTimeout(450);
      } else if ('fill' in step) {
        await resolve(page, step.fill).fill(step.value, { timeout: 8_000 });
        await page.waitForTimeout(500);
      } else if ('press' in step) {
        await page.keyboard.press(step.press);
        await page.waitForTimeout(350);
      } else if ('wait' in step) {
        await page.waitForTimeout(step.wait);
      } else if ('waitFor' in step) {
        await resolve(page, step.waitFor).waitFor({ state: 'visible', timeout: 12_000 });
      } else if ('eval' in step) {
        await page.evaluate(step.eval);
        await page.waitForTimeout(500);
      }
    } catch (error) {
      throw new Error(`étape ${index + 1} (${side}) ${JSON.stringify(step)} : ${String(error).split('\n')[0]}`);
    }
  }
}
