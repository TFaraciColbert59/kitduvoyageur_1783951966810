import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const css = ['src/styles/tokens.css', 'src/styles/liquid-glass.css'].map(path => readFileSync(path, 'utf8')).join('\n');

test.beforeEach(async ({ page }) => {
  await page.setContent(`<style>${css}</style><main>
    <article class="glass" data-glass-variant="base" style="padding:20px">
      <h1>Voyage</h1><p>Contenu lisible</p><div class="glass" data-glass-variant="base">Surface interne</div>
      <button class="glass-capsule-btn sm">Choisir</button>
    </article>
    <button class="glass interactive" data-glass-variant="interactive">Action</button>
    <article class="glass" data-glass-variant="overlay">Panneau</article>
  </main>`);
});

test('nested surfaces never add another backdrop', async ({ page }) => {
  await expect(page.locator('.glass .glass')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.glass .glass-capsule-btn')).toHaveCSS('backdrop-filter', 'none');
});

test('compact glass controls still have a 44px touch target', async ({ page }) => {
  const bounds = await page.getByRole('button', { name: 'Choisir' }).boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
});

test('low effects mode removes every glass blur and preserves solid fill', async ({ page }) => {
  await page.locator('html').evaluate(el => el.setAttribute('data-glass-effects', 'reduced'));
  for (const surface of await page.locator('.glass, .glass-capsule-btn').all()) {
    await expect(surface).toHaveCSS('backdrop-filter', 'none');
  }
  await expect(page.locator('article.glass').first()).toHaveCSS('background-color', 'rgb(238, 243, 236)');
});

test('reduced motion suppresses press transforms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const action = page.getByRole('button', { name: 'Action', exact: true });
  await action.hover();
  await page.mouse.down();
  await expect(action).toHaveCSS('transform', 'none');
  await page.mouse.up();
});

test('focus remains visible without relying on a shadow', async ({ page }) => {
  await page.keyboard.press('Tab');
  const outline = await page.getByRole('button', { name: 'Choisir' }).evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

test('opaque accessibility mode preserves primary-action contrast', async ({ page }) => {
  await page.getByRole('button', { name: 'Choisir' }).evaluate(el => el.classList.add('primary'));
  await page.emulateMedia({ contrast: 'more' });
  const action = page.getByRole('button', { name: 'Choisir' });
  await expect(action).toHaveCSS('background-color', 'rgb(23, 64, 44)');
  await expect(action).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('article.glass').first()).toHaveCSS('backdrop-filter', 'none');
});

test('standard text and secondary text retain AA contrast over light and dark extremes', async ({ page }) => {
  const samples = await page.locator('article.glass').first().evaluate(el => {
    const style = getComputedStyle(el);
    return { fill: style.backgroundColor, primary: style.color, secondary: style.getPropertyValue('--glass-text-secondary') };
  });
  const parse = (value: string) => value.startsWith('#')
    ? value.slice(1).match(/.{2}/g)!.map(x => parseInt(x, 16))
    : value.match(/[\d.]+/g)!.map(Number);
  const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const fill = parse(samples.fill);
  for (const backdrop of [0, 255]) {
    const background = fill.slice(0, 3).map(v => v * fill[3] + backdrop * (1 - fill[3]));
    for (const foreground of [samples.primary, samples.secondary.trim()]) {
      const values = [luminance(background), luminance(parse(foreground))].sort((a, b) => b - a);
      expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('explicit dark surfaces use readable foregrounds', async ({ page }) => {
  await page.locator('html').evaluate(el => el.classList.add('dark'));
  await expect(page.locator('article.glass').first()).toHaveCSS('color', 'rgb(238, 243, 236)');
});

test('canonical surfaces preserve fixed panel positioning and pill geometry', async ({ page }) => {
  await page.addStyleTag({ content: '.fixed { position: fixed; }' });
  await page.locator('article.glass').last().evaluate(el => el.classList.add('fixed'));
  await expect(page.locator('article.glass').last()).toHaveCSS('position', 'fixed');
  await page.getByRole('button', { name: 'Action', exact: true }).evaluate(el => el.setAttribute('data-glass-shape', 'pill'));
  await expect(page.getByRole('button', { name: 'Action', exact: true })).toHaveCSS('border-radius', '9999px');
});
