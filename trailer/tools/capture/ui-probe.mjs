// Sonde pas à pas en session démo : exécute une suite d'actions puis capture.
// Actions (arguments) : goto:/route · click:Texte · role:button:Nom · label:Nom=valeur
//   · file:selecteur=chemin · wait:ms · shot:nom · scroll:px · tap:x,y
// Usage : VERCEL_SHARE=… node tools/capture/ui-probe.mjs <dossier> action…
import fs from 'node:fs';
import path from 'node:path';
import { openContext, settle, mask, BASE } from './lib.mjs';
import { demoLogin } from './demo-probe.mjs';
import { dump, refuseCookies } from './steps.mjs';

const [out, ...actions] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { browser, ctx } = await openContext();
if (!(await demoLogin(ctx))) { await browser.close(); process.exit(1); }
const page = await ctx.newPage();
const controls = async (name) => {
  const list = await page.evaluate(() =>
    [...document.querySelectorAll('button, a, [role=tab], [role=radio], input, textarea')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => `${e.tagName.toLowerCase()}|${e.getAttribute('aria-label') || ''}|${(e.innerText || e.placeholder || e.name || '').trim().slice(0, 50)}`)
      .join('\n'));
  fs.writeFileSync(path.join(out, name + '.controls.txt'), mask(list));
};
for (const a of actions) {
  const [k, ...rest] = a.split(':'); const v = rest.join(':');
  try {
    if (k === 'goto') { await page.goto(BASE + v, { waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page, 5000); await refuseCookies(page); }
    else if (k === 'click') { await page.getByText(v, { exact: false }).first().click({ timeout: 15000 }); await page.waitForTimeout(1500); }
    else if (k === 'exact') { await page.getByText(v, { exact: true }).first().click({ timeout: 15000 }); await page.waitForTimeout(1500); }
    else if (k === 'role') { const [r, n] = [v.split(':')[0], v.split(':').slice(1).join(':')]; await page.getByRole(r, { name: n }).first().click({ timeout: 15000 }); await page.waitForTimeout(1500); }
    else if (k === 'label') { const [n, val] = v.split('='); await page.getByLabel(n).first().fill(val); await page.waitForTimeout(500); }
    else if (k === 'ph') { const [n, val] = v.split('='); await page.getByPlaceholder(n).first().fill(val); await page.waitForTimeout(500); }
    else if (k === 'fill') { const i = v.lastIndexOf('='); await page.locator(v.slice(0, i)).first().fill(v.slice(i + 1)); await page.waitForTimeout(500); }
    else if (k === 'file') { const j = v.lastIndexOf('='); const [sel, f] = [v.slice(0, j), v.slice(j + 1)]; await page.locator(sel).first().setInputFiles(f); await page.waitForTimeout(4000); }
    else if (k === 'wait') await page.waitForTimeout(Number(v));
    else if (k === 'scroll') { await page.mouse.wheel(0, Number(v)); await page.waitForTimeout(1200); }
    else if (k === 'tap') { const [x, y] = v.split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(1500); }
    else if (k === 'shot') { await settle(page, 1500); await dump(page, out, v, { timeout: 120000 }); await controls(v); }
    console.log('ok', mask(a));
  } catch (e) { console.log('ÉCHEC', mask(a), mask(e.message.split('\n')[0])); await dump(page, out, 'err-' + Date.now()).catch(() => {}); break; }
}
console.log('url', mask(new URL(page.url()).pathname + new URL(page.url()).search));
await browser.close();
