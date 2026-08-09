import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SpeciesResult {
  name: string;           // Nom scientifique
  common_name: string;    // Nom commun français
  confidence: 'haute' | 'moyenne' | 'faible';
  description: string;    // 1-2 phrases sur l'espèce
  is_protected: boolean;
  group: 'plante' | 'champignon' | 'animal' | 'insecte' | 'inconnu';
}

/**
 * POST /api/carnet/identify-species
 * Identification IA d'espèces depuis une photo.
 * Body: { momentId?, imageBase64, mimeType }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await req.json();
    const { momentId, imageBase64, mimeType = 'image/jpeg' } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image manquante' }, { status: 400 });
    }

    // Construction du message multimodal Gemini Vision
    const systemPrompt = `Tu es un expert en biodiversité et naturaliste de terrain.
Tu identifies les espèces présentes dans les photos prises en milieu naturel.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaires.`;

    const userMessage = {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
          },
        },
        {
          type: 'text',
          text: `Identifie l'espèce présente dans cette photo.
Si plusieurs espèces sont visibles, identifie la plus prominente.
Si aucune espèce n'est clairement identifiable, indique "inconnu".

Réponds avec ce JSON exact :
{
  "name": "nom scientifique",
  "common_name": "nom commun en français",
  "confidence": "haute|moyenne|faible",
  "description": "description courte de l'espèce (1-2 phrases)",
  "is_protected": true/false,
  "group": "plante|champignon|animal|insecte|inconnu"
}`,
        },
      ],
    };

    const aiResponse = await getChatCompletion(
      'GEMINI',
      'gemini/gemini-2.0-flash',
      [
        { role: 'system', content: systemPrompt },
        userMessage,
      ],
      { temperature: 0.2, max_tokens: 500 }
    );

    let species: SpeciesResult;
    try {
      const raw = aiResponse.choices[0].message.content ?? '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      species = JSON.parse(cleaned);
    } catch {
      species = {
        name: 'Inconnu',
        common_name: 'Espèce non identifiée',
        confidence: 'faible',
        description: 'L\'identification automatique n\'a pas pu aboutir.',
        is_protected: false,
        group: 'inconnu',
      };
    }

    // Si un momentId est fourni, sauvegarder dans carnet_moments.identified_species
    if (momentId) {
      const { error: updateError } = await supabase
        .from('carnet_moments')
        .update({
          identified_species: [species],
        })
        .eq('id', momentId);

      if (updateError) {
        console.error('[identify-species] update error:', updateError);
      }
    }

    return NextResponse.json(species);
  } catch (err) {
    console.error('[identify-species]', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
