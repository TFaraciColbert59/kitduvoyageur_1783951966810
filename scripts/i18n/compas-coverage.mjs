/**
 * compas-coverage.mjs — Couverture i18n du Compas (PLAN-100, phase 6 « Monde »).
 *
 * Deux usages :
 *  - module importé par `tests/i18n/compas-coverage.spec.ts` : `findFrenchLiterals`
 *    repère une chaîne française restée en dur dans un fichier ; `flattenKeys`
 *    aplatit un dictionnaire en clés pointées ;
 *  - CLI (`node scripts/i18n/compas-coverage.mjs`) : inventaire des chaînes
 *    françaises restantes par fichier du Compas (pour planifier les lots).
 *
 * Heuristique assumée (pas un analyseur TypeScript) : texte JSX et littéraux de
 * chaînes, après retrait des commentaires, qui portent un accent, une
 * ponctuation française (’ « ») ou un mot français courant. Sont ignorés : les
 * imports, les chemins et URL, les clés `compas.…`, les valeurs d'attributs
 * techniques (`name`, `className`, `id`…) et toute ligne marquée `i18n-ok`.
 * Faux négatifs possibles (un mot isolé hors liste, sans accent).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fichiers dont les textes visibles sont extraits (lot 1). Ils doivent rester à zéro. */
export const COMPAS_I18N_FILES = [
  'src/features/compas/components/CompasStart.tsx',
  'src/features/compas/components/CompasPrep.tsx',
  'src/features/compas/components/CompasSkeleton.tsx',
  'src/features/compas/components/CompasText.tsx',
  'src/features/compas/components/TrialNote.tsx',
  'src/features/compas/components/AiNotice.tsx',
  'src/features/compas/components/GeoapifyCredit.tsx',
  'src/features/compas/components/CompasOuFlows.tsx',
  'src/features/compas/engine/request.ts',
  'src/features/compas/engine/compasI18n.ts',
  'src/features/compas/components/CompasScreen.tsx',
  'src/features/compas/components/CompasCards.tsx',
  'src/features/compas/components/compasTypes.ts',
  'src/features/compas/components/CompasMap.tsx',
  'src/features/compas/components/CompasPassage.tsx',
  'src/features/compas/components/CompasDisLe.tsx',
  'src/features/compas/components/CompasRuler.tsx',
  'src/features/compas/components/CompasItemHistory.tsx',
  'src/features/compas/components/CompasTripPicker.tsx',
  'src/features/compas/components/TripInvitations.tsx',
  'src/features/compas/components/CompasDecision.tsx',
  'src/features/compas/components/CompasMembers.tsx',
  'src/features/compas/components/CompasSheet.tsx',
  'src/features/compas/components/compasApply.ts',
  'src/features/compas/components/CompasAccessory.tsx',
  'src/features/compas/components/CompasRisks.tsx',
  'src/features/compas/components/CompasPrimitives.tsx',
  'src/features/compas/components/MeteoalarmNotice.tsx',
  'src/features/compas/components/OfficialAlertTexts.tsx',
];

const ACCENTED_RE = /[àâäéèêëîïôöùûüÿçœæÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇŒÆ’«»]/;

/** Mots français courants (sans accent) ; bornes de mot, insensibles à la casse. */
const FRENCH_WORDS = [
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'au',
  'aux',
  'et',
  'ou',
  'est',
  'ton',
  'ta',
  'tes',
  'mon',
  'ma',
  'mes',
  'votre',
  'vos',
  'notre',
  'nos',
  'pour',
  'dans',
  'avec',
  'sans',
  'sur',
  'sous',
  'par',
  'plus',
  'moins',
  'pas',
  'aucun',
  'aucune',
  'tout',
  'tous',
  'toute',
  'toutes',
  'rien',
  'encore',
  'jour',
  'jours',
  'nuit',
  'nuits',
  'personne',
  'personnes',
  'voyage',
  'aventure',
  'carte',
  'demande',
  'essai',
  'compte',
  'garder',
  'reprendre',
  'voir',
  'fait',
  'connecte',
  'trajet',
  'parcours',
  'budget',
  'envies',
  'lieu',
  'quand',
  'groupe',
];
const FRENCH_WORD_RE = new RegExp(`(?<![\\w-])(${FRENCH_WORDS.join('|')})(?![\\w-])`, 'i');

