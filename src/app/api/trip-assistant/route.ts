import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/trip-assistant
 * Assistant IA de préparation de randonnée.
 * Prend les paramètres du voyage, le matériel de l'utilisateur,
 * et génère des recommandations personnalisées.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const { destination, duration_days, difficulty, season, question } = body;

    if (!question) {
      return NextResponse.json({ error: 'Question manquante' }, { status: 400 });
    }

    // Charger le matériel de l'utilisateur
    let gearContext = 'Aucun matériel enregistré dans l\'inventaire.';
    if (user) {
      const { data: gear } = await supabase
        .from('gear_items')
        .select('name, brand, category, weight_g')
        .eq('user_id', user.id)
        .limit(30);

      if (gear && gear.length > 0) {
        gearContext = `Matériel de l'utilisateur (${gear.length} articles) :\n` +
          gear.map((g) => `- ${g.name}${g.brand ? ` (${g.brand})` : ''}, ${g.category}${g.weight_g ? `, ${g.weight_g}g` : ''}`).join('\n');
      }
    }

    const systemPrompt = `Tu es un expert en randonnée et préparation outdoor pour Le Kit du Voyageur.
Tu réponds de manière concise, pratique et personnalisée en tenant compte du matériel existant de l'utilisateur.
Tu réponds en JSON strict avec deux champs : "answer" (réponse principale, 2-5 phrases) et "tips" (tableau de 3 conseils courts).
Ne génère JAMAIS de markdown dans les valeurs JSON. Réponds UNIQUEMENT du JSON valide.`;

    const contextParts = [
      destination && `Destination : ${destination}`,
      duration_days && `Durée : ${duration_days} jour${duration_days > 1 ? 's' : ''}`,
      difficulty && `Niveau : ${difficulty}`,
      season && `Saison : ${season}`,
    ].filter(Boolean).join('\n');

    const userPrompt = `${contextParts ? `Contexte du voyage :\n${contextParts}\n\n` : ''}${gearContext}\n\nQuestion : ${question}`;

    const aiResponse = await getChatCompletion(
      'GEMINI',
      'gemini/gemini-2.5-flash',
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.5, max_tokens: 1000 }
    );

    let result: { answer: string; tips: string[] };
    try {
      const raw = aiResponse.choices[0].message.content ?? '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      result = {
        answer: parsed.answer || 'Je ne peux pas répondre à cette question pour le moment.',
        tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : [],
      };
    } catch {
      const raw = aiResponse.choices[0].message.content ?? '';
      result = {
        answer: raw.slice(0, 500) || 'Erreur de génération.',
        tips: [],
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[trip-assistant]', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
