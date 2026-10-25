import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'networkidle', timeout: 90000 }).catch(()=>{});
await p.waitForTimeout(4000);
const out = await p.evaluate(() => {
  const wants = ['.ig-tabs', '.card.cs', '.ig-tile', '.ig-hl ', '.ig-hl{', '.ig-grid', '.tb', '.ig-th', '.mapzone', '.top{'];
  const hits = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = Array.from(sheet.cssRules || []); } catch { continue; }
    const walk = (list) => {
      for (const r of list) {
        if (r.cssRules) { walk(Array.from(r.cssRules)); continue; }
        const sel = r.selectorText || '';
        if (wants.some((w) => sel.includes(w.replace('{', '').trim()))) {
          hits.push({ href: (sheet.href || '').split('/').pop(), sel, css: (r.style.cssText || '').slice(0, 220) });
        }
      }
    };
    walk(rules);
  }
  return hits;
});
for (const h of out) console.log(h.href, '|', h.sel.slice(0, 70), '|', h.css);
console.log('total', out.length);
await b.close();