/** Attributs dont la valeur est technique (jamais lue par une personne). */
const TECHNICAL_ATTR_RE =
  /(?:\b(?:name|className|id|type|href|key|variant|role|rel|target|htmlFor|enterKeyHint|autoComplete|mode|src|data-[\w-]+|aria-(?:current|live|hidden|busy|describedby|expanded|pressed|controls))\s*=\s*\{?\s*)$/;

function looksFrench(text) {
  const value = text.trim();
  if (value.length < 2) return false;
  if (/^compas\.[\w.]+$/.test(value)) return false;
  if (/^(?:\/|https?:|@\/|\.{1,2}\/)/.test(value)) return false;
  return ACCENTED_RE.test(value) || FRENCH_WORD_RE.test(value);
}

/** Remplace les commentaires par des espaces (lignes conservées pour les numéros). */
function blankComments(source) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Chaînes françaises restées en dur dans une source TS/TSX.
 * @param {string} source
 * @returns {Array<{ line: number; text: string }>}
 */
export function findFrenchLiterals(source) {
  const lines = source.split('\n');
  const code = blankComments(source);
  const hits = [];
  const push = (index, text) => {
    const line = lineAt(code, index);
    const raw = lines[line - 1] ?? '';
    if (raw.includes('i18n-ok') || /^\s*import\b/.test(raw)) return;
    if (!looksFrench(text)) return;
    hits.push({ line, text: text.trim().replace(/\s+/g, ' ').slice(0, 120) });
  };
  // Texte JSX entre deux balises (multi-ligne), sans expression.
  for (const m of code.matchAll(/>([^<>{}]+)</g)) push(m.index + 1, m[1]);
  // Littéraux de chaînes (une ligne) et gabarits.
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (const m of code.matchAll(literal)) {
    const before = code.slice(Math.max(0, m.index - 60), m.index);
    if (TECHNICAL_ATTR_RE.test(before)) continue;
    push(m.index, m[1] ?? m[2] ?? m[3] ?? '');
  }
  // Une même chaîne peut être vue deux fois (texte JSX contenant une apostrophe) : dédoublonnée.
  const seen = new Set();
  return hits
    .filter((h) => {
      const k = `${h.line}:${h.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.line - b.line);
}

/**
 * Aplatit un dictionnaire en `{ 'a.b.c': 'texte' }`.
 * @param {Record<string, unknown>} dict
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
export function flattenKeys(dict, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(dict)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else if (value && typeof value === 'object') Object.assign(out, flattenKeys(value, full));
  }
  return out;
}

/** Placeholders `{var}` d'un gabarit, triés. */
export function placeholders(template) {
  return [...template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
}

function listFiles(root, dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts'))
    .map((e) => `${dir}/${e.name}`);
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const groups = [
    ['Composants', 'src/features/compas/components'],
    ['Serveur', 'src/features/compas/server'],
    ['Moteur', 'src/features/compas/engine'],
  ];
  for (const [title, dir] of groups) {
    const rows = listFiles(root, dir)
      .map((file) => ({
        file,
        count: findFrenchLiterals(fs.readFileSync(path.join(root, file), 'utf8')).length,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    const total = rows.reduce((s, r) => s + r.count, 0);
    console.info(`\n## ${title} (${dir}) : ${rows.length} fichiers, ${total} chaînes`);
    for (const r of rows) console.info(`${String(r.count).padStart(5)}  ${r.file}`);
  }
  const lot = COMPAS_I18N_FILES.map((file) => ({
    file,
    hits: fs.existsSync(path.join(root, file))
      ? findFrenchLiterals(fs.readFileSync(path.join(root, file), 'utf8'))
      : [],
  }));
  const left = lot.filter((l) => l.hits.length > 0);
  console.info(
    `\nLot 1 : ${left.length === 0 ? 'aucune chaîne française en dur' : `${left.length} fichiers à reprendre`}`
  );
  for (const l of left) for (const h of l.hits) console.info(`  ${l.file}:${h.line}  ${h.text}`);
  if (left.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
