// Mesure T1 : fps pendant un drag mobile reellement dispatche sur la piste.
// Le compteur tourne dans la page (rAF), la souris bouge via CDP : ce sont
// de vrais pointermove, pas une simulation de setState.
const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();

  await page.goto('http://localhost:4028/trajectoire', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const slider = page.locator('[role="slider"]');
  const box = await slider.boundingBox();
  if (!box) throw new Error('curseur introuvable');

  const y = box.y + box.height / 2;

  // Compteur rAF ouvert AVANT le geste.
  await page.evaluate(() => {
    window.__frames = [];
    const tick = (ts) => {
      window.__frames.push(ts);
      window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
  });

  await page.touchscreen.tap(box.x + box.width * 0.5, y).catch(() => {});
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  // Traversee aller-retour sur 2 s : 120 deplacements, comme un doigt.
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(box.x + box.width * (0.5 - (i / 60) * 0.45), y);
    await page.mouse.move(box.x + box.width * (0.05 + (i / 60) * 0.45), y);
  }
  await page.mouse.up();

  const res = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__frames;
    if (f.length < 2) return { frames: f.length };
    const deltas = [];
    for (let i = 1; i < f.length; i++) deltas.push(f[i] - f[i - 1]);
    deltas.sort((a, b) => a - b);
    const sum = deltas.reduce((a, b) => a + b, 0);
    const long = deltas.filter((d) => d > 20).length; // > 20 ms = image ratee
    return {
      frames: f.length,
      dureeMs: Math.round(sum),
      fpsMoyen: Math.round((deltas.length / sum) * 1000),
      fpsMedians: Math.round(1000 / deltas[Math.floor(deltas.length / 2)]),
      pireMs: Math.round(deltas[deltas.length - 1]),
      p95Ms: Math.round(deltas[Math.floor(deltas.length * 0.95)]),
      imagesRatees: long,
      tauxImagesRatees: +((long / deltas.length) * 100).toFixed(1),
    };
  });

  console.log(JSON.stringify({ viewport: devices['iPhone 13'].viewport, ...res }, null, 2));
  await browser.close();
})();
