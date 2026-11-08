import { test } from '@playwright/test';

import {
  closeByEscape,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  openExplorer,
} from './communaute-v2.fixtures';

test('debug focus retour', async ({ page }) => {
  await installCommunityV2Mock(page);
  await freezeClock(page);
  await gotoCommunity(page);
  const trigger = page.getByRole('button', { name: 'Explorer et rechercher' });
  const messages: string[] = [];
  page.on('console', (m) => messages.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
  const opened = await openExplorer(page);
  console.log('OUVERT?', opened, 'URL', page.url());
  const opener = await page.evaluate(() => {
    const layer = document.querySelector('[data-testid="communaute-v2-explore"]');
    return { active: document.activeElement?.tagName, hasLayer: Boolean(layer) };
  });
  console.log('AVANT-FERMETURE:', JSON.stringify(opener), 'MESSAGES:', JSON.stringify(messages.slice(-6)));
  await closeByEscape(page, 'communaute-v2-explore');
  const after = await page.evaluate(() => ({
    active: document.activeElement?.tagName,
    activeLabel: document.activeElement?.getAttribute('aria-label'),
    inertRoots: Array.from(document.body.children)
      .filter((element) => element.tagName === 'DIV')
      .map((element) => ({
        cls: (element.className || '').toString().slice(0, 30),
        inert: (element as HTMLElement).inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      })),
  }));
  console.log('APRES-FERMETURE:', JSON.stringify(after));
  await page.waitForTimeout(800);
  const later = await page.evaluate(() => ({
    active: document.activeElement?.tagName,
    activeLabel: document.activeElement?.getAttribute('aria-label'),
  }));
  console.log('APRES-800MS:', JSON.stringify(later));
});
