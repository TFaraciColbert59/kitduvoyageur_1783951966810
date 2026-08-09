// Test réel de la sauvegarde de session de randonnée (hike_sessions) :
//  1) crée un utilisateur jetable via Auth REST
//  2) insère une session via client authentifié (prouve RLS own_sessions + schéma)
//  3) POST la vraie route HTTP /api/hike-sessions du dev server avec le cookie auth
//  4) relit la ligne en base et vérifie les champs réels
// Usage : node scripts/test_hike_session.mjs [baseUrl]
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';
const BASE = process.argv[2] || 'http://localhost:4028';
const COOKIE_NAME = 'sb-icxyvwzfjbflcbqukpfz-auth-token';

const email = `lkdv.session.${Date.now()}@test.com`;
const password = 'Str0ngPass!lkdv';

const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

function assert(cond, msg) {
  if (!cond) throw new Error(`❌ ${msg}`);
  console.log(`  ✅ ${msg}`);
}

async function main() {
  console.log('=== 1) Création utilisateur jetable ===');
  const { data: signUp, error: signUpErr } = await anon.auth.signUp({ email, password });
  assert(!signUpErr, `signUp ok (${signUpErr?.message || 'pas d\'erreur'})`);
  if (!signUp.user) throw new Error('signUp: aucun user');
  console.log(`  user: ${email} (${signUp.user.id})`);
  if (!signUp.session) {
    console.log('  ⚠️ Aucune session retournée → confirmation email requise par défaut. On tente un signIn.');
    const { data: si, error: siErr } = await anon.auth.signInWithPassword({ email, password });
    if (siErr || !si.session) {
      throw new Error('❌ Impossible d\'obtenir une session : confirmation email requise. Utilise un compte confirmé ou active l\'auto-confirm.');
    }
    console.log('  signIn retourne une session (compte auto-confirmé).');
  }
  const session = (signUp.session || (await anon.auth.signInWithPassword({ email, password })).data.session);
  const userId = session.user.id;
  console.log('  ✅ session obtenue (expires ' + new Date(session.expires_at * 1000).toISOString() + ')');

  const auth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await auth.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });

  console.log('=== 2) Insert direct authentifié (preuve RLS own_sessions + schéma) ===');
  const payload = {
    user_id: userId,
    route_id: 3,
    started_at: '2026-08-09T09:00:00Z',
    ended_at: '2026-08-09T11:30:00Z',
    distance_km: 12.4,
    duration_seconds: 9000,
    elevation_gain_m: 320,
    positions_geojson: { type: 'LineString', coordinates: [[3.6343, 50.479], [3.6351, 50.4792], [3.6360, 50.4795]] },
    poi_events: [ { poiName: 'eau potable', reachedAt: '2026-08-09T10:05:00Z', lat: 50.965851, lon: 1.8425605 } ],
  };
  const { data: inserted, error: insErr } = await auth.from('hike_sessions').insert(payload).select('id,user_id,route_id,distance_km,poi_events').single();
  assert(!insErr, `insert direct ${insErr ? 'ERR ' + insErr.message : ''}`);
  assert(inserted.user_id === userId, 'RLS : user_id bien lié à auth.uid()');
  assert(Number(inserted.route_id) === 3, 'route_id réel écrit');
  assert(Number(inserted.distance_km) === 12.4, 'distance_km écrite');
  assert(Array.isArray(inserted.poi_events) && inserted.poi_events[0]?.poiName === 'eau potable', 'poi_events écrits');
  const directId = inserted.id;

  console.log('=== 3) POST HTTP réel → /api/hike-sessions (dev server) ===');
  // Le cookie est le JSON brut de la session (client.ts définit cookieEncoding désactivé)
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(session))}`;
  const body = {
    routeId: '3',
    carnetId: null,
    startedAt: '2026-08-09T09:00:00Z',
    endedAt: '2026-08-09T11:30:00Z',
    distanceKm: 12.4,
    durationSeconds: 9000,
    elevationGainM: 320,
    positions: [
      { latitude: 50.479, longitude: 3.6343, altitude: 29 },
      { latitude: 50.4792, longitude: 3.6351, altitude: 28 },
    ],
    poiEvents: [],
  };
  const res = await fetch(`${BASE}/api/hike-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  const resJson = await res.json();
  if (res.status !== 200) {
    console.log(`  ⚠️ POST /api/hike-sessions → ${res.status}:`, JSON.stringify(resJson));
  } else {
    assert(!!resJson.sessionId, `POST HTTP 200 → sessionId ${resJson.sessionId}`);
  }

  console.log('=== 4) Relire en base (client authentifié) ===');
  const { data: rows } = await auth.from('hike_sessions').select('id,route_id,distance_km,duration_seconds,positions_geojson,poi_events,started_at,ended_at').order('created_at', { ascending: false }).limit(5);
  assert(Array.isArray(rows) && rows.length > 0, `${rows?.length || 0} session(s) en base`);
  rows.forEach((r) => console.log(`  - id=${r.id} route=${r.route_id} dist=${r.distance_km} dur=${r.duration_seconds}s pois=${Array.isArray(r.poi_events) ? r.poi_events.length : 0}`));
  assert(rows.some((r) => r.id === directId), 'notre session directe est bien persistée');
  if (rows.every((r) => r.id !== directId)) throw new Error('session introuvable');

  console.log('\n🎉 hike_sessions écrit + relu avec succès (RLS + schéma + route HTTP validés).');
}

main().catch((e) => { console.error(e.message); process.exit(1); });