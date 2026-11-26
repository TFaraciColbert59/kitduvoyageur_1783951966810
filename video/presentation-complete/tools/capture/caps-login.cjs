const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; const routes = process.argv.slice(3);
const PW = process.env.PWFILE ? fs.readFileSync(process.env.PWFILE, 'utf8').trim() : '';
(async () => {
  const b = await chromium.launch();
  const st = process.env.LKDV_STATE || __dirname + '/.session/state.json'; fs.mkdirSync(require('path').dirname(st), { recursive: true });
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], locale: 'fr-FR', ...(fs.existsSync(st) ? { storageState: st } : {}) });
  const p = await ctx.newPage();
  if (!fs.existsSync(st)) {
    await p.goto('http://localhost:3000/connexion', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Refuser' }).click({ timeout: 5000 }).catch(() => {});
    await p.locator('input[type=email]:visible').first().fill('demo@lkdv.app');
    await p.locator('input[type=password]:visible').first().fill(PW);
    await p.locator('input[type=password]:visible').first().press('Enter');
    await p.waitForURL(u => !u.toString().includes('/connexion'), { timeout: 120000 }).catch(() => {});
    console.log('connexion ->', p.url());
    await ctx.storageState({ path: st });
  }
  for (const r of routes) {
    const name = r.replace(/^\//, '').replace(/[\/?=&]/g, '_') || 'accueil';
    try {
      await p.goto('http://localhost:3000' + r, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(3000);
      await p.screenshot({ path: `${OUT}/${name}.png` });
      console.log(r, '->', p.url().replace('http://localhost:3000', ''));
    } catch (e) { console.log(r, 'ERREUR', e.message.split('\n')[0]); }
  }
  await ctx.storageState({ path: st });
  await b.close();
})();
