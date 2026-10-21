// scripts/geo/import_geo_place_names.ts — Remplit public.geo_place_names (PLAN-100 6.4).
//
// Noms par langue des lieux de `geo_places`, tirés de GeoNames `alternateNamesV2` (CC BY 4.0,
// créditée dans les mentions légales, comme geo_places). Un nom par lieu et par langue (le préféré),
// seulement s'il diffère du nom GeoNames ; aucun nom inventé ni translittéré. Règles :
// src/features/compas/engine/geoPlaceNames.ts.
//
// PRÉREQUIS (écriture) : la migration DIFFÉRÉE
// supabase/migrations_deferred/20261018120000_geo_place_names.sql appliquée à la main.
//
// Sources du fichier alternateNamesV2, au choix :
//   --file alternateNamesV2.txt   déjà dézippé ;
//   --cache-dir dossier           télécharge https://download.geonames.org/export/dump/alternateNamesV2.zip
//                                 (≈ 200 Mo, réutilisé s'il y est déjà), lu avec `unzip -p`.
// Langues : --lang fr,en,es,de,it (défaut : les langues de l'interface) ; ru, ja, zh… acceptés.
//
// Lieux retenus : ceux de geo_places. En écriture, lus en base (identifiant et nom GeoNames). En
// essai, --places-dir dossier lit les dumps de geo_places (cities500, FR, CH, IT, AT, téléchargés
// s'ils manquent) ; sans lui, l'essai compte TOUS les lieux GeoNames (borne haute).
//
//   ESSAI, n'écrit RIEN (défaut) :
//     npx tsx scripts/geo/import_geo_place_names.ts --cache-dir /tmp/geonames --places-dir /tmp/geonames
//   ÉCRITURE (SUPABASE_DB_URL dans l'environnement) :
//     npx tsx scripts/geo/import_geo_place_names.ts --cache-dir /tmp/geonames --apply --max-db-mb 250
//
// Upsert idempotent sur (place_id, lang), par lots de 1 000 (une transaction par lot) ; une ligne
// inchangée n'est pas réécrite. Taille de la base relue avant d'écrire puis tous les 50 lots :
// au-dessus de --max-db-mb, rien de plus n'est écrit. Rien n'est retiré.

import 'dotenv/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { appUserAgent } from '../../src/lib/userAgent';
import {
  createPlaceNameCollector,
  DEFAULT_NAME_LANGS,
  parseNameLangs,
  type PlaceNameRow,
} from '../../src/features/compas/engine/geoPlaceNames';
import { createGeoPlaceCollector, GEO_PLACES_DUMPS } from '../../src/features/compas/engine/geoPlacesImport';

const DUMP = 'https://download.geonames.org/export/dump/';
const UA = appUserAgent('import des noms de lieux GeoNames');
const BATCH = 1000;
const SIZE_CHECK_EVERY = 50;

interface Options {
  file: string | null;
  cacheDir: string | null;
  placesDir: string | null;
  langs: ReadonlySet<string>;
  apply: boolean;
  maxDbMb: number;
  json: boolean;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    'Usage : npx tsx scripts/geo/import_geo_place_names.ts (--file alternateNamesV2.txt | --cache-dir dossier) ' +
      '[--lang fr,en,es,de,it] [--places-dir dossier] [--dry-run | --apply] [--max-db-mb 250] [--json]\n' +
      '  --dry-run (défaut) lit et compte sans rien écrire ; --apply écrit (SUPABASE_DB_URL requis).'
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const one = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const file = one('--file');
  const cacheDir = one('--cache-dir');
  if ((file === null) === (cacheDir === null)) usage('Une seule source : --file ou --cache-dir.');
  if (file && !fs.existsSync(file)) usage(`Fichier introuvable : ${file}.`);
  if (argv.includes('--apply') && argv.includes('--dry-run')) usage('--apply et --dry-run s’excluent.');
  let langs = DEFAULT_NAME_LANGS;
  const lang = one('--lang');
  if (lang !== null) {
    try {
      langs = parseNameLangs(lang);
    } catch (err) {
      usage(err instanceof Error ? err.message : String(err));
    }
  }
  const max = one('--max-db-mb');
  const maxDbMb = max === null ? 250 : Number(max);
  if (!Number.isFinite(maxDbMb) || maxDbMb <= 0) usage(`--max-db-mb invalide : ${max}.`);
  return {
    file,
    cacheDir,
    placesDir: one('--places-dir'),
    langs,
    apply: argv.includes('--apply'),
    maxDbMb,
    json: argv.includes('--json'),
  };
}

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
  const { rows } = await client.query("select to_regclass('public.geo_place_names') as t");
  const mb = await dbSizeMb(client);
  if (!rows[0]?.t || !Number.isFinite(mb) || mb > maxDbMb) {
    await client.end();
    throw new Error(
      !rows[0]?.t
        ? 'public.geo_place_names n’existe pas : la migration différée 20261018120000_geo_place_names.sql n’est pas appliquée.'
        : `base à ${Number.isFinite(mb) ? mb.toFixed(0) : '?'} Mo, au-dessus de la limite de ${maxDbMb} Mo : rien n’est écrit.`
    );
  }
  return client;
}

/** Les lieux de geo_places (identifiant → nom GeoNames), lus en base. */
async function placesFromDb(client: PgClient): Promise<Map<number, string>> {
  const { rows } = await client.query('select geoname_id, name from public.geo_places');
  return new Map(rows.map((r) => [Number(r.geoname_id), String(r.name)]));
}

