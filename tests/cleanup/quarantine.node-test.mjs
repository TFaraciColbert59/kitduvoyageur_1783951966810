import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyQuarantine,
  isProtectedPath,
  normalizeRelativePath,
  planQuarantine,
  restoreQuarantine,
} from '../../scripts/cleanup/quarantine.mjs';

/**
 * Quarantaine : les tests prouvent les garde-fous (dry-run, refus des chemins
 * protégés/travail en cours), le manifeste et la restauration vérifiée par hash.
 * Aucun test ne supprime de fichier : le script n’a pas de mode destructif.
 */

function fixture(setup) {
  const dir = mkdtempSync(join(tmpdir(), 'lkdv-quarantine-'));
  execFileSync('git', ['init', '-q', dir]);
  setup(dir);
  execFileSync('git', ['-C', dir, 'add', '-A']);
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'fixture', '--allow-empty']);
  return dir;
}

function put(dir, path, content) {
  const absolute = join(dir, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, content);
}

test('refuse les chemins protégés et les sorties du dépôt', () => {
  assert.equal(isProtectedPath('.git/config'), true);
  assert.equal(isProtectedPath('supabase/migrations/001.sql'), true);
  assert.equal(isProtectedPath('package.json'), true);
  assert.equal(isProtectedPath('src/features/dead.ts'), false);
  const dir = fixture(() => {});
  try {
    assert.throws(() => normalizeRelativePath(dir, '../escape.ts'), /hors du dépôt/);
    assert.throws(() => normalizeRelativePath(dir, '/etc/passwd'), /absolu/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dry-run : plan complet, aucun fichier déplacé', () => {
  const dir = fixture((root) => {
    put(root, 'package.json', '{}');
    put(root, 'src/dead.ts', 'export const dead = 1;\n');
  });
  try {
    const plan = planQuarantine({ root: dir, paths: ['src/dead.ts'], reason: 'export jamais importé (knip + grep)' });
    assert.equal(plan.items.length, 1);
    assert.equal(plan.items[0].path, 'src/dead.ts');
    assert.match(plan.items[0].sha256, /^[0-9a-f]{64}$/);
    assert.equal(existsSync(join(dir, 'src/dead.ts')), true);
    assert.equal(existsSync(join(dir, '.cleanup-trash')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refuse un fichier non suivi et un fichier modifié (travail en cours)', () => {
  const dir = fixture((root) => {
    put(root, 'package.json', '{}');
    put(root, 'src/dead.ts', 'export const dead = 1;\n');
    put(root, 'src/other.ts', 'export const other = 1;\n');
  });
  try {
    // Fichier suivi et propre : le plan est autorisé.
    assert.equal(planQuarantine({ root: dir, paths: ['src/dead.ts'], reason: 'preuve suffisante' }).items.length, 1);
    // Fichier modifié dans l’arbre de travail : refus (travail en cours protégé).
    writeFileSync(join(dir, 'src/dead.ts'), 'export const dead = 2;\n');
    assert.throws(
      () => planQuarantine({ root: dir, paths: ['src/dead.ts'], reason: 'preuve suffisante' }),
      /modifié/,
    );
    // Chemin non suivi (absent du disque) : refus avant tout déplacement.
    assert.throws(
      () => planQuarantine({ root: dir, paths: ['src/untracked.ts'], reason: 'preuve suffisante' }),
      /absent du disque|non suivi/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('apply puis restore : fichier intact, manifeste et hash vérifiés', () => {
  const dir = fixture((root) => {
    put(root, 'package.json', '{}');
    put(root, 'src/dead.ts', 'export const dead = 1;\n');
  });
  try {
    const plan = planQuarantine({ root: dir, paths: ['src/dead.ts'], reason: 'export jamais importé (knip + grep)' });
    const manifest = applyQuarantine(plan, { root: dir });
    assert.equal(existsSync(join(dir, 'src/dead.ts')), false);
    assert.equal(existsSync(join(dir, manifest.manifestPath)), true);
    assert.equal(existsSync(join(dir, manifest.targetRoot, 'MANIFEST.md')), true);
    const stored = JSON.parse(readFileSync(join(dir, manifest.manifestPath), 'utf8'));
    assert.equal(stored.state, 'applied');

    const restored = restoreQuarantine({ root: dir, stamp: plan.stamp });
    assert.deepEqual(restored.restored, ['src/dead.ts']);
    assert.equal(readFileSync(join(dir, 'src/dead.ts'), 'utf8'), 'export const dead = 1;\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('restauration refusée si le contenu quarantiné a été altéré', () => {
  const dir = fixture((root) => {
    put(root, 'package.json', '{}');
    put(root, 'src/dead.ts', 'export const dead = 1;\n');
  });
  try {
    const plan = planQuarantine({ root: dir, paths: ['src/dead.ts'], reason: 'export jamais importé (knip + grep)' });
    const manifest = applyQuarantine(plan, { root: dir });
    writeFileSync(join(dir, manifest.items[0].quarantinePath), 'altéré\n');
    assert.throws(() => restoreQuarantine({ root: dir, stamp: plan.stamp }), /hash différent/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
