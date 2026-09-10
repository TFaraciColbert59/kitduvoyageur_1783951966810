import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const EVENT_RE = /^[a-z][a-z0-9_]{2,40}$/;

/**
 * H7.2 — Ingestion batchée de télémétrie hub.
 * Règles : header `idempotency-key` requis (≤128), ≤20 events/batch,
 * user_id forcé = auth.uid() (jamais celui du client).
 */
export async function POST(req: Request) {
  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return new Response('idempotency-key required', { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length === 0 || events.length > 20) {
    return new Response('max 20 events per batch', { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const sessionId =
    req.headers.get('x-hub-session')?.slice(0, 36) ?? crypto.randomUUID();

  const rows = [];
  for (const e of events) {
    const ev = e as { event?: unknown; payload?: unknown };
    if (typeof ev.event !== 'string' || !EVENT_RE.test(ev.event)) {
      return new Response('invalid event_name', { status: 400 });
    }
    const payloadText = JSON.stringify(ev.payload ?? {});
    if (payloadText.length >= 8192) {
      return new Response('payload too large', { status: 400 });
    }
    rows.push({
      user_id: user.id,
      session_id: sessionId,
      event_name: ev.event,
      payload: ev.payload ?? {},
    });
  }

  const { error } = await supabase.from('hub_telemetry').insert(rows);
  if (error) return new Response('insert failed', { status: 500 });
  return NextResponse.json({ ok: true, ingested: rows.length });
}
