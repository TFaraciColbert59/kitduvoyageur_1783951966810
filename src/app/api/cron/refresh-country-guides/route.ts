import { NextRequest, NextResponse } from 'next/server';
import { generateForCountries } from '@/lib/ai/countryGuidesPregen';
import { refreshStalePracticalGuides } from '@/lib/ai/jobs/generateCountryGuide';
import {
  refreshStaleBlocks,
  batchGenerateCountries,
} from '@/lib/ai/country-content/contentBatchService';

export const dynamic = 'force-dynamic';

/**
 * Cron de rafraîchissement des guides pays — hors trafic.
 * Déclencheur EXTERNE : `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Scope :
 * - `safety-alertes` : rafraîchissement rapide (7j) Tier 1 (sécurité/alertes)
 * - `blocks` : rafraîchissement multi-tiers (country_content_blocks)
 * - `practical` (par défaut) : guides pratiques par section (table `country_practical_guides`)
 * - `qa` : questions-réponses pays legacy (cache `country-guides`)
 * - `all` : tous les scopes
 */

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') ?? 'blocks';
    const countriesParam = url.searchParams.get('countries');
    const limitCountriesParam = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const force = url.searchParams.get('force') === '1';

    const countries = countriesParam ? countriesParam.split(',').map((c) => c.trim()) : undefined;

    let blocksResult = null;
    let safetyResult = null;
    let practicalResult = null;
    let qaResult = null;

    // 1. Scope sécurité alertes (Tier 1, cadence 7 jours)
    if (scope === 'safety-alertes' || scope === 'all') {
      safetyResult = await refreshStaleBlocks({
        limit: Number.isFinite(limitCountriesParam) ? limitCountriesParam : 20,
        tier: 1,
        blockType: 'securite_alertes',
      });
    }

    // 2. Scope multi-tiers complets (country_content_blocks)
    if (scope === 'blocks' || scope === 'all') {
      if (countries && countries.length > 0) {
        blocksResult = await batchGenerateCountries(countries, { force });
      } else {
        blocksResult = await refreshStaleBlocks({
          limit: Number.isFinite(limitCountriesParam) ? limitCountriesParam : 20,
        });
      }
    }

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
      blocks: blocksResult,
      safety: safetyResult,
      practical: practicalResult,
      qa: qaResult,
    });
  } catch (err) {
    console.error('[ai/cron-guides] erreur inattendue:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Rafraîchissement interrompu' }, { status: 500 });
  }
}
