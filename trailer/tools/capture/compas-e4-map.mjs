// E4 : relit (sans écrire) la dernière aventure ouverte du Compas et agrandit sa carte.
// Usage : VERCEL_SHARE=… node tools/capture/compas-e4-map.mjs <dossier>
import fs from 'node:fs';
import { openContext, settle, BASE } from './lib.mjs';
import { demoLogin } from './demo-probe.mjs';
import { refuseCookies, dump } from './steps.mjs';

const out = process.argv[2] || 'qa/tmp/e4';
fs.mkdirSync(out, { recursive: true });
const { browser, ctx } = await openContext({ geolocation: { latitude: 46.5405, longitude: 12.1357, accuracy: 10 } });
if (await demoLogin(ctx)) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/compas?etape=ou', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page, 12000);
  await refuseCookies(page);
  await dump(page, out, 'm-00');
  const labels = await page.$$eval('button[aria-label]', (bs) => bs.map((b) => b.getAttribute('aria-label')));
  fs.writeFileSync(out + '/m-buttons.txt', labels.join('\n'));
  // Glisser la poignée de la carte vers le haut (tiroir de carte agrandi).
  await page.mouse.move(215, 576); await page.mouse.down();
  for (let y = 576; y >= 150; y -= 20) { await page.mouse.move(215, y); await page.waitForTimeout(16); }
  await page.mouse.up();
  await settle(page, 6000);
  await dump(page, out, 'm-01-glisse');
  // Dézoom d'un cran pour voir les sommets autour.
  const minus = page.getByRole('button', { name: /Dézoomer|Zoom arrière|zoom out/i });
  if (await minus.count()) { await minus.first().click(); await settle(page, 6000); await dump(page, out, 'm-02-dezoom'); }
  await page.close();
}
await browser.close();
