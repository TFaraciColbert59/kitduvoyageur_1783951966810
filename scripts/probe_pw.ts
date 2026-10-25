import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { chromium } = req('C:/Users/Tony/.claude/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js');

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ baseURL: 'http://localhost:4028' });
  await ctx.addInitScript(() => {
    (window as any).__calls = 0;
    (navigator.permissions as any).query = () => Promise.resolve({ state: 'granted', onchange: null });
    (navigator.geolocation as any).watchPosition = (s: any) => { (window as any).__calls++; return 1; };
    (navigator.geolocation as any).clearWatch = () => {};
  });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(
    () =>
      new Promise<any>((res) => {
        (navigator.geolocation as any).watchPosition(() => {}, () => {}, {});
        Promise.resolve((navigator.permissions as any).query({ name: 'geolocation' })).then((st: any) =>
          res({ calls: (window as any).__calls, perm: st?.state, hasGeo: 'geolocation' in navigator })
        );
      })
  );
  console.log('PROBE:', JSON.stringify(r));
  await b.close();
})().catch((e) => { console.error('PROBE-ERR', e.message); process.exit(1); });