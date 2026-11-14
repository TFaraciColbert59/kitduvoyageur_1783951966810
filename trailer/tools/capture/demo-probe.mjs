// Sonde en LECTURE dans le compte de démonstration partagé (bouton « Connexion démo »
// de /connexion, identifiants côté serveur seulement). Aucune écriture : on regarde.
// Usage : VERCEL_SHARE=… node tools/capture/demo-probe.mjs <dossier> /route1 …
import fs from 'node:fs';
import path from 'node:path';
import { openContext, assertServed, settle, mask, BASE } from './lib.mjs';

export async function demoLogin(ctx) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/connexion', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(page, 2000);
  await assertServed(page);
  const btn = page.getByRole('link', { name: /Connexion démo/i });
  await btn.click();
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'), { timeout: 60000 }).catch(() => {});
  await settle(page, 1500);
  const ok = !new URL(page.url()).pathname.startsWith('/connexion');
  console.log('connexion démo', ok ? 'ok' : 'échec', mask(new URL(page.url()).pathname));
  await page.close();
  return ok;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [out, ...routes] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const { browser, ctx } = await openContext();
  if (await demoLogin(ctx)) {
    for (const route of routes) {
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await settle(page, 6000);
        const name = route.replace(/[^a-z0-9]+/gi, '_') || 'root';
        await page.screenshot({ path: path.join(out, name + '.png') });
        fs.writeFileSync(path.join(out, name + '.txt'), mask(page.url()) + '\n' + mask(await page.evaluate(() => document.body.innerText)).slice(0, 3000));
        console.log(route, '→', mask(new URL(page.url()).pathname));
      } catch (e) {
        console.log(route, 'ERREUR', mask(e.message));
      }
      await page.close();
    }
  }
  await browser.close();
}
