// Kit Studio (E5, E6) dans le compte de démonstration : gestes en LECTURE seulement
// (changer de mode, ouvrir le bilan, ouvrir la commande). Aucune configuration modifiée.
// Usage : VERCEL_SHARE=… node tools/capture/kit-studio.mjs <dossier>
import fs from 'node:fs';
import path from 'node:path';
import { openContext, settle, mask, BASE } from './lib.mjs';
import { demoLogin } from './demo-probe.mjs';
import { refuseCookies, dump } from './steps.mjs';

const out = process.argv[2] || 'assets/screens/raw';
fs.mkdirSync(out, { recursive: true });
const { browser, ctx } = await openContext();
try {
  if (!(await demoLogin(ctx))) throw new Error('connexion démo impossible');
  const page = await ctx.newPage();
  await page.goto(BASE + '/kit-studio', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page, 9000);
  await refuseCookies(page);
  await page.waitForTimeout(1500);
  await dump(page, out, 'ks-01-contenu');
  // Mode « Apparence du sac » (crayon) : le bouton Commander n'apparaît qu'ici.
  const look = page.getByRole('radio', { name: /Apparence du sac/i }).or(page.getByRole('button', { name: /Apparence du sac/i }));
  if (await look.count()) {
    await look.first().click();
    await page.waitForTimeout(3500);
    await dump(page, out, 'ks-02-apparence');
  } else console.log('mode apparence introuvable');
  const order = page.getByRole('button', { name: /^Commander/ });
  if (await order.count()) {
    console.log('bouton :', await order.first().innerText());
    await order.first().click();
    await page.waitForTimeout(2500);
    await dump(page, out, 'ks-03-commande');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
  } else console.log('aucun bouton Commander (rien à commander dans ce kit)');
  const content = page.getByRole('radio', { name: /Contenu du sac/i }).or(page.getByRole('button', { name: /Contenu du sac/i }));
  if (await content.count()) { await content.first().click(); await page.waitForTimeout(2000); }
  const pill = page.getByRole('button', { name: /Ouvrir le bilan/i });
  if (await pill.count()) {
    await pill.first().click();
    await page.waitForTimeout(3000);
    await dump(page, out, 'ks-04-bilan');
  } else console.log('pilule du bilan introuvable');
  await page.close();
} catch (e) {
  console.log('ERREUR', mask(e.message));
}
await browser.close();
