import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(6000);
const clean = (h) => h ? h.replace(/data:image\/[^"']{40,}/g, 'data:IMG').replace(/\s+/g, ' ') : 'ABSENT';
const out = await p.evaluate(() => ({
  hl: document.querySelector('.ig-hl-row')?.outerHTML.slice(0, 1400),
  grid: document.querySelector('.ig-grid-wrap')?.outerHTML.slice(0, 1200),
  tabsFloat: document.querySelector('.ig-tabs-float')?.outerHTML.slice(0, 1200),
  tabsCls: document.querySelector('.ig-tabs')?.className,
  hlCls: document.querySelector('.ig-hl')?.className,
  tileCls: document.querySelector('.ig-tile')?.className,
  cardCls: document.querySelector('.card')?.className,
}));
for (const [k, v] of Object.entries(out)) console.log('###', k, '\n', clean(v), '\n');
await b.close();
