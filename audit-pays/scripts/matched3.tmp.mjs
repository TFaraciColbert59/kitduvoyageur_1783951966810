import { chromium } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:4001/pays/fr';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(6000);
const cdp = await ctx.newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const doc = await cdp.send('DOM.getDocument', { depth: -1 });
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.tb' });
const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
for (const r of m.matchedCSSRules || []) {
  const t = r.rule.selectorList.text;
  const props = (r.rule.style.cssProperties || []).filter((x) => ['width','height','left','right','bottom','position','padding','transform','margin'].includes(x.name) && x.value);
  if (!props.length) continue;
  console.log(t.slice(0, 70), '=>', props.map((x) => `${x.name}:${x.value}${x.important?' !':''}`).join('; '));
}
const cs = await p.evaluate(() => { const e = document.querySelector('.tb'); const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { box: [r.x, r.y, r.width, r.height], left: s.left, right: s.right, width: s.width, position: s.position, transform: s.transform, marginLeft: s.marginLeft }; });
console.log('COMPUTED', JSON.stringify(cs));
await b.close();
