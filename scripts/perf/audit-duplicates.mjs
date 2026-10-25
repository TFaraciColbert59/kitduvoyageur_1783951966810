/**
 * PERF — Audit des doublons d'images (P3), lecture seule.
 * Compare SHA-256 entre public/assets/*.jpg et public/assets/images/*.jpg,
 * puis compte les références de chaque chemin dans le code/docs.
 *
 * Usage : node scripts/perf/audit-duplicates.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const TOP = 'public/assets';
const IMAGES = 'public/assets/images';

function hash(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function countRefs(path) {
  try {
    const output = execSync(
      `rg -F -c "${path}" src docs scripts tests --glob "!*.png" --glob "!*.jpg" 2>nul`,
      { encoding: 'utf8', shell: 'cmd.exe' }
    );
    return output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .reduce((sum, line) => sum + Number(line.split(':').pop() || 0), 0);
  } catch {
    return 0;
  }
}

const topFiles = readdirSync(TOP).filter((name) => name.toLowerCase().endsWith('.jpg'));
const imageFiles = new Set(
  readdirSync(IMAGES).filter((name) => name.toLowerCase().endsWith('.jpg'))
);

let duplicates = 0;
let duplicateBytes = 0;
let bothReferenced = 0;
const rows = [];

for (const name of topFiles) {
  if (!imageFiles.has(name)) continue;
  const topPath = join(TOP, name);
  const imagePath = join(IMAGES, name);
  if (hash(topPath) !== hash(imagePath)) continue;

  duplicates += 1;
  duplicateBytes += statSync(topPath).size;
  const refsTop = countRefs(`/assets/${name}`);
  const refsImages = countRefs(`/assets/images/${name}`);
  if (refsTop > 0 && refsImages > 0) bothReferenced += 1;
  rows.push({ name, refsTop, refsImages, kb: Math.round(statSync(topPath).size / 1024) });
}

console.log(`Doublons exacts : ${duplicates} (${(duplicateBytes / 1024 / 1024).toFixed(1)} Mo)`);
console.log(`Référencés des DEUX côtés (à réécrire) : ${bothReferenced}`);
console.log('name | refsTop | refsImages | Ko');
for (const row of rows) {
  console.log(`${row.name} | ${row.refsTop} | ${row.refsImages} | ${row.kb}`);
}
