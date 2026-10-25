import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContentBlockType, ContentSource } from '@/lib/ai/country-content/contentBlocksTypes';

export const dynamic = 'force-dynamic';

export interface BlockData {
  block_type: ContentBlockType;
  tier: number;
  content_md: string;
  content_json: any;
  sources: ContentSource[];
  model_used: string;
  generated_at: string;
  stale_after: string;
  reviewed_at: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  if (!rawCode || typeof rawCode !== 'string' || rawCode.length < 2) {
    return NextResponse.json({ error: 'Code pays invalide' }, { status: 400 });
  }

  const countryCode = rawCode.trim().toUpperCase();

  try {
    const supabase = await createClient();

    // 1. Interrogation de la table multi-tiers country_content_blocks
    // La RLS filtre automatiquement les blocs dégradés ou non revus (Tier 1)
    const { data: contentBlocks, error: blocksErr } = await supabase
      .from('country_content_blocks')
      .select('block_type, tier, content_md, content_json, sources, model_used, generated_at, stale_after, reviewed_at')
      .eq('country_code', countryCode)
      .eq('degraded', false);

    const blocks: Partial<Record<ContentBlockType, BlockData>> = {};
    const sections: Record<string, {
      content_md: string;
      sources: ContentSource[];
      model_used: string;
      generated_at: string;
      stale_after: string;
    }> = {};

    let latestUpdate: string | null = null;

    if (!blocksErr && contentBlocks && contentBlocks.length > 0) {
      for (const row of contentBlocks) {
        const bType = row.block_type as ContentBlockType;
        const blockObj: BlockData = {
          block_type: bType,
          tier: row.tier,
          content_md: row.content_md,
          content_json: row.content_json,
          sources: Array.isArray(row.sources) ? row.sources : [],
          model_used: row.model_used,
          generated_at: row.generated_at,
          stale_after: row.stale_after,
          reviewed_at: row.reviewed_at,
        };
        blocks[bType] = blockObj;

        // Rétrocompatibilité avec les 6 clés de sections existantes
        if (bType === 'formalites') sections.formalites = blockObj;
        if (bType === 'transport') sections.transport = blockObj;
        if (bType === 'budget') sections.budget = blockObj;
        if (bType === 'sante') sections.sante = blockObj;
        if (bType === 'securite_alertes') sections.securite = blockObj;
        if (bType === 'meilleure_periode_activite') sections.meilleure_saison = blockObj;

        if (!latestUpdate || new Date(row.generated_at).getTime() > new Date(latestUpdate).getTime()) {
          latestUpdate = row.generated_at;
        }
      }
    } else {
      // 2. Fallback rétrocompatible si aucun bloc n'est encore généré dans country_content_blocks
      const { data: legacyRows } = await supabase
        .from('country_practical_guides')
        .select('section, content_md, sources, model_used, generated_at, stale_after')
        .eq('country_code', countryCode)
        .eq('degraded', false);

      for (const row of legacyRows || []) {
        const sec = row.section;
        const legacyObj = {
          content_md: row.content_md,
          sources: Array.isArray(row.sources) ? row.sources : [],
          model_used: row.model_used,
          generated_at: row.generated_at,
          stale_after: row.stale_after,
        };
        sections[sec] = legacyObj;
        if (!latestUpdate || new Date(row.generated_at).getTime() > new Date(latestUpdate).getTime()) {
          latestUpdate = row.generated_at;
        }
      }
    }

    const hasContent = Object.keys(blocks).length > 0 || Object.keys(sections).length > 0;

    return NextResponse.json(
      {
        country_code: countryCode,
        blocks,
        sections,
        updated_at: latestUpdate,
        has_content: hasContent,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error(`[api/ai/country-guide] Exception pour ${countryCode}:`, err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
