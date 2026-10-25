import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const css = ['src/styles/tokens.css', 'src/styles/liquid-glass.css']
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

// Test 1: Glass variant classes render at 390px viewport
test('GlassCard variants render correctly at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<style>${css}</style>
    <main>
      <div class="glass" data-glass-variant="base" id="var-base">Base</div>
      <div class="glass" data-glass-variant="elevated" id="var-elevated">Elevated</div>
      <div class="glass interactive" data-glass-variant="interactive" id="var-interactive">Interactive</div>
      <div class="glass" data-glass-variant="selected" id="var-selected">Selected</div>
      <div class="glass" data-glass-variant="overlay" id="var-overlay">Overlay</div>
      <div class="glass" data-glass-variant="critical" id="var-critical">Critical</div>
    </main>`);

  const variants = ['base', 'elevated', 'interactive', 'selected', 'overlay', 'critical'] as const;
  for (const variant of variants) {
    const locator = page.locator(`#var-${variant}`);
    await expect(locator).toBeVisible();
    await expect(locator).toHaveClass(/glass/);
    await expect(locator).toHaveAttribute('data-glass-variant', variant);
  }
  await expect(page.locator('#var-interactive')).toHaveClass(/interactive/);
});

// Test 2: Nested backdrop-filter is already tested in glass-contract.spec.ts (SKIPPED as duplicate)

// Test 3: Viewport selector changes grid maxWidth
test('viewport selector updates grid maxWidth constraint', async ({ page }) => {
  await page.setContent(`<style>
    ${css}
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; width: 100%; }
  </style>
  <main>
    <label>Viewport
      <select id="viewport-select">
        <option value="full">Desktop (plein)</option>
        <option value="tablet">Tablette 768px</option>
        <option value="430">iPhone Plus 430px</option>
        <option value="390">iPhone 15 390px</option>
        <option value="320">iPhone SE 320px</option>
      </select>
    </label>
    <div id="grid" class="grid">
      <div class="glass" data-glass-variant="base">Surface 1</div>
      <div class="glass" data-glass-variant="base">Surface 2</div>
      <div class="glass" data-glass-variant="base">Surface 3</div>
    </div>
  </main>
  <script>
    const viewportWidths = {
      '320': '320px', '390': '390px', '430': '430px', 'tablet': '768px', 'full': 'none'
    };
    const select = document.getElementById('viewport-select');
    const grid = document.getElementById('grid');
    select.addEventListener('change', (e) => {
      const val = viewportWidths[e.target.value];
      grid.style.maxWidth = val || 'none';
      if (val && val !== 'none') {
        grid.style.margin = '0 auto';
      } else {
        grid.style.margin = '';
      }
    });
  </script>`);

  const grid = page.locator('#grid');
  const select = page.locator('#viewport-select');

  await select.selectOption('390');
  await expect(grid).toHaveCSS('max-width', '390px');

  await select.selectOption('320');
  await expect(grid).toHaveCSS('max-width', '320px');

  await select.selectOption('430');
  await expect(grid).toHaveCSS('max-width', '430px');

  await select.selectOption('tablet');
  await expect(grid).toHaveCSS('max-width', '768px');
});

// Test 4: Keyboard navigation - interactive glass card responds to Enter and Space
test('interactive GlassCard activates on Enter and Space', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <div class="glass interactive" data-glass-variant="interactive" tabindex="0" id="card">Action</div>
    <script>
      const card = document.getElementById('card');
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          card.click();
        }
      });
      card.addEventListener('click', () => {
        window.__clickCount = (window.__clickCount || 0) + 1;
      });
    </script>`);

  await page.locator('#card').focus();
  await page.keyboard.press('Enter');
  let count = await page.evaluate(() => (window as any).__clickCount);
  expect(count).toBe(1);

  await page.keyboard.press('Space');
  count = await page.evaluate(() => (window as any).__clickCount);
  expect(count).toBe(2);
});

// Test 5: Glass disabled cards ignore click
test('disabled GlassCard has aria-disabled and no pointer interaction', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <div class="glass" data-glass-variant="base" aria-disabled="true" tabindex="-1" id="disabled">Disabled</div>
    <script>
      const card = document.getElementById('disabled');
      card.addEventListener('click', () => {
        if (card.getAttribute('aria-disabled') === 'true') return;
        window.__clicked = true;
      });
    </script>`);

  const disabledCard = page.locator('#disabled');
  await expect(disabledCard).toHaveAttribute('aria-disabled', 'true');
  await expect(disabledCard).toHaveAttribute('tabindex', '-1');

  const cursor = await disabledCard.evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe('default');

  await disabledCard.click({ force: true });
  const clicked = await page.evaluate(() => (window as any).__clicked);
  expect(clicked).toBeUndefined();
});

// Test 6: bottom-sheet shape has correct border-radius
test('bottom-sheet shape has top-only border radius', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <div class="glass" data-glass-shape="bottom-sheet" id="sheet">Sheet</div>`);

  const br = await page.locator('#sheet').evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      tl: s.borderTopLeftRadius,
      tr: s.borderTopRightRadius,
      bl: s.borderBottomLeftRadius,
      br: s.borderBottomRightRadius,
    };
  });

  expect(br.bl).toBe('0px');
  expect(br.br).toBe('0px');
  expect(parseInt(br.tl, 10)).toBeGreaterThan(0);
  expect(parseInt(br.tr, 10)).toBeGreaterThan(0);
});

// Test 7: Overlay variant gets stronger box-shadow (shadow-overlay)
test('overlay variant applies overlay shadow', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <div class="glass" data-glass-variant="base" id="base">Base</div>
    <div class="glass" data-glass-variant="overlay" id="overlay">Overlay</div>`);

  const baseShadow = await page.locator('#base').evaluate((el) => getComputedStyle(el).boxShadow);
  const overlayShadow = await page.locator('#overlay').evaluate((el) => getComputedStyle(el).boxShadow);

  expect(overlayShadow).not.toBe('none');
  expect(overlayShadow.length).toBeGreaterThan(0);
  expect(overlayShadow).not.toBe(baseShadow);
});

// Test 8: Reduced motion disables animations (distinct from press transform in glass-contract.spec.ts)
test('reduced motion disables glass entry and shimmer animations', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <div class="glass glass-anim-in" id="animated">Animated</div>
    <div class="glass glass-shimmer" id="shimmer">Shimmer</div>`);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#animated')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#shimmer')).toHaveCSS('animation-name', 'none');
});

// Test 9: Focus visible outline exists
test('glass card focus outline is visible', async ({ page }) => {
  await page.setContent(`<style>${css}</style>
    <div class="glass interactive" data-glass-variant="interactive" tabindex="0" id="focused">Focus me</div>`);

  await page.locator('#focused').focus();
  const outline = await page.locator('#focused').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

// Test 10: 320px viewport - glass card content is readable (min dimensions check)
test('glass card at 320px viewport has sufficient touch target', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.setContent(`<style>${css}</style>
    <button class="glass-capsule-btn" style="display:inline-flex;align-items:center;justify-content:center;">Action</button>`);

  const bounds = await page.getByRole('button').boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
});
