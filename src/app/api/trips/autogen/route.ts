import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { createTripFromAutogenIntent } from '@/features/trips/server/createTripFromAutogenIntent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/trips/autogen
 *
 * La commande canonique de creation d un voyage vit dans
 * eatures/trips/server/createTripFromAutogenIntent.ts, qui touche la base
 * en service role. Un composant 'use client' ne peut PAS l importer : le
 * bundle client entrainnerait alors lib/ai/serviceClient.ts, qui commence
 * par import 'server-only', et Next fait tomber TOUTES les routes en 500
 * (module needing server-only). Cette Route Handler est donc le seul point
 * de contact cote serveur.
 *
 * Le contrat de retour est celui de la fonction, a l identique : la reponse
 * HTTP reprend esult.status pour un echec, et le corps est l union
 * CreateTripFromAutogenIntentResult. Le client n a donc rien a traduire.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Une generation coute une chaine IA entiere : on borne par utilisateur,
    // fail-closed comme le reste des routes IA.
    const limited = await enforceRateLimit(
      user?.id ?? clientIpFromHeaders(req.headers),
      { scope: 'trips-autogen', limit: 6, windowMs: 60_000, failMode: 'closed' }
    );
    if (limited) return limited;

    const body = await req.json();
    const result = await createTripFromAutogenIntent(body);
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch {
    // Jamais de detail technique expose a l ecran.
    return NextResponse.json(
      { ok: false, status: 500, error: 'La creation du voyage a echoue - reessayez.' },
      { status: 500 }
    );
  }
}
