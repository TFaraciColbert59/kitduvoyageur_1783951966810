import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRACTICAL_SECTIONS, PracticalSection } from '@/lib/ai/jobs/generateCountryGuide';

export const dynamic = 'force-dynamic';

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
    const { data: rows, error } = await supabase
      .from('country_practical_guides')
      .select('section, content_md, sources, model_used, generated_at, stale_after, degraded')
      .eq('country_code', countryCode)
      .eq('degraded', false);

    if (error) {
      console.error(`[api/ai/country-guide] Erreur Supabase pour ${countryCode}:`, error.message);
      return NextResponse.json({ error: 'Erreur lors de la récupération des guides' }, { status: 500 });
    }

    const sections: Partial<Record<PracticalSection, {
      content_md: string;
      sources: Array<{ title: string; url: string }>;
      model_used: string;
      generated_at: string;
      stale_after: string;
    }>> = {};

    let latestUpdate: string | null = null;

    for (const row of rows || []) {
      const sec = row.section as PracticalSection;
      if (PRACTICAL_SECTIONS.includes(sec)) {
        sections[sec] = {
          content_md: row.content_md,
          sources: Array.isArray(row.sources) ? row.sources : [],
          model_used: row.model_used,
          generated_at: row.generated_at,
          stale_after: row.stale_after,
        };
        if (!latestUpdate || new Date(row.generated_at).getTime() > new Date(latestUpdate).getTime()) {
          latestUpdate = row.generated_at;
        }
      }
    }

    return NextResponse.json(
      {
        country_code: countryCode,
        sections,
        updated_at: latestUpdate,
        has_content: Object.keys(sections).length > 0,
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
