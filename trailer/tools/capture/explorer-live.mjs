// E7 / E8 / E10 : Explorer, activité en direct, GPS de l'appareil simulé.
// La position et l'horloge de l'appareil sont simulées DANS LA PAGE (comme un
// rejeu GPX) : l'app reçoit des fixes `watchPosition` réalistes (≈1 m/s) et
// calcule elle-même distance, allure, temps et D+. Aucune valeur n'est écrite.
// Usage : VERCEL_SHARE=… node tools/capture/explorer-live.mjs <dossier> [probe]
import fs from 'node:fs';
import { openContext, assertServed, settle, BASE } from './lib.mjs';
import { dump, refuseCookies } from './steps.mjs';

const out = process.argv[2] || 'qa/tmp/explorer';
const probeOnly = process.argv[3] === 'probe';
fs.mkdirSync(out, { recursive: true });

// Sentier 215 : Passo Tre Croci → Lago di Sorapis (points de passage approchés).
const WAY = [
  [46.5562, 12.2009, 1805], [46.5545, 12.2075, 1830], [46.5521, 12.2132, 1860],
  [46.5480, 12.2178, 1890], [46.5432, 12.2210, 1905], [46.5390, 12.2251, 1880],
  [46.5340, 12.2268, 1910], [46.5290, 12.2262, 1950], [46.5245, 12.2240, 1930],
  [46.5196, 12.2228, 1925],
];

function polyLen(p) {
  const rad = (d) => (d * Math.PI) / 180; let L = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    L += 2 * 6371000 * Math.asin(Math.sqrt(h));
  }
  return L;
}
// Ajuste l'amplitude des lacets pour que la trace mesure targetM.
function calibrated(targetM, n = 360) {
  let lo = 0, hi = 0.002, best;
  for (let it = 0; it < 40; it++) {
    const amp = (lo + hi) / 2; best = track(n, 1, amp);
    if (polyLen(best) < targetM) lo = amp; else hi = amp;
  }
  console.log('trace', Math.round(polyLen(best)), 'm,', best.length, 'fixes');
  return best;
}

function track(totalM, stepM, amp = 0.00018) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const hav = (a, b) => {
    const dLa = rad(b[0] - a[0]), dLo = rad(b[1] - a[1]);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const segs = WAY.slice(1).map((b, i) => ({ a: WAY[i], b, len: hav(WAY[i], b) }));
  const pathLen = segs.reduce((s, x) => s + x.len, 0);
  const k = totalM / pathLen; // lacets : le sentier réel serpente (facteur appliqué à l'abscisse)
  const pts = [];
  for (let d = 0; d <= totalM; d += stepM) {
    let r = d / k;
    let s = segs.find((x) => (r <= x.len ? true : ((r -= x.len), false))) || segs[segs.length - 1];
    const f = Math.min(1, r / s.len);
    const wig = Math.sin(d * 0.35) * amp; // lacets
    pts.push({
      lat: s.a[0] + (s.b[0] - s.a[0]) * f + wig,
      lng: s.a[1] + (s.b[1] - s.a[1]) * f + wig * 0.6,
      ele: s.a[2] + (s.b[2] - s.a[2]) * f + Math.sin(d / 140) * 6,
    });
  }
  return pts;
}

const INIT = `(() => {
  const RealDate = Date; let off = 0;
  class FDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }
  window.Date = FDate;
  const cbs = new Map(); let id = 0; let last = null;
  const mk = (p) => ({ timestamp: FDate.now(), coords: { latitude: p.lat, longitude: p.lng, altitude: p.ele, accuracy: 6, altitudeAccuracy: 8, heading: null, speed: p.speed ?? null } });
  const geo = {
    getCurrentPosition(ok) { if (last) setTimeout(() => ok(mk(last)), 50); },
    watchPosition(ok) { const k = ++id; cbs.set(k, ok); if (last) setTimeout(() => ok(mk(last)), 50); return k; },
    clearWatch(k) { cbs.delete(k); },
  };
  Object.defineProperty(navigator, 'geolocation', { get: () => geo, configurable: true });
  window.__gps = { advance(ms) { off += ms; }, push(p) { last = p; for (const ok of cbs.values()) ok(mk(p)); }, set(p) { last = p; } };
})();`;

const pts = calibrated(6420);
const { browser, ctx } = await openContext({ geolocation: { latitude: pts[0].lat, longitude: pts[0].lng, accuracy: 6 } });
await ctx.addInitScript(INIT);
await ctx.addInitScript(`window.__gpsStart = ${JSON.stringify(pts[0])}; window.__gps && window.__gps.set(window.__gpsStart);`);
const page = await ctx.newPage();
const tiles = { ok: 0, ko: 0 };
page.on('response', (r) => { if (/openfreemap|tile/i.test(r.url())) (r.ok() ? tiles.ok++ : tiles.ko++); });
page.on('requestfailed', (r) => { if (/openfreemap|tile/i.test(r.url())) tiles.ko++; });
await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 90000 });
await settle(page, 8000);
await assertServed(page);
await refuseCookies(page);
await settle(page, 3000);
console.log('tuiles', JSON.stringify(tiles));
await dump(page, out, '00-explorer');
if (probeOnly) { await browser.close(); process.exit(0); }

// Démarrer une activité → Randonnée (le tiroir s'ouvre par la poignée « … »).
if (!(await page.getByRole('button', { name: 'Démarrer une activité' }).count())) {
  await page.mouse.click(215, 855);
  await page.waitForTimeout(1500);
  await dump(page, out, '00b-tiroir');
}
await page.getByRole('button', { name: 'Démarrer une activité' }).first().click();
await page.waitForTimeout(1500);
await dump(page, out, '01-start-sheet');
await page.getByText(/Randonnée/).first().click();
await page.waitForTimeout(2500);
await page.evaluate((p) => window.__gps.push(p), pts[0]);
await page.waitForTimeout(3000);
await dump(page, out, '02-live-0');

// Rejeu : un fix toutes les 18 s simulées (≈1 m/s), rendu par lots.
const stepMs = 18000;
const marks = { 120: '03-live-early', [pts.length - 1]: '04-live-6k4' };
for (let i = 1; i < pts.length; i++) {
  await page.evaluate(([p, ms]) => { window.__gps.advance(ms); window.__gps.push(p); }, [pts[i], stepMs]);
  if (i % 40 === 0) await page.waitForTimeout(150);
  if (marks[i]) { await settle(page, 6000); await dump(page, out, marks[i], { timeout: 120000 }); }
}
await page.waitForTimeout(3000);
await dump(page, out, '05-live-end', { timeout: 120000 });
await browser.close();
