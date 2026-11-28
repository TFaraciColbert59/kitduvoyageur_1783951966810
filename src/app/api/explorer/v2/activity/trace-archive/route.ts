import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const rawPointSchema = z.object({
  seq: z.number().int().positive(),
  t: z.number().int(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  ele: z.number().nullable().optional(),
  acc: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  hr: z.number().int().nullable().optional(),
  pwr: z.number().int().nullable().optional(),
  cad: z.number().nullable().optional(),
});

const archiveBodySchema = z
  .object({
    sessionId: z.string().uuid(),
    points: z.array(rawPointSchema).min(1).max(100_000),
  })
  .strict();

interface R2BucketLike {
  put(key: string, value: Uint8Array | string, options?: { httpMetadata?: { contentType?: string; contentEncoding?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

function getR2Bucket(): R2BucketLike | null {
  const g = globalThis as unknown as { LKDV_TRACES_BUCKET?: R2BucketLike; __env__?: { LKDV_TRACES_BUCKET?: R2BucketLike } };
  return g.LKDV_TRACES_BUCKET ?? g.__env__?.LKDV_TRACES_BUCKET ?? null;
}

export async function gzipNdjson(points: ReadonlyArray<Record<string, unknown>>): Promise<Uint8Array> {
  const ndjson = points.map((p) => JSON.stringify(p)).join('\n');
  const encoded = new TextEncoder().encode(ndjson);
  if (typeof CompressionStream === 'undefined') return encoded;
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  await writer.write(encoded);
  await writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

export async function gunzipNdjson(bytes: Uint8Array): Promise<Array<Record<string, unknown>>> {
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    text = new TextDecoder().decode(buf);
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

/**
 * Lot 05 — Archive une trace brute 1 Hz en NDJSON compressé Gzip (`raw_v2.ndjson.gz`)
 * dans Cloudflare R2 (`0 $` egress), puis met à jour `activity_sessions.raw_trace_r2_key`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-trace-archive-write',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = archiveBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'trace invalide' }, { status: 400 });
  }

  const compressed = await gzipNdjson(parsed.data.points);
  const r2Key = `traces/${parsed.data.sessionId}/raw_v2.ndjson.gz`;
  const bucket = getR2Bucket();
  if (bucket) {
    await bucket.put(r2Key, compressed, {
      httpMetadata: { contentType: 'application/x-ndjson', contentEncoding: 'gzip' },
    });
  }

  return NextResponse.json(
    {
      archived: Boolean(bucket),
      r2Key,
      pointsCount: parsed.data.points.length,
      compressedBytes: compressed.byteLength,
    },
    { status: 200 },
  );
}

/**
 * Lot 05 — Lecteur/décompresseur de `raw_v2.ndjson.gz` pour l'analyse experte,
 * Crop/Split et portabilité RGPD Art. 20.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'sessionId invalide' }, { status: 400 });
  }
  const bucket = getR2Bucket();
  if (!bucket) {
    return NextResponse.json({ points: [], source: 'r2_unbound_fallback' }, { status: 200 });
  }
  const obj = await bucket.get(`traces/${sessionId}/raw_v2.ndjson.gz`);
  if (!obj) {
    return NextResponse.json({ error: 'archive introuvable' }, { status: 404 });
  }
  const bytes = new Uint8Array(await obj.arrayBuffer());
  const points = await gunzipNdjson(bytes);
  return NextResponse.json({ points, source: 'r2_ndjson_gz' }, { status: 200 });
}
