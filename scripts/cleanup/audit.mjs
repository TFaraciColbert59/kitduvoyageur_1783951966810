#!/usr/bin/env node
/**
 * LKDV cleanup inventory. READ ONLY: never deletes, moves or rewrites files.
 * Run from any directory: node scripts/cleanup/audit.mjs [--json] [--strict]
 * --strict fails only for broken local package-script entrypoints.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_ROOTS = ['src/', 'scripts/', 'tests/', '.agent/', '.agents/', 'handoff/'];
const TEXT_EXT = /\.(?:[cm]?js|tsx?|jsx|json|md|css|scss|sql|sh|yml|yaml)$/i;
const LOCAL_ENTRYPOINT = /(?:^|[;&|]\s*|\s+)(?:node|tsx|ts-node|bash|sh|python3?)\s+((?:scripts|tools|tests|src)\/[\w./-]+\.(?:[cm]?js|tsx?|py|sh))(?=\s|[;&|]|$)/g;
const GENERATED_PATH = /(?:^|\/)(?:\.next|\.turbo|node_modules|coverage|dist|__pycache__)(?:\/|$)/;

function trackedFiles(root) {
  const raw = execFileSync('git', ['-C', root, 'ls-files', '-z'], { maxBuffer: 100 * 1024 * 1024 });
  return raw.toString('utf8').split('\0').filter(Boolean);
}

export function auditRepository(root = DEFAULT_ROOT) {
  const base = resolve(root);
  const paths = trackedFiles(base);
  const tracked = new Set(paths);
  const hashes = new Map();
  const oversizedSource = [];
  const generatedTracked = [];
  let scannedTextFiles = 0;
  let trackedBytes = 0;

  for (const rel of paths) {
    const absolute = resolve(base, rel);
    // Do not follow files outside the checkout, even if a git index is malformed.
    if (relative(base, absolute).startsWith('..' + sep) || isAbsolute(relative(base, absolute))) continue;
    let info;
    try { info = statSync(absolute); } catch { continue; }
    if (!info.isFile()) continue;
    trackedBytes += info.size;
    if (GENERATED_PATH.test(rel)) generatedTracked.push(rel);
    if (!SOURCE_ROOTS.some(prefix => rel.startsWith(prefix)) || !TEXT_EXT.test(rel) || info.size > 1024 * 1024) continue;
    const contents = readFileSync(absolute);
    const digest = createHash('sha256').update(contents).digest('hex');
    const group = hashes.get(digest) || { paths: [], bytes: info.size };
    group.paths.push(rel);
    hashes.set(digest, group);
    scannedTextFiles += 1;
    if (/\.(?:[cm]?js|tsx?|jsx)$/i.test(rel)) {
      const lines = contents.toString('utf8').split('\n').length;
      if (lines >= 800) oversizedSource.push({ path: rel, lines, bytes: info.size });
    }
  }

  const pkgPath = join(base, 'package.json');
  const brokenScripts = [];
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      for (const match of String(command).matchAll(LOCAL_ENTRYPOINT)) {
        const file = match[1];
        if (!tracked.has(file) || !existsSync(join(base, file))) {
          brokenScripts.push({ script: name, file });
        }
      }
    }
  }

  const duplicateGroups = [...hashes.values()]
    .filter(group => group.paths.length > 1)
    .sort((a, b) => (b.paths.length - a.paths.length) || (b.bytes - a.bytes))
    .slice(0, 40);
  oversizedSource.sort((a, b) => b.lines - a.lines);
  return {
    generatedAt: new Date().toISOString(),
    trackedFiles: paths.length,
    trackedBytes,
    scannedTextFiles,
    brokenScripts,
    duplicateGroups,
    oversizedSource: oversizedSource.slice(0, 35),
    generatedTracked: generatedTracked.slice(0, 35),
    caveats: [
      'Duplicate hashes indicate identical content, not safe-to-delete files.',
      'Large files require profiling and dependency analysis before refactoring.',
      'Dynamic imports, native bridges, migrations and routing conventions need manual review.',
      'This command is strictly read-only; it never removes or changes project files.',
    ],
  };
}

function printHuman(audit) {
  console.log(`LKDV cleanup inventory — ${audit.generatedAt}`);
  console.log(`Tracked files: ${audit.trackedFiles}; scanned source/text: ${audit.scannedTextFiles}`);
  console.log(`Tracked bytes: ${(audit.trackedBytes / (1024 ** 2)).toFixed(1)} MiB`);
  console.log(`Broken package scripts: ${audit.brokenScripts.length}`);
  for (const item of audit.brokenScripts) console.log(`  - ${item.script}: ${item.file}`);
  console.log(`Exact duplicate content groups (up to 40): ${audit.duplicateGroups.length}`);
  for (const group of audit.duplicateGroups.slice(0, 12)) console.log(`  - ${group.paths.join(' = ')}`);
  console.log(`Source files >=800 lines (up to 35): ${audit.oversizedSource.length}`);
  for (const item of audit.oversizedSource.slice(0, 15)) console.log(`  - ${item.lines} lines: ${item.path}`);
  console.log(`Tracked generated-directory candidates: ${audit.generatedTracked.length}`);
  console.log('No modifications made. Review findings manually before any removal.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = auditRepository();
  if (process.argv.includes('--json')) console.log(JSON.stringify(audit, null, 2));
  else printHuman(audit);
  if (process.argv.includes('--strict') && audit.brokenScripts.length > 0) process.exitCode = 1;
}
