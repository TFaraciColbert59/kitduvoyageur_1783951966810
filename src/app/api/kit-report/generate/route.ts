import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { askAI } from '@/lib/ai/askAI';
import { KIT_CONFIGURATOR_SPEC, kitReportBodySchema, buildKitPrompt, resolveKitAIOutput } from '@/lib/ai/features/kitConfigurator';
import { analyzeKit, type RealShopProduct } from '@/lib/ai/configuratorCore';
import { applyOrientationPrefill, isValidOrientation, type PrefillTarget } from '@/features/identity/orientation';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Rapport de kit connecté — architecture « IA-comme-enrichisseur » :
 *   1. CALCUL DÉTERMINISTE D'ABORD (analyzeKit) : manques/alertes réels du
 *      catalogue, zéro hallucination, règle « never fabricate ».
 *   2. IA ENSUITE (Nemotron via askAI) : justifications + alternatives RÉELLES.
 *   3. Validation Zod stricte + sanitize anti-fabrication ; en cas d'échec ou
 *      de dégradation IA → fallback déterministe (jamais d'erreur 500).
 * Calculs poids/prix et insertion kit_reports INCHANGÉS.
 */

// season/climate → weatherKey du moteur déterministe (mapping documenté).
function deriveWeatherKey(season: string, climate?: string): 'sec_chaud' | 'frais_brumeux' | 'pluvieux_vente' | 'froid_sec' {
  const haystack = `${season} ${climate ?? ''}`.toLowerCase();
  if (/hiver|froid|neige|glace|polaire/.test(haystack)) return 'froid_sec';
  if (/pluie|pluvieux|vent|orage|mousson/.test(haystack)) return 'pluvieux_vente';
  if (/été|ete|chaud|sec|désert|desert|tropical/.test(haystack)) return 'sec_chaud';
  return 'frais_brumeux';
}

function deriveDurationKey(startDate: string, endDate: string): '1-2d' | '3-5d' | '1-2w' | '2w+' {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '3-5d';
  const days = Math.ceil((end - start) / 86_400_000);
  if (days <= 2) return '1-2d';
  if (days <= 5) return '3-5d';
  if (days <= 14) return '1-2w';
  return '2w+';
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const rawBody = await req.json();
    const parsedBody = kitReportBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parsedBody.error.issues.map((i) => i.path.join('.')).join(', ') },
        { status: 400 }
      );
    }
    let { sessionParams, selectedItems } = parsedBody.data;

    // ── Pré-remplissage ORIENTATION (ADR-010, Lot B.3) ─────────────────────
    // L'orientation (privée) sert de prior au configurateur : on ne comble que
    // les champs vides, on ne touche JAMAIS une valeur posée, et on annonce les
    // champs réellement pré-remplis (jamais silencieux → l'UI affiche
    // « pré-rempli d'après ta pratique — modifier »).
    const prefilledFrom: PrefillTarget[] = [];
    if (user) {
      const { data: orientation } = await supabase
        .from('user_orientation')
        .select('terrain, autonomy, priority, experience')
        .eq('user_id', user.id)
        .maybeSingle();
      if (isValidOrientation(orientation)) {
        const applied = applyOrientationPrefill(sessionParams, orientation);
        sessionParams = applied.sessionParams;
        prefilledFrom.push(...applied.prefilledFields);
      }
    }

    // Fetch products from products table
    const { data: dbProducts } = await supabase
      .from('products')
      .select('id, slug, name, brand, category, weight_g, price_eur, image, stock')
      .gt('stock', 0)
      .order('category');

    // Fetch user owned inventory if logged in
    let userOwnedGear: { id: string; name: string; brand?: string; category: string; weight_g: number }[] = [];
    if (user) {
      const { data: gear } = await supabase
        .from('gear_items')
        .select('id, name, brand, category, weight_g')
        .eq('user_id', user.id);
      userOwnedGear = gear || [];
    }

    const sourceable: RealShopProduct[] = (dbProducts ?? []).map((p: any) => ({
      id: p.id,
      slug: p.slug || p.id,
      name: p.name,
      brand: p.brand || 'Le Kit du Voyageur',
      category: p.category || 'Accessoires',
      priceEur: Number(p.price_eur) || 0,
      weightGrams: Number(p.weight_g) || 0,
      image: p.image || '',
      stock: p.stock || 0,
    }));

    // ── 1. CALCUL DÉTERMINISTE (source de vérité, zéro hallucination) ─────────
    const analysis = analyzeKit({
      catalog: sourceable,
      ownedItems: userOwnedGear.map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand ?? undefined,
        category: item.category ?? 'Équipement',
        weightGrams: item.weight_g ?? 300,
        source: 'inventory' as const,
      })),
      weatherKey: deriveWeatherKey(sessionParams.season, sessionParams.climate),
      durationKey: deriveDurationKey(sessionParams.startDate, sessionParams.endDate),
    });

    // ── 2. IA ENRICHISSEUSE (Nemotron via askAI — quota géré par le routeur) ──
    const { system, prompt } = buildKitPrompt({
      sessionParams,
      selectedItems: selectedItems.map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        weight_g: item.weight_g,
        price_eur: item.price_eur,
      })),
      sourceable,
      analysis,
    });

    const result = await askAI({
      feature: 'kit-configurator',
      tier: KIT_CONFIGURATOR_SPEC.tier,
      system,
      prompt,
      maxTokens: 4_000,
      reasoningBudget: KIT_CONFIGURATOR_SPEC.maxReasoningBudget,
      cacheTtlSeconds: 0,
      userId: user?.id,
    });

    // ── 3. Validation Zod + sanitize « never fabricate » → fallback si échec ──
    const { data: aiData, usedFallback, fabricatedDropped } = resolveKitAIOutput({
      result: { degraded: result.degraded, text: result.text },
      sourceable,
      sessionParams,
      analysis,
    });
    if (usedFallback) {
      console.warn('[kit-report] IA dégradée/inexploitable → fallback déterministe');
    }
    if (fabricatedDropped > 0) {
      console.warn('[kit-report] alternatives fabriquées supprimées:', fabricatedDropped);
    }

    // Compute weight breakdown by category (inchangé)
    const weightBreakdown: Record<string, number> = {};
    let totalWeightG = 0;
    let totalPriceEur = 0;

    for (const item of selectedItems) {
      const cat = item.category || 'Autre';
      weightBreakdown[cat] = (weightBreakdown[cat] ?? 0) + item.weight_g;
      totalWeightG += item.weight_g;
      totalPriceEur += item.price_eur;
    }

    // Enrich selected items with justifications (inchangé)
    const enrichedItems = selectedItems.map(item => ({
      ...item,
      justification: aiData?.justifications?.[item.id] ?? `Recommandé pour ${sessionParams.activity} en ${sessionParams.season}.`,
      sourceable: true,
    }));

    // Save session + report if user is logged in (inchangé)
    let reportId: string | null = null;
    if (user) {
      const { data: session } = await supabase
        .from('configurator_sessions')
        .insert({
          user_id: user.id,
          destination: sessionParams.destination,
          country: sessionParams.country,
          start_date: sessionParams.startDate || null,
          end_date: sessionParams.endDate || null,
          season: sessionParams.season,
          activity: sessionParams.activity,
          level: sessionParams.level,
          max_weight_g: sessionParams.maxWeightG,
          budget_eur: sessionParams.budgetEur,
          body_weight_kg: sessionParams.bodyWeightKg ?? null,
          climate: sessionParams.climate ?? '',
        })
        .select('id')
        .single();

      const { data: report } = await supabase
        .from('kit_reports')
        .insert({
          user_id: user.id,
          session_id: session?.id ?? null,
          destination: sessionParams.destination,
          country: sessionParams.country,
          start_date: sessionParams.startDate || null,
          end_date: sessionParams.endDate || null,
          season: sessionParams.season,
          activity: sessionParams.activity,
          level: sessionParams.level,
          climate: sessionParams.climate ?? '',
          body_weight_kg: sessionParams.bodyWeightKg ?? null,
          budget_eur: sessionParams.budgetEur,
          selected_items: enrichedItems,
          alternatives: aiData.alternatives ?? {},
          consumables: aiData.consumables ?? [],
          bring_yourself: aiData.bring_yourself ?? [],
          weight_breakdown: weightBreakdown,
          total_weight_g: totalWeightG,
          total_price_eur: totalPriceEur,
          carbon_kg_estimate: aiData.carbon_kg_estimate ?? null,
          status: 'active',
        })
        .select('id')
        .single();

      reportId = report?.id ?? null;
    }

    return NextResponse.json({
      reportId,
      sessionParams,
      prefilledFrom,
      selectedItems: enrichedItems,
      alternatives: aiData.alternatives ?? {},
      consumables: aiData.consumables ?? [],
      bring_yourself: aiData.bring_yourself ?? [],
      weightBreakdown,
      totalWeightG,
      totalPriceEur,
      carbonKgEstimate: aiData.carbon_kg_estimate ?? null,
      destinationContext: aiData.destination_context ?? null,
      degraded: result.degraded,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('Kit report generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur de génération' },
      { status: 500 }
    );
  }
}
