// scripts/geo/import_geo_places.ts — Remplit public.geo_places (plan 3.2, réimport mensuel 3.9).
//
// Lieux habités GeoNames (CC BY 4.0, créditée dans les mentions légales) : cities500 pour le monde
// et tous les lieux habités de FR, CH, IT, AT. Règles de tri et de nature : celles du lot E
// (`src/features/compas/engine/geoPlacesImport.ts`, reprises de `prep_geo_places.py`).
//
// Sources, au choix :
//   --cache-dir dossier   télécharge https://download.geonames.org/export/dump/{cities500,FR,CH,IT,AT}.zip
//                         (réutilisés s'ils y sont déjà) et les lit avec `unzip -p` (sans dézipper) ;
//   --file chemin.txt     un dump déjà dézippé (cities500.txt, FR.txt…), répétable, dans cet ordre ;
//   --tsv chemin.tsv      l'ancien TSV préparé par prep_geo_places.py (aussi en argument seul).
//
//   ESSAI, n'écrit RIEN (défaut) :
//     npx tsx scripts/geo/import_geo_places.ts --cache-dir /tmp/geonames
//   ÉCRITURE (SUPABASE_DB_URL dans l'environnement) :
//     npx tsx scripts/geo/import_geo_places.ts --cache-dir /tmp/geonames --apply --max-db-mb 250
//
// Upsert idempotent sur geoname_id, par lots de 1 000 (une transaction par lot). Une ligne
// inchangée n'est pas réécrite (pas de version morte à chaque passage mensuel) ; `updated_at`
// = date du dernier changement. La taille de la base est relue avant d'écrire puis tous les
// 50 lots : au-dessus de --max-db-mb, rien de plus n'est écrit. Rien n'est retiré : un lieu
// disparu de GeoNames reste jusqu'à un nettoyage décidé à part.

import 'dotenv/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { appUserAgent } from '../../src/lib/userAgent';
import {
  createGeoPlaceCollector,
  GEO_PLACES_DUMPS,
  parseGeoPlaceTsvLine,
  type GeoPlaceImportRow,
} from '../../src/features/compas/engine/geoPlacesImport';

const DUMP = 'https://download.geonames.org/export/dump/';
const UA = appUserAgent('import des lieux habités GeoNames');
const BATCH = 1000;
const SIZE_CHECK_EVERY = 50;

interface Options {
  files: string[];
  tsv: string | null;
  cacheDir: string | null;
  apply: boolean;
  maxDbMb: number;
  json: boolean;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    'Usage : npx tsx scripts/geo/import_geo_places.ts (--cache-dir dossier | --file cities500.txt [--file FR.txt…] | --tsv geo_places.tsv) ' +
      '[--dry-run | --apply] [--max-db-mb 250] [--json]\n' +
      '  --dry-run (défaut) lit et compte sans rien écrire ; --apply écrit (SUPABASE_DB_URL requis).'
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const all = (name: string): string[] =>
    argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
  const one = (name: string): string | null => all(name)[0] ?? null;
  const files = all('--file');
  // Ancien usage : le TSV en seul argument.
  const bare = argv.length === 1 && argv[0].endsWith('.tsv') ? argv[0] : null;
  const tsv = one('--tsv') ?? bare;
  const cacheDir = one('--cache-dir');
  const sources = [files.length > 0, tsv !== null, cacheDir !== null].filter(Boolean).length;
  if (sources !== 1) usage('Une seule source : --cache-dir, --file ou --tsv.');
  for (const f of [...files, ...(tsv ? [tsv] : [])])
    if (!fs.existsSync(f)) usage(`Fichier introuvable : ${f}.`);
  if (argv.includes('--apply') && argv.includes('--dry-run')) usage('--apply et --dry-run s’excluent.');
  const max = one('--max-db-mb');
  const maxDbMb = max === null ? 250 : Number(max);
  if (!Number.isFinite(maxDbMb) || maxDbMb <= 0) usage(`--max-db-mb invalide : ${max}.`);
  return { files, tsv, cacheDir, apply: argv.includes('--apply'), maxDbMb, json: argv.includes('--json') };
}

/** XX.zip dans le cache (téléchargé une fois). */
async function ensureZip(code: string, cacheDir: string): Promise<string> {
  const file = path.join(cacheDir, `${code}.zip`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(cacheDir, { recursive: true });
  console.info(`Téléchargement de ${DUMP}${code}.zip…`);
  const res = await fetch(`${DUMP}${code}.zip`, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`${code}.zip : HTTP ${res.status}`);
  const part = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), fs.createWriteStream(part));
  fs.renameSync(part, file);
  return file;
}

async function readLines(input: NodeJS.ReadableStream, add: (l: string) => void): Promise<void> {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) if (line) add(line);
}

async function readZip(zip: string, member: string, add: (l: string) => void): Promise<void> {
  const child = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'inherit'] });
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`unzip ${zip} : code ${code}`))));
  });
  await readLines(child.stdout, add);
  await done;
}

type PgClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
  end: () => Promise<void>;
};

async function dbSizeMb(client: PgClient): Promise<number> {
  const { rows } = await client.query('select pg_database_size(current_database()) / 1048576.0 as mb');
  return Number(rows[0]?.mb);
}

