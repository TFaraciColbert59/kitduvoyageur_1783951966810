// Compas v5 : fabrique les dictionnaires `compas.v5.*` des cinq langues à partir des fichiers JSON de
// `src/features/compas/v5/i18n/`. Un fichier JSON par zone (top, card, nous, budget, sac…), pour que
// plusieurs personnes ou agents écrivent en parallèle sans se marcher dessus.
//
//   node scripts/compas/build-v5-i18n.mjs          écrit src/lib/i18n/translations/compas-v5.<langue>.ts
//   node scripts/compas/build-v5-i18n.mjs --check  échoue si les fichiers écrits ne sont pas à jour
//
// Format d'un fichier : { "<zone>": { "<clé>": { "fr": "…", "en": "…", "es": "…", "de": "…", "it": "…" },
//   "<sous-groupe>": { "<clé>": { … } } } }. Les clés se lisent `compas.v5.<zone>.<clé>`. Pluriels : `…One` et
// `…Other`, comme le reste du Compas. Les {variables} sont les mêmes dans les cinq langues.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src/features/compas/v5/i18n');
const OUT = path.join(ROOT, 'src/lib/i18n/translations');
const LANGS = ['fr', 'en', 'es', 'de', 'it'];
const CAP = (l) => l[0].toUpperCase() + l.slice(1);
const check = process.argv.includes('--check');

const isLeaf = (v) => v && typeof v === 'object' && LANGS.some((l) => typeof v[l] === 'string');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const errors = [];

function merge(target, source, trail) {
  for (const [k, v] of Object.entries(source)) {
    const at = [...trail, k];
    if (isLeaf(v)) {
      if (k in target) errors.push(`clé en double : ${at.join('.')}`);
      for (const l of LANGS) {
        if (typeof v[l] !== 'string' || !v[l].trim()) errors.push(`${at.join('.')} : « ${l} » manquant ou vide`);
      }
      if (typeof v.fr === 'string') {
        const ph = placeholders(v.fr);
        for (const l of LANGS.slice(1)) if (typeof v[l] === 'string' && placeholders(v[l]) !== ph) errors.push(`${at.join('.')} : variables différentes en ${l}`);
      }
      target[k] = Object.fromEntries(LANGS.map((l) => [l, String(v[l] ?? '').replace(/'/g, '’')]));
    } else if (v && typeof v === 'object') {
      target[k] ??= {};
      merge(target[k], v, at);
    } else errors.push(`${at.join('.')} : forme inattendue`);
  }
}

const tree = {};
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort() : [];
for (const f of files) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  } catch (e) {
    errors.push(`${f} : JSON invalide (${e.message})`);
    continue;
  }
  merge(tree, json, []);
}
if (errors.length) {
  console.error('[i18n v5] ' + errors.length + ' problème(s) :\n - ' + errors.slice(0, 40).join('\n - '));
  process.exit(1);
}

const pick = (node, lang) => {
  if (LANGS.every((l) => typeof node[l] === 'string') && Object.keys(node).every((k) => LANGS.includes(k))) return node[lang];
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = pick(v, lang);
  return out;
};
const ser = (value, indent = 2) => {
  const pad = ' '.repeat(indent);
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  const entries = Object.entries(value);
  return `{\n${entries.map(([k, v]) => `${pad}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${ser(v, indent + 2)},`).join('\n')}\n${' '.repeat(indent - 2)}}`;
};

let stale = false;
for (const lang of LANGS) {
  const body = ser({ v5: pick(tree, lang) }, 2);
  const text = `// Fichier généré par scripts/compas/build-v5-i18n.mjs à partir de src/features/compas/v5/i18n/*.json : ne pas modifier.\nexport const compasV5${CAP(lang)} = ${body};\n`;
  const file = path.join(OUT, `compas-v5.${lang}.ts`);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) stale = true;
  } else fs.writeFileSync(file, text);
}
if (check && stale) {
  console.error('[i18n v5] dictionnaires pas à jour : lancer `node scripts/compas/build-v5-i18n.mjs`');
  process.exit(1);
}
console.log(`[i18n v5] ${files.length} fichier(s), ${Object.keys(tree).length} zone(s)`);
