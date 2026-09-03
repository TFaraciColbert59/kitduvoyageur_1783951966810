import { NextRequest, NextResponse } from 'next/server';
import { generateForCountries } from '@/lib/ai/countryGuidesPregen';

export const dynamic = 'force-dynamic';

/**
 * Cron de rafraîchissement des guides pays (Chantier D) — hors trafic.
 * Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`.
 * Un run traite un lot borné (défaut 20 pays ≈ 500 req) pour respecter le
 * budget :free (1000 req/jour) ; l'ordonnanceur externe incrémente `offset`
 * (ou laisse le skip-cache faire le tri : seules les entrées expirées ou
 * manquantes sont régénérées).
 */

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const countriesParam = url.searchParams.get('countries');
    const limitCountries = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const force = url.searchParams.get('force') === '1';

    const result = await generateForCountries({
      countries: countriesParam ? countriesParam.split(',').map((c) => c.trim()) : undefined,
      limitCountries: Number.isFinite(limitCountries) ? limitCountries : 20,
      offset: Number.isFinite(offset) ? offset : 0,
      force,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[ai/cron-guides] erreur inattendue:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Rafraîchissement interrompu' }, { status: 500 });
  }
}
