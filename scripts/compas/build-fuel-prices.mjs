// Compas — prix des carburants de l'UE-27 (PLAN-100 1.8 et 4.6).
//
// Lit le classeur « Weekly Oil Bulletin — Weekly prices with Taxes » de la Commission
// européenne (bulletin pétrolier hebdomadaire : prix à la pompe TTC, euros pour 1 000 litres)
//   https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en
// publié sous licence CC BY 4.0 (avis juridique de la Commission : « Unless otherwise
// indicated […] content owned by the EU on this website is licensed under the Creative
// Commons Attribution 4.0 International (CC BY 4.0) licence », crédit et indication des
// changements exigés), et écrit dans `src/features/compas/data/` :
//   - `fuelPrices.json` : date des prix, Euro-super 95 et gazole en euros par LITRE par pays
//     (ISO 3166-1 alpha-2), plus la moyenne pondérée de l'UE-27 publiée dans le même classeur ;
//   - `fuelPrices.meta.json` : source, licence, crédit, date des prix, date de publication de
//     la page, nom du fichier, empreinte SHA-256, nombre de pays.
//
// LES DONNÉES SONT NON FIABLES : le classeur n'est jamais exécuté ; seules les cellules lues
// par position (colonne B Euro-super 95, C gazole) sont gardées, en nombres compris entre
// 500 et 4 000 € pour 1 000 litres. Tout pays absent ou inconnu, toute cellule hors bornes
// ou toute date illisible fait échouer le script : rien n'est écrit. Le prix d'un pays qui ne
// publie pas une colonne n'est pas inventé : la colonne manque pour ce pays.
//
// Usage : node scripts/compas/build-fuel-prices.mjs "/chemin/Weekly Oil Bulletin Weekly prices with Taxes.xlsx" 2026-10-08
//   (2e argument : date d'affichage « latest prices » sur la page de la Commission, AAAA-MM-JJ)
// Aucune dépendance (lecture du zip et du XML avec Node seul).
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');

export const PAGE_URL = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';
export const LICENCE_URL = 'https://commission.europa.eu/legal-notice_en';
export const CREDIT =
  'Weekly Oil Bulletin, Commission européenne (DG Énergie), https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en (CC BY 4.0) ; prix convertis en euros par litre, arrondis au millième';

/** Les 27 États membres tels que le classeur les écrit (anglais). Toute autre ligne de pays fait échouer. */
export const COUNTRIES = Object.freeze({
  Austria: 'AT',
  Belgium: 'BE',
  Bulgaria: 'BG',
  Croatia: 'HR',
  Cyprus: 'CY',
  Czechia: 'CZ',
  Denmark: 'DK',
  Estonia: 'EE',
  Finland: 'FI',
  France: 'FR',
  Germany: 'DE',
  Greece: 'GR',
  Hungary: 'HU',
  Ireland: 'IE',
  Italy: 'IT',
  Latvia: 'LV',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Malta: 'MT',
  Netherlands: 'NL',
  Poland: 'PL',
  Portugal: 'PT',
  Romania: 'RO',
  Slovakia: 'SK',
  Slovenia: 'SI',
  Spain: 'ES',
  Sweden: 'SE',
});

/** Bornes de bon sens, en euros pour 1 000 litres : au-delà, la cellule n'est pas un prix à la pompe. */
const MIN = 500;
const MAX = 4000;

/** Lit les entrées d'un zip (répertoire central) avec `zlib` : { nom → contenu }. Refuse tout ce qui n'est pas stocké ou deflate. */
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('classeur illisible : fin de zip introuvable');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('classeur illisible : répertoire central');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml'].includes(name)) continue;
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + size);
    if (size > 5_000_000) throw new Error(`entrée trop grosse : ${name}`);
    files.set(name, method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null);
    if (files.get(name) === null) throw new Error(`compression non gérée pour ${name}`);
  }
  return files;
}

const xmlText = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Cellules de la feuille : { 'A3': 'Austria', 'B3': 1837, … } (texte ou nombre). */
export function readCells(files) {
  const shared = files.get('xl/sharedStrings.xml');
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!shared || !sheet) throw new Error('classeur illisible : feuille ou chaînes manquantes');
  const strings = [...shared.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]).trim());
  const cells = {};
  for (const m of sheet.toString('utf8').matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const v = /<v>([^<]*)<\/v>/.exec(m[3] ?? '')?.[1];
    if (v === undefined) continue;
    cells[m[1]] = /t="s"/.test(m[2]) ? strings[Number(v)] : Number(v);
  }
  return cells;
}

