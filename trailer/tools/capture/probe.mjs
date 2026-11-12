// Sonde : capture brute d'une liste de routes publiques pour repérer les écrans.
// Usage : VERCEL_SHARE=… node tools/capture/probe.mjs <dossier> /route1 /route2 …
import fs from 'node:fs';
import path from 'node:path';
import { openContext, assertServed, settle, mask, BASE } from './lib.mjs';

const [out, ...routes] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { browser, ctx } = await openContext();
for (const route of routes) {
  const page = await ctx.newPage();
  try {
    const r = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(page, 4000);
    await assertServed(page);
    const name = route.replace(/[^a-z0-9]+/gi, '_') || 'root';
    await page.screenshot({ path: path.join(out, name + '.png') });
    const text = (await page.evaluate(() => document.body.innerText)).slice(0, 1500);
    fs.writeFileSync(path.join(out, name + '.txt'), mask(page.url()) + '\n' + mask(text));
    console.log(route, r?.status(), '→', mask(new URL(page.url()).pathname));
  } catch (e) {
    console.log(route, 'ERREUR', mask(e.message));
  }
  await page.close();
}
await browser.close();
