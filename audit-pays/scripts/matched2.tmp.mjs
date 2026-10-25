import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(7000);
const anc = await p.evaluate(() => {
  const ph = document.querySelector('.phone'); const out = [];
  let n = ph;
  while (n && n !== document.documentElement) { out.push((n.className || '').toString().slice(0, 60) || n.tagName); n = n.parentElement; }
  return { chain: out, sheets: Array.from(document.styleSheets).map((s) => (s.href || 'inline').split('/').pop()) };
});
console.log('ANCETRES:', anc.chain.join(' < '));
console.log('SHEETS:', anc.sheets.join(', '));
const cdp = await ctx.newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const doc = await cdp.send('DOM.getDocument', { depth: -1 });
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.ig-tabs' });
const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
for (const r of m.matchedCSSRules || []) {
  const t = r.rule.selectorList.text;
  if (!/ig-tabs|ig-tile|card\.cs|phone|\.tb/.test(t)) continue;
  console.log('RULE', t.slice(0, 60), '| sheet', r.rule.styleSheetId);
}
await b.close();
