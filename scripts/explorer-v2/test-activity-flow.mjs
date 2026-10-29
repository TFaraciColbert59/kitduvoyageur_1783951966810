#!/usr/bin/env node
/**
 * Parcours d'activité de bout en bout (P1-07, P7-19).
 *
 * Avec le compte de recette A : crée une session `rando` en direct, pousse des
 * points GPS, clôt la session via la RPC `finish_activity_session`, vérifie que
 * le résumé apparaît dans `hike_sessions`, puis **nettoie** ce qui a été créé.
 *
 * Usage : node scripts/explorer-v2/test-activity-flow.mjs
 * Sortie : docs/explorer-v2/ACTIVITY_FLOW.md, code 1 au premier échec.
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
const secrets = JSON.parse(readFileSync(join(ROOT, '.secrets/explorer-test-accounts.json'), 'utf8'));

async function signIn(account) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`connexion : ${res.status}`);
  return json.access_token;
}

const token = await signIn(secrets.a);
const api = (path, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

const steps = [];
const check = (name, ok, detail) => {
  steps.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// 1. Création de la session
const createRes = await api('activity_sessions', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify([
    {
      user_id: secrets.a.userId,
      sport: 'rando',
      status: 'live',
      share_level: 'followers',
      distance_m: 7300,
      elev_gain_m: 460,
      moving_s: 2400,
    },
  ]),
});
const created = await createRes.json();
const sessionId = created?.[0]?.id;
check('session créée', resOk(createRes) && !!sessionId, sessionId ?? `HTTP ${createRes.status}`);

// 2. Points GPS
const points = Array.from({ length: 12 }, (_, index) => ({
  session_id: sessionId,
  lat: 45.9237 + index * 0.0004,
  lng: 6.8694 + index * 0.0006,
  ele: 1035 + index * 12,
  acc: 6.5,
  speed: 1.1,
}));
const pointsRes = await api('activity_points', { method: 'POST', body: JSON.stringify(points) });
check('12 points GPS écrits', pointsRes.ok, `HTTP ${pointsRes.status}`);

// 3. Clôture par la RPC
const finishRes = await api('rpc/finish_activity_session', {
  method: 'POST',
  body: JSON.stringify({ p_session: sessionId }),
});
const summaryId = finishRes.ok ? await finishRes.json() : null;
check('RPC finish_activity_session', finishRes.ok && !!summaryId, `summary ${summaryId ?? 'aucun'}`);

// 4. Résumé dans hike_sessions
const summaryRes = await api(
  `hike_sessions?select=id,distance_km,duration_seconds,processing_status,visibility&id=eq.${summaryId}`,
);
const summary = (await summaryRes.json())?.[0];
check(
  'résumé écrit dans hike_sessions',
  !!summary,
  summary && Number(summary.distance_km) > 0
    ? `km=${summary.distance_km} s=${summary.duration_seconds} ${summary.processing_status}`
    : 'absent ou vide',
);

// 5. La session est close
const closedRes = await api(`activity_sessions?select=status&id=eq.${sessionId}`);
const closed = (await closedRes.json())?.[0];
check('session passée à finished', closed?.status === 'finished', closed?.status ?? 'inconnu');

// 6. Nettoyage
const delPoints = await api(`activity_points?session_id=eq.${sessionId}`, { method: 'DELETE' });
const delSummary = await api(`hike_sessions?id=eq.${summaryId}`, { method: 'DELETE' });
const delSession = await api(`activity_sessions?id=eq.${sessionId}`, { method: 'DELETE' });
check(
  'nettoyage (points, résumé, session)',
  delPoints.ok && delSummary.ok && delSession.ok,
  `${delPoints.status}/${delSummary.status}/${delSession.status}`,
);

const failed = steps.filter((step) => !step.ok);
const body = [
  '# ACTIVITY_FLOW · Explorer v2',
  '',
  `- Date : ${new Date().toISOString()}`,
  `- Compte : ${secrets.a.email}`,
  `- Résultat : ${failed.length === 0 ? '✅ parcours complet' : `❌ ${failed.length} échec(s)`}`,
  '',
  '| Étape | Résultat | Détail |',
  '|---|---|---|',
  ...steps.map((step) => `| ${step.name} | ${step.ok ? 'OK' : 'ÉCHEC'} | ${step.detail ?? ''} |`),
  '',
].join('\n');
mkdirSync(join(ROOT, 'docs/explorer-v2'), { recursive: true });
writeFileSync(join(ROOT, 'docs/explorer-v2/ACTIVITY_FLOW.md'), body, 'utf8');
console.log(`\n${steps.length - failed.length}/${steps.length} étapes vertes`);
if (failed.length) process.exit(1);

function resOk(response) {
  return response.ok;
}
