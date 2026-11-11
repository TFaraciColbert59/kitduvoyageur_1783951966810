// Compas v6 — instantanés des voyages d'un passage du banc (SPEC-V6-MOTEUR §5, T0.5).
//
// Relit en base les voyages qu'un passage de `validate-online.mjs` a produits, par la
// session du compte de démonstration elle-même (RLS : elle ne lit que ses voyages), et
// écrit un fichier `<id de demande>.json` par voyage, à la forme `TripSnapshot` que
// `score-trip.mjs --lot` note.
//
// Usage :
//   node scripts/compas/snapshot-reference.mjs <baseUrl> <dossier de sortie> <results.jsonl> [autres.jsonl …]
// Environnement (jamais écrit dans un fichier) :
//   VERCEL_SHARE                    jeton d'accès de l'aperçu
//   NEXT_PUBLIC_SUPABASE_URL        adresse du projet
//   NEXT_PUBLIC_SUPABASE_ANON_KEY   clé publique (celle que la page envoie déjà)
//
// Appariement demande → voyage : le voyage créé entre le début de la demande et sa fin
// (le journal du banc porte `at` et `seconds`). Une demande sans voyage est listée, pas inventée.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [base, outDir, ...files] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !outDir || files.length === 0 || !url || !key) {
  console.error(
    'Usage : NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… node scripts/compas/snapshot-reference.mjs <baseUrl> <sortie> <results.jsonl> […]'
  );
  process.exit(2);
}

const entries = files
  .flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((e) => e.id && e.at);
