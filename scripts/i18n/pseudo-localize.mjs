/**
 * pseudo-localize.mjs — Génère une variante pseudo-localisée du dictionnaire EN.
 *
 * Objectif : tester les débordements (+40 %) et repérer les chaînes non
 * externalisées, sans nouvelle dépendance ni rendu pixel.
 *
 * - accents : chaque lettre ASCII est remplacée par un homoglyphe accentué ;
 * - expansion : ~40 % de caractères de remplissage « · » ajoutés en fin ;
 * - les placeholders `{var}` sont préservés à l'identique.
 *
 * Exécution :
 *   npx tsx scripts/i18n/pseudo-localize.mjs   (ou `node` ≥ 23.6, TS natif)
 * Sortie : docs/i18n/pseudo-en.json + résumé console.
 *
 * Les fonctions pures sont exportées pour le test Vitest
 * (tests/i18n/pseudo-localization.spec.ts).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXPANSION_RATIO = 0.4;

const ACCENT_MAP = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í',
  j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ',
  s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
};

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;
const MARKER_RE = /\u0000(\d+)\u0000/g;

/** Accentue une chaîne sans toucher aux placeholders `{var}`. */
export function accentText(value) {
  const placeholders = [];
  const marked = value.replace(PLACEHOLDER_RE, (placeholder) => {
    placeholders.push(placeholder);
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  const accented = marked.replace(/[a-zA-Z]/g, (char) => {
    const lower = char.toLowerCase();
    const accentedChar = ACCENT_MAP[lower];
    if (!accentedChar) return char;
    return char === lower ? accentedChar : accentedChar.toUpperCase();
  });
  return accented.replace(MARKER_RE, (_, index) => placeholders[Number(index)]);
}

/** Chaîne pseudo-localisée : accents + expansion ~40 %. */
export function pseudoLocalizeText(value, { expansion = EXPANSION_RATIO } = {}) {
  if (typeof value !== 'string' || value.length === 0) return value;
  const accented = accentText(value);
  const fillerLength = Math.max(0, Math.ceil(value.length * expansion));
  return `${accented}${'·'.repeat(fillerLength)}`;
}

/** Applique la pseudo-localisation à toutes les chaînes d'un dictionnaire. */
export function pseudoLocalizeDictionary(dictionary, options) {
  if (typeof dictionary === 'string') {
    return pseudoLocalizeText(dictionary, options);
  }
  if (Array.isArray(dictionary)) {
    return dictionary.map((item) => pseudoLocalizeDictionary(item, options));
  }
  if (dictionary && typeof dictionary === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(dictionary)) {
      result[key] = pseudoLocalizeDictionary(value, options);
    }
    return result;
  }
  return dictionary;
}

/** Aplatit un dictionnaire en `{ 'section.cle': valeur }`. */
export function flattenDictionary(dictionary, prefix = '') {
  const flat = {};
  for (const [key, value] of Object.entries(dictionary ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, flattenDictionary(value, path));
    } else {
      flat[path] = value;
    }
  }
  return flat;
}

/** Liste des placeholders `{var}` d'une chaîne (dans l'ordre d'apparition). */
export function extractPlaceholders(value) {
  return typeof value === 'string' ? (value.match(PLACEHOLDER_RE) ?? []) : [];
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

async function main() {
  const root = repoRoot();
  let en;
  try {
    ({ en } = await import(
      pathToFileURL(path.join(root, 'src/lib/i18n/translations/en.ts')).href
    ));
  } catch (error) {
    console.error(
      '[i18n] Import TS impossible avec ce runtime. Utilisez : npx tsx scripts/i18n/pseudo-localize.mjs'
    );
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const pseudo = pseudoLocalizeDictionary(en);
  const flatEn = flattenDictionary(en);
  const flatPseudo = flattenDictionary(pseudo);
  const keys = Object.keys(flatEn);
  const expanded = keys.filter(
    (key) =>
      typeof flatEn[key] === 'string' &&
      flatEn[key].length > 0 &&
      flatPseudo[key].length >= Math.ceil(flatEn[key].length * (1 + EXPANSION_RATIO))
  );

  const outDir = path.join(root, 'docs', 'i18n');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'pseudo-en.json');
  fs.writeFileSync(outFile, JSON.stringify(pseudo, null, 2) + '\n', 'utf8');

  console.log(`[i18n] ${keys.length} clés pseudo-localisées (EN).`);
  console.log(`[i18n] ${expanded.length}/${keys.length} clés respectent +${EXPANSION_RATIO * 100} %.`);
  console.log(`[i18n] Écrit : ${path.relative(root, outFile)}`);
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  await main();
}
