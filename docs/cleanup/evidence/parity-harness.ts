// ARCHIVE DE PREUVE — ne pas importer dans le produit.
// Copie verbatim des anciennes fonctions de src/app/api/explorer/v2/profile/route.ts
// (commit f89f5665) pour prouver la parité avec geo/track.ts. Exécution :
//   esbuild docs/cleanup/evidence/parity-harness.ts --bundle --platform=node --format=esm --outfile=/tmp/parity.mjs
//   node /tmp/parity.mjs
import { resampleTrack, decimateTrack, summarizeElevation, trackDistanceM } from '/Users/fr168256/lkdv-chantier-cleanup/src/features/explorer-v2/geo/track';
const R = 6371000;
function haversineM(a: [number, number], b: [number, number]) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function decimate(positions: Array<[number, number]>, max: number) {
  if (positions.length <= max) return positions;
  const step = Math.ceil(positions.length / max);
  const out: Array<[number, number]> = [];
  for (let index = 0; index < positions.length; index += step) out.push(positions[index]);
  const last = positions[positions.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
function resample(positions: Array<[number, number]>, stepM: number) {
  const out = [{ position: positions[0], d: 0 }];
  let travelled = 0;
  let nextAt = stepM;
  for (let index = 1; index < positions.length; index += 1) {
    const a = positions[index - 1];
    const b = positions[index];
    const segment = haversineM(a, b);
    while (travelled + segment >= nextAt && segment > 0) {
      const ratio = (nextAt - travelled) / segment;
      out.push({ position: [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio], d: nextAt });
      nextAt += stepM;
    }
    travelled += segment;
  }
  return out;
}
function summarize(points: Array<{ d: number; ele: number | null }>, distanceM: number) {
  let gain = 0, loss = 0, min: number | null = null, max: number | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const p = points[index - 1].ele, c = points[index].ele;
    if (p === null || c === null) continue;
    const delta = c - p;
    if (delta > 0) gain += delta; else loss -= delta;
  }
  for (const point of points) { if (point.ele === null) continue; if (min === null || point.ele < min) min = point.ele; if (max === null || point.ele > max) max = point.ele; }
  return { distance_m: Math.round(distanceM), gain_m: Math.round(gain), loss_m: Math.round(loss), min_m: min === null ? null : Math.round(min), max_m: max === null ? null : Math.round(max) };
}
let seed = 42;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
let mismatches = 0, cases = 0, maxDistDiff = 0, maxPosDiff = 0, sampleCount = 0;
for (let c = 0; c < 500; c += 1) {
  const n = 2 + Math.floor(rand() * 60);
  let lng = 2 + rand() * 4, lat = 44 + rand() * 4;
  const track: Array<[number, number]> = [];
  for (let i = 0; i < n; i += 1) { lng += (rand() - 0.5) * 0.02; lat += (rand() - 0.5) * 0.02; track.push([lng, lat]); }
  const decOld = decimate(track, 400);
  const decNew = decimateTrack(track, 400);
  const oldSamples = resample(decOld, 80);
  const newSamples = resampleTrack(decNew, 80);
  cases += 1; sampleCount += newSamples.length;
  if (oldSamples.length !== newSamples.length) { mismatches += 1; continue; }
  for (let i = 0; i < oldSamples.length; i += 1) {
    const d = Math.abs(oldSamples[i].d - newSamples[i].distance_m);
    const p = Math.max(Math.abs(oldSamples[i].position[0] - newSamples[i].position[0]), Math.abs(oldSamples[i].position[1] - newSamples[i].position[1]));
    maxDistDiff = Math.max(maxDistDiff, d); maxPosDiff = Math.max(maxPosDiff, p);
    if (d > 1e-6 || p > 1e-9) mismatches += 1;
  }
  const eleOld = oldSamples.map((s, i) => ({ d: Math.round(s.d), ele: 900 + Math.round(Math.sin(i / 7) * 40) }));
  const eleNew = newSamples.map((s, i) => ({ d: Math.round(s.distance_m), ele: 900 + Math.round(Math.sin(i / 7) * 40) }));
  const a = JSON.stringify(summarize(eleOld, trackDistanceM(decOld)));
  const b = JSON.stringify(summarizeElevation(eleNew, trackDistanceM(decNew)));
  if (a !== b) mismatches += 1;
}
console.log(JSON.stringify({ cases, samples: sampleCount, mismatches, maxDistDiff, maxPosDiff }, null, 2));