/** Les mêmes, depuis les dumps GeoNames de geo_places (essai). */
async function placesFromDumps(dir: string): Promise<Map<number, string>> {
  const collector = createGeoPlaceCollector();
  for (const code of GEO_PLACES_DUMPS) {
    const zip = await ensureZip(code, dir);
    console.info(`Lecture de ${zip} (lieux de geo_places)`);
    await readZip(zip, `${code}.txt`, (l) => collector.add(l));
  }
  return new Map(collector.result().rows.map((r) => [r.geoname_id, r.name]));
}

// Jointure sur geo_places : jamais de nom d'un lieu absent du référentiel (clé étrangère).
const UPSERT = `
  insert into public.geo_place_names
    (place_id, lang, name, name_key, alternate_name_id, is_preferred, updated_at)
  select r.place_id, r.lang, r.name, r.name_key, r.alternate_name_id, r.is_preferred, $2::date
  from jsonb_to_recordset($1::jsonb)
    as r(place_id integer, lang text, name text, name_key text, alternate_name_id integer, is_preferred boolean)
  join public.geo_places g on g.geoname_id = r.place_id
  on conflict (place_id, lang) do update set
    name = excluded.name, name_key = excluded.name_key, alternate_name_id = excluded.alternate_name_id,
    is_preferred = excluded.is_preferred, updated_at = excluded.updated_at
  where (geo_place_names.name, geo_place_names.name_key, geo_place_names.alternate_name_id, geo_place_names.is_preferred)
    is distinct from (excluded.name, excluded.name_key, excluded.alternate_name_id, excluded.is_preferred)`;

async function write(client: PgClient, rows: PlaceNameRow[], run: string, maxDbMb: number) {
  let sent = 0;
  let changed = 0;
  for (let i = 0, n = 0; i < rows.length; i += BATCH, n += 1) {
    if (n > 0 && n % SIZE_CHECK_EVERY === 0) {
      const mb = await dbSizeMb(client);
      if (!Number.isFinite(mb) || mb > maxDbMb)
        throw new Error(`base à ${Number.isFinite(mb) ? mb.toFixed(0) : '?'} Mo après ${sent} lignes, au-dessus de ${maxDbMb} Mo : arrêt.`);
    }
    const batch = rows.slice(i, i + BATCH).map(({ is_short: _short, ...r }) => r);
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
  }
  return { sent, changed };
}

/** Ordre de grandeur de la place prise (ligne + index), pour l'essai. */
function estimateMb(rows: PlaceNameRow[]): number {
  let bytes = 0;
  for (const r of rows) bytes += 110 + Buffer.byteLength(r.name) + 2 * Buffer.byteLength(r.name_key);
  return bytes / 1048576;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const run = new Date().toISOString().slice(0, 10);
  console.info(`${opts.apply ? 'ÉCRITURE' : 'ESSAI (rien n’est écrit)'} — langues ${[...opts.langs].join(', ')}`);
  const client = opts.apply ? await connect(opts.maxDbMb) : null;
  try {
    const places = client
      ? await placesFromDb(client)
      : opts.placesDir
        ? await placesFromDumps(opts.placesDir)
        : null;
    if (places) console.info(`Lieux du référentiel : ${places.size}`);
    else console.info('Sans --places-dir : tous les lieux GeoNames sont comptés (borne haute).');
    const collector = createPlaceNameCollector(opts.langs);
    const add = (l: string) => collector.add(l);
    if (opts.file) {
      console.info(`Lecture de ${opts.file}`);
      await readLines(fs.createReadStream(opts.file, 'utf8'), add);
    } else if (opts.cacheDir) {
      const zip = await ensureZip('alternateNamesV2', opts.cacheDir);
      console.info(`Lecture de ${zip}`);
      await readZip(zip, 'alternateNamesV2.txt', add);
    }
    const res = collector.result(places ? (id) => places.get(id) : undefined);
    const byLang: Record<string, number> = {};
    for (const r of res.rows) byLang[r.lang] = (byLang[r.lang] ?? 0) + 1;
    const mb = estimateMb(res.rows);
    const { sent, changed } = client ? await write(client, res.rows, run, opts.maxDbMb) : { sent: 0, changed: 0 };
    console.info('\n=== Résumé ===');
    console.info(`Lignes lues : ${res.lines} · noms gardés : ${res.rows.length} · écartées : ${JSON.stringify(res.dropped)}`);
    console.info(`Identiques au nom GeoNames : ${res.sameAsGeonames} · lieux hors référentiel : ${res.outsideReferential}`);
    console.info(`Par langue : ${JSON.stringify(byLang)} · place estimée : ${mb.toFixed(1)} Mo`);
    if (client) {
      console.info(`Envoyés : ${sent} · écrits ou changés (upsert sur place_id, lang) : ${changed}`);
      console.info(`Base après l’import : ${(await dbSizeMb(client)).toFixed(0)} Mo`);
    }
    if (opts.json)
      console.info(
        JSON.stringify({
          mode: opts.apply ? 'apply' : 'dry-run',
          lines: res.lines,
          kept: res.rows.length,
          sameAsGeonames: res.sameAsGeonames,
          outsideReferential: res.outsideReferential,
          estimatedMb: Number(mb.toFixed(1)),
          sent,
          changed,
          dropped: res.dropped,
          byLang,
        })
      );
  } finally {
    await client?.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
