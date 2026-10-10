// Compas — aéroports desservis (OurAirports, domaine public, PLAN-100 4.3).
//
// Lit `airports.csv` d'OurAirports (téléchargé, ou chemin donné en argument),
// garde les aéroports à vols réguliers (`scheduled_service` = yes) avec un
// code IATA, grands ou moyens, et écrit dans `src/features/compas/data/` :
//   - `airports.json` : [iata, nom, lat (3 décimales), lon (3 décimales), pays ISO, 'L' | 'M']
//     trié par code IATA, une ligne par aéroport (diff lisible) ;
//   - `airports.meta.json` : source, adresse, licence, date, nombre. `fetched` est le
//     jour du téléchargement ; avec un fichier donné en argument, le jour de sa
//     dernière modification (pour un fichier téléchargé, le jour où il l'a été).
//
// Usage :
//   NODE_USE_ENV_PROXY=1 node scripts/compas/build-airports.mjs
//   node scripts/compas/build-airports.mjs /chemin/vers/airports.csv
// (Node 22 : `fetch` ne passe par HTTPS_PROXY qu'avec NODE_USE_ENV_PROXY=1.)
// Aucune dépendance.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');
/** En dessous, le fichier lu est tronqué ou n'est pas celui d'OurAirports. */
const MIN_AIRPORTS = 3000;

/** Une ligne CSV (RFC 4180) : champs entre guillemets, guillemets doublés. */
export function parseCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(field);
      field = '';
    } else field += c;
  }
  out.push(field);
  return out;
}

/** Les enregistrements du fichier, sans couper un champ entre guillemets qui contient un saut de ligne. */
function csvRecords(text) {
  const records = [];
  let current = '';
  let quotes = 0;
  for (const line of text.split(/\r?\n/)) {
    current = current ? `${current}\n${line}` : line;
    quotes += (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 0) {
      if (current.trim()) records.push(parseCsvLine(current));
      current = '';
      quotes = 0;
    }
  }
  return records;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/** Aéroports desservis du CSV, triés par code IATA. */
export function buildAirports(text) {
  // Un fichier enregistré par Excel ou Notepad peut commencer par un BOM UTF-8.
  const [header, ...rows] = csvRecords(text.replace(/^\uFEFF/, ''));
  if (!header) throw new Error('CSV OurAirports vide ou sans en-tête');
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Colonne absente du CSV : ${name}`);
    return i;
  };
  const iType = col('type');
  const iName = col('name');
  const iLat = col('latitude_deg');
  const iLon = col('longitude_deg');
  const iCountry = col('iso_country');
  const iService = col('scheduled_service');
  const iIata = col('iata_code');
  const out = [];
  for (const r of rows) {
    const type = r[iType];
    if (type !== 'large_airport' && type !== 'medium_airport') continue;
    if (r[iService] !== 'yes') continue;
    const iata = (r[iIata] ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(iata)) continue;
    const lat = Number(r[iLat]);
    const lon = Number(r[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push([
      iata,
      (r[iName] ?? '').trim(),
      round3(lat),
      round3(lon),
      (r[iCountry] ?? '').trim().toUpperCase(),
      type === 'large_airport' ? 'L' : 'M',
    ]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

async function main() {
  const file = process.argv[2];
  const day = (date) => date.toISOString().slice(0, 10);
  let text;
  let fetched;
  if (file) {
    text = await readFile(file, 'utf8');
    fetched = day((await stat(file)).mtime);
  } else {
    text = await fetch(AIRPORTS_URL).then((res) => {
      if (!res.ok) throw new Error(`OurAirports : HTTP ${res.status}`);
      return res.text();
    });
    fetched = day(new Date());
  }
  const airports = buildAirports(text);
  if (airports.length < MIN_AIRPORTS)
    throw new Error(`Seulement ${airports.length} aéroports : fichier tronqué ou inattendu, rien n'est écrit.`);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'airports.json'),
    `[\n${airports.map((a) => JSON.stringify(a)).join(',\n')}\n]\n`
  );
  const meta = {
    source: 'OurAirports',
    url: AIRPORTS_URL,
    licence: 'Public Domain',
    fetched,
    count: airports.length,
  };
  await writeFile(path.join(OUT_DIR, 'airports.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.info(`${airports.length} aéroports écrits dans ${path.relative(ROOT, OUT_DIR)}`);
}

// Lancé en ligne de commande (pas importé par un test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
