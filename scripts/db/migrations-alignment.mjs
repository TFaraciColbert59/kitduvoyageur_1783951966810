#!/usr/bin/env node
/**
 * Alignement dépôt ↔ registre des migrations (PLAN-100, phase 9).
 *
 * LECTURE SEULE. Ce script ne se connecte à aucune base : il compare
 * `supabase/migrations/*.sql` à un EXPORT du registre de production
 * (`supabase_migrations.schema_migrations`) que Tony produit lui-même :
 *
 *   SQL Editor :
 *     select version || ',' || coalesce(name, '') from supabase_migrations.schema_migrations order by version;
 *   (exporter le résultat en CSV), ou bien :
 *     PROD_DB_URL=… node scripts/db/fetch-prod-ledger.mjs registre.txt   (versions seules)
 *
 * Usage :
 *   node scripts/db/migrations-alignment.mjs <export-du-registre> [--strict]
 *
 * Formats d'export acceptés, une ligne par migration : `version`, `version,nom`,
 * `version;nom`, `version<TAB>nom`, `version|nom` (une ligne d'en-tête ou des
 * guillemets sont ignorés). Avec `--strict`, le code de sortie vaut 1 dès qu'un
 * écart existe (aucun effet sur la base dans tous les cas).
 *
 * Catégories :
 *   - `aligned`          : version présente des deux côtés ;
 *   - `renumbered`       : même nom des deux côtés, versions différentes (typique d'un
 *                          `apply_migration` du connecteur, qui inscrit l'heure
 *                          d'application) → renommer le FICHIER à la version du registre ;
 *   - `repoOnly`         : fichier sans ligne au registre → jamais appliqué, ou appliqué
 *                          sous un autre nom (à vérifier objet par objet avant tout push) ;
 *   - `registryOnly`     : ligne au registre sans fichier → correctif passé en direct ou
 *                          version fantôme (à reconstruire en `<version>_hotfix.sql`
 *                          depuis `statements`, ou à documenter) ;
 *   - `parkedInRegistry` : version d'un fichier de `migrations_deferred/` ou
 *                          `migrations_frozen/` déjà inscrite au registre (à signaler).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = /^\d{14}$/;

/** `20261012100000_adventure_events_claim_lease.sql` → { version, name }. */
export function parseMigrationFile(fileName) {
  const base = fileName.replace(/\.sql$/, '');
  const i = base.indexOf('_');
  if (i < 0) return null;
  const version = base.slice(0, i);
  if (!VERSION.test(version)) return null;
  return { version, name: base.slice(i + 1), file: fileName };
}

/** Une ligne d'export du registre → { version, name } (name = '' si absent). */
export function parseRegistryLine(line) {
  const clean = line.replace(/"/g, '').trim();
  if (!clean) return null;
  const [version, ...rest] = clean.split(/[,;\t|]/);
  const v = version.trim();
  if (!VERSION.test(v)) return null; // en-tête, commentaire, ligne vide
  return { version: v, name: rest.join(' ').trim() };
}

/** Nom comparable : casse et séparateurs ignorés. */
function key(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Compare les fichiers du dépôt au registre. Pur et déterministe.
 * @param {{version:string,name:string,file?:string}[]} repo
 * @param {{version:string,name:string}[]} registry
 * @param {string[]} parkedVersions versions des dossiers deferred/frozen
 */
export function compareLedger(repo, registry, parkedVersions = []) {
  const registryByVersion = new Map(registry.map((r) => [r.version, r]));
  const repoByVersion = new Map(repo.map((r) => [r.version, r]));

  const aligned = repo.filter((r) => registryByVersion.has(r.version)).map((r) => r.version);
  const repoMissing = repo.filter((r) => !registryByVersion.has(r.version));
  const registryMissing = registry.filter((r) => !repoByVersion.has(r.version));

  // Même nom, versions différentes : seulement si le nom est unique de chaque côté.
  const count = (list) => {
    const m = new Map();
    for (const r of list) if (r.name) m.set(key(r.name), (m.get(key(r.name)) ?? 0) + 1);
    return m;
  };
  const repoNames = count(repoMissing);
  const regNames = count(registryMissing);
  const renumbered = [];
  const usedReg = new Set();
  for (const r of repoMissing) {
    const k = key(r.name);
    if (!k || k === 'hotfix' || repoNames.get(k) !== 1 || regNames.get(k) !== 1) continue;
    const match = registryMissing.find((g) => key(g.name) === k);
    if (match) {
      renumbered.push({ name: r.name, repoVersion: r.version, registryVersion: match.version, file: r.file });
      usedReg.add(match.version);
    }
  }
  const renumberedRepo = new Set(renumbered.map((r) => r.repoVersion));

  const parked = new Set(parkedVersions);
  return {
    aligned,
    renumbered,
    repoOnly: repoMissing.filter((r) => !renumberedRepo.has(r.version)),
    registryOnly: registryMissing.filter((r) => !usedReg.has(r.version)),
    parkedInRegistry: registry.filter((r) => parked.has(r.version)).map((r) => r.version),
  };
}

function listVersions(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .map(parseMigrationFile)
    .filter(Boolean);
}

function main(argv) {
  const exportPath = argv.find((a) => !a.startsWith('--'));
  const strict = argv.includes('--strict');
  if (!exportPath) {
    console.error('Usage : node scripts/db/migrations-alignment.mjs <export-du-registre> [--strict]');
    return 2;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const repo = listVersions(path.join(root, 'supabase/migrations'));
  const parkedVersions = [
    ...listVersions(path.join(root, 'supabase/migrations_deferred')),
    ...listVersions(path.join(root, 'supabase/migrations_frozen')),
  ].map((m) => m.version);
  const registry = readFileSync(exportPath, 'utf8').split(/\r?\n/).map(parseRegistryLine).filter(Boolean);
  if (registry.length === 0) {
    console.error(`Aucune version lue dans ${exportPath} : export vide ou format inconnu.`);
    return 2;
  }
  const hasNames = registry.some((r) => r.name);
  const res = compareLedger(repo, registry, parkedVersions);

  console.info(`Dépôt : ${repo.length} fichiers · registre : ${registry.length} lignes · alignées : ${res.aligned.length}`);
  if (!hasNames) console.info('(export sans noms : les migrations renumérotées ne peuvent pas être reconnues)');
  const section = (title, rows, fmt) => {
    console.info(`\n${title} : ${rows.length}`);
    for (const r of rows) console.info(`  ${fmt(r)}`);
  };
  section('Même nom, version différente (renommer le fichier à la version du registre)', res.renumbered,
    (r) => `${r.file} → ${r.registryVersion}_${r.name}.sql`);
  section('Fichiers du dépôt absents du registre (non appliqués, ou appliqués sous un autre nom)', res.repoOnly,
    (r) => r.file);
  section('Lignes du registre sans fichier (correctif en direct ou version fantôme)', res.registryOnly,
    (r) => `${r.version}${r.name ? ` ${r.name}` : ''}`);
  section('Versions mises de côté (deferred / frozen) déjà au registre', res.parkedInRegistry, (v) => v);

  const gaps = res.renumbered.length + res.repoOnly.length + res.registryOnly.length + res.parkedInRegistry.length;
  console.info(gaps === 0 ? '\nAucun écart.' : `\n${gaps} écart(s). Rien n'a été modifié.`);
  return strict && gaps > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
