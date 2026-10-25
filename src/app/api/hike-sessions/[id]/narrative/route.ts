import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Narratives {
  journal: string;
  aventure: string;
  sportive: string;
  generated_at: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    // Récupérer la session
    const { data: session, error: sessionError } = await supabase
      .from('hike_sessions')
      .select('id, user_id, route_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, poi_events, narratives')
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Récupérer le nom de la route si disponible
    let routeName: string | null = null;
    if (session.route_id) {
      const { data: route } = await supabase
        .from('hiking_routes')
        .select('name, ref')
        .eq('id', session.route_id)
        .maybeSingle();
      routeName = route?.name || route?.ref || null;
    }

    // Récupérer les moments manuels du carnet liés à cette session
    let manualNotes: string[] = [];
    if (session.carnet_id) {
      const { data: moments } = await supabase
        .from('carnet_moments')
        .select('citation, heure, lieu')
        .eq('hike_session_id', id)
        .eq('source', 'manuel')
        .order('moment_timestamp', { ascending: true });

      manualNotes = (moments || [])
        .map((m) => [m.heure, m.citation, m.lieu].filter(Boolean).join(' — '))
        .filter(Boolean);
    }

    const poiEvents: { poiName: string; reachedAt: string }[] =
      Array.isArray(session.poi_events) ? session.poi_events : [];

    const systemPrompt = `Tu rédiges le récit d'une randonnée réelle à partir des données fournies. 
N'invente AUCUN détail non présent dans les données (pas de météo, pas d'événements, pas de rencontres non mentionnées) — 
reste factuel sur la base de ce qui est donné, le style change mais pas les faits. 
Réponds en JSON strict, sans markdown, sans commentaires.`;

    const userPrompt = `Voici les données de la randonnée :
- Nom de l'itinéraire : ${routeName || 'Randonnée libre'}
- Date : ${new Date(session.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
- Départ : ${new Date(session.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
- Arrivée : ${new Date(session.ended_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
- Distance : ${Number(session.distance_km).toFixed(1)} km
- Durée : ${formatDuration(session.duration_seconds)}
- Dénivelé positif : ${session.elevation_gain_m ? Math.round(session.elevation_gain_m) + ' m' : 'non disponible'}
${poiEvents.length > 0 ? `- Points de passage : ${poiEvents.map((p) => `${p.poiName} (${new Date(p.reachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`).join(', ')}` : ''}
${manualNotes.length > 0 ? `- Notes du carnet : ${manualNotes.join(' | ')}` : ''}

Génère les 3 versions dans ce JSON exact :
{
  "journal": "récit à la première personne, ton posé, chronologique, 3-5 phrases",
  "aventure": "récit narratif, ton plus vivant, orienté sensations, 3-5 phrases",
  "sportive": "résumé factuel condensé : distance/dénivelé/temps en avant, phrases courtes, style fiche de performance"
}`;

    const aiResponse = await getChatCompletion(
      'GEMINI',
      'gemini/gemini-2.5-flash',
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.6, max_tokens: 2000 }
    );

    let parsed: Narratives;
    try {
      const raw = aiResponse.choices[0].message.content ?? '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const data = JSON.parse(cleaned);
      parsed = {
        journal: data.journal || '',
        aventure: data.aventure || '',
        sportive: data.sportive || '',
        generated_at: new Date().toISOString(),
      };
    } catch {
      return NextResponse.json({ error: 'Erreur de parsing IA' }, { status: 500 });
    }

    // Sauvegarder dans hike_sessions.narratives
    const { error: updateError } = await supabase
      .from('hike_sessions')
      .update({ narratives: parsed })
      .eq('id', id);

    if (updateError) {
      console.error('[narrative] update error:', updateError);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[narrative] error:', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