/** Date d'un numéro de série Excel (jours depuis le 30 décembre 1899), AAAA-MM-JJ. */
export function excelDay(serial) {
  if (!Number.isInteger(serial) || serial < 40000 || serial > 60000) throw new Error(`date du classeur illisible : ${serial}`);
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

const perLitre = (cell, what) => {
  if (cell === undefined) return null;
  if (typeof cell !== 'number' || !Number.isFinite(cell) || cell < MIN || cell > MAX) throw new Error(`prix hors bornes (${what}) : ${cell}`);
  return Math.round(cell) / 1000;
};

/** Le jeu de prix tiré des cellules du classeur ; échoue sur tout ce qui n'est pas prévu. */
export function parseBulletin(cells) {
  if (!/Euro-super 95/.test(String(cells.B1)) || !/Gas oil automobile/.test(String(cells.C1)) || !/in EUR/.test(String(cells.A1)))
    throw new Error('en-têtes inattendus : colonnes B (Euro-super 95) et C (gazole) introuvables');
  if (!/1000 l/.test(String(cells.B2)) || !/1000 l/.test(String(cells.C2))) throw new Error('unité inattendue (1 000 litres attendus)');
  const date = excelDay(cells.A2);
  const eurosuper95 = {};
  const diesel = {};
  const seen = new Set();
  let eu27 = null;
  for (let row = 3; row <= 60; row += 1) {
    const label = cells[`A${row}`];
    if (typeof label !== 'string') continue;
    if (/EUR27/.test(label)) {
      const b = perLitre(cells[`B${row}`], 'moyenne UE-27 essence');
      const c = perLitre(cells[`C${row}`], 'moyenne UE-27 gazole');
      if (b == null || c == null) throw new Error('moyenne pondérée de l’UE-27 incomplète');
      eu27 = { eurosuper95: b, diesel: c };
      continue;
    }
    if (/Euro Area|Moyenne|Weighted/.test(label) && !COUNTRIES[label]) continue;
    const code = COUNTRIES[label.trim()];
    if (!code) throw new Error(`ligne inconnue du classeur : ${label}`);
    const b = perLitre(cells[`B${row}`], `${label} essence`);
    const c = perLitre(cells[`C${row}`], `${label} gazole`);
    if (b != null) eurosuper95[code] = b;
    if (c != null) diesel[code] = c;
    seen.add(code);
  }
  const missing = Object.values(COUNTRIES).filter((c) => !seen.has(c));
  if (missing.length) throw new Error(`pays absents du classeur : ${missing.join(', ')}`);
  if (!eu27) throw new Error('ligne de la moyenne pondérée de l’UE-27 introuvable');
  return { date, eurosuper95, diesel, eu27 };
}

async function main() {
  const [file, pageDate] = process.argv.slice(2);
  if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(pageDate ?? ''))
    throw new Error('usage : node scripts/compas/build-fuel-prices.mjs classeur.xlsx AAAA-MM-JJ');
  const raw = await readFile(file);
  const { date, ...prices } = parseBulletin(readCells(unzip(raw)));
  const data = { date, unit: 'EUR par litre, TTC, prix à la pompe', ...prices };
  const meta = {
    source: 'Weekly Oil Bulletin — prix hebdomadaires avec taxes, Commission européenne (DG Énergie)',
    page: PAGE_URL,
    licence: 'CC BY 4.0',
    licenceUrl: LICENCE_URL,
    credit: CREDIT,
    pricesDate: date,
    pagePublished: pageDate,
    file: path.basename(file),
    note: 'Le nom du fichier publié porte une date plus ancienne que le contenu : la date des prix est celle lue dans la cellule A2 du classeur.',
    sha256: createHash('sha256').update(raw).digest('hex'),
    countries: Object.keys(prices.eurosuper95).length,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'fuelPrices.json'), `${JSON.stringify(data, null, 1)}\n`);
  await writeFile(path.join(OUT_DIR, 'fuelPrices.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.info(`${meta.countries} pays, prix du ${date}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
