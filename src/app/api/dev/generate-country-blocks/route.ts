import { NextRequest, NextResponse } from 'next/server';
import { generateCountryFullContent } from '@/lib/ai/country-content/contentBatchService';
import {
  generateSafetyCriticalBlock,
  reviewContentBlock,
  getPendingReviews,
  SafetyCriticalBlockType,
} from '@/lib/ai/country-content/generateSafetyCriticalBlock';
import { generateContentBlock } from '@/lib/ai/country-content/generateContentBlock';
import { generateCountryKitRecommendation } from '@/lib/ai/country-content/recommendCountryKits';
import { ContentBlockType } from '@/lib/ai/country-content/contentBlocksTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Endpoint réservé au développement local' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country')?.toUpperCase();
  const tierParam = searchParams.get('tier');
  const blockParam = searchParams.get('block');
  const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true';
  const action = searchParams.get('action');

  try {
    // 1. Action : Review / Approbation d'un bloc Tier 1
    if (action === 'review') {
      const blockId = searchParams.get('block_id');
      const reviewer = searchParams.get('reviewer') || 'admin-audit';
      if (!blockId) {
        return NextResponse.json({ error: 'block_id requis pour action=review' }, { status: 400 });
      }
      const result = await reviewContentBlock(blockId, reviewer);
      return NextResponse.json(result);
    }

    // 2. Action : Liste des reviews en attente
    if (action === 'pending') {
      const pending = await getPendingReviews(country);
      return NextResponse.json({ count: pending.length, pending });
    }

    if (!country) {
      return NextResponse.json({ error: 'Paramètre country requis (ex: PT, NP, ST)' }, { status: 400 });
    }

    // 3. Génération d'un bloc spécifique
    if (blockParam) {
      const bType = blockParam as ContentBlockType;
      let record;
      if (bType === 'formalites' || bType === 'securite_alertes') {
        record = await generateSafetyCriticalBlock(country, bType, { force });
      } else if (bType === 'recommandations_kit') {
        record = await generateCountryKitRecommendation(country, { force });
      } else {
        record = await generateContentBlock(country, bType, { force });
      }
      return NextResponse.json({ country, block_type: bType, record });
    }

    // 4. Génération par Tier
    if (tierParam === '1') {
      const formalites = await generateSafetyCriticalBlock(country, 'formalites', { force });
      const securite = await generateSafetyCriticalBlock(country, 'securite_alertes', { force });
      return NextResponse.json({ country, tier: 1, formalites, securite });
    }

    if (tierParam === '4') {
      const kit = await generateCountryKitRecommendation(country, { force });
      return NextResponse.json({ country, tier: 4, kit });
    }

    // 5. Génération complète (13 blocs)
    const report = await generateCountryFullContent(country, { force });
    return NextResponse.json({ report });
  } catch (err) {
    console.error('[dev/generate-country-blocks] Erreur:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
