// Ouvre un tiroir par capture (lecture seule) : on recharge la page, on clique le déclencheur, on photographie.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2]; const B = 'http://localhost:3000';
const JOBS = JSON.parse(process.env.JOBS);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, locale: 'fr-FR', storageState: (process.env.LKDV_STATE || __dirname + '/.session/state.json') });
  const p = await ctx.newPage();
  for (const [route, labels] of JOBS) {
    for (const lab of labels) {
      const name = (process.env.PREFIX || '') + (route.split('/')[1] + '-' + lab).normalize('NFD').replace(/[^\w-]+/g, '').toLowerCase().slice(0, 48);
      try {
        await p.goto(B + route, { waitUntil: 'domcontentloaded', timeout: 240000 });
        await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(2500);
        for (const step of lab.split(' > ')) {
          let t = p.getByRole('button', { name: step, exact: true });
          if (!(await t.count())) t = p.getByRole('tab', { name: step });
          if (!(await t.count())) t = p.getByRole('button', { name: step });
          if (!(await t.count())) t = p.getByText(step, { exact: true });
          await t.first().click({ timeout: 8000 }); await p.waitForTimeout(1800);
        }
        await p.waitForTimeout(2500);
        if (process.env.LIST) { const it = await p.$$eval('[role=dialog] button, [role=dialog] [role=tab], [data-vaul-drawer] button', els => els.filter(e => e.getBoundingClientRect().height > 0).map(e => (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40))); console.log('   tiroir :', [...new Set(it)].join(' | ')); }
        await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('ok', name);
      } catch (e) { console.log('KO', route, lab, e.message.split('\n')[0]); }
    }
  }
  await b.close();
})();
