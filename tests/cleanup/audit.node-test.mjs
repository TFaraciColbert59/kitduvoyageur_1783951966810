import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditRepository } from '../../scripts/cleanup/audit.mjs';

function fixture(setup) {
  const dir = mkdtempSync(join(tmpdir(), 'lkdv-cleanup-'));
  try {
    execFileSync('git', ['init', '-q', dir]);
    setup(dir);
    execFileSync('git', ['-C', dir, 'add', '-A']);
    return auditRepository(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function put(dir, path, content) {
  const absolute = join(dir, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, content);
}

test('reports missing local entrypoints without changing files', () => {
  const report = fixture(dir => {
    put(dir, 'package.json', JSON.stringify({ scripts: {
      'cleanup:audit': 'node scripts/cleanup/audit.mjs',
      'test': 'node scripts/existing.mjs',
      'build': 'next build',
    }}));
    put(dir, 'scripts/existing.mjs', 'console.log("hello")\n');
  });
  assert.deepEqual(report.brokenScripts, [{ script: 'cleanup:audit', file: 'scripts/cleanup/audit.mjs' }]);
  assert.equal(report.trackedFiles, 2);
});

test('identical files are candidates, not deletion instructions', () => {
  const report = fixture(dir => {
    put(dir, 'package.json', JSON.stringify({ scripts: {} }));
    put(dir, 'src/features/a.ts', 'export const value = 1;\n');
    put(dir, 'src/features/b.ts', 'export const value = 1;\n');
    put(dir, 'src/features/c.ts', 'export const value = 2;\n');
  });
  assert.equal(report.duplicateGroups.length, 1);
  assert.deepEqual(report.duplicateGroups[0].paths, ['src/features/a.ts', 'src/features/b.ts']);
  assert.match(report.caveats.join(' '), /not safe-to-delete/i);
});

test('flags tracked generated directories without removing them', () => {
  const report = fixture(dir => {
    put(dir, 'package.json', JSON.stringify({ scripts: {} }));
    put(dir, 'dist/bundle.js', 'something');
  });
  assert.deepEqual(report.generatedTracked, ['dist/bundle.js']);
});
