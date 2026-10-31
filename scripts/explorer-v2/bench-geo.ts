#!/usr/bin/env node
/**
 * Banc du moteur géo de l'Explorer (P9-05/P9-06, décision Rust/WASM P05).
 *
 * Mesure le **moteur TypeScript réel** (`src/features/explorer-v2/geo/track.ts`),
 * celui qui tourne dans le worker et dans la route API — plus une copie
 * locale de l'algorithme.
 *
 * Usage :
 *   npx tsx scripts/explorer-v2/bench-geo.mjs [--runs=15] [--json] [--out=file.json]
 *
 * Décision Rust/WASM : ne basculer que si le gain mesuré est >= 2× sur le
 * parcours réel ET si le wasm compressé reste <= 150 Ko (protocoles/03).
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import {
  decimateTrack,
  resampleTrack,
  summarizeElevation,
  trackDistanceM,
  type LngLat,
} from '../../src/features/explorer-v2/geo/track';

const args = process.argv.slice(2);
const runsArg = args.find((arg) => arg.startsWith('--runs='));
const runs = Math.max(5, Number(runsArg?.split('=')[1] ?? 15));
const asJson = args.includes('--json');
const outArg = args.find((arg) => arg.startsWith('--out='));

/** Trace synthétique déterministe et physiquement plausible. */
function syntheticTrack(points, meters) {
  const stepLat = meters / points / 111_320;
  return Array.from({ length: points }, (_, index) => [
    2.35 + index * stepLat * 0.7,
    45.9 + index * stepLat + Math.sin(index / 40) * 0.0004,
  ]);
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * values.length) - 1));
  return sorted[index];
}

function stats(values) {
  return {
    p50: Number(percentile(values, 0.5).toFixed(3)),
    p95: Number(percentile(values, 0.95).toFixed(3)),
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
  };
}

function elevationFor(samples) {
  return samples.map((sample, index) => ({
    d: Math.round(sample.distance_m),
    ele: 900 + Math.round(Math.sin(index / 7) * 40),
  }));
}

function measure(track, runsCount) {
  // Réchauffement : V8 optimise les premières passes.
  for (let warmup = 0; warmup < 3; warmup += 1) {
    const decimated = decimateTrack(track, 400);
    const samples = resampleTrack(decimated, 80);
    summarizeElevation(elevationFor(samples), trackDistanceM(decimated));
  }

  const decimateMs = [];
  const resampleMs = [];
  const totalMs = [];
  let sampleCount = 0;
  const started = performance.now();
  for (let run = 0; run < runsCount; run += 1) {
    const t0 = performance.now();
    const decimated = decimateTrack(track, 400);
    const t1 = performance.now();
    const samples = resampleTrack(decimated, 80);
    const t2 = performance.now();
    summarizeElevation(elevationFor(samples), trackDistanceM(decimated));
    const t3 = performance.now();
    decimateMs.push(t1 - t0);
    resampleMs.push(t2 - t1);
    totalMs.push(t3 - t0);
    sampleCount = samples.length;
  }
  return {
    samples: sampleCount,
    decimate: stats(decimateMs),
    resample: stats(resampleMs),
    total: stats(totalMs),
    wallMs: Number((performance.now() - started).toFixed(1)),
  };
}

const SIZES = [
  { points: 1_000, meters: 12_000 },
  { points: 10_000, meters: 120_000 },
  { points: 100_000, meters: 1_200_000 },
];

const results = SIZES.map(({ points, meters }) => {
  const track = syntheticTrack(points, meters);
  return {
    scenario: `track-${points}`,
    points,
    meters,
    runs,
    engine: 'ts',
    ...measure(track, runs),
  };
});

const frameBudgetMs = 16;
const worstTotal = Math.max(...results.map((entry) => entry.total.p95));
const verdict =
  worstTotal < frameBudgetMs
    ? 'TS suffisant : le pire cas mesuré tient dans le budget de frame (16 ms), un moteur WASM n’apporte pas de gain end-to-end démontrable.'
    : 'WASM à évaluer : le pire cas dépasse le budget de frame, un prototype comparatif se justifie (seuil 2× et <= 150 Ko gz).';

const payload = { generatedAt: new Date().toISOString(), runs, results, verdict };

if (asJson) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(`Banc moteur géo TS — ${runs} passes mesurées après 3 passes de chauffe`);
  console.log('scénario      points   échantillons   décimation p50/p95 ms   rééchantillonnage p50/p95 ms   total p50/p95 ms');
  for (const result of results) {
    console.log(
      `${result.scenario.padEnd(13)} ${String(result.points).padStart(6)}   ${String(result.samples).padStart(11)}   ` +
        `${String(result.decimate.p50).padStart(8)} / ${String(result.decimate.p95).padEnd(8)}   ` +
        `${String(result.resample.p50).padStart(8)} / ${String(result.resample.p95).padEnd(12)}   ` +
        `${String(result.total.p50).padStart(8)} / ${String(result.total.p95).padEnd(8)}`,
    );
  }
  console.log(`\nVerdict : ${verdict}`);
}

if (outArg) {
  const path = outArg.split('=')[1];
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Résultats écrits dans ${path}`);
}
