// scripts/geo/import_geo_pois.ts — Remplit public.geo_pois (plan 3.4 et 3.9).
//
// Refuges, cabanes, campings, abris, points d'eau et sources d'OpenStreetMap (ODbL),
// lus tuile par tuile sur Overpass private.coffee (la seule instance du site, une
// requête à la fois : `src/lib/overpass.ts`), puis écrits par upsert idempotent sur
// l'identifiant OSM. Même esprit que scripts/geo/import_geo_places.ts (3.2), mais
// la source est une API et non des fichiers, d'où la connexion directe à la base.
//
//   ESSAI, n'écrit RIEN (défaut) :
//     npx tsx scripts/geo/import_geo_pois.ts --zone vercors --dry-run --cache-dir /tmp/pois
//   ÉCRITURE (SUPABASE_DB_URL dans l'environnement, migration geo_pois appliquée) :
//     npx tsx scripts/geo/import_geo_pois.ts --zone alpes --apply
//
// Options :
//   --zone vercors|alpes|france   ou   --bbox ouest,sud,est,nord
//   --tile <degrés>               pas de la grille (0,5 pour un massif, 1 sinon)
//   --dry-run                     (défaut) lit Overpass, n'écrit rien, résume
//   --apply                       écrit en base, une transaction par tuile
//   --cache-dir <dossier>         garde les réponses : relancer l'essai ne redemande rien à Overpass
//   --pause-s <secondes>          attente entre deux requêtes (5 par défaut)
//   --max-db-mb <Mo>              refuse d'écrire si la base dépasse cette taille (250 par défaut, plan 1.1)
//   --skip-fresh-days <jours>     avec --apply : saute les tuiles importées depuis moins de N jours et prend
//                                 les plus anciennes d'abord (reprise d'un passage interrompu, sans rien refaire)
//   --json                        résumé lisible par une machine à la fin
//
// Idempotent : relancé, il met à jour les mêmes lignes. Un objet absent d'une tuile
// complète compte une absence ; retiré à la deuxième de suite (`geo_pois_finish_tile`).
// Une tuile dont la réponse est coupée ou muette n'écrit rien et n'est pas marquée
// couverte. Licence : © contributeurs OpenStreetMap (ODbL), voir docs/compas/REFERENTIEL-GEO.md.

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { overpassPost, serializeOverpass } from '../../src/lib/overpass';
import { appUserAgent } from '../../src/lib/userAgent';
import { overpassUsable } from '../../src/features/compas/engine/stagePois';
import {
  buildGeoPoisQuery,
  estimateTableBytes,
  GEO_POI_ZONES,
  geoPoiTiles,
  parseGeoPois,
  summarizeGeoPois,
  type BBox,
  type GeoPoiRow,
} from '../../src/features/compas/engine/geoPois';

const UA = appUserAgent('import des refuges et points d eau, une requete a la fois');
// Overpass travaille jusqu'à 180 s côté serveur (`[timeout:180]`) ; une tuile d'essai a pris 178 s un jour de forte charge.
const REQUEST_TIMEOUT_MS = 300_000;
const MAX_ATTEMPTS = 3;
const BATCH = 1000;

