#!/usr/bin/env node
/** Captures jetables « valider / sos » (supprimé après la recette). */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.CRM_PREVIEW_URL || 'http://127.0.0.1:4200';
const OUT = path.resolve(process.cwd(), 'bundle/etat/preuves/design/fix-valider-sos');
mkdirSync(OUT, { recursive: true });

const VALIDER = '/valider/d1300000-0000-4000-8000-000000000001';
const SOS = '/sos/d1000000-0000-4000-8000-000000000001';

const shots = [
  { name: 'valider-1440', url: VALIDER, width: 1440, height: 1040 },
  { name: 'valider-saisie-1440', url: VALIDER, width: 1440, height: 1040, act: async (p) => {
      await p.locator('#approval-confirmation').fill('89,90 €');
    } },
  { name: 'valider-erreur-1440', url: VALIDER, width: 1440, height: 1040, act: async (p) => {
      await p.locator('#approval-confirmation').fill('12,00');
      await p.getByTestId('approve-button').click();
      await p.waitForTimeout(400);
    } },
  { name: 'valider-validee-1440', url: VALIDER, width: 1440, height: 1040, act: async (p) => {
      await p.locator('#approval-confirmation').fill('89,90 €');
      await p.getByTestId('approve-button').click();
      await p.waitForTimeout(500);
    } },
  { name: 'valider-390', url: VALIDER, width: 390, height: 844 },
  { name: 'sos-390', url: SOS, width: 390, height: 844 },
  { name: 'sos-pris-390', url: SOS, width: 390, height: 844, act: async (p) => {
      await p.getByTestId('sos-take').click();
      await p.waitForTimeout(400);
    } },
  { name: 'sos-cloture-390', url: SOS, width: 390, height: 844, act: async (p) => {
      await p.getByTestId('sos-take').click();
      await p.waitForTimeout(300);
      await p.getByTestId('sos-close').click();
      await p.waitForTimeout(300);
      await p.getByLabel(/note/i).fill('Appel passé, personne en sécurité.');
      await p.waitForTimeout(200);
      await p.locator('[data-testid="sos-screen"]').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    } },
  { name: 'sos-1440', url: SOS, width: 1440, height: 1040 },
  { name: 'sos-liste-390', url: '/sos', width: 390, height: 844 }
];

const browser = await chromium.launch();
const metrics = {};
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 1 });
  const api = [];
  page.on('pageerror', () => {});
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') api.push(`${request.method()} ${request.url()}`);
  });
  try {
    await page.goto(BASE + shot.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    if (shot.act) {
      await shot.act(page);
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
    metrics[shot.name] = await page.evaluate(() => {
      const box = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const small = Array.from(document.querySelectorAll('button, a[href], input, [role="button"]'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return false;
          return r.height < 44 || r.width < 44;
        })
        .slice(0, 12)
        .map((el) => `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ''} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
        title: document.querySelector('h1')?.textContent ?? null,
        main: box('main'),
        rail: box('aside'),
        firstCard: box('main section'),
        input: box('#approval-confirmation'),
        call112: box('[data-testid="sos-call-112"]'),
        take: box('[data-testid="sos-take"]'),
        sosRoot: box('[data-testid="sos-screen"]'),
        smallTargets: small
      };
    });
    metrics[shot.name].apiWrites = api;
    console.log('OK', shot.name, JSON.stringify(metrics[shot.name]));
  } catch (error) {
    console.log('FAIL', shot.name, String(error).slice(0, 300));
    metrics[shot.name] = { error: String(error).slice(0, 400) };
  } finally {
    await page.close();
  }
}
await browser.close();
writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), metrics }, null, 2));
console.log('mesures ->', path.join(OUT, 'mesures.json'));
