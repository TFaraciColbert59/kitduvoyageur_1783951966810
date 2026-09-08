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

    // Fail-closed : sans secret configuré, on refuse le webhook plutôt que
    // d'enregistrer des conversions non authentifiées (données financières).
    if (!secret) {
      console.error('[Travelpayouts Webhook] TRAVELPAYOUTS_WEBHOOK_SECRET non configuré — webhook refusé.');
      return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 503 });
    }

    const isValid = verifyAffiliatePostbackSignature(rawBody, signature, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
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
