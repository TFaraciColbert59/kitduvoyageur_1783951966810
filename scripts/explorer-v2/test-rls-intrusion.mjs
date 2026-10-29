#!/usr/bin/env node
/**
 * Explorer v2 — test d'intrusion RLS (05_DONNEES.md §5).
 *
 * Se connecte réellement à Supabase Auth avec deux comptes de recette
 * (`scripts/explorer-v2/seed-test-accounts.mjs`), puis vérifie que chaque
 * politique fait son travail :
 *   - `anon` ne lit aucune session d'activité ;
 *   - un abonné **mutuel** lit la session en direct partagée ;
 *   - les points GPS restent au propriétaire ;
 *   - un tiers ne peut ni modifier ni créer une session au nom d'un autre ;
 *   - le propriétaire lit ses propres données ;
 *   - `geo_pois` et `country_practical` restent lisibles publiquement.
 *
 * Usage : node scripts/explorer-v2/test-rls-intrusion.mjs
 * Sortie : docs/explorer-v2/RLS_INTRUSION.md, code 1 au premier échec.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function env() {
  const raw = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '';
  const map = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) map[match[1]] = match[2].trim();
  }
  return { url: map.NEXT_PUBLIC_SUPABASE_URL, anon: map.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}

const { url, anon } = env();
if (!url || !anon) throw new Error('.env.local : NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants');

const secretsPath = join(ROOT, '.secrets/explorer-test-accounts.json');
if (!existsSync(secretsPath)) {
  throw new Error('comptes de recette absents : node scripts/explorer-v2/seed-test-accounts.mjs');
}
const accounts = JSON.parse(readFileSync(secretsPath, 'utf8'));

async function signIn(account) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`connexion ${account.email} : ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.access_token;
}

async function rest(path, { token, method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: anon,
    Authorization: `Bearer ${token ?? anon}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const tokenA = await signIn(accounts.a);
const tokenB = await signIn(accounts.b);

const sessionA = await rest(
  `activity_sessions?select=id,user_id,share_level,status&user_id=eq.${accounts.a.userId}&status=eq.live`,
  { token: tokenA },
);
const sessionId = Array.isArray(sessionA.json) ? sessionA.json[0]?.id : null;
check(
  'A lit sa propre session live',
  Array.isArray(sessionA.json) && sessionA.json.length === 1,
  `${sessionA.json?.length ?? 0} ligne(s)`,
);

const anonSessions = await rest('activity_sessions?select=id');
check(
  'anon ne lit aucune session',
  anonSessions.status === 200 ? (anonSessions.json?.length ?? 0) === 0 : anonSessions.status === 401,
  `HTTP ${anonSessions.status}, ${anonSessions.json?.length ?? 0} ligne(s)`,
);

const bSessions = await rest('activity_sessions?select=id,share_level,status', { token: tokenB });
check(
  'B (abonné mutuel) lit la session live partagée de A',
  Array.isArray(bSessions.json) && bSessions.json.some((row) => row.id === sessionId),
  `${bSessions.json?.length ?? 0} ligne(s)`,
);

const bPoints = await rest(`activity_points?select=id&session_id=eq.${sessionId}`, { token: tokenB });
check('B ne lit aucun point GPS de A', (bPoints.json?.length ?? 0) === 0, `${bPoints.json?.length ?? 0} point(s)`);

const aPoints = await rest(`activity_points?select=id&session_id=eq.${sessionId}&limit=100`, { token: tokenA });
check('A lit ses propres points GPS', (aPoints.json?.length ?? 0) > 0, `${aPoints.json?.length ?? 0} point(s)`);

const bUpdate = await rest(`activity_sessions?id=eq.${sessionId}`, {
  token: tokenB,
  method: 'PATCH',
  body: { status: 'abandoned' },
  prefer: 'return=representation',
});
check(
  'B ne peut pas modifier la session de A',
  bUpdate.status >= 400 || (Array.isArray(bUpdate.json) && bUpdate.json.length === 0),
  `HTTP ${bUpdate.status}, ${Array.isArray(bUpdate.json) ? bUpdate.json.length : '—'} ligne(s)`,
);

const bInsert = await rest('activity_sessions', {
  token: tokenB,
  method: 'POST',
  body: [
    {
      user_id: accounts.a.userId,
      sport: 'rando',
      status: 'live',
      started_at: new Date().toISOString(),
    },
  ],
  prefer: 'return=representation',
});
check(
  'B ne peut pas créer une session au nom de A',
  bInsert.status >= 400 || (Array.isArray(bInsert.json) && bInsert.json.length === 0),
  `HTTP ${bInsert.status}`,
);

const bSos = await rest('sos_alerts?select=*', { token: tokenB });
check('B ne lit aucune alerte SOS', (bSos.json?.length ?? 0) === 0, `${bSos.json?.length ?? 0} ligne(s)`);

const anonPois = await rest('geo_pois?select=osm_id&limit=3');
check(
  'geo_pois lisible publiquement (anon)',
  anonPois.status === 200 && (anonPois.json?.length ?? 0) > 0,
  `HTTP ${anonPois.status}`,
);

const anonPractical = await rest('country_practical?select=iso_a2&limit=1');
check('country_practical lisible publiquement', anonPractical.status === 200, `HTTP ${anonPractical.status}`);

const anonCache = await rest('osm_poi_cache?select=cache_key&limit=1');
check(
  'osm_poi_cache fermé au public',
  anonCache.status === 401 || anonCache.status === 403 || (anonCache.json?.length ?? 0) === 0,
  `HTTP ${anonCache.status}`,
);

const failed = results.filter((row) => !row.ok);
const body = [
  '# RLS_INTRUSION · Explorer v2',
  '',
  `- Date : ${new Date().toISOString()}`,
  `- Comptes : ${accounts.a.email} (A) · ${accounts.b.email} (B, abonné mutuel)`,
  `- Résultat : ${failed.length === 0 ? '✅ toutes les politiques tiennent' : `❌ ${failed.length} échec(s)`}`,
  '',
  '| Contrôle | Résultat | Détail |',
  '|---|---|---|',
  ...results.map((row) => `| ${row.name} | ${row.ok ? 'OK' : 'ÉCHEC'} | ${row.detail ?? ''} |`),
  '',
].join('\n');
mkdirSync(join(ROOT, 'docs/explorer-v2'), { recursive: true });
writeFileSync(join(ROOT, 'docs/explorer-v2/RLS_INTRUSION.md'), body, 'utf8');

console.log(`\n${results.length - failed.length}/${results.length} contrôles verts`);
if (failed.length) process.exit(1);
