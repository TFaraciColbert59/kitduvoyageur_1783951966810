import { chromium } from 'playwright';

const routes = process.argv.slice(2).filter((a) => a.startsWith('/'));
const width = Number(process.env.PROBE_W || 1440);
const height = Number(process.env.PROBE_H || 900);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  isMobile: width < 700,
  hasTouch: width < 700,
});
await context.addInitScript(() => {
  window.localStorage.setItem(
    'lkdv_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
  );
});

const report = [];
for (const route of routes) {
  const page = await context.newPage();
  const events = { console: [], pageerror: [], rejection: [], http4xx5xx: [], failed: [] };
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') events.console.push(`[${t}] ${m.text()}`);
  });
  page.on('pageerror', (e) => events.pageerror.push(e.message));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? '';
    if (!f.includes('ERR_ABORTED')) events.failed.push(`${r.method()} ${r.url()} :: ${f}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) events.http4xx5xx.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  await page.goto(`http://localhost:4028${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  events.title = await page.title();
  report.push({ route, url: page.url(), ...events });
  await page.close();
}
await browser.close();

for (const r of report) {
  console.log(`\n=== ${r.route} → ${r.url} "${r.title}"`);
  if (r.pageerror.length) console.log('  PAGEERROR:', JSON.stringify(r.pageerror, null, 2));
  if (r.console.length) console.log('  CONSOLE:', JSON.stringify(r.console, null, 2));
  if (r.failed.length) console.log('  REQFAILED:', JSON.stringify(r.failed, null, 2));
  if (r.http4xx5xx.length) console.log('  HTTP>=400:', JSON.stringify(r.http4xx5xx, null, 2));
}
console.log(`\nROUTES: ${report.length} | total console: ${report.reduce((a, r) => a + r.console.length, 0)} | pageerror: ${report.reduce((a, r) => a + r.pageerror.length, 0)} | http>=400: ${report.reduce((a, r) => a + r.http4xx5xx.length, 0)}`);
