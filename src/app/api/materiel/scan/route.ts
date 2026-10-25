import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanRequestSchema, productOwnershipSchema } from '@/lib/schemas/materiel';
import { parseScanExtract } from '@/lib/materiel/scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/materiel/scan — scan OCR/Barcode d'un article via Gemini Vision.
 * Reçoit une data URL d'image (webcam / upload), extrait marque/modèle/poids/matière
 * et retourne une fiche pré-remplie. Auto-enregistrement en inventaire si connecté.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const parsed = scanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Image manquante' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback sans IA : brouillon neutre, pas de crash.
      return NextResponse.json({
        draft: { name: 'Article scanné', brand: null, category: 'Autre', weight_g: 0 },
        extracted: {},
        saved: false,
        confidence: 0,
      });
    }

    const imageData = parsed.data.image_data_url;
    const base64 = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64,
                  },
                },
                {
                  text: `Extrais depuis cette photo d'équipement outdoor : marque, modèle, type d'article, poids estimé en grammes, matière principale. Réponds UNIQUEMENT en JSON strict : {"brand":"...","model":"...","category":"...","weight_g_estimate":0,"material":"...","confidence":0.0,"barcode":"...ou vide"}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );

    if (!response.ok) {
      // Fallback sans IA : brouillon neutre (pas de crash).
      return NextResponse.json({
        draft: { name: 'Article scanné', brand: null, category: 'Autre', weight_g: 0 },
        extracted: {},
        saved: false,
        confidence: 0,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let extracted: {
      brand?: string;
      model?: string;
      category?: string;
      weight_g_estimate?: number;
      material?: string;
      confidence?: number;
      barcode?: string;
    } = {};

    extracted = parseScanExtract(text);

    // Créer un brouillon de fiche à partir de l'extraction
    const draft = {
      name:
        [extracted.brand, extracted.model || extracted.category]
          .filter(Boolean)
          .join(' ') || 'Article scanné',
      brand: extracted.brand || null,
      category: productOwnershipSchema.shape.category.unwrap().options.find(
        (c: string) => c.toLowerCase().includes((extracted.category ?? '').toLowerCase().slice(0, 6))
      ) || 'Autre',
      weight_g: extracted.weight_g_estimate ?? 0,
      barcode: extracted.barcode || null,
    };

    let saved = false;
    if (user) {
      const result = productOwnershipSchema.safeParse({
        ...draft,
        condition: 'bon',
      });
      if (result.success) {
        const { data: savedItem } = await supabase
          .from('product_ownership')
          .insert({ user_id: user.id, ...result.data })
          .select('*')
          .single();
        if (savedItem) saved = true;
      }
    }

    return NextResponse.json({ draft, extracted, saved, confidence: extracted.confidence ?? 0 });
  } catch (err) {
    console.error('POST /api/materiel/scan', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}