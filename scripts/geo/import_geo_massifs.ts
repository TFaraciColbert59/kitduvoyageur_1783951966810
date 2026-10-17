// scripts/geo/import_geo_massifs.ts — Remplit public.geo_massifs (plan 3.3, GeoNames T et L).
//
// Massifs, chaînes, plateaux, presqu'îles et régions naturelles de GeoNames (CC BY 4.0, créditée
// dans les mentions légales, comme geo_places) : codes MTS, HLLS, PLAT, UPLD, PEN, RGN, et MT
// seulement si son nom dit « massif » (choix et justification : src/features/compas/engine/geoMassifs.ts).
// Un point par objet, jamais d'emprise (GeoNames n'en donne pas).
//
// Sources, au choix :
//   --file chemin.txt       un fichier du dump déjà dézippé (allCountries.txt, FR.txt…), répétable ;
//   --country FR,CH,IT      télécharge https://download.geonames.org/export/dump/XX.zip dans
//                           --cache-dir (réutilisé s'il y est déjà) et le lit avec `unzip -p` ;
//                           « all » = allCountries.zip (≈ 400 Mo, à réserver à une machine d'import).
//
//   ESSAI, n'écrit RIEN (défaut) :
//     npx tsx scripts/geo/import_geo_massifs.ts --country FR --cache-dir /tmp/geonames
//   ÉCRITURE (SUPABASE_DB_URL dans l'environnement, migration 20261017133000_geo_massifs appliquée) :
//     npx tsx scripts/geo/import_geo_massifs.ts --country all --cache-dir /tmp/geonames --apply
//
// Upsert idempotent sur geoname_id, par lots de 1 000 (une transaction par lot). Rien n'est retiré :
// un objet disparu de GeoNames reste jusqu'à un nettoyage décidé à part.

import 'dotenv/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { appUserAgent } from '../../src/lib/userAgent';
import {
  createGeoMassifCollector,
  type GeoMassifRow,
} from '../../src/features/compas/engine/geoMassifs';

const DUMP = 'https://download.geonames.org/export/dump/';
const UA = appUserAgent('import des massifs GeoNames');
const BATCH = 1000;

interface Options {
  files: string[];
  countries: string[];
  cacheDir: string;
  apply: boolean;
  maxDbMb: number;
  json: boolean;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    'Usage : npx tsx scripts/geo/import_geo_massifs.ts (--file allCountries.txt [--file FR.txt] | --country FR,CH|all) ' +
      '[--cache-dir dossier] [--dry-run | --apply] [--max-db-mb 250] [--json]\n' +
      '  --dry-run (défaut) lit et compte sans rien écrire ; --apply écrit (SUPABASE_DB_URL requis).'
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const all = (name: string): string[] =>
    argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
  const files = all('--file');
  const countries = all('--country')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (v.toLowerCase() === 'all' ? 'allCountries' : v.toUpperCase()));
  if (!files.length && !countries.length) usage();
  for (const c of countries)
    if (c !== 'allCountries' && !/^[A-Z]{2}$/.test(c)) usage(`Code pays invalide : ${c}.`);
  for (const f of files) if (!fs.existsSync(f)) usage(`Fichier introuvable : ${f}.`);
  if (argv.includes('--apply') && argv.includes('--dry-run'))
    usage('--apply et --dry-run s’excluent.');
  const cacheIdx = argv.indexOf('--cache-dir');
  const maxIdx = argv.indexOf('--max-db-mb');
  return {
    files,
    countries,
    cacheDir: cacheIdx >= 0 && argv[cacheIdx + 1] ? argv[cacheIdx + 1] : 'geonames-cache',
    apply: argv.includes('--apply'),
    maxDbMb: maxIdx >= 0 ? Number(argv[maxIdx + 1]) : 250,
    json: argv.includes('--json'),
  };
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
  await pipeline(
    Readable.fromWeb(res.body as import('stream/web').ReadableStream),
    fs.createWriteStream(part)
  );
  fs.renameSync(part, file);
  return file;
}

