import { NextRequest, NextResponse } from 'next/server';
import { generateForCountries } from '@/lib/ai/countryGuidesPregen';
import { refreshStalePracticalGuides } from '@/lib/ai/jobs/generateCountryGuide';

export const dynamic = 'force-dynamic';

/**
 * Cron de rafraîchissement des guides pays — hors trafic.
 * Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Scope :
 * - `practical` (par défaut) : guides pratiques par section (table `country_practical_guides`, max 10 pays par passe)
 * - `qa` : questions-réponses pays legacy (cache `country-guides`)
 * - `all` : les deux
 */

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') ?? 'practical';
    const countriesParam = url.searchParams.get('countries');
    const limitCountriesParam = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const force = url.searchParams.get('force') === '1';

    const countries = countriesParam ? countriesParam.split(',').map((c) => c.trim()) : undefined;

    let practicalResult = null;
    let qaResult = null;

    if (scope === 'practical' || scope === 'all') {
      const limit = Number.isFinite(limitCountriesParam) ? Math.min(limitCountriesParam, 10) : 10;
      practicalResult = await refreshStalePracticalGuides({
        countries,
        limitCountries: limit,
        force,
      });
    }

    if (scope === 'qa' || scope === 'all') {
      const limit = Number.isFinite(limitCountriesParam) ? limitCountriesParam : 20;
      qaResult = await generateForCountries({
        countries,
        limitCountries: limit,
        offset: Number.isFinite(offset) ? offset : 0,
        force,
      });
    }

    return NextResponse.json({
      ok: true,
      scope,
      practical: practicalResult,
      qa: qaResult,
    });
  } catch (err) {
    console.error('[ai/cron-guides] erreur inattendue:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Rafraîchissement interrompu' }, { status: 500 });
  }
}
