const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ids = ['presentation', 'destinations', 'activites', 'culture', 'gastronomie', 'pratique', 'communaute'];
  const out = {};

  // 1440x900 : FR (media query absente) + IS (pays verbeux)
  for (const [c, vp] of [['fr', { width: 1440, height: 900 }], ['is', { width: 1440, height: 900 }]]) {
    const p = await b.newPage({ viewport: vp });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 60)));
    await p.goto(`http://localhost:4000/pays/${c}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForTimeout(6000);
    out[c] = { tabs: {} };
    for (let i = 0; i < ids.length; i++) {
      await p.locator('.country-tab').nth(i).click();
      await p.waitForTimeout(700);
      out[c].tabs[ids[i]] = await p.evaluate(() => {
        const panel = document.querySelector('.country-tab-panel');
        const first = panel.querySelector(':scope > .p-hero, :scope > .section, :scope > .country-tab-section');
        const pr = panel.getBoundingClientRect();
        const fr = first.getBoundingClientRect();
        return {
          fits: panel.scrollHeight <= panel.clientHeight + 2,
          centered: Math.abs(Math.round(fr.top - pr.top) - Math.round(pr.bottom - fr.bottom)) <= 2,
        };
      });
    }
    out[c].errors = errs;
    await p.close();
  }

  // Globe ratio (1440) + pas de .cult-quote + presentation_lead absent du DOM
  const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto('http://localhost:4000/pays/fr', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p2.waitForTimeout(6000);
  out.globe = await p2.evaluate(() => {
    const wrap = document.querySelector('.country-tab-panel .hero-globe-wrapper');
    const canvas = wrap.querySelector('canvas');
    return {
      wrap: wrap ? `${Math.round(wrap.getBoundingClientRect().width)}x${Math.round(wrap.getBoundingClientRect().height)}` : null,
      canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
    };
  });
  out.cultQuoteGone = await p2.locator('.cult-quote').count();
  out.leadGone = await p2.evaluate(() => !document.body.textContent.includes('Des 4 807 mètres'));
  await p2.close();

  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();