interface Options {
  zone: string | null;
  box: BBox;
  step: number;
  apply: boolean;
  cacheDir: string | null;
  pauseS: number;
  maxDbMb: number;
  skipFreshDays: number;
  json: boolean;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    'Usage : npx tsx scripts/geo/import_geo_pois.ts (--zone vercors|alpes|france | --bbox ouest,sud,est,nord) ' +
      '[--tile 1] [--dry-run | --apply] [--cache-dir dossier] [--pause-s 5] [--max-db-mb 250] [--skip-fresh-days 25] [--json]'
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const zone = get('--zone') ?? null;
  const bboxArg = get('--bbox');
  if ((zone && bboxArg) || (!zone && !bboxArg)) usage('Il faut --zone OU --bbox.');
  let box: BBox;
  let step = 1;
  if (zone) {
    const z = GEO_POI_ZONES[zone];
    if (!z) usage(`Zone inconnue : ${zone} (${Object.keys(GEO_POI_ZONES).join(', ')}).`);
    box = z.box;
    step = z.tile;
  } else {
    const parts = (bboxArg ?? '').split(',').map(Number);
    if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) usage('--bbox attend ouest,sud,est,nord.');
    box = parts as BBox;
  }
  if (get('--tile')) step = Number(get('--tile'));
  if (![0.25, 0.5, 1, 2].includes(step)) usage('--tile : 0.25, 0.5, 1 ou 2 (grille commune à tous les imports).');
  if (argv.includes('--apply') && argv.includes('--dry-run')) usage('--apply et --dry-run s’excluent.');
  return {
    zone,
    box,
    step,
    apply: argv.includes('--apply'),
    cacheDir: get('--cache-dir') ?? null,
    pauseS: Number(get('--pause-s') ?? 5),
    maxDbMb: Number(get('--max-db-mb') ?? 250),
    skipFreshDays: Number(get('--skip-fresh-days') ?? 0),
    json: argv.includes('--json'),
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const tileName = (t: BBox) => `${t[1]}_${t[0]}_${t[2] - t[0]}`;

interface TileFetch {
  payload: unknown | null;
  bytes: number;
  ms: number;
  fromCache: boolean;
  error: string | null;
}

/** Une tuile : le cache d'abord, sinon Overpass (une seule requête à la fois, trois essais espacés). */
async function fetchTile(tile: BBox, opts: Options): Promise<TileFetch> {
  const cacheFile = opts.cacheDir ? path.join(opts.cacheDir, `${tileName(tile)}.json`) : null;
  if (cacheFile && fs.existsSync(cacheFile)) {
    const text = fs.readFileSync(cacheFile, 'utf8');
    return { payload: JSON.parse(text), bytes: text.length, ms: 0, fromCache: true, error: null };
  }
  const query = buildGeoPoisQuery(tile);
  let error = 'aucune réponse';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const t0 = Date.now();
    try {
      const { status, text } = await serializeOverpass(async () => {
        const res = await overpassPost(query, { userAgent: UA, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        return { status: res.status, text: await res.text() };
      });
      if (status === 200) {
        const payload: unknown = JSON.parse(text);
        if (overpassUsable(payload)) {
          if (cacheFile) {
            fs.mkdirSync(opts.cacheDir as string, { recursive: true });
            fs.writeFileSync(cacheFile, text);
          }
          return { payload, bytes: text.length, ms: Date.now() - t0, fromCache: false, error: null };
        }
        error = `réponse coupée (${String((payload as { remark?: unknown }).remark ?? 'sans détail').slice(0, 120)})`;
      } else {
        error = `HTTP ${status}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'erreur';
    }
    console.warn(`  essai ${attempt}/${MAX_ATTEMPTS} : ${error}`);
    if (attempt < MAX_ATTEMPTS) await sleep(30_000 * attempt);
  }
  return { payload: null, bytes: 0, ms: 0, fromCache: false, error };
}

type PgClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

async function connect(): Promise<PgClient> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) usage('--apply demande SUPABASE_DB_URL dans l’environnement.');
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query("select to_regclass('public.geo_pois') as t");
  if (!rows[0]?.t) {
    await client.end();
    throw new Error('public.geo_pois n’existe pas : la migration 20261013090000_geo_pois.sql n’est pas appliquée.');
  }
  return client as unknown as PgClient;
}

async function assertRoom(client: PgClient, maxDbMb: number): Promise<void> {
  const { rows } = await client.query('select pg_database_size(current_database()) / 1048576.0 as mb');
  const mb = Number(rows[0]?.mb);
  if (!Number.isFinite(mb) || mb > maxDbMb) {
    throw new Error(`base à ${Number.isFinite(mb) ? mb.toFixed(0) : '?'} Mo, au-dessus de la limite de ${maxDbMb} Mo : rien n’est écrit (retirer places_geo d’abord, plan 1.1).`);
  }
}

const UPSERT = `
  insert into public.geo_pois (osm_id, subtype, name, lat, lon, ele_m, capacity, potable, seen_on, missed)
  select r.osm_id, r.subtype, r.name, r.lat, r.lon, r.ele_m, r.capacity, r.potable, $2::date, 0
  from jsonb_to_recordset($1::jsonb)
    as r(osm_id text, subtype text, name text, lat real, lon real, ele_m smallint, capacity smallint, potable boolean)
  on conflict (osm_id) do update set
    subtype = excluded.subtype, name = excluded.name, lat = excluded.lat, lon = excluded.lon,
    ele_m = excluded.ele_m, capacity = excluded.capacity, potable = excluded.potable,
    seen_on = excluded.seen_on, missed = 0`;

/** Écrit UNE tuile complète, en une transaction : si quoi que ce soit échoue, rien n'est gardé de cette tuile. */
async function writeTile(client: PgClient, tile: BBox, rows: GeoPoiRow[], run: string): Promise<{ missed: number; deleted: number; rows: number }> {
  // Une réponse bien plus petite que la précédente (OSM muet, tronqué) ne doit rien retirer.
  const prev = await client.query('select rows from public.geo_pois_coverage where west = $1 and south = $2 and east = $3 and north = $4', [
    tile[0],
    tile[1],
    tile[2],
    tile[3],
  ]);
  const prevRows = Number(prev.rows[0]?.rows ?? 0);
  const countMisses = !(prevRows > 20 && rows.length < prevRows * 0.5);
  if (!countMisses) console.warn(`  ${rows.length} objets contre ${prevRows} la dernière fois : aucune absence n’est comptée.`);
  await client.query('begin');
  try {
    for (let i = 0; i < rows.length; i += BATCH) {
      await client.query(UPSERT, [JSON.stringify(rows.slice(i, i + BATCH)), run]);
    }
    const res = await client.query('select public.geo_pois_finish_tile($1::real, $2::real, $3::real, $4::real, $5::date, $6) as r', [
      tile[0],
      tile[1],
      tile[2],
      tile[3],
      run,
      countMisses,
    ]);
    await client.query('commit');
    return res.rows[0].r as { missed: number; deleted: number; rows: number };
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

/**
 * Reprise : les tuiles importées depuis moins de `days` jours sont sautées, les plus
 * anciennes (ou jamais importées) passent d'abord. Un passage interrompu se termine au
 * suivant sans rien refaire, et une tuile en échec revient en tête.
 */
async function staleTilesFirst(client: PgClient, tiles: BBox[], days: number): Promise<{ todo: BBox[]; fresh: number }> {
  const { rows } = await client.query('select west, south, east, north, (current_date - done_on) as age from public.geo_pois_coverage');
  const age = new Map<string, number>();
  for (const r of rows) age.set(`${Number(r.west)},${Number(r.south)},${Number(r.east)},${Number(r.north)}`, Number(r.age));
  const ageOf = (t: BBox) => age.get(t.join(',')) ?? Infinity;
  const todo = tiles.filter((t) => ageOf(t) >= days).sort((a, b) => ageOf(b) - ageOf(a));
  return { todo, fresh: tiles.length - todo.length };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  let tiles = geoPoiTiles(opts.box, opts.step);
  const run = new Date().toISOString().slice(0, 10);
  if (opts.skipFreshDays > 0 && !opts.apply) console.warn('--skip-fresh-days ne sert qu’avec --apply (la base seule sait ce qui est déjà importé) : ignoré.');
  console.info(
    `${opts.apply ? 'ÉCRITURE' : 'ESSAI (rien n’est écrit)'} — ${opts.zone ? GEO_POI_ZONES[opts.zone].label : `emprise ${opts.box.join(',')}`}, ` +
      `${tiles.length} tuile(s) de ${opts.step}°, une requête à la fois, ${opts.pauseS} s entre deux.`
  );
  const client = opts.apply ? await connect() : null;
  if (client && opts.skipFreshDays > 0) {
    const { todo, fresh } = await staleTilesFirst(client, tiles, opts.skipFreshDays);
    console.info(`${fresh} tuile(s) importée(s) depuis moins de ${opts.skipFreshDays} jours : sautées ; ${todo.length} à faire.`);
    tiles = todo;
    if (!tiles.length) {
      await client.end();
      console.info('Rien à rafraîchir.');
      return;
    }
  }
  const all = new Map<string, GeoPoiRow>();
  const dropped: Record<string, number> = {};
  const perTile: Array<Record<string, unknown>> = [];
  let payloadBytes = 0;
  let elements = 0;
  let requests = 0;
  let incomplete = 0;
  const started = Date.now();
  try {
    for (const [i, tile] of tiles.entries()) {
      if (client) await assertRoom(client, opts.maxDbMb);
      console.info(`[${i + 1}/${tiles.length}] tuile ${tile.join(', ')}`);
      const got = await fetchTile(tile, opts);
      if (!got.fromCache) requests += 1;
      if (!got.payload) {
        incomplete += 1;
        perTile.push({ tile, error: got.error });
        console.warn(`  tuile incomplète, rien n’est écrit pour elle : ${got.error}`);
      } else {
        const parsed = parseGeoPois(got.payload);
        payloadBytes += got.bytes;
        elements += parsed.elements;
        for (const [k, v] of Object.entries(parsed.dropped)) dropped[k] = (dropped[k] ?? 0) + (v ?? 0);
        for (const r of parsed.rows) all.set(r.osm_id, r);
        const info: Record<string, unknown> = { tile, ms: got.ms, fromCache: got.fromCache, bytes: got.bytes, elements: parsed.elements, kept: parsed.rows.length };
        if (client) info.written = await writeTile(client, tile, parsed.rows, run);
        perTile.push(info);
        console.info(`  ${parsed.elements} éléments, ${parsed.rows.length} gardés, ${(got.bytes / 1024).toFixed(0)} Ko${got.fromCache ? ' (cache)' : `, ${(got.ms / 1000).toFixed(1)} s`}`);
      }
      if (i < tiles.length - 1 && !got.fromCache) await sleep(opts.pauseS * 1000);
    }
  } finally {
    await client?.end();
  }

  const rows = [...all.values()];
  const summary = {
    mode: opts.apply ? 'apply' : 'dry-run',
    zone: opts.zone ?? opts.box,
    tileDeg: opts.step,
    tiles: tiles.length,
    tilesIncomplete: incomplete,
    overpassRequests: requests,
    elapsedS: Math.round((Date.now() - started) / 1000),
    payloadBytes,
    elements,
    kept: rows.length,
    dropped,
    ...summarizeGeoPois(rows),
    estimatedTableBytes: estimateTableBytes(rows),
    perTile,
  };
  console.info('\n=== Résumé ===');
  console.info(`Lignes gardées : ${summary.kept} (sur ${elements} éléments lus ; écartés : ${JSON.stringify(dropped)})`);
  console.info(`Par nature : ${JSON.stringify(summary.bySubtype)}`);
  console.info(`Nom : ${summary.named}/${summary.kept} · altitude : ${summary.withEle} · capacité : ${summary.withCapacity} · eau potable oui/inconnu : ${JSON.stringify(summary.potable)}`);
  console.info(`Réponses Overpass : ${(payloadBytes / 1048576).toFixed(1)} Mo en ${summary.elapsedS} s pour ${requests} requête(s)`);
  console.info(`Place estimée en base (tableau + index, ± 30 %) : ${(summary.estimatedTableBytes / 1048576).toFixed(2)} Mo, soit ${rows.length ? Math.round(summary.estimatedTableBytes / rows.length) : 0} octets par ligne`);
  if (incomplete) console.info(`${incomplete} tuile(s) incomplète(s) : à relancer.`);
  if (opts.json) console.info(JSON.stringify(summary));
  if (incomplete) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
