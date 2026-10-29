#!/usr/bin/env node
/**
 * Création d'un départ (P6-07) : écriture réelle dans `trips` par le compte de
 * recette, relecture publique, refus d'usurpation, puis nettoyage.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const raw = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '';
const env = {};
for (const line of raw.split('\n')) {
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

const slug = `recette-explorer-${Date.now().toString(36)}`;
const createRes = await api('trips', tokenA, {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify([
    {
      slug,
      user_id: secrets.a.userId,
      title: 'Recette Explorer v2 — départ test',
      destination_name: 'Chamonix',
      destination_country_code: 'FR',
      start_date: '2027-06-01',
      end_date: '2027-06-04',
      primary_activity: 'hiking',
      party_size: 4,
      status: 'planned',
      visibility: 'public',
    },
  ]),
});
const createBody = await createRes.json().catch(() => null);
const created = createRes.ok ? createBody?.[0] : null;
check(
  'départ créé dans trips',
  !!created?.id,
  created?.id ?? `HTTP ${createRes.status} ${JSON.stringify(createBody).slice(0, 160)}`,
);

const readRes = await fetch(`${url}/rest/v1/trips?select=id,title,status,visibility&slug=eq.${slug}`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
const read = readRes.ok ? (await readRes.json())?.[0] : null;
check('départ relu publiquement', read?.title === 'Recette Explorer v2 — départ test', read?.status ?? 'absent');

const forged = await api('trips', tokenB, {
  method: 'POST',
  body: JSON.stringify([
    {
      slug: `${slug}-forged`,
      title: 'Usurpation',
      user_id: secrets.a.userId,
      start_date: '2027-06-01',
      end_date: '2027-06-02',
      status: 'planned',
      visibility: 'public',
    },
  ]),
});
check(
  'B ne peut pas créer un départ au nom de A',
  forged.status >= 400,
  `HTTP ${forged.status}`,
);

const mgmt = readFileSync(join(process.env.HOME, '.supabase/access-token'), 'utf8').trim();
const delRes = await fetch('https://api.supabase.com/v1/projects/icxyvwzfjbflcbqukpfz/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `delete from public.trips where slug like '${slug}%';` }),
});
check('nettoyage', delRes.ok, `HTTP ${delRes.status}`);

const failed = steps.filter((s) => !s.ok);
mkdirSync(join(ROOT, 'docs/explorer-v2'), { recursive: true });
writeFileSync(
  join(ROOT, 'docs/explorer-v2/TRIP_FLOW.md'),
  [
    '# TRIP_FLOW · Explorer v2',
    '',
    `- Date : ${new Date().toISOString()}`,
    `- Résultat : ${failed.length === 0 ? '✅ départ créé et relu' : `❌ ${failed.length} échec(s)`}`,
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
