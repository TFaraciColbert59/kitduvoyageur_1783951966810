// Banc contrôlé des API critiques : p50, p95, erreurs, octets.
// Usage : node scripts/perf/bench-apis.mjs <base> [runs]
import { request } from 'playwright';

const base = process.argv[2];
const runs = Number(process.argv[3] || 20);
if (!base) {
  console.error('usage: node scripts/perf/bench-apis.mjs <base> [runs]');
  process.exit(2);
}
const endpoints = [
  { name: 'compte/bootstrap', path: '/api/compte/bootstrap' },
  { name: 'compte/highlights', path: '/api/compte/highlights' },
  { name: 'compte/following', path: '/api/compte/reseau/following' },
  { name: 'explorer/content', path: '/api/explorer/v2/content?kind=carnets&limit=6' },
  { name: 'explorer/countries', path: '/api/explorer/v2/countries?iso=FR' },
  { name: 'ai/ping', path: '/api/ai/ping' },
  { name: 'elevation', path: '/api/elevation?points=45.9,6.1' },
];

const context = await request.newContext({
  baseURL: base,
  storageState: process.env.STORAGE_STATE,
  timeout: 60_000,
});

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = p * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(sorted.length - 1, low + 1);
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (position - low));
}

const results = [];
for (const endpoint of endpoints) {
  // un passage de chauffe exclu
  await context.get(endpoint.path).catch(() => undefined);
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    let status = 0;
    let bytes = 0;
    let error = null;
    try {
      const response = await context.get(endpoint.path);
      status = response.status();
      const body = await response.body();
      bytes = body.byteLength;
    } catch (caught) {
      error = String(caught).slice(0, 120);
    }
    samples.push({ ms: performance.now() - start, status, bytes, error });
  }
  const ok = samples.filter((sample) => !sample.error && sample.status < 400);
  results.push({
    name: endpoint.name,
    n: samples.length,
    errors: samples.filter((sample) => sample.error || sample.status >= 400).length,
    p50: percentile(ok.map((sample) => sample.ms), 0.5),
    p95: percentile(ok.map((sample) => sample.ms), 0.95),
    bytes: Math.round(ok.reduce((sum, sample) => sum + sample.bytes, 0) / Math.max(1, ok.length)),
    status: ok.length ? ok[0].status : samples[0]?.status,
  });
}

// Un seul appel IA réel : il consomme un quota et n'a pas sa place dans une boucle.
try {
  const start = performance.now();
  const response = await context.post('/api/ai/chat-completion', {
    data: {
      task: 'fast',
      stream: false,
      maxTokens: 64,
      system: 'Réponds en un mot, sans ponctuation.',
      prompt: 'Dis bonjour.',
    },
    timeout: 90_000,
  });
  const body = await response.body();
  results.push({
    name: 'ai/chat-completion (1 appel)',
    n: 1,
    errors: response.status() >= 400 ? 1 : 0,
    p50: Math.round(performance.now() - start),
    p95: Math.round(performance.now() - start),
    bytes: body.byteLength,
    status: response.status(),
  });
} catch (error) {
  results.push({ name: 'ai/chat-completion (1 appel)', n: 1, errors: 1, p50: null, p95: null, bytes: 0, status: 0, error: String(error).slice(0, 120) });
}

console.log(JSON.stringify(results, null, 2));
await context.dispose();
