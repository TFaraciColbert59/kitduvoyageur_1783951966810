import { NextRequest, NextResponse } from 'next/server';
import { recordAffiliateConversion } from '@/lib/queries-affiliation';
import { affiliatePostbackPayloadSchema } from '@/features/affiliation/schemas/affiliate.schema';
import { verifyAffiliatePostbackSignature } from '@/features/affiliation/engine/affiliateEngine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-travelpayouts-signature') || '';
    const secret = process.env.TRAVELPAYOUTS_WEBHOOK_SECRET || '';

    // Vérification de la signature si le secret est configuré
    if (secret) {
      const isValid = verifyAffiliatePostbackSignature(rawBody, signature, secret);
      if (!isValid) {
        return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
      }
    }

    const json = JSON.parse(rawBody);
    const parsed = affiliatePostbackPayloadSchema.parse(json);

    const conversion = await recordAffiliateConversion(parsed);

    if (!conversion) {
      return NextResponse.json(
        { error: 'Échec de l’enregistrement de la conversion.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversion_id: conversion.id,
      status: conversion.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne webhook.';
    console.error('[Travelpayouts Webhook] Erreur :', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
