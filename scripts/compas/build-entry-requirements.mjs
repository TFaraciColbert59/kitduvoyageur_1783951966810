// Compas — table passeport × destination (travelrequirements.info, PLAN-100 4.2).
//
// Lit `visa-matrix.csv` du jeu « Entry Requirements Dataset » (CC BY 4.0, usage
// commercial permis, crédit exact de l'éditeur) et son `index.json` voisin, puis
// écrit dans `src/features/compas/data/` :
//   - `entryRequirements.json` : par destination (ISO2), des groupes
//     [exigence, séjour max en jours | null, fenêtre | null, date de vérification,
//     « passeports » séparés par une espace]. Un groupe réunit les passeports qui
//     ont la même exigence, le même séjour, la même fenêtre et la même date : le
//     fichier tient en environ 140 Ko au lieu de 600 Ko (une ligne par destination,
//     diff lisible) ;
//   - `entryRequirements.meta.json` : source, version, licence, crédit, dates, nombre de
//     lignes, empreinte SHA-256 du CSV lu.
//
// LES DONNÉES SONT NON FIABLES : le CSV n'est jamais exécuté ni copié tel quel.
// Chaque colonne utile est validée (liste fermée pour `requirement`, codes à deux
// lettres, entiers, dates réelles) ; toute valeur inconnue fait échouer le script et
// rien n'est écrit. Les colonnes de texte libre (noms, adresses de sources) ne sont
// jamais recopiées. Le manifeste est contrôlé : licence CC BY 4.0, crédit exact de
// l'éditeur pour cette version, couverture égale au contenu du CSV (fichier tronqué).
// Les jeux dérivés de Passport Index sont exclus (recherche académique seulement) :
// seule la licence CC-BY-4.0 de ce manifeste est acceptée.
//
// Usage :
//   node scripts/compas/build-entry-requirements.mjs /chemin/vers/visa-matrix.csv
//   (index.json doit se trouver dans le même dossier ; jeu publié sur
//   https://travelrequirements.info/data/)
// Aucune dépendance.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvLine } from './build-airports.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'src', 'features', 'compas', 'data');

export const DATA_URL = 'https://travelrequirements.info/data/';
/** Fin du crédit exact donné par l'éditeur ; le début porte la version du jeu. */
export const EXPECTED_CREDIT_SUFFIX = ', AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0)';
const CREDIT_PREFIX = 'TravelRequirements.info — Entry Requirements Dataset v';

/** Liste fermée des exigences (schéma publié de l'éditeur) : toute autre valeur fait échouer. */
export const REQUIREMENTS = Object.freeze([
  'visa-free',
  'evisa',
  'eta',
  'visa-on-arrival',
  'embassy-visa',
  'freedom-of-movement',
  'banned',
  'unconfirmed',
  'travel-permit',
]);
const WINDOW_BASES = ['rolling', 'per-12-months-from-first-entry', 'per-entry'];
const LEVELS = ['row', 'policy'];
const COLUMNS = [
  'destination_iso2',
  'passport_code',
  'requirement',
  'max_stay_days',
  'stay_window_basis',
  'stay_window_days',
  'source_last_verified',
  'source_level',
];
const ISO2 = /^[A-Z]{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INT = /^\d{1,5}$/;

/** Les enregistrements du fichier avec leur numéro de ligne, sans couper un champ entre guillemets. */
function csvRecords(text) {
  const records = [];
  let current = '';
  let start = 0;
  let quotes = 0;
  text.split(/\r?\n/).forEach((line, i) => {
    if (!current) start = i + 1;
    current = current ? `${current}\n${line}` : line;
    quotes += (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 0) {
      if (current.trim()) records.push({ line: start, fields: parseCsvLine(current) });
      current = '';
      quotes = 0;
    }
  });
  return records;
}

/** Vrai pour un jour du calendrier réel (« 2026-02-30 » n'existe pas). */
function isRealDay(s) {
  if (!DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function checkManifest(index, rows, destinations, passports) {
  if (!index || typeof index !== 'object') throw new Error('Manifeste index.json absent ou illisible');
  const version = index.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version))
    throw new Error(`Version du jeu absente ou inattendue dans index.json : ${JSON.stringify(version)}`);
  if (index.license?.spdx !== 'CC-BY-4.0')
    throw new Error(
      `Licence inattendue dans index.json : ${JSON.stringify(index.license?.spdx)} (seule CC-BY-4.0 est acceptée, jamais un jeu dérivé de Passport Index)`
    );
  const credit = index.attribution?.citation;
  if (credit !== `${CREDIT_PREFIX}${version}${EXPECTED_CREDIT_SUFFIX}`)
    throw new Error(`Crédit de l'éditeur inattendu pour la version ${version} : ${JSON.stringify(credit)}`);
  const cover = index.coverage;
  if (!cover || typeof cover !== 'object') throw new Error('Couverture absente du manifeste index.json');
  if (cover.matrixRows !== rows)
    throw new Error(`Le CSV compte ${rows} lignes, le manifeste en annonce ${cover.matrixRows} : fichier tronqué ou autre version, rien n'est écrit.`);
  if (cover.destinations !== destinations)
    throw new Error(`Le CSV compte ${destinations} destinations, le manifeste en annonce ${cover.destinations}.`);
  if (cover.passports !== passports)
    throw new Error(`Le CSV compte ${passports} passeports, le manifeste en annonce ${cover.passports}.`);
  return { version, credit };
}

/**
 * La table compacte et ses métadonnées, depuis le texte du CSV et le manifeste.
 * `fetched` : jour du téléchargement (AAAA-MM-JJ). `sha256` : empreinte des octets du
 * CSV ; calculée sur le texte quand elle n'est pas donnée.
 */
export function buildEntryRequirements(text, index, { fetched, sha256 } = {}) {
  if (!isRealDay(fetched ?? '')) throw new Error(`Date « fetched » absente ou mal formée : ${JSON.stringify(fetched)}`);
  // Un fichier enregistré par Excel ou Notepad peut commencer par un BOM UTF-8.
  const [head, ...rows] = csvRecords(text.replace(/^﻿/, ''));
  if (!head) throw new Error('CSV vide ou sans en-tête');
  const header = head.fields;
  const at = Object.fromEntries(
    COLUMNS.map((name) => {
      const i = header.indexOf(name);
      if (i < 0) throw new Error(`Colonne absente du CSV : ${name}`);
      return [name, i];
    })
  );

  const seen = new Set();
  const passports = new Set();
  const byDestination = new Map();
  let verifiedMin = null;
  let verifiedMax = null;
  for (const { line, fields } of rows) {
    const bad = (column, value) => new Error(`${column} invalide (${JSON.stringify(value)}), ligne ${line}`);
    if (fields.length !== header.length)
      throw new Error(`${fields.length} colonnes au lieu de ${header.length}, ligne ${line}`);
    const get = (name) => fields[at[name]].trim();
    const destination = get('destination_iso2');
    if (!ISO2.test(destination)) throw bad('destination_iso2', destination);
    const passport = get('passport_code');
    if (!ISO2.test(passport)) throw bad('passport_code', passport);
    const requirement = get('requirement');
    if (!REQUIREMENTS.includes(requirement)) throw bad('requirement inconnu', requirement);
    const stayText = get('max_stay_days');
    let stay = null;
    if (stayText !== '') {
      if (!INT.test(stayText) || Number(stayText) < 1 || Number(stayText) > 3650) throw bad('max_stay_days', stayText);
      stay = Number(stayText);
    }
    const basis = get('stay_window_basis');
    const windowDays = get('stay_window_days');
    let window = null;
    if (basis !== '') {
      if (!WINDOW_BASES.includes(basis)) throw bad('stay_window_basis', basis);
      if (basis === 'rolling') {
        if (!INT.test(windowDays) || Number(windowDays) < 1) throw bad('stay_window_days', windowDays);
        window = `rolling-${Number(windowDays)}`;
      } else {
        if (windowDays !== '' && !INT.test(windowDays)) throw bad('stay_window_days', windowDays);
        window = basis;
      }
    } else if (windowDays !== '') throw bad('stay_window_days sans stay_window_basis', windowDays);
    const verified = get('source_last_verified');
    if (!isRealDay(verified)) throw bad('source_last_verified', verified);
    const level = get('source_level');
    if (!LEVELS.includes(level)) throw bad('source_level', level);

    const key = `${destination}>${passport}`;
    if (seen.has(key)) throw new Error(`Le couple ${destination} × ${passport} revient deux fois, ligne ${line}`);
    seen.add(key);
    passports.add(passport);
    if (verifiedMin === null || verified < verifiedMin) verifiedMin = verified;
    if (verifiedMax === null || verified > verifiedMax) verifiedMax = verified;

    const group = [requirement, stay, window, verified];
    const groups = byDestination.get(destination) ?? new Map();
    const id = JSON.stringify(group);
    const entry = groups.get(id) ?? { group, passports: [] };
    entry.passports.push(passport);
    groups.set(id, entry);
    byDestination.set(destination, groups);
  }
  const { version, credit } = checkManifest(index, rows.length, byDestination.size, passports.size);

  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const table = {};
  for (const destination of [...byDestination.keys()].sort()) {
    table[destination] = [...byDestination.get(destination).values()]
      .sort(
        (a, b) =>
          compare(a.group[0], b.group[0]) ||
          compare(a.group[1] ?? 0, b.group[1] ?? 0) ||
          compare(a.group[2] ?? '', b.group[2] ?? '') ||
          compare(a.group[3], b.group[3])
      )
      .map(({ group, passports: list }) => [...group, list.sort().join(' ')]);
  }
  const meta = {
    source: 'TravelRequirements.info — Entry Requirements Dataset',
    version,
    url: DATA_URL,
    licence: 'CC BY 4.0',
    credit,
    fetched,
    verifiedMin,
    verifiedMax,
    rows: rows.length,
    destinations: byDestination.size,
    passports: passports.size,
    sha256: sha256 ?? createHash('sha256').update(text).digest('hex'),
  };
  return { table, meta };
}

/** Une destination par ligne (diff lisible). */
export function serializeTable(table) {
  return `{\n${Object.entries(table)
    .map(([destination, groups]) => `${JSON.stringify(destination)}:${JSON.stringify(groups)}`)
    .join(',\n')}\n}\n`;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage : node scripts/compas/build-entry-requirements.mjs /chemin/vers/visa-matrix.csv');
  const bytes = await readFile(file);
  const index = JSON.parse(await readFile(path.join(path.dirname(path.resolve(file)), 'index.json'), 'utf8'));
  const { table, meta } = buildEntryRequirements(bytes.toString('utf8'), index, {
    fetched: new Date().toISOString().slice(0, 10),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'entryRequirements.json'), serializeTable(table));
  await writeFile(path.join(OUT_DIR, 'entryRequirements.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.info(
    `${meta.rows} lignes (${meta.destinations} destinations, ${meta.passports} passeports) écrites dans ${path.relative(ROOT, OUT_DIR)}`
  );
}

// Lancé en ligne de commande (pas importé par un test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
