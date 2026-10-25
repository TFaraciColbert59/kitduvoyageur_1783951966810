import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(6000);
const clean = (h) => h.replace(/data:image\/[^"']{40,}/g, 'data:IMG').replace(/src="[^"]{80,}"/g, 'src="IMG"').replace(/\s+/g, ' ');
const out = await p.evaluate(() => {
  const pick = (sel) => { const e = document.querySelector(sel); return e ? e.outerHTML : null; };
  return {
    phoneAttrs: document.querySelector('.phone')?.getAttributeNames(),
    phoneClasses: document.querySelector('.phone')?.className,
    top: pick('.top'),
    card: pick('.card'),
    mapzone: pick('.mapzone'),
    tabbar: pick('.tabbar') || pick('.tb'),
  };
});
for (const [k, v] of Object.entries(out)) {
  const s = typeof v === 'string' ? clean(v) : JSON.stringify(v);
  console.log('###', k, 'len', s.length, '\n', s.slice(0, 2200), '\n');
}
await b.close();
