import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SessionParams {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  season: string;
  activity: string;
  level: string;
  maxWeightG: number;
  budgetEur: number;
  bodyWeightKg?: number;
  climate?: string;
}

interface ProductItem {
  id: string;
  name: string;
  brand: string;
  slug: string;
  category: string;
  weight_g: number;
  price_eur: number;
  description: string;
  image: string;
  image_alt: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const { sessionParams, selectedItems }: { sessionParams: SessionParams; selectedItems: ProductItem[] } = body;

    if (!sessionParams || !selectedItems) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Fetch products from DB that are sourceable (stock > 0)
    const { data: dbProducts } = await supabase
      .from('products')
      .select('id, slug, name, brand, category, weight_g, price_eur, description, image, image_alt, stock')
      .gt('stock', 0)
      .order('category');

    const sourceable = dbProducts ?? [];

    // Build AI prompt for justifications + alternatives + consumables
    const itemsForAI = selectedItems.map(item => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      weight_g: item.weight_g,
      price_eur: item.price_eur,
    }));

    const systemPrompt = `Tu es un expert équipement outdoor. Tu génères des rapports de kit personnalisés en JSON strict.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaires.`;

    const userPrompt = `Génère un rapport de kit pour ce voyage :
- Destination : ${sessionParams.destination} (${sessionParams.country})
- Dates : ${sessionParams.startDate} → ${sessionParams.endDate}
- Saison : ${sessionParams.season}
- Activité : ${sessionParams.activity}
- Niveau : ${sessionParams.level}
- Budget max : ${sessionParams.budgetEur}€
- Poids max : ${(sessionParams.maxWeightG / 1000).toFixed(1)}kg
${sessionParams.bodyWeightKg ? `- Poids corporel : ${sessionParams.bodyWeightKg}kg` : ''}
${sessionParams.climate ? `- Climat : ${sessionParams.climate}` : ''}

Articles sélectionnés :
${JSON.stringify(itemsForAI, null, 2)}

Catalogue disponible (sourceable) :
${JSON.stringify(sourceable.slice(0, 30).map(p => ({ id: p.id, name: p.name, brand: p.brand, category: p.category, weight_g: p.weight_g, price_eur: Number(p.price_eur) })), null, 2)}

Retourne ce JSON exact :
{
  "justifications": { "<item_id>": "phrase de justification IA pour ce voyage précis (1-2 phrases)" },
  "alternatives": {
    "<item_id>": {
      "eco": { "name": "...", "brand": "...", "price_eur": 0, "reason": "..." },
      "premium": { "name": "...", "brand": "...", "price_eur": 0, "reason": "..." }
    }
  },
  "consumables": [
    { "name": "...", "category": "...", "reason": "...", "estimated_price_eur": 0 }
  ],
  "bring_yourself": [
    { "item": "...", "guide": "...", "affiliate_hint": "..." }
  ],
  "carbon_kg_estimate": 0,
  "destination_context": {
    "weather_summary": "...",
    "security_level": "faible|modéré|élevé",
    "security_notes": "...",
    "country_page_code": "${sessionParams.country.toLowerCase().replace(/\s+/g, '-')}"
  }
}`;

    const aiResponse = await getChatCompletion(
      'GEMINI',
      'gemini/gemini-2.5-flash',
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.4, max_tokens: 4000 }
    );

    let aiData: {
      justifications: Record<string, string>;
      alternatives: Record<string, { eco: { name: string; brand: string; price_eur: number; reason: string }; premium: { name: string; brand: string; price_eur: number; reason: string } }>;
      consumables: { name: string; category: string; reason: string; estimated_price_eur: number }[];
      bring_yourself: { item: string; guide: string; affiliate_hint: string }[];
      carbon_kg_estimate: number;
      destination_context: { weather_summary: string; security_level: string; security_notes: string; country_page_code: string };
    };

    try {
      const raw = aiResponse.choices[0].message.content ?? '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiData = JSON.parse(cleaned);
    } catch {
      aiData = {
        justifications: {},
        alternatives: {},
        consumables: [],
        bring_yourself: [
          { item: 'Chaussures de randonnée', guide: 'Choisir selon le terrain et la durée', affiliate_hint: '' },
          { item: 'Vêtements techniques', guide: 'Adapter aux conditions climatiques', affiliate_hint: '' },
        ],
        carbon_kg_estimate: 0,
        destination_context: {
          weather_summary: `Conditions typiques pour ${sessionParams.destination} en ${sessionParams.season}`,
          security_level: 'modéré',
          security_notes: 'Consultez la fiche pays pour les informations de sécurité actualisées.',
          country_page_code: sessionParams.country.toLowerCase().replace(/\s+/g, '-'),
        },
      };
    }

    // Compute weight breakdown by category
    const weightBreakdown: Record<string, number> = {};
    let totalWeightG = 0;
    let totalPriceEur = 0;

    for (const item of selectedItems) {
      const cat = item.category || 'Autre';
      weightBreakdown[cat] = (weightBreakdown[cat] ?? 0) + item.weight_g;
      totalWeightG += item.weight_g;
      totalPriceEur += item.price_eur;
    }

    // Enrich selected items with justifications
    const enrichedItems = selectedItems.map(item => ({
      ...item,
      justification: aiData.justifications?.[item.id] ?? `Recommandé pour ${sessionParams.activity} en ${sessionParams.season}.`,
      sourceable: true,
    }));

    // Save session + report if user is logged in
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
      selectedItems: enrichedItems,
      alternatives: aiData.alternatives ?? {},
      consumables: aiData.consumables ?? [],
      bring_yourself: aiData.bring_yourself ?? [],
      weightBreakdown,
      totalWeightG,
      totalPriceEur,
      carbonKgEstimate: aiData.carbon_kg_estimate ?? null,
      destinationContext: aiData.destination_context ?? null,
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
