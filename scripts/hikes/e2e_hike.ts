// Test E2E navigateur RÉEL du flux randonnée online :
//   Explorer → /randonnee-active?routeId=3 → permission GPS accordée →
//   auto-start → mouvement GPS simulé le long de la vraie géométrie →
//   vérification UI (distance/progression/POI) + console (aucune erreur
//   Leaflet/NaN) → Stop (TERMINER) → session sauvegardée dans hike_sessions.
//
// Pré-requis : dev server sur :4028 ; Playwright (venv seo) + Chromium installés.
// Usage : npx tsx scripts/e2e_hike.ts
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { flattenSegments } from '../src/features/hiking/services/RouteGeom';
import { loadRouteDetail } from '../src/features/hiking/services/RouteService';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Tony/.claude/skills/seo/.venv/Lib/site-packages/playwright/driver/package/index.js');

const URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';
const BASE = 'http://localhost:4028';

const supabase = createClient('https://icxyvwzfjbflcbqukpfz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA', { auth: { persistSession: false } });

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

function buildWalk(geojson: any) {
  const segments = flattenSegments(geojson);
  const stepM = 40;
  const out: any[] = [];
  let ts = Date.now();
  for (const seg of segments) {
    const steps = Math.max(1, Math.round(seg.segLenM / 40));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const rad = (a: number) => (a * Math.PI) / 180;
      const y = Math.sin(rad(seg.endLng - seg.startLng)) * Math.cos(rad(seg.endLat));
      const x = Math.cos(rad(seg.startLat)) * Math.sin(rad(seg.endLat)) - Math.sin(rad(seg.startLat)) * Math.cos(rad(seg.endLat)) * Math.cos(rad(seg.endLng - seg.startLng));
      const hdg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      out.push({
        lat: seg.startLat + (seg.endLat - seg.startLat) * t,
        lng: seg.startLng + (seg.endLng - seg.startLng) * t,
        hdg,
        ts,
      });
      ts += 20000;
    }
  }
  return out;
}

