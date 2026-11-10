/* eslint-disable no-console -- script en ligne de commande : la sortie standard est son résultat */
// Compas v6 — note un voyage sur quatre axes (ADR-V6-001 §6, tâche T0.2).
// Le script ne contient aucune règle : il charge `src/features/compas/engine/score` par tsx.
//
// Usage :
//   node scripts/compas/score-trip.mjs --snapshot <fichier.json> [--demande <id> --jeu <jeu.json>]
//   node scripts/compas/score-trip.mjs --lot <dossier> --jeu <jeu.json> [--sortie <fichier.json>] --date <ISO>
//   node scripts/compas/score-trip.mjs --trip <uuid> [--demande <id> --jeu <jeu.json>]
//        (SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL, et SUPABASE_SERVICE_ROLE_KEY, dans l'environnement)
// Codes : 0 ok, 1 erreur de données, 2 usage ou configuration manquante.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const here = path.dirname(fileURLToPath(import.meta.url));
const { scoreTrip, aggregate, GRILLE } = await tsImport(path.join(here, '../../src/features/compas/engine/score/index.ts'), import.meta.url);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return fail(`Lecture impossible : ${f} (${e.message})`);
  }
};
const loadJeu = (f) => {
  if (!f) return new Map();
  const j = readJson(f);
  if (!Array.isArray(j?.demandes)) fail(`Jeu illisible : ${f} (pas de « demandes »)`);
  return new Map(j.demandes.map((d) => [d.id, d]));
};
const fmt = (x) => (x == null ? '—' : String(x));
const pad = (s, n) => String(s).padEnd(n);

async function readTrip(id) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('Lecture en base impossible : définir SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.', 2);
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const one = async (q) => {
    const { data, error } = await q;
    if (error) fail(`Lecture en base : ${error.message}`);
    return data;
  };
  const trip = await one(
    db
      .from('trips')
      .select('id,title,destination_name,destination_country_code,start_date,end_date,party_size,primary_activity,estimated_budget,budget_currency,metadata')
      .eq('id', id)
      .maybeSingle()
  );
  if (!trip) fail(`Voyage introuvable : ${id}`);
  const steps = await one(
    db
      .from('trip_steps')
      .select('day_number,title,description,latitude,longitude,distance_km,elevation_gain_m,start_time,accommodation_name,transport_mode,metadata')
      .eq('trip_id', id)
      .order('day_number')
  );
  const items = await one(db.from('trip_items').select('item_name,category,is_vital,source,inventory_item_id,shop_product_id').eq('trip_id', id));
  const expenses = await one(db.from('trip_expenses').select('title,amount,currency,category,is_planned,metadata').eq('trip_id', id));
  return { trip, steps: steps ?? [], items: items ?? [], expenses: expenses ?? [] };
}

function moyenne(score) {
  const n = ['justesse', 'completude', 'faisabilite', 'precision'].map((a) => score[a].note).filter((x) => x != null);
  return n.length ? n.reduce((t, x) => t + x, 0) / n.length : null;
}

function one(snapshot, demandeId, jeuFile) {
  const jeu = loadJeu(jeuFile);
  if (demandeId && !jeu.has(demandeId)) fail(`Demande ${demandeId} absente du jeu.`);
  const expected = demandeId ? jeu.get(demandeId).attendu : null;
  console.log(JSON.stringify(scoreTrip(snapshot, expected), null, 2));
}

async function main() {
  const snap = arg('snapshot');
  const lot = arg('lot');
  const tripId = arg('trip');
  if (snap) return one(readJson(snap), arg('demande'), arg('jeu'));
  if (tripId) return one(await readTrip(tripId), arg('demande'), arg('jeu'));
  if (!lot) fail('Usage : --snapshot <fichier> | --lot <dossier> --jeu <jeu.json> | --trip <uuid>', 2);
  if (!arg('jeu')) fail('--lot demande --jeu <jeu.json>.', 2);
  const date = arg('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(date)) fail('--lot demande --date <ISO> (ex. 2026-11-10 ou 2026-11-10T09:00:00Z) : aucune horloge implicite.', 2);
  const jeu = loadJeu(arg('jeu'));
  const files = fs.readdirSync(lot).filter((f) => /\.json$/.test(f)).sort();
  const rows = [];
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    const d = jeu.get(id);
    if (!d) {
      console.error(`Ignoré : ${f} (demande absente du jeu)`);
      continue;
    }
    rows.push({ id, famille: d.famille, score: scoreTrip(readJson(path.join(lot, f)), d.attendu ?? null) });
  }
  if (!rows.length) fail('Aucun instantané noté.');
  const agg = aggregate(rows.map((r) => ({ famille: r.famille, score: r.score })));
  console.log(`${pad('famille', 16)}${pad('n', 5)}${pad('justesse', 10)}${pad('complétude', 12)}${pad('faisabilité', 13)}précision`);
  const keys = Object.keys(agg).filter((k) => k !== 'tous').sort();
  for (const k of [...keys, 'tous']) {
    const a = agg[k];
    console.log(`${pad(k, 16)}${pad(a.n, 5)}${pad(fmt(a.justesse), 10)}${pad(fmt(a.completude), 12)}${pad(fmt(a.faisabilite), 13)}${fmt(a.precision)}`);
  }
  const worst = rows
    .map((r) => ({ id: r.id, famille: r.famille, moy: moyenne(r.score) }))
    .filter((r) => r.moy != null)
    .sort((a, b) => a.moy - b.moy || a.id.localeCompare(b.id))
    .slice(0, 10);
  console.log('\n10 voyages les plus mal notés (moyenne des notes non nulles) :');
  for (const w of worst) console.log(`  ${w.id}  ${pad(w.famille, 14)} ${w.moy.toFixed(1)}`);
  const out = arg('sortie');
  if (out) {
    fs.writeFileSync(out, JSON.stringify({ grille: GRILLE, date, n: rows.length, parFamille: agg, voyages: rows.map((r) => ({ id: r.id, famille: r.famille, ...r.score })) }, null, 1));
    console.log(`\nDétail écrit dans ${out}`);
  }
}

await main();
