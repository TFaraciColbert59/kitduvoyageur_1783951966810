import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4000/pays/fr', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(3500);
const r = await p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const h1 = [...document.querySelectorAll('h1')].map((e) => ({ t: (e.textContent || '').trim().slice(0, 30), visible: vis(e), path: (() => { let n = e, out = []; for (let i = 0; i < 6 && n; i++, n = n.parentElement) out.push((n.className || '').toString().split(' ').slice(0, 2).join('.')); return out.join(' < '); })() }));
  const shell = [...document.querySelectorAll('div,main')].filter((e) => /md:hidden|hidden md:|lg:block/.test((e.className || '').toString())).slice(0, 8).map((e) => ({ cls: (e.className || '').toString().slice(0, 60), visible: vis(e) }));
  const focusables = [...document.querySelectorAll('button,a[href],input,[tabindex]')].filter(vis).length;
  return { h1, shell, focusables, srOnly: document.querySelectorAll('.sr-only').length };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