async function connect(maxDbMb: number): Promise<PgClient> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) usage('--apply demande SUPABASE_DB_URL dans l’environnement.');
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } }) as unknown as PgClient & {
    connect: () => Promise<void>;
  };
  await client.connect();
  const { rows } = await client.query("select to_regclass('public.geo_places') as t");
  const mb = await dbSizeMb(client);
  if (!rows[0]?.t || !Number.isFinite(mb) || mb > maxDbMb) {
    await client.end();
    throw new Error(
      !rows[0]?.t
        ? 'public.geo_places n’existe pas : la migration 20261008190319_geo_places.sql n’est pas appliquée.'
        : `base à ${Number.isFinite(mb) ? mb.toFixed(0) : '?'} Mo, au-dessus de la limite de ${maxDbMb} Mo : rien n’est écrit.`
    );
  }
  return client;
}

// Une ligne inchangée n'est pas réécrite (`where … is distinct from`) : le rejeu mensuel ne laisse
// pas 368 000 versions mortes, et `updated_at` reste la date du dernier changement.
const UPSERT = `
  insert into public.geo_places
    (geoname_id, name, kind, country_code, admin1, lat, lon, ele_m, population, timezone, updated_at)
  select r.geoname_id, r.name, r.kind, r.country_code, r.admin1, r.lat, r.lon, r.ele_m,
         r.population, r.timezone, $2::date
  from jsonb_to_recordset($1::jsonb)
    as r(geoname_id integer, name text, kind text, country_code text, admin1 text, lat real,
         lon real, ele_m smallint, population integer, timezone text)
  on conflict (geoname_id) do update set
    name = excluded.name, kind = excluded.kind, country_code = excluded.country_code,
    admin1 = excluded.admin1, lat = excluded.lat, lon = excluded.lon, ele_m = excluded.ele_m,
    population = excluded.population, timezone = excluded.timezone, updated_at = excluded.updated_at
  where (geo_places.name, geo_places.kind, geo_places.country_code, geo_places.admin1, geo_places.lat,
         geo_places.lon, geo_places.ele_m, geo_places.population, geo_places.timezone)
    is distinct from
        (excluded.name, excluded.kind, excluded.country_code, excluded.admin1, excluded.lat,
         excluded.lon, excluded.ele_m, excluded.population, excluded.timezone)`;

async function write(
  client: PgClient,
  rows: GeoPlaceImportRow[],
  run: string,
  maxDbMb: number
): Promise<{ sent: number; changed: number }> {
  let sent = 0;
  let changed = 0;
  for (let i = 0, n = 0; i < rows.length; i += BATCH, n += 1) {
    if (n > 0 && n % SIZE_CHECK_EVERY === 0) {
      const mb = await dbSizeMb(client);
      if (!Number.isFinite(mb) || mb > maxDbMb)
        throw new Error(`base à ${Number.isFinite(mb) ? mb.toFixed(0) : '?'} Mo après ${sent} lignes, au-dessus de ${maxDbMb} Mo : arrêt.`);
    }
    const batch = rows.slice(i, i + BATCH);
    await client.query('begin');
    try {
      const res = await client.query(UPSERT, [JSON.stringify(batch), run]);
      await client.query('commit');
      changed += res.rowCount ?? 0;
    } catch (err) {
      await client.query('rollback');
      throw new Error(`lot refusé après ${sent} lignes : ${err instanceof Error ? err.message : err}`);
    }
    sent += batch.length;
    if (sent % 50_000 < BATCH) console.info(`${sent} lieux envoyés`);
  }
  return { sent, changed };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const run = new Date().toISOString().slice(0, 10);
  const label = opts.cacheDir ? `GeoNames ${GEO_PLACES_DUMPS.join(', ')}` : [...opts.files, opts.tsv].filter(Boolean).join(', ');
  console.info(`${opts.apply ? 'ÉCRITURE' : 'ESSAI (rien n’est écrit)'} — ${label}`);
  // Connexion et taille vérifiées AVANT de lire les dumps.
  const client = opts.apply ? await connect(opts.maxDbMb) : null;
  try {
    const collector = createGeoPlaceCollector(opts.tsv ? parseGeoPlaceTsvLine : undefined);
    const add = (l: string) => collector.add(l);
    if (opts.tsv) await readLines(fs.createReadStream(opts.tsv, 'utf8'), add);
    for (const f of opts.files) {
      console.info(`Lecture de ${f}`);
      await readLines(fs.createReadStream(f, 'utf8'), add);
    }
    if (opts.cacheDir)
      for (const code of GEO_PLACES_DUMPS) {
        const zip = await ensureZip(code, opts.cacheDir);
        console.info(`Lecture de ${zip}`);
        await readZip(zip, `${code}.txt`, add);
      }
    const { rows, dropped, lines, replaced } = collector.result();
    const byKind: Record<string, number> = {};
    for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    const { sent, changed } = client ? await write(client, rows, run, opts.maxDbMb) : { sent: 0, changed: 0 };
    console.info('\n=== Résumé ===');
    console.info(`Lignes lues : ${lines} · lieux gardés : ${rows.length} · relus deux fois : ${replaced} · écartées : ${JSON.stringify(dropped)}`);
    console.info(`Par nature : ${JSON.stringify(byKind)}`);
    if (client) console.info(`Envoyés : ${sent} · écrits ou changés (upsert sur geoname_id) : ${changed}`);
    if (client) console.info(`Base après l’import : ${(await dbSizeMb(client)).toFixed(0)} Mo`);
    if (opts.json)
      console.info(JSON.stringify({ mode: opts.apply ? 'apply' : 'dry-run', lines, kept: rows.length, replaced, sent, changed, dropped, byKind }));
  } finally {
    await client?.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