if (entries.length === 0) {
  console.error('Aucune entrée datée dans les journaux donnés.');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
const context = await browser.newContext({ locale: 'fr-FR' });
const page = await context.newPage();
if (process.env.VERCEL_SHARE)
  await page.goto(`${base}/?_vercel_share=${process.env.VERCEL_SHARE}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
const tab = await context.newPage();
await tab.goto(`${base}/api/demo-login`, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => undefined);
await tab.waitForURL((u) => !u.pathname.startsWith('/api/'), { timeout: 90_000 }).catch(() => undefined);
await tab.close();
await page.goto(`${base}/compte`, { waitUntil: 'domcontentloaded', timeout: 90_000 });

// Jeton de la session : cookie `sb-<ref>-auth-token`, parfois découpé (.0, .1…), encodé en base64.
const cookies = (await context.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
cookies.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
let raw = cookies.map((c) => decodeURIComponent(c.value)).join('');
if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice(7), 'base64').toString('utf8');
let session;
try {
  session = JSON.parse(raw);
} catch {
  session = null;
}
const token = session?.access_token;
const userId = session?.user?.id;
if (!token || !userId) {
  console.error('Session de démonstration introuvable (connexion démo éteinte sur cet aperçu ?).');
  await browser.close();
  process.exit(1);
}

/**
 * Lecture REST faite DANS le navigateur (il passe par le mandataire de sortie, pas Node), depuis un
 * onglet vide : une page de l'application navigue d'elle-même et casserait l'appel en cours.
 */
const blank = await context.newPage();
await blank.goto('about:blank');
async function rest(query) {
  const out = await blank.evaluate(
    async ({ u, k, t }) => {
      const r = await fetch(u, { headers: { apikey: k, Authorization: `Bearer ${t}` } });
      return { status: r.status, body: await r.text() };
    },
    { u: `${url}/rest/v1/${query}`, k: key, t: token }
  );
  if (out.status !== 200) throw new Error(`lecture ${query.split('?')[0]} : HTTP ${out.status} ${out.body.slice(0, 160)}`);
  return JSON.parse(out.body);
}

const times = entries.map((e) => Date.parse(e.at));
const min = new Date(Math.min(...times) - 60_000).toISOString();
const max = new Date(Math.max(...times.map((t, i) => t + (entries[i].seconds ?? 0) * 1000)) + 60_000).toISOString();
const trips = await rest(
  `trips?select=id,title,destination_name,destination_country_code,start_date,end_date,party_size,primary_activity,estimated_budget,budget_currency,metadata,created_at&user_id=eq.${userId}&created_at=gte.${min}&created_at=lte.${max}&order=created_at.asc&limit=1000`
);

const byTrip = async (table, select) => {
  const rows = [];
  for (let i = 0; i < trips.length; i += 20) {
    const ids = trips.slice(i, i + 20).map((t) => t.id).join(',');
    if (ids) rows.push(...(await rest(`${table}?select=trip_id,${select}&trip_id=in.(${ids})&limit=5000`)));
  }
  const map = new Map();
  for (const r of rows) {
    const { trip_id, ...rest_ } = r;
    map.set(trip_id, [...(map.get(trip_id) ?? []), rest_]);
  }
  return map;
};
const steps = await byTrip(
  'trip_steps',
  'day_number,title,description,latitude,longitude,distance_km,elevation_gain_m,start_time,accommodation_name,transport_mode,metadata'
);
const items = await byTrip('trip_items', 'item_name,category,is_vital,source,inventory_item_id,shop_product_id');
const expenses = await byTrip('trip_expenses', 'title,amount,currency,category,is_planned,metadata');
await browser.close();

/** Ce qui sert à la note, rien d'autre : ni tracé, ni identifiant de personne, ni état de file. */
function cleanMetadata(metadata) {
  const c = metadata && typeof metadata === 'object' ? metadata.compas : null;
  if (!c || typeof c !== 'object') return { compas: {} };
  const a = c.autofill && typeof c.autofill === 'object' ? c.autofill : null;
  const papers = a?.papers && typeof a.papers === 'object' ? { ...a.papers } : null;
  if (papers) delete papers.launchedBy;
  return {
    compas: {
      anchor: c.anchor ?? null,
      planned_days: c.planned_days ?? null,
      duration_h: c.duration_h ?? null,
      prefs: c.prefs ?? null,
      origin: c.origin ?? null,
      autofill: a
        ? { runId: a.runId ? 'r' : null, undone: a.undone === true, at: a.at ?? null, notes: a.notes ?? [], papers, basis: a.basis ?? null, engine: a.engine ?? [] }
        : null,
    },
  };
}
const num = (v) => (v == null ? null : Number(v));

const used = new Set();
const missing = [];
for (const e of entries) {
  const t0 = Date.parse(e.at) - 5_000;
  const t1 = Date.parse(e.at) + (e.seconds ?? 0) * 1000 + 5_000;
  const trip = trips.find((t) => !used.has(t.id) && Date.parse(t.created_at) >= t0 && Date.parse(t.created_at) <= t1);
  if (!trip) {
    missing.push(e.id);
    continue;
  }
  used.add(trip.id);
  const snapshot = {
    demande: e.id,
    banc: { at: e.at, seconds: e.seconds ?? null, prepSeconds: e.prepSeconds ?? null, outcome: e.outcome ?? null, error: e.error ?? null },
    trip: {
      id: trip.id,
      title: trip.title,
      destination_name: trip.destination_name,
      destination_country_code: trip.destination_country_code,
      start_date: trip.start_date,
      end_date: trip.end_date,
      party_size: trip.party_size,
      primary_activity: trip.primary_activity,
      estimated_budget: num(trip.estimated_budget),
      budget_currency: trip.budget_currency,
      metadata: cleanMetadata(trip.metadata),
    },
    steps: (steps.get(trip.id) ?? [])
      .map((s) => ({ ...s, distance_km: num(s.distance_km), elevation_gain_m: num(s.elevation_gain_m) }))
      .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0)),
    items: items.get(trip.id) ?? [],
    expenses: (expenses.get(trip.id) ?? []).map((x) => ({ ...x, amount: num(x.amount) })),
  };
  fs.writeFileSync(path.join(outDir, `${e.id}.json`), JSON.stringify(snapshot, null, 1) + '\n');
}
console.info(`${entries.length} demandes, ${trips.length} voyages lus, ${used.size} instantanés écrits dans ${outDir}`);
if (missing.length) console.warn(`sans voyage (${missing.length}) : ${missing.join(', ')}`);
