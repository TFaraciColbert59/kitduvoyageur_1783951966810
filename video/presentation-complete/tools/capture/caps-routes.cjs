// Capture du Hub en plein écran iPhone (393×852, 3x), compte de démo connecté. Lecture seule : aucun clic de validation.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ST = (process.env.LKDV_STATE || __dirname + '/.session/state.json');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, locale: 'fr-FR', storageState: ST });
  const p = await ctx.newPage();
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  for (const r of process.argv.slice(3)) {
    await p.goto('http://localhost:3000' + r, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await p.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});
    await p.getByRole('button', { name: 'Refuser' }).click({ timeout: 3000 }).catch(() => {});
    await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
    await p.waitForTimeout(5000);
    const name = r.slice(1).replace(/[\/?=]/g, '_');
    await p.screenshot({ path: `${OUT}/${name}.png` });
    console.log(r, '->', p.url().replace('http://localhost:3000', ''));
  }
  await b.close();
})();
