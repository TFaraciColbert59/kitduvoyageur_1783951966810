// Gestes communs : refus des cookies (geste réel de l'utilisateur), capture + texte.
import fs from 'node:fs';
import path from 'node:path';
import { mask } from './lib.mjs';

export async function refuseCookies(page) {
  const b = page.getByRole('button', { name: /^Refuser$/ });
  if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(800); }
}

/** Capture plein viewport (1290×2796) + texte visible, pour vérifier les libellés. */
export async function dump(page, out, name, opts = {}) {
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file, ...opts });
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(out, name + '.txt'), mask(text).slice(0, 6000));
  console.log('capture', name);
  return file;
}
