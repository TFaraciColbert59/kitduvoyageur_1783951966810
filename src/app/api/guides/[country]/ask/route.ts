import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { askAI } from '@/lib/ai/askAI';
import { getCompleteCountryDetail } from '@/lib/countryDetails';
import {
  isSupportedCountry,
  getCountryName,
  buildGuidePrompt,
  buildCountryContext,
  buildGuideFallback,
} from '@/lib/ai/features/countryGuides';

export const dynamic = 'force-dynamic';

/**
 * Q&R guides pays (Chantier D) — cache-first.
 * La pré-génération (cron/script) utilise le MÊME buildGuidePrompt → mêmes
 * clés de cache → ~90 % de requêtes servies instantanément et gratuitement.
 * Dégradation gracieuse : IA indisponible → fiche pays statique + mention sobre.
 */

const askSchema = z.object({
  question: z.string().min(2).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ country: string }> }
) {
  try {
    const { country: rawCountry } = await params;
    const country = decodeURIComponent(rawCountry).toUpperCase();
    if (!isSupportedCountry(country)) {
      return NextResponse.json({ error: 'Pays inconnu' }, { status: 404 });
    }

    if (process.env.NODE_ENV === 'production') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized', details: 'Session requise' }, { status: 401 });
      }
    }

    const parsed = askSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Question invalide', details: parsed.error.issues.map((i) => i.path.join('.')).join(', ') },
        { status: 400 }
      );
    }
    const { question } = parsed.data;

    const countryName = getCountryName(country);
    const detail = getCompleteCountryDetail(country);
    const { system, prompt } = buildGuidePrompt(countryName, question, buildCountryContext(detail));

    const result = await askAI({
      feature: 'country-guides',
      tier: 'heavy',
      system,
      prompt,
      maxTokens: 512,
    });

    const text = result.degraded
      ? buildGuideFallback(detail, question)
      : result.text;

    return NextResponse.json({
      country,
      question,
      text,
      model: result.degraded ? 'fallback-deterministe' : result.model,
      degraded: result.degraded,
      cached: result.cached,
      provider: result.provider,
    });
  } catch (err) {
    console.error('[guides/ask] erreur inattendue:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  }
}
