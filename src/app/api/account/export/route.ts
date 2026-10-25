import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  buildGdprExport,
  createSupabaseGdprExportClient,
  gdprExportFileName,
  GDPR_EXPORT_SCHEMA_VERSION,
} from '@/server/gdprExport';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/export — export RGPD (portabilité) des données du compte
 * courant. Auth requise (401) ; service requis (503) ; l'identifiant vient
 * exclusivement de la session. Réponse JSON téléchargeable, `no-store`.
 * Aucune donnée n'est journalisée.
 */
export async function GET() {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Phase 8 — export massif : 10/heure, fail-open (droit à la portabilité).
    const limited = await enforceRateLimit(user.id, {
      scope: 'account-export',
      limit: 10,
      windowMs: 3_600_000,
      failMode: 'open',
    });
    if (limited) return limited;

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const bundle = await buildGdprExport(createSupabaseGdprExportClient(supabase), user.id);

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${gdprExportFileName()}"`,
        'cache-control': 'no-store',
        'x-lkdv-export-schema': GDPR_EXPORT_SCHEMA_VERSION,
      },
    });
  } catch (error) {
    console.error(
      '[account/export] erreur inattendue:',
      error instanceof Error ? error.message : 'inconnue'
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
