#!/usr/bin/env node
/**
 * LKDV cleanup quarantine — DRY RUN par défaut.
 *
 * Ne supprime jamais rien : déplace un fichier **suivi par git** vers
 * `.cleanup-trash/<timestamp>/<chemin d'origine>/`, écrit un manifeste
 * (sha256, taille, blob git) et fournit la commande de restauration exacte.
 *
 * Usage :
 *   node scripts/cleanup/quarantine.mjs --paths a.ts,b.ts --reason "code mort prouvé"
 *   node scripts/cleanup/quarantine.mjs --paths a.ts --reason "…" --apply
 *   node scripts/cleanup/quarantine.mjs --restore 2026-10-31T15-00-00-000Z
 *   node scripts/cleanup/quarantine.mjs --paths a.ts --reason "…" --json
 *
 * Garde-fous :
 *  - refuse les chemins absolus, `..`, les racines protégées (.git, node_modules,
 *    .next, supabase/migrations) et tout fichier non suivi par git ;
 *  - refuse un fichier déjà modifié dans l'arbre de travail (travail en cours) ;
 *  - `--apply` exige `--reason` et la confirmation exacte `--yes` ;
 *  - aucune suppression définitive n'est possible depuis ce script.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TRASH_DIR = '.cleanup-trash';
const PROTECTED = ['.git', 'node_modules', '.next', '.turbo', 'supabase/migrations'];
const FORBIDDEN_EXACT = new Set(['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

class UsageError extends Error {}
class RefusalError extends Error {}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { maxBuffer: 100 * 1024 * 1024 });
}

function gitOutput(root, args) {
  return git(root, args).toString('utf8');
}

/** Liste des fichiers suivis par git. */
export function trackedPaths(root) {
  return gitOutput(root, ['ls-files', '-z']).split('\0').filter(Boolean);
}

/** Vrai si `rel` est dans une racine protégée (ou est un fichier protégé). */
export function isProtectedPath(rel) {
  if (!rel) return true;
  if (FORBIDDEN_EXACT.has(rel)) return true;
  return PROTECTED.some((entry) => rel === entry || rel.startsWith(`${entry}/`));
}

