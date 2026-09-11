import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseGdprDeleteDeps,
  deleteAccountData,
  DELETE_CONFIRMATION_PHRASE,
  ResidualDataError,
} from '@/server/gdprDelete';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/account/delete — effacement RGPD du compte courant.
 *
 * Sécurité :
 *   - session obligatoire (401), identité issue de la session uniquement ;
 *   - confirmation explicite EXACTE (`{ "confirmation": "SUPPRIMER MON COMPTE" }`),
 *     sinon 400 — jamais de suppression par simple appel ;
 *   - suppression via service_role APRÈS authentification, cascades vérifiées ;
 *   - toute donnée résiduelle ⇒ 500 bloquant (jamais un faux succès).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const confirmation = (body as { confirmation?: unknown } | null)?.confirmation;
    if (confirmation !== DELETE_CONFIRMATION_PHRASE) {
      return NextResponse.json(
        {
          error: 'Confirmation requise',
          details: `Le champ confirmation doit valoir exactement « ${DELETE_CONFIRMATION_PHRASE} ».`,
        },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const result = await deleteAccountData(
      { userId: user.id, confirmation },
      createSupabaseGdprDeleteDeps(supabase)
    );

    if (!result.deleted) {
      return NextResponse.json({ error: 'Confirmation requise' }, { status: 400 });
    }

    return NextResponse.json({
      deleted: true,
      deletedAt: result.deletedAt,
      residual: result.residual,
    });
  } catch (error) {
    if (error instanceof ResidualDataError) {
      return NextResponse.json(
        {
          error: 'Suppression incomplète',
          details: 'Des données résiduelles subsistent — incident traité, aucune donnée n’est réputée supprimée.',
        },
        { status: 500 }
      );
    }
    console.error(
      '[account/delete] erreur inattendue:',
      error instanceof Error ? error.message : 'inconnue'
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
