import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Read-only, synthetic browser audit. Never updates visual-test snapshots.
const phase = process.argv[2] || 'before';
if (!/^[a-zA-Z0-9_-]+$/.test(phase)) throw new Error('Invalid audit phase');
const baseURL = process.env.GLASS_AUDIT_URL || 'http://localhost:4000';
const routes = (process.env.GLASS_AUDIT_ROUTES || '/materiel,/communaute,/profil').split(',');
const viewportSpecs = [[320,568],[390,844],[430,932],[834,1194],[1194,834],[1440,900]];
const outDir = path.resolve('docs/visual/liquid-glass', phase);
await mkdir(outDir, { recursive: true });
const report = {
  phase, startedAt: new Date().toISOString(), baseURL,
  limitations: ['Desktop browser emulation; no real Android/iOS device.', 'Development server synthetic timings are not field Core Web Vitals.', 'No GPU, energy, battery, thermal, or screen-reader measurement.', 'Axe cannot certify visual contrast over all translucent/image/map backgrounds.'],
  engines: {}, cases: [],
};
const save = () => writeFile(path.join(outDir, 'audit.json'), JSON.stringify(report, null, 2));

for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  let browser;
  try { browser = await engine.launch({ headless: true }); }
  catch (error) {
    report.engines[engineName] = { available: false, error: error.message.split('\n')[0] };
    await save();
    continue;
  }
  report.engines[engineName] = { available: true, version: browser.version() };
  for (const route of routes) {
    for (const [width, height] of viewportSpecs) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      const result = { engine: engineName, route, viewport: { width, height }, pageErrors: [] };
      page.on('pageerror', error => result.pageErrors.push(error.message));
      await page.addInitScript(() => {
        window.__glassVitals = { lcp: null, cls: 0, longTasks: [] };
        for (const type of ['largest-contentful-paint','layout-shift','longtask']) {
          try {
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) {
                if (type === 'largest-contentful-paint') window.__glassVitals.lcp = entry.startTime;
                if (type === 'layout-shift' && !entry.hadRecentInput) window.__glassVitals.cls += entry.value;
                if (type === 'longtask') window.__glassVitals.longTasks.push(entry.duration);
              }
            }).observe({ type, buffered: true });
          } catch { /* Browser does not expose this performance entry type. */ }
        }
      });
      try {
        const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(2200);
        await page.evaluate(() => document.fonts.ready);
        result.httpStatus = response?.status();
        result.finalURL = page.url();
        result.title = await page.title();
        const finalPath = new URL(page.url()).pathname;
        const requestedPath = new URL(route, baseURL).pathname;
        const visibleText = await page.locator('body').innerText();
        result.routeStatus = /\/(login|connexion|auth)(\/|$)/.test(finalPath)
          ? 'auth-redirect'
          : /redirection vers/i.test(visibleText)
            ? 'pending-navigation'
            : finalPath !== requestedPath ? 'redirected-route' : 'requested-route';
        result.dom = await page.evaluate(() => {
          const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const all = [...document.querySelectorAll('*')].filter(visible);
          const isBlur = el => { const s = getComputedStyle(el); return (s.backdropFilter || s.webkitBackdropFilter || 'none') !== 'none'; };
          const blurs = all.filter(isBlur);
          const nested = blurs.filter(el => { let p = el.parentElement; while (p) { if (isBlur(p)) return true; p = p.parentElement; } return false; });
          const targets = all.filter(el => el.matches('button,a[href],input,select,textarea,[role="button"]'));
          return {
            heading: document.querySelector('h1')?.textContent?.trim(),
            canonicalCards: document.querySelectorAll('.glass-card,[data-glass-card]').length,
            backdropCount: blurs.length, nestedBackdropCount: nested.length,
            nestedBackdrops: nested.slice(0,20).map(el => ({ tag: el.tagName, className: String(el.className) })),
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
            shortTouchTargets: targets.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).slice(0,60).map(el => ({ tag: el.tagName, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0,70), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })),
            backdropSupported: CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
          };
        });
        const basename = `${engineName}-${route.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'') || 'home'}-${width}x${height}`;
        result.screenshot = `${basename}.png`;
        await page.screenshot({ path: path.join(outDir, result.screenshot), fullPage: true });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        result.accessibility = { violations: axe.violations.map(({id,impact,description,helpUrl,nodes}) => ({ id,impact,description,helpUrl,nodes: nodes.map(({target,failureSummary}) => ({target,failureSummary})) })), incomplete: axe.incomplete.map(({id,nodes}) => ({ id, count: nodes.length })), passes: axe.passes.length };
        result.performance = await page.evaluate(async () => {
          const candidates = [document.scrollingElement, ...document.querySelectorAll('main,[class*="overflow"]')].filter(Boolean);
          const scroller = candidates.sort((a,b) => (b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0];
          const range = Math.max(0, scroller.scrollHeight-scroller.clientHeight);
          const frames = []; let previous; const start = performance.now();
          await new Promise(resolve => {
            const tick = now => {
              if (previous !== undefined) frames.push(now-previous);
              previous = now;
              scroller.scrollTop = range * ((now-start) / 1800);
              if (now-start < 1800) requestAnimationFrame(tick); else resolve();
            };
            requestAnimationFrame(tick);
          });
          scroller.scrollTop = 0;
          const sorted = [...frames].sort((a,b) => a-b);
          return { label: 'Synthetic rAF scrolling, desktop headless, dev server', scrollRange: range, frames: frames.length, meanFrameMs: frames.reduce((a,b) => a+b,0)/frames.length, p95FrameMs: sorted[Math.floor(sorted.length*0.95)], framesOver32ms: frames.filter(n => n>32).length, estimatedFPS: 1000/(frames.reduce((a,b) => a+b,0)/frames.length), heapBytes: performance.memory?.usedJSHeapSize ?? null, vitals: window.__glassVitals };
        });
      } catch (error) { result.error = error.message; }
      report.cases.push(result);
      console.log(`${phase} ${engineName} ${route} ${width}x${height}: ${result.error || `${result.routeStatus}; axe=${result.accessibility?.violations.length}; nestedBlur=${result.dom?.nestedBackdropCount}`}`);
      await save();
      await context.close();
    }
  }
  await browser.close();
}
report.completedAt = new Date().toISOString();
await save();
console.log(`Audit saved: ${outDir}`);
