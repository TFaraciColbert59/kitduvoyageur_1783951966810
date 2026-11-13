import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const p = await ctx.newPage();
for (const code of ['pt','np']) {
  await p.goto('http://127.0.0.1:4000/pays/' + code, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  try { const x = p.getByRole('button', { name: /Refuser/i }).first(); if (await x.isVisible({ timeout: 2000 })) await x.click(); } catch {}
  await p.screenshot({ path: `/Users/fr168256/lkdv/audit/pays-2026-10-25/avant/pays-${code}-430.png` });
  const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, txt: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200) }));
  console.log(code, m.h, m.txt.slice(0, 120));
}
await b.close();
