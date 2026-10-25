import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4001/compte', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(7000);
const cdp = await ctx.newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const doc = await cdp.send('DOM.getDocument', { depth: -1 });
async function matched(sel) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel });
  if (!nodeId) return { sel, none: true };
  const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
  const out = [];
  for (const r of m.matchedCSSRules || []) {
    const rs = r.rule;
    if (!rs.style) continue;
    const props = (rs.style.cssProperties || []).filter((x) => x.name && x.value && ['width','height','display','grid-template-rows','grid-template-columns','position','left','right','bottom','padding','border-radius','inset'].includes(x.name));
    if (props.length) out.push({ sel: rs.selectorList.text.slice(0, 80), props: props.map((x) => `${x.name}:${x.value}${x.important ? ' !' : ''}`).join('; ') });
  }
  return { sel, out };
}
for (const s of ['.phone', '.tb', '.ig-tabs', '.card.cs', '.ig-grid-wrap', '.ig-tile', '.ig-hl', '.mapzone', '.top']) {
  const r = await matched(s);
  console.log('###', s);
  if (r.none) { console.log('  ABSENT'); continue; }
  r.out.forEach((o) => console.log('  ', o.sel, '=>', o.props));
}
await b.close();
