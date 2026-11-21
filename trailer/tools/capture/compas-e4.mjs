// E4 (P15) : itinéraire sur les Dolomites dans le Compas du compte de démonstration.
// UNE seule écriture : le brouillon créé par « Préparer » (limite du brief E4 : 1 brouillon).
// Usage : VERCEL_SHARE=… node tools/capture/compas-e4.mjs <dossier> ["phrase"]
import fs from 'node:fs';
import { openContext, settle, mask, BASE } from './lib.mjs';
import { demoLogin } from './demo-probe.mjs';
import { refuseCookies, dump } from './steps.mjs';

const out = process.argv[2] || 'qa/tmp/e4';
const PHRASE = process.argv[3] || "Cortina d'Ampezzo, 4 jours à 4";
fs.mkdirSync(out, { recursive: true });
const { browser, ctx } = await openContext({ geolocation: { latitude: 46.5405, longitude: 12.1357, accuracy: 10 } });
try {
  if (!(await demoLogin(ctx))) throw new Error('connexion démo impossible');
  const page = await ctx.newPage();
  await page.goto(BASE + '/compas?nouvelle=1', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page, 5000);
  await refuseCookies(page);
  const box = page.locator('form input, textarea').first();
  await box.click();
  await page.keyboard.type(PHRASE, { delay: 60 });
  await page.waitForTimeout(2000);
  await dump(page, out, 'e4-00-saisi');
  await page.keyboard.press('Enter');
  console.log('écriture : brouillon Compas', new Date().toISOString());
  for (const [i, wait] of [[1, 15000], [2, 30000], [3, 45000]]) {
    await page.waitForTimeout(wait);
    await dump(page, out, `e4-0${i}-prep`);
  }
  await settle(page, 4000);
  const url = new URL(page.url());
  console.log('aventure :', mask(url.pathname + url.search));
  for (const etape of ['ou', 'verdict']) {
    url.searchParams.set('etape', etape);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(page, 12000);
    await dump(page, out, `e4-etape-${etape}`);
  }
  fs.writeFileSync(out + '/url.txt', mask(url.pathname + url.search));
  await page.close();
} catch (e) {
  console.log('ERREUR', mask(e.message));
}
await browser.close();
