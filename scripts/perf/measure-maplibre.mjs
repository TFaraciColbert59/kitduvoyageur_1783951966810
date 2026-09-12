/**
 * PERF — Mesure réelle du poids de maplibre-gl (P2), brut + gzip.
 * Usage : node scripts/perf/measure-maplibre.mjs
 */
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const FILES = [
  'node_modules/maplibre-gl/dist/maplibre-gl.mjs',
  'node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs',
  'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
  'node_modules/maplibre-gl/dist/maplibre-gl.css',
];

let totalRaw = 0;
let totalGzip = 0;
console.log('fichier'.padEnd(58) + 'brut'.padStart(12) + 'gzip'.padStart(12));
for (const file of FILES) {
  const raw = statSync(file).size;
  const gzip = gzipSync(readFileSync(file)).length;
  totalRaw += raw;
  totalGzip += gzip;
  console.log(
    file.replace('node_modules/maplibre-gl/dist/', '').padEnd(58) +
      `${(raw / 1024).toFixed(0)} Ko`.padStart(12) +
      `${(gzip / 1024).toFixed(0)} Ko`.padStart(12)
  );
}
console.log('-'.repeat(82));
console.log(
  'TOTAL'.padEnd(58) +
    `${(totalRaw / 1024).toFixed(0)} Ko`.padStart(12) +
    `${(totalGzip / 1024).toFixed(0)} Ko`.padStart(12)
);
