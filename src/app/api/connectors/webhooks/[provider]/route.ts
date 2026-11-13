import { NextResponse } from 'next/server';

import { parseProviderId } from '@/lib/connectors/schemas';
import { ingestPartnerWebhook } from '@/lib/connectors/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1_000_000;

/**
 * Webhook partenaire : signature HMAC obligatoire, idempotence stricte et
 * `athlete.deauthorize` appliqué immédiatement. Aucun utilisateur n'est
 * accepté depuis le corps : la liaison OAuth fait foi.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const providerId = parseProviderId((await params).provider);
  if (!providerId) {
    return NextResponse.json({ error: 'Connecteur inconnu.', code: 'not_found' }, { status: 404 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Corps webhook trop volumineux.', code: 'payload_too_large' }, { status: 413 });
  }

  const rawSignature =
    request.headers.get('x-lkdv-signature') ?? request.headers.get('x-hub-signature-256') ?? '';
  const signature = rawSignature.startsWith('sha256=') ? rawSignature.slice(7) : rawSignature;

  const result = ingestPartnerWebhook({
    providerId,
    rawBody,
    signature: signature || null,
  });

  return NextResponse.json(result.body, {
    status: result.httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  });
}
