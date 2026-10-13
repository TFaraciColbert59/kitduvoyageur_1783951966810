import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/**
 * T43/locale — synchronise les DONNÉES pays (countries_geo, countries_content)
 * de la prod vers le stack Supabase LOCAL, en lecture seule côté prod.
 * Usage : node scripts/ops/local_seed_countries.mjs [--check]
 * Clés locales : stack Supabase standard (demo) — aucune clé prod écrite ici.
 */

const LOCAL_URL = 'http://127.0.0.1:54321';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
// Clé du stack LOCAL (`npx supabase status -o env`, variable SERVICE_ROLE_KEY) : jamais écrite dans le dépôt,
// le contrôle `tests/audit` refuse tout jeton dans le code suivi, même la clé de démonstration publique.
const LOCAL_SERVICE_KEY = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!LOCAL_SERVICE_KEY) {
  console.error(
    'SUPABASE_LOCAL_SERVICE_ROLE_KEY manquante : copie SERVICE_ROLE_KEY de `npx supabase status -o env` dans .env.local ou l’environnement.'
  );
  process.exit(1);
}

const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const local = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHECK_ONLY = process.argv.includes('--check');
const TABLES = ['countries_geo', 'countries_content'];

for (const table of TABLES) {
  const { data: prodRows, error: prodError } = await prod.from(table).select('*');
  if (prodError) {
    console.log(`${table}: prod → erreur ${prodError.message}`);
    continue;
  }
  const { data: localSample, error: localError } = await local.from(table).select('*').limit(1);
  if (localError) {
    console.log(`${table}: local → erreur ${localError.message}`);
    continue;
  }
  const prodColumns = prodRows.length ? Object.keys(prodRows[0]).sort() : [];
  const localColumns = localSample?.length ? Object.keys(localSample[0]).sort() : [];
  const missing = prodColumns.filter((column) => !localColumns.includes(column));
  console.log(
    `${table}: prod=${prodRows.length} lignes | local échantillon=${localSample?.length ?? 0} | colonnes manquantes en local: ${
      missing.length ? missing.join(',') : 'aucune'
    }`
  );
  if (CHECK_ONLY || prodRows.length === 0) continue;

  // Colonnes locales inconnues tant que la table est vide : on insère la
  // ligne prod complète (Postgres rejettera toute colonne réellement absente).
  const usable =
    localColumns.length === 0
      ? prodRows
      : prodRows.map((row) =>
          Object.fromEntries(Object.entries(row).filter(([key]) => localColumns.includes(key)))
        );
  const { error: deleteError } = await local.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) console.log(`${table}: purge locale refusée (${deleteError.message}) — insertion seule`);
  const { error: insertError } = await local.from(table).insert(usable);
  if (insertError) {
    console.log(`${table}: insertion → erreur ${insertError.message}`);
    continue;
  }
  const { data: after } = await local.from(table).select('id').limit(100000);
  console.log(`${table}: synchronisé → ${after?.length ?? 0} lignes locales`);
}
