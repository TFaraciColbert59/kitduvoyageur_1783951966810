import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/pays-audit';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:4000';

const viewports = [
  { name: '430', width: 430, height: 932, dpr: 2 },
  { name: '768', width: 768, height: 1024, dpr: 1 },
  { name: '1440', width: 1440, height: 900, dpr: 1 },
];

const browser = await chromium.launch();

async function shoot(route, label) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));
    let status = 0;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
      status = resp?.status() ?? 0;
      await page.waitForTimeout(3500);
      await page.evaluate(async () => {
        await new Promise((r) => setTimeout(r, 300));
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);
    } catch (e) {
      errors.push('GOTO: ' + String(e).slice(0, 300));
    }
    const file = path.join(OUT, `${label}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        scrollHeight: de.scrollHeight,
        innerHeight: window.innerHeight,
        scrollWidth: de.scrollWidth,
        innerWidth: window.innerWidth,
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map((e) => e.textContent?.trim()).slice(0, 3),
      };
    }).catch(() => ({}));
    fs.writeFileSync(file.replace('.png', '.json'), JSON.stringify({ route, vp, status, metrics, errors }, null, 2));
    console.log(label, vp.name, 'status', status, 'scrollH', metrics.scrollHeight, 'innerH', metrics.innerHeight, 'errors', errors.length);
    await ctx.close();
  }
}

await shoot('/pays/fr', 'pays-fr');
await shoot('/compte', 'ref-compte');
await shoot('/communaute', 'ref-communaute');
await browser.close();