async function runTest(routeId: string) {
  const hasRoute = routeId != null && routeId !== '';
  const email = `lkdv.e2e.${Date.now()}@test.com`;
  const password = 'Str0ngPass!lkdv';
  console.log(`=== E2E navigateur — ${routeId ? `route ${routeId}` : 'mode libre'} ===`);

  const { data: su, error: suErr } = await supabase.auth.signUp({ email: `lkdv.e2e.${Date.now()}@test.com`, password: 'Str0ngPass!lkdv' });
  if (!su.user || !su.session) throw new Error(`signup/e2e échec: ${suErr?.message}`);
  const session1 = su.session;
  console.log(`  utilisateur: ${su.user.email}`);

  let route = null;
  let walk: any[] = [];
  if (routeId) {
    const r = await loadRouteDetail(supabase, routeId);
    if (!r?.geojson) throw new Error('route introuvable');
    walk = buildWalk(r.geojson);
    console.log(`  route « ${r.name} » — ${walk.length} pas simulés (~${(walk.length * 40 / 1000).toFixed(1)} km)`);
  } else {
    console.log('  mode libre (pas de géométrie de route)');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, baseURL: 'http://localhost:4028' });

  const initSrc = `
const __PTS = ${JSON.stringify(walk)};
try {
  if (!Array.isArray(__PTS) || __PTS.length === 0) { (window as any).__initErr = 'points vides'; }
  else {
    var i = 0;
    function mkPos(idx) {
      var p = __PTS[idx];
      return {
        coords: { latitude: p.lat, longitude: p.lng, accuracy: 5, altitude: 30, altitudeAccuracy: 10, heading: p.hdg != null ? (p.hdg % 360) : null, speed: 1.6 },
        timestamp: p.ts
      };
    }
    var g = navigator.geolocation;
    (window as any).__simWatchCalls = 0; (window as any).__simFired = 0;
    try { navigator.permissions.query = function () { return Promise.resolve({ state: 'granted', onchange: null }); }; } catch (e) {}
    g.getCurrentPosition = function (success) { success(mkPos(Math.min(i, __PTS.length - 1))); };
    g.watchPosition = function (success) { (window as any).__simWatchCalls++; var id = setInterval(function () { (window as any).__simFired++; success(mkPos(Math.min(i, __PTS.length - 1))); if (i < __PTS.length - 1) i++; }, 20); return id; };
    g.clearWatch = function () {}; (window as any).__initOk = true;
  }
} catch (e) { (window as any).__initErr = String(e).slice(0, 200); }
try { localStorage.removeItem('lkdv_active_hike_session'); } catch (e) {}
`;

  await context.addInitScript({ content: initSrc });

  const page = await context.newPage();
  const consoleIssues: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg: any) => { if (msg.type() === 'error' || msg.type() === 'warning') consoleIssues.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`); });
  page.on('pageerror', (err: any) => pageErrors.push(String(err).slice(0, 300)));

  await context.addCookies([{ name: 'sb-icxyvwzfjbflcbqukpfz-auth-token', value: JSON.stringify(session1), domain: 'localhost', path: '/' }]);

  console.log('  navigation /randonnee-active...');
  await page.goto(routeId ? `/randonnee-active?routeId=${routeId}` : '/randonnee-active', { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForTimeout(9000);
  const diagText = await page.evaluate(() => document.body.innerText || '');
  const sim = await page.evaluate(() => ({ watch: (window as any).__simWatchCalls || 0, fired: (window as any).__simFired || 0, initOk: !!(window as any).__initOk, initErr: (window as any).__initErr || null })).catch(() => ({ watch: -1, fired: -1, initOk: false, initErr: 'evaluate fail' }));
  const hasPermModal = diagText.includes('Géolocalisation requise');
  const hasPermDenied = diagText.includes('Accès à la position refusé');
  const started = diagText.includes('PAUSE');
  const notStarted = diagText.includes('DÉMARRER');
  const mProgDiag = diagText.match(/(\d+) %/);
  const mDistDiag = diagText.match(/(\d+\.\d+) ?\/ ?(\d+\.\d+) km/);
  const mDistAlt = !mDistDiag ? diagText.match(/(\d+\.\d+) km/) : null;
  console.log('  DIAG → sim(watch/fired/initOk/err):', sim.watch, '/', sim.fired, '/', sim.initOk, '/', JSON.stringify(sim.initErr), '| permModal:', diagText.includes('Géolocalisation requise'), '| denied:', diagText.includes('Accès à la position refusé'), '| DockBar PAUSE(actif):', diagText.includes('PAUSE'), '| DÉMARRER:', diagText.includes('DÉMARRER'));
  console.log('  DIAG → progression:', diagText.match(/(\d+) %/)?.[1] || '?', '| km:', diagText.match(/(\d+\.\d+) ?\/ ?(\d+\.\d+) km/)?.[1] || diagText.match(/(\d+\.\d+) km/)?.[1] || '?');
  console.log('  DIAG → texte (500):', JSON.stringify(diagText.slice(0, 500)));
  console.log('  DIAG → console issues:', JSON.stringify(consoleIssues.slice(0, 6)));
  if (diagText.includes('Géolocalisation requise')) { console.log('  ⚠️ modale permission affichée → clic sur Autoriser'); const allow = page.getByRole('button', { name: /Autoriser/i }); if (await allow.count()) await allow.click(); }

  let lastText = ''; let bestProgress = -1; let bestDistance = -1;
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    const lastText = await page.evaluate(() => document.body.innerText || '');
    const mProg = lastText.match(/(\d+) %/);
    const mDist = lastText.match(/(\d+\.\d+) ?\/ ?(\d+\.\d+) km/);
    if (mProg) bestProgress = Math.max(bestProgress, Number(mProg[1]));
    if (mDist) bestDistance = Math.max(bestDistance, Number(mDist[1].replace(',', '.')));
    if (bestProgress >= 98) break;
  }
  console.log('  UI — progression max:', bestProgress + '%', '· distance max:', bestDistance, 'km');
  if (bestDistance <= 5) throw new Error('distance affichée réelle');
  if (bestProgress < 90) throw new Error('progression projetée réelle');

  const stopBtn = page.getByRole('button', { name: /TERMINER/i });
  if (await stopBtn.count()) { await stopBtn.click(); } else { throw new Error('bouton TERMINER trouvé'); }
  let textAfterStop = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.waitForTimeout(1000);
    textAfterStop = await page.evaluate(() => document.body.innerText || '');
    if (/terminée|c'est fait|parcours complet/i.test(textAfterStop)) break;
  }
  console.log('  DIAG → text after stop:', JSON.stringify(textAfterStop.slice(0, 300)));
  if (!/terminée|c'est fait|parcours complet/i.test(textAfterStop)) {
    throw new Error(`écran de fin de randonnée non affiché (reçu: ${JSON.stringify(textAfterStop.slice(0, 150))})`);
  }

  const leafletNaN = consoleIssues.concat(pageErrors).filter((e) => /Invalid LatLng|NaN|Unhandled|hydrat/i.test(e));
  if (leafletNaN.length > 0) throw new Error('aucune erreur Leaflet/NaN en console');

  await page.screenshot({ path: `${process.env.TEMP || 'C:/Users/Tony/AppData/Local/Temp'}/lkdv_e2e_${routeId || 'free'}.png`, fullPage: false });

  const auth = createClient('https://icxyvwzfjbflcbqukpfz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA', { auth: { persistSession: false } });
  await auth.auth.setSession({ access_token: session1.access_token, refresh_token: session1.refresh_token });
  const { data: rows, error: rowsErr } = await supabase.from('hike_sessions').select('id, route_id, distance_km, duration_seconds, positions_geojson').eq('user_id', session1.user.id).eq('route_id', routeId || null);
  if (rowsErr || !Array.isArray(rows) || rows.length < 1) throw new Error('session sauvegardée en base');
  if (rows?.[0]) console.log(`  → distance=${rows[0].distance_km} · durée=${rows[0].duration_seconds}s · geojson=${rows[0].positions_geojson != null}`);

  console.log('E2E TERMINÉ');
}

async function main() {
  await runTest('3');
  await runTest('1');
  await runTest('');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });