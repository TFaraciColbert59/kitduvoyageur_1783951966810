#!/usr/bin/env node
/**
 * VERROU DE VIE PRIVÉE — profil voyageur du Compas (PLAN-100 4.1, lot P)
 * =====================================================================
 * Nationalité, pays de résidence et domicile ne sortent jamais du serveur, sauf
 * vers la personne elle-même. Ce verrou casse le build (`prebuild`), la CI (Gate 0,
 * via identity_compliance.mjs) et `npm test` (travellerPrivacy.test.ts) si :
 *   1. la table user_traveller est nommée hors du lecteur et de l'export RGPD ;
 *   2. le lecteur `server/traveller` est importé hors du serveur du Compas et des
 *      deux pages serveur qui montrent le profil à la personne (jamais par un
 *      fichier 'use client') ;
 *   3. les actions `server/travellerActions` sont importées hors de src/components/identity ;
 *   4. la carte `TravellerCard` est montée ailleurs que /compte/voyageur et le Compas vide ;
 *   5. l'IA, les kits, les voyages partagés, les profils publics ou les routes API
 *      importent le contexte voyageur (`engine/traveller`) ;
 *   6. le lecteur ou les actions écrivent dans la console (aucun journal) ;
 *   7. la ligne « Papiers » d'une nationalité (`readerPapersNotes`, `notesForReader`) est
 *      nommée ailleurs que dans le moteur des papiers et la lecture du Compas
 *      (`getCompasData`) : le voyage (`trips.metadata`, lisible par les collaborateurs et,
 *      public, par tous) ne garde que la ligne SANS nationalité (`sharedPapersNotes`) ;
 *   8. une note de papiers brute de `travelPapers(...)` (`papers.notes`, qui porte la ligne de
 *      la nationalité) est reprise telle quelle dans le serveur du Compas : seulement
 *      filtrée de sa ligne « Papiers » (`papers.notes.filter(`) ;
 *   9. (lot Z1) un calcul qui lit le PROFIL pour fabriquer une ligne ou un montant (`abroadCosts`,
 *      `formalitiesBasis`, `entryFees`, `frenchDevices`, `travelPapers`, `isFrenchNational`,
 *      `readerFormalities`, `readerPlugsNotes`) est nommé hors de son moteur et de la lecture
 *      (`getCompasData`) : la préparation (`autofillActions`) ne range que des lignes sans profil ;
 *  10. (lot Z1) un conseil de l'IA est filtré (`keepAiNote`) avec d'autres règles que celles SANS
 *      profil (`sharedRules`) : sa présence trahirait la devise ou la résidence du lanceur ;
 *  11. (lot Z1) l'écriture du voyage (un fichier de `server/` hors lecture qui lit le profil) lit du profil autre que le fuseau
 *      (`traveller.timeZone`) et le départ (`traveller.home`, un fait du voyage choisi par le
 *      lanceur), ou passe le profil entier à une fonction (`traveller` en argument ou en `...`) ;
 *  12. (lot Z1) la consigne envoyée à l'IA (`buildCompasAutofillSystem`) reçoit un réglage : un
 *      tiers ne reçoit jamais la nationalité, même sous forme de règle.
 * Marche de fichiers en Node, sans `rg` : un outil absent ne fait jamais passer à vide.
 *
 * Usage : node scripts/verify/traveller_privacy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TABLE = 'user_traveller';
const READER = 'src/features/compas/server/traveller';
const ACTIONS = 'src/features/compas/server/travellerActions';
const CARD = 'src/components/identity/TravellerCard';
const ENGINE = 'src/features/compas/engine/traveller';

const TABLE_ALLOWED = new Set(['src/features/compas/server/traveller.ts', 'src/server/gdprExport.ts']);
const READER_PAGES = new Set(['src/app/compas/page.tsx', 'src/app/compte/voyageur/page.tsx']);
const CARD_ALLOWED = new Set(['src/app/compte/voyageur/page.tsx', 'src/features/compas/components/CompasStart.tsx']);
const ENGINE_FORBIDDEN = ['src/lib/ai/', 'src/features/kits/', 'src/features/trips/', 'src/app/k/', 'src/app/profil/', 'src/app/api/'];
const SILENT = new Set(['src/features/compas/server/traveller.ts', 'src/features/compas/server/travellerActions.ts']);
const PAPERS_READ_ALLOWED = new Set(['src/features/compas/engine/papers.ts', 'src/features/compas/server/getCompasData.ts']);
const PAPERS_READ_NAMES = /\b(?:readerPapersNotes|readerPlugsNotes|notesForReader)\b/;
const RAW_PAPERS_NOTES = /\bpapers\.notes\b(?!\s*\.filter\()/;

// Lot Z1 : les calculs qui lisent le profil, et les seuls fichiers qui peuvent les nommer.
const COSTS = 'src/features/compas/engine/costs.ts';
const FORMALITIES = 'src/features/compas/engine/formalities.ts';
const PAPERS = 'src/features/compas/engine/papers.ts';
const TRAVEL = 'src/features/compas/engine/travel.ts';
const READ_DATA = 'src/features/compas/server/getCompasData.ts';
const PROFILE_CALCS = {
  abroadCosts: new Set([TRAVEL, FORMALITIES]),
  formalitiesBasis: new Set([COSTS, FORMALITIES]),
  entryFees: new Set([COSTS, PAPERS, FORMALITIES]),
  frenchDevices: new Set([PAPERS]),
  travelPapers: new Set([PAPERS]),
  isFrenchNational: new Set(['src/features/compas/engine/traveller.ts']),
  readerFormalities: new Set([FORMALITIES, READ_DATA]),
  readerPlugsNotes: new Set([PAPERS, READ_DATA]),
};
const SERVER_DIR = 'src/features/compas/server/';
const SERVER_READ_SIDE = new Set([READ_DATA, `${SERVER_DIR}traveller.ts`, `${SERVER_DIR}travellerActions.ts`]);
/** Ce que l'écriture du voyage peut encore lire du profil : le fuseau (« aujourd'hui ») et le départ. */
const WRITE_PROFILE_FIELDS = new Set(['timeZone', 'home']);
const AI_SYSTEM_WITH_ARGUMENT = /\bbuildCompasAutofillSystem\s*\(\s*[^)\s]/;

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const TEST_FILE = /\.(?:test|spec)\.[jt]sx?$/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(abs, out);
    } else if (CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

/** Le code sans les lignes de commentaire ni les commentaires de fin de ligne (les lignes restent alignées). */
function codeOf(text) {
  return text
    .split('\n')
    .map((line) => (/^\s*(?:\/\/|\/?\*)/.test(line) ? '' : line.replace(/(^|\s)\/\/.*$/, '$1')))
    .join('\n');
}

/** Les arguments de premier niveau de l'appel dont la parenthèse ouvrante est à `open`. */
function callArguments(code, open) {
  const args = [];
  let depth = 0;
  let quote = null;
  let from = open + 1;
  for (let i = open; i < code.length; i += 1) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) {
        args.push(code.slice(from, i).trim());
        return args;
      }
    } else if (c === ',' && depth === 1) {
      args.push(code.slice(from, i).trim());
      from = i + 1;
    }
  }
  return args;
}

/** Module visé par un import, sans extension (« @/x » = « src/x ») ; null pour un paquet. */
function target(file, spec) {
  let t;
  if (spec.startsWith('@/')) t = `src/${spec.slice(2)}`;
  else if (spec.startsWith('./') || spec.startsWith('../')) t = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  else return null;
  return t.replace(/\.(?:tsx?|jsx?|mjs)$/, '').replace(/\/index$/, '');
}

/** Les violations du verrou sous `root/src` (chemins relatifs à `root`), [] si conforme. */
export function travellerPrivacyViolations(root = process.cwd()) {
  const out = [];
  for (const abs of walk(path.join(root, 'src'), []).sort()) {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');
    const client = /^\s*['"]use client['"]/.test(text);
    if (text.includes(TABLE) && !TABLE_ALLOWED.has(file)) out.push(`table ${TABLE} nommée hors du lecteur : ${file}`);
    if (SILENT.has(file) && /\bconsole\./.test(text)) out.push(`journal interdit dans ${file}`);
    if (PAPERS_READ_NAMES.test(text) && !PAPERS_READ_ALLOWED.has(file)) out.push(`ligne « Papiers » d'une nationalité nommée hors de la lecture : ${file}`);
    if (file.startsWith('src/features/compas/server/') && RAW_PAPERS_NOTES.test(text))
      out.push(`notes de papiers brutes (nationalité) reprises dans ${file}`);
    const code = codeOf(text);
    for (const [name, allowed] of Object.entries(PROFILE_CALCS))
      if (new RegExp(`\\b${name}\\b`).test(code) && !allowed.has(file))
        out.push(`calcul dépendant du profil (${name}) nommé hors de son moteur et de la lecture : ${file}`);
    if (file.startsWith(SERVER_DIR) && !SERVER_READ_SIDE.has(file) && /\breadTraveller(?:State)?\b/.test(code)) {
      for (const m of code.matchAll(/(?<![\w./])traveller\??\.(\w+)/g))
        if (!WRITE_PROFILE_FIELDS.has(m[1])) out.push(`valeur du profil (traveller.${m[1]}) lue dans l'écriture du voyage : ${file}`);
      // Le profil entier ne circule pas : seule sa déclaration (`[..., traveller] = await Promise.all`) le nomme seul.
      for (const m of code.matchAll(/(?<![\w/])(?<![^.]\.)traveller\b(?!\s*\??\.)/g))
        if (code.slice(m.index + m[0].length).trimStart()[0] !== ']')
          out.push(`profil voyageur passé tel quel dans l'écriture du voyage : ${file}`);
    }
    if (file.startsWith(SERVER_DIR)) {
      for (const m of code.matchAll(/\bkeepAiNote\s*\(/g)) {
        const second = callArguments(code, m.index + m[0].length - 1)[1] ?? '';
        if (second !== 'aiRules' && !second.startsWith('sharedRules('))
          out.push(`conseil de l'IA filtré avec d'autres règles que celles sans profil (sharedRules) dans ${file}`);
      }
      for (const m of code.matchAll(/\baiRules\s*=\s*([^;\n]*)/g))
        if (!m[1].trim().startsWith('sharedRules(')) out.push(`aiRules ne vient pas de sharedRules dans ${file}`);
    }
    if (AI_SYSTEM_WITH_ARGUMENT.test(code)) out.push(`consigne de l'IA réglée par un argument (la nationalité ne part pas à un tiers) : ${file}`);
    for (const m of text.matchAll(IMPORT_RE)) {
      const t = target(file, m[1]);
      if (!t) continue;
      const serverSide = file.startsWith('src/features/compas/server/') || READER_PAGES.has(file);
      if (t === READER && (client || !serverSide)) out.push(`lecteur du profil voyageur importé par ${file}`);
      if (t === ACTIONS && !file.startsWith('src/components/identity/')) out.push(`actions du profil voyageur importées par ${file}`);
      if (t === CARD && !CARD_ALLOWED.has(file)) out.push(`carte du profil voyageur montée dans ${file}`);
      if (t === ENGINE && ENGINE_FORBIDDEN.some((p) => file.startsWith(p))) out.push(`contexte voyageur importé par ${file}`);
    }
  }
  return [...new Set(out)];
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const violations = travellerPrivacyViolations();
  if (violations.length) {
    for (const v of violations) console.error(`✗ ${v}`);
    console.error(`\n✗ VIE PRIVÉE : ${violations.length} violation(s) du profil voyageur.`);
    process.exit(1);
  }
  console.info('✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).');
}
