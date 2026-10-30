import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  buildGdprExport,
  createSupabaseGdprExportClient,
  gdprExportFileName,
  GdprExportIncompleteError,
} from '@/server/gdprExport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/user/export
 * Téléchargement de l'archive RGPD article 20 (portabilité des données).
 * Strictement authentifié : l'identifiant provient exclusivement de la session.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentification requise pour exporter vos données' },
        { status: 401 }
      );
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json(
        { error: 'Service de données temporairement indisponible' },
        { status: 503 }
      );
    }

    const gdprClient = createSupabaseGdprExportClient(service);
    const exportBundle = await buildGdprExport(gdprClient, user.id);
    const fileName = gdprExportFileName();

    return new NextResponse(JSON.stringify(exportBundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: unknown) {
    if (err instanceof GdprExportIncompleteError) {
      return NextResponse.json({
        error: 'Export incomplet',
        code: 'EXPORT_INCOMPLETE',
        details: 'Aucune archive partielle n’a été fournie. Réessayez plus tard ou contactez le support.',
      }, { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    console.error('[LKDV /api/user/export] Échec inattendu de génération');
    return NextResponse.json(
      { error: 'Erreur interne lors de la génération de l’export RGPD' },
      { status: 500 }
    );
  }
}
