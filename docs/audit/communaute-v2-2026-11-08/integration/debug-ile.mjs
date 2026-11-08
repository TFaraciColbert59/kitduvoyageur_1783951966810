/**
 * Débogage ciblé : appui sur « Rejoindre » d'une tuile club (île de confirmation).
 * Usage : node .../debug-ile.mjs --base http://127.0.0.1:4028
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { installFixtures, sessionCookieFor } from './network.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://127.0.0.1:4028';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  serviceWorkers: 'block',
});
await context.addCookies([sessionCookieFor(base)]);
const page = await context.newPage();
page.on('pageerror', (error) => console.log('PAGEERROR:', String(error).slice(0, 300)));
await installFixtures(page);

await page.goto(`${base}/communaute`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1200);
await page.locator('button[aria-label="Explorer et rechercher"]').first().click();
await page.waitForTimeout(1500);
await page.locator('[data-testid="cv2-capsule"] [role="tab"][aria-label="Clubs"]').first().click();
await page.waitForTimeout(1500);
console.log('join buttons:', await page.locator('[data-testid="cv2-club-join"]').count());
const labels = await page.locator('[data-testid="cv2-club-join"]').evaluateAll((nodes) =>
  nodes.map((node) => ({ label: node.getAttribute('aria-label'), pressed: node.getAttribute('aria-pressed'), disabled: node.hasAttribute('disabled') })),
);
console.log(labels);
const joinButton = page.locator('[data-testid="cv2-club-join"]').first();
await joinButton.scrollIntoViewIfNeeded();
await joinButton.click();
await page.waitForTimeout(900);
const state = await page.evaluate(() => ({
  island: Boolean(document.querySelector('[data-testid="cv2-island"]')),
  islandText: document.querySelector('[data-testid="cv2-island"]')?.textContent ?? null,
  peek: Boolean(document.querySelector('.lkdv-cv2x-peek, [data-testid="cv2-peek"]')),
  detail: Boolean(document.querySelector('[data-testid="cv2-detail"]')),
  toasts: Array.from(document.querySelectorAll('[role="status"]')).map((node) => node.textContent?.slice(0, 80)),
}));
console.log(JSON.stringify(state, null, 2));
await page.screenshot({ path: join(HERE, 'captures', '_debug-ile.png') });
await browser.close();
