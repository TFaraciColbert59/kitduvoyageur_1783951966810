#!/usr/bin/env node
/**
 * P4 — Courbe de charge rapide (serveur Next local + Supabase distant).
 * Mesure RPS + latences p50/p95/p99 sur les routes publiques chaudes.
 * Usage : node scripts/ops/p4_load_quick.mjs [--url http://127.0.0.1:4028] [--duration 10] [--connections 25]
 */
import autocannon from 'autocannon';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = getArg('url', 'http://127.0.0.1:4028');
const DURATION = Number(getArg('duration', '10'));
const CONNECTIONS = Number(getArg('connections', '25'));

const ROUTES = ['/', '/explorer', '/pays/fr', '/api/pois?bbox=6.8,45.9,6.9,45.95'];

const results = [];
for (const route of ROUTES) {
  const res = await autocannon({
    url: `${BASE}${route}`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { 'accept-language': 'fr' },
  });
  results.push({
    route,
    rps: Math.round(res.requests.average),
    p50: res.latency.p50,
    p95: res.latency.p97_5 ?? res.latency.p95,
    p99: res.latency.p99,
    max: res.latency.max,
    errors: res.errors,
    non2xx: res.non2xx,
  });
  console.log(
    `${route} → ${Math.round(res.requests.average)} req/s | p50 ${res.latency.p50}ms | p99 ${res.latency.p99}ms | err ${res.errors} | non2xx ${res.non2xx}`
  );
}

console.log('\n--- JSON ---');
console.log(JSON.stringify(results, null, 2));
