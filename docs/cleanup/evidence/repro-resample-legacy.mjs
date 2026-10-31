// Preuve P0 (hors suite de tests) : copie verbatim de resampleTrack de
// src/features/explorer-v2/workers/geo.worker.ts avant correction.
// Exécuter : node --max-old-space-size=256 docs/cleanup/evidence/repro-resample-legacy.mjs

// Reproduction isolée de l'algorithme legacy de geo.worker.ts (resampleTrack),
// bornée en itérations pour prouver la boucle non progressante.
const R = 6371000;
function haversineM(a, b) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function resampleTrack(positions, stepM = 60) {
  if (positions.length === 0) return [];
  const out = [{ position: positions[0], distance_m: 0 }];
  let travelled = 0, nextAt = stepM;
  for (let i = 1; i < positions.length; i += 1) {
    const a = positions[i - 1], b = positions[i];
    const segment = haversineM(a, b);
    let cursor = travelled;
    while (cursor + segment >= nextAt && segment > 0) {
      const ratio = (nextAt - cursor) / segment;
      out.push({ position: [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio], distance_m: nextAt });
      nextAt += stepM;
      cursor = nextAt;
    }
    travelled += segment;
  }
  return out;
}
const CAP = 100000;
let emitted = 0;
const t0 = Date.now();
// Un segment de 1 km avec step 60 m : cas banal d'une route rectiligne.
const positions = [[6.87, 45.92], [6.8827, 45.92]];
try {
  const res = resampleTrack(positions, 60);
  emitted = res.length;
} catch (e) { console.log('error', e.message); }
console.log(JSON.stringify({ emitted, ms: Date.now() - t0, cap: CAP }));