/** Lit un flux ligne à ligne dans le collecteur. */
async function readLines(input: NodeJS.ReadableStream, add: (l: string) => void): Promise<void> {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) if (line) add(line);
}

/** Le .txt du zip, sans le dézipper sur disque (`unzip -p`). */
async function readZip(zip: string, member: string, add: (l: string) => void): Promise<void> {
  const child = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'inherit'] });
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`unzip ${zip} : code ${code}`))
    );
  });
  await readLines(child.stdout, add);
  await done;
}

type PgClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

async function connect(maxDbMb: number): Promise<PgClient> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) usage('--apply demande SUPABASE_DB_URL dans l’environnement.');
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    "select to_regclass('public.geo_massifs') as t, pg_database_size(current_database()) / 1048576.0 as mb"
  );
  const mb = Number(rows[0]?.mb);
  if (!rows[0]?.t || !Number.isFinite(mb) || mb > maxDbMb) {
    await client.end();
    throw new Error(
      !rows[0]?.t
        ? 'public.geo_massifs n’existe pas : la migration 20261017133000_geo_massifs.sql n’est pas appliquée.'
        : `base à ${Number.isFinite(mb) ? mb.toFixed(0) : '?'} Mo, au-dessus de la limite de ${maxDbMb} Mo : rien n’est écrit.`
    );
  }
  return client as unknown as PgClient;
}

const UPSERT = `
  insert into public.geo_massifs
    (geoname_id, feature_code, name, name_plain, country_code, lat, lon, elevation_m, seen_on)
  select r.geoname_id, r.feature_code, r.name, r.name_plain, r.country_code, r.lat, r.lon,
         r.elevation_m, $2::date
  from jsonb_to_recordset($1::jsonb)
    as r(geoname_id integer, feature_code text, name text, name_plain text, country_code text,
         lat real, lon real, elevation_m smallint)
  on conflict (geoname_id) do update set
    feature_code = excluded.feature_code, name = excluded.name, name_plain = excluded.name_plain,
    country_code = excluded.country_code, lat = excluded.lat, lon = excluded.lon,
    elevation_m = excluded.elevation_m, seen_on = excluded.seen_on`;

async function write(client: PgClient, rows: GeoMassifRow[], run: string): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await client.query('begin');
    try {
      await client.query(UPSERT, [JSON.stringify(batch), run]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw new Error(
        `lot refusé après ${written} lignes : ${err instanceof Error ? err.message : err}`
      );
    }
    written += batch.length;
  }
  return written;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const run = new Date().toISOString().slice(0, 10);
  console.info(
    `${opts.apply ? 'ÉCRITURE' : 'ESSAI (rien n’est écrit)'} — ${[...opts.files, ...opts.countries].join(', ')}`
  );
  // Connexion vérifiée AVANT de lire des millions de lignes.
  const client = opts.apply ? await connect(opts.maxDbMb) : null;
  try {
    const collector = createGeoMassifCollector();
    const add = (l: string) => collector.add(l);
    for (const f of opts.files) {
      console.info(`Lecture de ${f}`);
      await readLines(fs.createReadStream(f, 'utf8'), add);
    }
    for (const c of opts.countries) {
      const zip = await ensureZip(c, opts.cacheDir);
      console.info(`Lecture de ${zip}`);
      await readZip(zip, `${c}.txt`, add);
    }
    const { rows, dropped, lines } = collector.result();
    const byCode: Record<string, number> = {};
    for (const r of rows) byCode[r.feature_code] = (byCode[r.feature_code] ?? 0) + 1;
    const written = client ? await write(client, rows, run) : 0;
    const summary = {
      mode: opts.apply ? 'apply' : 'dry-run',
      lines,
      kept: rows.length,
      written,
      dropped,
      byCode,
    };
    console.info('\n=== Résumé ===');
    console.info(
      `Lignes lues : ${lines} · gardées : ${rows.length} · écartées : ${JSON.stringify(dropped)}`
    );
    console.info(`Par code : ${JSON.stringify(byCode)}`);
    if (client) console.info(`Écrites (upsert sur geoname_id) : ${written}`);
    if (opts.json) console.info(JSON.stringify(summary));
  } finally {
    await client?.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
