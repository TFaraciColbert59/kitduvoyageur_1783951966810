import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { optimizeRequestSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface KitLine { name: string; category: string | null; weight_g: number; quantity: number }

function fallbackAnalysis(goal: string, kitName: string | null, kitItems: KitLine[], currentKg: number): Record<string, unknown> {
  const heaviest = [...kitItems].sort((a, b) => (b.weight_g ?? 0) - (a.weight_g ?? 0))[0];
  return {
    analysis: `Analyse locale (IA non configurée) : kit « ${kitName ?? 'inconnu'} » à ${currentKg.toFixed(2)} kg. Objectif : ${goal}.`,
    removals: heaviest ? [{ item: heaviest.name ?? 'Article', reason: 'Article le plus lourd — retirez-le si non essentiel.', weight_g: heaviest.weight_g }] : [],
    replacements: [],
    additions: [],
    after_weight_kg: Math.max(0, currentKg - (heaviest?.weight_g ? heaviest.weight_g / 1000 : 0)),
    after_price_eur_estimate: 0,
    co2_kg_saved_estimate: 0,
    score: 0,
  };
}

/** POST /api/materiel/optimize — optimisation de kit par IA (stream) avec fallback déterministe. */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const parsed = optimizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Requête invalide' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    let kit = null;
    let inventory: Array<{ name: string; category: string; weight_g: number; brand?: string | null }> = [];

    if (user && parsed.data.kit_id) {
      const { data: kitData } = await supabase
        .from('materiel_kits')
        .select('*, materiel_kit_items(*)')
        .eq('id', parsed.data.kit_id)
        .eq('user_id', user.id)
        .single();
      kit = kitData ?? null;

      const { data: gear } = await supabase
        .from('product_ownership')
        .select('name, category, weight_g, brand')
        .eq('user_id', user.id);
      inventory = gear ?? [];
    }

    const kitItems: KitLine[] = kit?.materiel_kit_items ?? [];
    const currentKg = kitItems.reduce((s, i) => s + (i.weight_g ?? 0) * (i.quantity ?? 1), 0) / 1000;

    let parsedJson: Record<string, unknown>;

    if (!apiKey) {
      parsedJson = fallbackAnalysis(parsed.data.goal, kit?.name ?? null, kitItems, currentKg);
    } else {
      const prompt = `Tu es l'optimiseur de pack du Kit du Voyageur. Objectif : ${parsed.data.goal}${parsed.data.target_kg ? ` (poids cible ${parsed.data.target_kg} kg)` : ''}.

Kit actuel (${kit?.name ?? 'inconnu'}):
${JSON.stringify(kitItems.map((i) => ({ name: i.name, cat: i.category, g: i.weight_g, qty: i.quantity })))}

Poids actuel: ${currentKg.toFixed(2)} kg

Inventaire disponible (articles possédés):
${JSON.stringify(inventory.map((i) => ({ name: i.name, cat: i.category, g: i.weight_g, brand: i.brand })))}

Réponds UNIQUEMENT en JSON strict:
{
  "analysis": "analyse en français, 2-3 phrases",
  "removals": [{"item":"...", "reason":"..."}],
  "replacements": [{"item":"...", "with":"...", "reason":"..."}],
  "additions": [{"item":"...", "category":"...", "weight_g_estimate":0, "reason":"..."}],
  "after_weight_kg": 0,
  "after_price_eur_estimate": 0,
  "co2_kg_saved_estimate": 0,
  "score": 0
}`;

      try {
        const gemini = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
            }),
          }
        );

        if (!gemini.ok) {
          parsedJson = fallbackAnalysis(parsed.data.goal, kit?.name ?? null, kitItems, currentKg);
        } else {
          const data = await gemini.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          try {
            parsedJson = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
          } catch {
            parsedJson = {
              analysis: 'Analyse non structurée: ' + text.slice(0, 300),
              removals: [], replacements: [], additions: [],
              after_weight_kg: currentKg, after_price_eur_estimate: 0, co2_kg_saved_estimate: 0, score: 0,
            };
          }
        }
      } catch {
        parsedJson = fallbackAnalysis(parsed.data.goal, kit?.name ?? null, kitItems, currentKg);
      }
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const payload = { type: 'chunk', chunk: { content: JSON.stringify(parsedJson) } };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('POST /api/materiel/optimize', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
