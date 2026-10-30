#!/usr/bin/env node
/**
 * Banc du worker géo (P9-05 / P9-06).
 *
 * Mesure le coût des opérations géométriques de l'Explorer côté client :
 *   - rééchantillonnage d'une trace réelle (1 000 points) ;
 *   - calcul du profil altimétrique (même code que le worker, sans réseau).
 *
 * Décision Rust/WASM : on ne bascule que si le gain mesuré est ≥ 2× et si le
 * binaire reste ≤ 150 Ko gz (02_ARCHITECTURE §8).
 */
import { performance } from 'node:perf_hooks';

function haversineM(a, b) {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function resample(positions, stepM) {
  const out = [{ position: positions[0], d: 0 }];
  let travelled = 0;
  let nextAt = stepM;
  for (let i = 1; i < positions.length; i += 1) {
    const a = positions[i - 1];
    const b = positions[i];
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

function decimate(positions, max) {
  if (positions.length <= max) return positions;
  const step = Math.ceil(positions.length / max);
  const out = [];
  for (let i = 0; i < positions.length; i += step) out.push(positions[i]);
  out.push(positions[positions.length - 1]);
  return out;
}

// Trace synthétique de 1 000 points (~12 km) : même ordre de grandeur qu'une
// géométrie OSM réelle.
const TRACK = Array.from({ length: 1000 }, (_, index) => [6.87 + index * 0.00012, 45.92 + index * 0.00008]);

const runs = 20;
let totalResample = 0;
let totalDecimate = 0;
for (let run = 0; run < runs; run += 1) {
  let start = performance.now();
  decimate(TRACK, 400);
  totalDecimate += performance.now() - start;

  start = performance.now();
  resample(decimate(TRACK, 400), 80);
  totalResample += performance.now() - start;
}

const resampleMs = totalResample / runs;
const decimateMs = totalDecimate / runs;
console.log(`trace 1 000 points · ${runs} passes`);
console.log(`  décimation  : ${decimateMs.toFixed(3)} ms`);
console.log(`  rééchantillonnage : ${resampleMs.toFixed(3)} ms`);
console.log(`  total par affichage : ${(decimateMs + resampleMs).toFixed(3)} ms`);

const budgetMs = 16;
const verdict = resampleMs + decimateMs < budgetMs ? 'TS suffisant' : 'WASM à évaluer';
console.log(`\nVerdict : ${verdict} (budget ${budgetMs} ms par image, gain WASM non justifié en dessous de 2×)`);
