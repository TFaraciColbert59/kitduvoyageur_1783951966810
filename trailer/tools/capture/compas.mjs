// Compas E2 (Où) et E3 (Nous) dans le compte de démonstration.
// UNE seule écriture : le brouillon créé par « Préparer » (limite du brief : 2 brouillons).
// Usage : VERCEL_SHARE=… node tools/capture/compas.mjs <dossier> [--no-submit]
import fs from 'node:fs';
import { openContext, settle, mask, BASE } from './lib.mjs';
import { demoLogin } from './demo-probe.mjs';
import { refuseCookies, dump } from './steps.mjs';

const out = process.argv[2] || 'assets/screens/raw';
const submit = !process.argv.includes('--no-submit');
const PHRASE = 'Les Dolomites, 4 jours à 4';
fs.mkdirSync(out, { recursive: true });
const { browser, ctx } = await openContext();
try {
  if (!(await demoLogin(ctx))) throw new Error('connexion démo impossible');
  const page = await ctx.newPage();
  await page.goto(BASE + '/compas?nouvelle=1', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page, 5000);
  await refuseCookies(page);
  await dump(page, out, 'cp-01-ou-vide');
  const box = page.locator('form input, textarea').first();
  await box.click();
  await page.keyboard.type(PHRASE, { delay: 70 });
  await page.waitForTimeout(2500);
  await dump(page, out, 'cp-02-ou-saisi');
  if (submit) {
    await page.keyboard.press('Enter');
    // Préparation visible : on capture pendant puis après.
    for (const [i, wait] of [[3, 6000], [4, 20000], [5, 40000]]) {
      await page.waitForTimeout(wait);
      await dump(page, out, `cp-0${i}-apres-${wait / 1000}s`);
    }
    await settle(page, 4000);
    const url = new URL(page.url());
    console.log('aventure :', mask(url.pathname + url.search));
    for (const etape of ['ou', 'nous']) {
      url.searchParams.set('etape', etape);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(page, 9000);
      await dump(page, out, `cp-etape-${etape}`);
    }
  }
  await page.close();
} catch (e) {
  console.log('ERREUR', mask(e.message));
}
await browser.close();
