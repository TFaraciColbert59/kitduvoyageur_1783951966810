/**
 * Banc de parité Kit Studio : la référence (maquette) et l'application rejouent le même scénario
 * dans le même navigateur. Trois portes : valeurs du moteur, textes, images (≤ 1 % de pixels).
 *
 *   KS_APP_URL=reference npx playwright test -c playwright.kit-studio.config.ts   (référence contre elle-même)
 *   KS_APP_URL=http://localhost:4000 npx playwright test -c playwright.kit-studio.config.ts
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const DIR = path.resolve('tests/kit-studio');
const OUT = path.resolve('test-results/kit-studio');
const S = JSON.parse(fs.readFileSync(path.join(DIR, 'scenario.json'), 'utf8'));
const GOLD = JSON.parse(fs.readFileSync(path.join(DIR, 'goldens.json'), 'utf8'));
const GOLD_JS = fs.readFileSync(path.join(DIR, 'goldens-script.js'), 'utf8');
const THREE = fs.readFileSync(path.resolve('node_modules/three/build/three.min.js'), 'utf8');
const REF = 'file://' + path.resolve('docs/kit-studio/reference/kit-studio.html') + '?debug=1';
const APP = process.env.KS_APP_URL && process.env.KS_APP_URL !== 'reference'
  ? process.env.KS_APP_URL.replace(/\/$/, '') + '/materiel/studio?debug=1'
  : REF;
const MAX_DIFF = Number(process.env.KS_MAX_DIFF ?? 0.01);

async function open(ctx: BrowserContext, url: string): Promise<Page> {
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  (page as Page & { errors: string[] }).errors = errors;
  await page.route('**/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE }));
  await page.addInitScript((st: Record<string, string>) => {
    try { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); } catch { /* stockage indisponible */ }
  }, S.storage);
  await page.goto(url);
  await page.waitForFunction(() => !!(window as unknown as { __ks?: unknown }).__ks, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  return page;
}

async function act(page: Page, a: string[]): Promise<void> {
  const [kind, x, y] = a;
  if (kind === 'focus') await page.focus(x);
  else if (kind === 'key') { await page.keyboard.press(x); await page.waitForTimeout(350); }
  else if (kind === 'click') {
    await page.evaluate((sel) => { const e = document.querySelector<HTMLElement>(sel); if (!e) throw new Error('absent : ' + sel); e.click(); }, x);
    await page.waitForTimeout(600);
  } else if (kind === 'fill') { await page.fill(x, y); await page.waitForTimeout(400); }
  else if (kind === 'hash') { await page.evaluate((h) => { location.hash = '#' + h; }, x); await page.waitForTimeout(800); }
  else if (kind === 'scrollPager') {
    await page.evaluate(([sel, i]) => { const p = document.querySelector<HTMLElement>(sel)!; p.scrollLeft = Number(i) * p.clientWidth; }, [x, y ?? a[2]] as [string, string]);
    await page.waitForTimeout(400);
  } else throw new Error('action inconnue : ' + kind);
}

const texts = (page: Page) => page.evaluate((sels: string[]) => Object.fromEntries(sels.map((s) => {
  const e = document.querySelector<HTMLElement>(s);
  return [s, e ? e.innerText.replace(/\s+/g, ' ').trim().slice(0, 400) : null];
})), S.texts as string[]);

function diffRatio(a: Buffer, b: Buffer, name: string): number {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  expect(B.width, name + ' : largeur').toBe(A.width);
  expect(B.height, name + ' : hauteur').toBe(A.height);
  const D = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name + '.ref.png'), a);
  fs.writeFileSync(path.join(OUT, name + '.app.png'), b);
  fs.writeFileSync(path.join(OUT, name + '.diff.png'), PNG.sync.write(D));
  return n / (A.width * A.height);
}

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: S.viewport.width, height: S.viewport.height }, deviceScaleFactor: S.viewport.deviceScaleFactor });

test('moteur : valeurs de référence identiques', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await open(ctx, APP);
  const got = await page.evaluate(GOLD_JS);
  expect(got).toEqual(GOLD);
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
  await ctx.close();
});

/** Attend que l'orbite, l'ouverture et l'éclatement aient fini leur course (le pas de temps est plafonné :
 *  sur un rendu lent, un délai fixe ne suffit pas). */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(S.settleMs);
  await page.waitForFunction(() => {
    const k = (window as unknown as { __ks: { S: Record<string, number> } }).__ks.S;
    return Math.abs(k.s - k.sT) < 0.004 && Math.abs(k.ex - k.exT) < 0.004 && Math.abs(k.pex - k.pexT) < 0.004;
  }, null, { timeout: 60000, polling: 200 });
  await page.waitForTimeout(400);
}

/** Joue tout le scénario sur une seule page, seule dans le navigateur. */
async function run(browser: import('@playwright/test').Browser, url: string) {
  const v = S.viewport;
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.deviceScaleFactor });
  const page = await open(ctx, url);
  const out: { id: string; t: Record<string, string | null>; png: Buffer }[] = [];
  for (const st of S.steps) {
    for (const a of st.do) await act(page, a);
    await settle(page);
    out.push({ id: st.id, t: await texts(page), png: await page.screenshot() });
  }
  const errors = (page as Page & { errors: string[] }).errors;
  await ctx.close();
  return { out, errors };
}

test('scénario : textes et images identiques', async ({ browser }) => {
  test.setTimeout(30 * 60 * 1000);
  const R = await run(browser, REF);
  const A = await run(browser, APP);
  const report: string[] = [];
  for (let i = 0; i < S.steps.length; i++) {
    const id = S.steps[i].id;
    await test.step(id, async () => {
      expect(A.out[i].t, id + ' : textes').toEqual(R.out[i].t);
      const r = diffRatio(R.out[i].png, A.out[i].png, id);
      report.push(`${id}\t${(r * 100).toFixed(2)} %`);
      expect.soft(r, id + ' : pixels différents').toBeLessThanOrEqual(MAX_DIFF);
    });
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'ecarts.tsv'), report.join('\n') + '\n');
  expect(R.errors, 'erreurs de la référence').toEqual([]);
  expect(A.errors, 'erreurs de l’application').toEqual([]);
});
