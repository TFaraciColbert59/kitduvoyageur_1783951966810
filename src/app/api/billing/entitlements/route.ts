import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  resolveEntitlementsFromRow,
  resolveUserEntitlements,
  stripeBillingConfiguration,
} from '@/lib/entitlements/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/entitlements — état serveur des entitlements de
 * l'utilisateur connecté : plan effectif, passes, source, et configuration
 * Stripe (clé secrète + price ids existants, **booléens uniquement**).
 *
 * Aucun prix n'est créé ni inventé : sans `STRIPE_SECRET_KEY` ou sans price id
 * configuré, `configured: false` est renvoyé explicitement. Un service
 * indisponible produit un état `unavailable` explicite (jamais un 500).
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Session requise' },
        { status: 401 }
      );
    }

    const billing = stripeBillingConfiguration();
    const service = getServiceSupabase();
    const resolved = service
      ? await resolveUserEntitlements(service, user.id, { configured: billing.configured })
      : resolveEntitlementsFromRow(null, {
          configured: billing.configured,
          sourceOnMissing: 'unavailable',
        });

    return NextResponse.json(
      {
        configured: resolved.configured,
        source: resolved.source,
        plan: resolved.plan,
        activePasses: resolved.activePasses,
        entitlements: resolved.entitlements,
        stripe: {
          secretKey: billing.secretKey,
          priceIds: billing.priceIds,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[billing/entitlements] erreur inattendue:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