/** Normalise et valide un chemin fourni en ligne de commande. */
export function normalizeRelativePath(root, raw) {
  if (typeof raw !== 'string' || raw.trim() === '') throw new UsageError('chemin vide');
  if (isAbsolute(raw)) throw new RefusalError(`chemin absolu refusé : ${raw}`);
  const absolute = resolve(root, raw);
  const rel = relative(root, absolute);
  if (rel.startsWith('..') || rel === '' || isAbsolute(rel)) {
    throw new RefusalError(`chemin hors du dépôt refusé : ${raw}`);
  }
  return rel.split(sep).join('/');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Prépare un plan de quarantaine sans rien déplacer.
 * Lève `RefusalError` dès qu'un chemin est protégé, non suivi ou modifié.
 */
export function planQuarantine({ root = DEFAULT_ROOT, paths = [], reason, now = new Date() } = {}) {
  const base = resolve(root);
  if (!reason || String(reason).trim().length < 8) {
    throw new UsageError('--reason est obligatoire (>= 8 caractères) : tracez la preuve d’inutilisation');
  }
  if (!Array.isArray(paths) || paths.length === 0) throw new UsageError('--paths est obligatoire');

  const tracked = new Set(trackedPaths(base));
  const status = gitOutput(base, ['status', '--porcelain', '-z']).split('\0').filter(Boolean);
  const dirty = new Set(status.map((line) => line.slice(3)));
  const items = [];
  const seen = new Set();

  for (const raw of paths) {
    const rel = normalizeRelativePath(base, raw);
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (isProtectedPath(rel)) throw new RefusalError(`chemin protégé refusé : ${rel}`);
    if (!tracked.has(rel)) throw new RefusalError(`fichier non suivi par git (travail en cours ou chemin faux) : ${rel}`);
    if (dirty.has(rel)) throw new RefusalError(`fichier modifié dans l’arbre de travail : ${rel} (ne pas toucher au chantier en cours)`);
    const absolute = join(base, rel);
    if (!existsSync(absolute)) throw new RefusalError(`fichier absent du disque : ${rel} (déjà quarantiné ?)`);
    const buffer = readFileSync(absolute);
    const blob = gitOutput(base, ['hash-object', '--', rel]).trim();
    items.push({ path: rel, bytes: buffer.length, sha256: sha256(buffer), gitBlob: blob });
  }

  const stamp = timestampSlug(now);
  const targetRoot = `${TRASH_DIR}/${stamp}`;
  return {
    stamp,
    targetRoot,
    reason: String(reason).trim(),
    createdAt: now.toISOString(),
    items: items.map((item) => ({ ...item, quarantinePath: `${targetRoot}/${item.path}` })),
    manifestPath: `${targetRoot}/manifest.json`,
    restoreCommand: `node scripts/cleanup/quarantine.mjs --restore ${stamp}`,
  };
}

function manifestMarkdown(plan) {
  const lines = [
    `# Quarantaine ${plan.stamp}`,
    '',
    `- Date : ${plan.createdAt}`,
    `- Raison : ${plan.reason}`,
    `- Restauration : \`${plan.restoreCommand}\``,
    '',
    '| Fichier | Octets | sha256 | Blob git |',
    '|---|---|---|---|',
    ...plan.items.map(
      (item) => `| \`${item.path}\` | ${item.bytes} | \`${item.sha256.slice(0, 16)}…\` | \`${item.gitBlob.slice(0, 12)}…\` |`,
    ),
    '',
    'Aucune suppression définitive : les fichiers sont déplacés, jamais effacés.',
  ];
  return `${lines.join('\n')}\n`;
}

/** Applique le plan : déplace les fichiers et écrit le manifeste. */
export function applyQuarantine(plan, { root = DEFAULT_ROOT } = {}) {
  const base = resolve(root);
  mkdirSync(join(base, plan.targetRoot), { recursive: true });
  for (const item of plan.items) {
    const from = join(base, item.path);
    const to = join(base, item.quarantinePath);
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
  }
  const manifest = { ...plan, state: 'applied' };
  writeFileSync(join(base, plan.manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(base, plan.targetRoot, 'MANIFEST.md'), manifestMarkdown(manifest));
  return manifest;
}

/** Restaure une quarantaine : vérifie les hashes avant de replacer les fichiers. */
export function restoreQuarantine({ root = DEFAULT_ROOT, stamp } = {}) {
  const base = resolve(root);
  if (!stamp || !/^[0-9TZ-]+$/.test(stamp)) throw new UsageError('--restore attend un timestamp du manifeste');
  const manifestPath = join(base, TRASH_DIR, stamp, 'manifest.json');
  if (!existsSync(manifestPath)) throw new RefusalError(`manifeste introuvable : ${TRASH_DIR}/${stamp}/manifest.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const restored = [];
  for (const item of manifest.items) {
    const from = join(base, item.quarantinePath);
    const to = join(base, item.path);
    if (!existsSync(from)) throw new RefusalError(`fichier quarantiné absent : ${item.quarantinePath}`);
    if (existsSync(to)) throw new RefusalError(`restauration refusée, le chemin est déjà occupé : ${item.path}`);
    const actual = sha256(readFileSync(from));
    if (actual !== item.sha256) throw new RefusalError(`hash différent pour ${item.path} : quarantaine modifiée`);
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
    restored.push(item.path);
  }
  return { stamp, restored };
}

function parseArgs(argv) {
  const options = { paths: [], apply: false, json: false, yes: false, restore: null, reason: null, root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new UsageError(`${arg} attend une valeur`);
      index += 1;
      return value;
    };
    if (arg === '--paths') options.paths = next().split(',').map((entry) => entry.trim()).filter(Boolean);
    else if (arg === '--reason') options.reason = next();
    else if (arg === '--restore') options.restore = next();
    else if (arg === '--root') options.root = resolve(next());
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new UsageError(`argument inconnu : ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(
    [
      'Quarantaine LKDV (aucune suppression définitive)',
      '',
      '  --paths a.ts,b/c.ts   fichiers suivis à mettre en quarantaine (relatifs au dépôt)',
      '  --reason "…"          preuve d’inutilisation (>= 8 caractères, obligatoire)',
      '  --apply --yes         exécute le déplacement (sinon DRY RUN)',
      '  --restore <stamp>     restaure une quarantaine depuis son manifeste',
      '  --json                sortie machine du plan',
      '  --root <dir>          racine du dépôt (défaut : ce dépôt)',
    ].join('\n'),
  );
}

function printPlan(plan) {
  console.log(`Quarantaine ${plan.stamp} — ${plan.items.length} fichier(s), DRY RUN (rien n’a bougé)`);
  console.log(`Raison : ${plan.reason}`);
  for (const item of plan.items) console.log(`  ${item.path} (${item.bytes} o, sha256 ${item.sha256.slice(0, 12)}…)`);
  console.log(`Manifeste prévu : ${plan.manifestPath}`);
  console.log(`Restauration : ${plan.restoreCommand}`);
  console.log('Relancer avec --apply --yes pour déplacer réellement les fichiers.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }
  if (options.restore) {
    const result = restoreQuarantine({ root: options.root, stamp: options.restore });
    console.log(`Restauré : ${result.restored.length} fichier(s) depuis ${result.stamp}`);
    for (const path of result.restored) console.log(`  ${path}`);
    return 0;
  }
  const plan = planQuarantine({
    root: options.root,
    paths: options.paths,
    reason: options.reason,
  });
  if (!options.apply) {
    if (options.json) console.log(JSON.stringify(plan, null, 2));
    else printPlan(plan);
    return 0;
  }
  if (!options.yes) {
    throw new UsageError('--apply exige --yes (confirmation explicite : la quarantaine déplace des fichiers suivis)');
  }
  const manifest = applyQuarantine(plan, { root: options.root });
  if (options.json) console.log(JSON.stringify(manifest, null, 2));
  else {
    console.log(`Quarantaine appliquée : ${manifest.items.length} fichier(s) → ${manifest.targetRoot}`);
    console.log(`Manifeste : ${manifest.manifestPath}`);
    console.log(`Restauration : ${manifest.restoreCommand}`);
    console.log('Ajouter puis commiter la suppression avec la preuve d’inutilisation ; ne rien supprimer du disque avant validation.');
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const kind = error instanceof UsageError ? 'usage' : error instanceof RefusalError ? 'refus' : 'erreur';
      console.error(`quarantine (${kind}) : ${error.message}`);
      process.exitCode = kind === 'usage' ? 2 : 3;
    });
}
