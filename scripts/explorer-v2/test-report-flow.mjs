#!/usr/bin/env node
/**
 * Signalement terrain (P5-09 / P5-10) : création réelle par le compte de
 * recette, lecture par un autre utilisateur, puis suppression. Prouve que la
 * mécanique présent/disparu s'appuie sur des lignes réelles.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const envRaw = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '';
const env = {};
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon } = env;
const secrets = JSON.parse(readFileSync(join(ROOT, '.secrets/explorer-test-accounts.json'), 'utf8'));

async function signIn(account) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`connexion ${account.email} : ${res.status}`);
  return json.access_token;
}

const tokenA = await signIn(secrets.a);
const tokenB = await signIn(secrets.b);
const api = (path, token, init = {}) =>
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

// Création
const createRes = await api('terrain_reports', tokenA, {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify([
    {
      reporter_id: secrets.a.userId,
      category: 'water',
      severity: 'info',
      passability: 'passable',
      description: 'Recette Explorer v2 — eau claire',
      lat: 45.925,
      lng: 6.883,
      source_type: 'user',
      status: 'pending',
      present_count: 0,
      gone_count: 0,
      unknown_count: 0,
      report_count: 1,
    },
  ]),
});
const created = createRes.ok ? (await createRes.json())?.[0] : null;
check('signalement créé par A', !!created?.id, created?.id ?? `HTTP ${createRes.status}`);

// Confirmation « toujours là » par B (fonction Explorer)
const mergeRes = await api('rpc/explorer_confirm_report', tokenB, {
  method: 'POST',
  body: JSON.stringify({ p_report_id: created?.id }),
});
const merged = mergeRes.ok ? await mergeRes.json() : null;
check('B confirme « toujours là »', merged?.status === 'confirmed', JSON.stringify(merged)?.slice(0, 90));

// Refus de confirmer son propre signalement
const selfRes = await api('rpc/explorer_confirm_report', tokenA, {
  method: 'POST',
  body: JSON.stringify({ p_report_id: created?.id }),
});
const self = selfRes.ok ? await selfRes.json() : null;
check('A ne peut pas confirmer son propre signalement', self?.status === 'own_report', JSON.stringify(self));

// Lecture publique agrégée (RPC SECURITY DEFINER a5) par B — après confirmation
const nearRes = await api('rpc/a5_terrain_reports_near', tokenB, {
  method: 'POST',
  body: JSON.stringify({ p_lat: 45.925, p_lng: 6.883, p_radius_m: 2000 }),
});
const near = nearRes.ok ? await nearRes.json() : [];
check(
  'B voit le signalement via la RPC publique a5',
  Array.isArray(near) && near.some((row) => row.id === created?.id),
  `${Array.isArray(near) ? near.length : 0} signalement(s) à 2 km`,
);


// Nettoyage : aucune politique DELETE n'est ouverte aux clients (les
// signalements expirent par cron), on passe donc par l'API Management.
const mgmt = readFileSync(join(process.env.HOME, '.supabase/access-token'), 'utf8').trim();
const delRes = await fetch(
  'https://api.supabase.com/v1/projects/icxyvwzfjbflcbqukpfz/database/query',
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `delete from public.terrain_reports where id = '${created?.id}';` }),
  },
);
check('nettoyage du signalement', delRes.ok, `HTTP ${delRes.status}`);

const failed = steps.filter((s) => !s.ok);
mkdirSync(join(ROOT, 'docs/explorer-v2'), { recursive: true });
writeFileSync(
  join(ROOT, 'docs/explorer-v2/REPORT_FLOW.md'),
  [
    '# REPORT_FLOW · Explorer v2',
    '',
    `- Date : ${new Date().toISOString()}`,
    `- Résultat : ${failed.length === 0 ? '✅ mécanique complète' : `❌ ${failed.length} échec(s)`}`,
    '',
    '| Étape | Résultat | Détail |',
    '|---|---|---|',
    ...steps.map((s) => `| ${s.name} | ${s.ok ? 'OK' : 'ÉCHEC'} | ${s.detail ?? ''} |`),
    '',
  ].join('\n'),
  'utf8',
);
console.log(`\n${steps.length - failed.length}/${steps.length} étapes vertes`);
if (failed.length) process.exit(1);
