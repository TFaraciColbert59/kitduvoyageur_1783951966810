import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(6000);
const out = await p.evaluate(() => {
  const t = document.querySelector('.ig-tile');
  if (!t) return null;
  // enlever les <svg> pour ne garder que la structure de texte
  const clone = t.cloneNode(true);
  clone.querySelectorAll('svg').forEach((s) => s.replaceWith(document.createComment('svg')));
  return { cls: t.className, inner: clone.innerHTML.replace(/\s+/g, ' ').slice(0, 700) };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
