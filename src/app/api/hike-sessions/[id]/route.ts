import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { isFollowerTraceVisibility, type TraceViewer } from '@/features/compte/server/tracePrivacy';
import { parseStoredWeather, weatherForViewer } from '@/features/compte/server/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const viewerId = authData?.user?.id ?? null;

    /*
     * La table brute est réservée au propriétaire et aux participants. Cette
     * route ne sert que des métadonnées sûres : elle lit donc la ligne avec le
     * client serveur, puis vérifie elle-même l'autorisation avant de répondre.
     * Sans clé service, on retombe sur la RLS utilisateur (fail-closed).
     */
    const sessionClient = createServiceClient() ?? supabase;
    const { data: session, error } = await sessionClient
      .from('hike_sessions')
      // Jamais `*` : ni positions GPS, ni notes privées dans la réponse.
      .select(
        'id, user_id, route_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, max_altitude_m, title, visibility, processing_status, track_quality, weather, created_at'
      )
      .eq('id', id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    const { user_id: ownerId, ...safeSession } = session as Record<string, unknown> & {
      user_id?: string | null;
      weather?: unknown;
      visibility?: string | null;
    };
    const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);
    const rawVisibility =
      typeof safeSession.visibility === 'string' ? safeSession.visibility : null;

    /*
     * Rôle de lecture réel, jamais déduit de la seule valeur `visibility` :
     * un participant inscrit garde la météo exacte ; un abonné n'est reconnu
     * qu'après lecture de `user_follows`. Tout le reste est visiteur.
     */
    let viewer: TraceViewer = isOwner ? 'owner' : 'visitor';
    let isParticipant = false;
    if (!isOwner && viewerId) {
      const { data: participant } = await supabase
        .from('hike_session_participants')
        .select('user_id')
        .eq('session_id', id)
        .eq('user_id', viewerId)
        .maybeSingle();
      if (participant) {
        isParticipant = true;
        viewer = 'participant';
      } else if (isFollowerTraceVisibility(rawVisibility) && ownerId) {
        const { data: follow } = await supabase
          .from('user_follows')
          .select('follower_id')
          .eq('follower_id', viewerId)
          .eq('following_id', ownerId)
          .maybeSingle();
        if ((follow as { follower_id?: string | null } | null)?.follower_id) {
          viewer = 'follower';
        }
      }
    }

    /*
     * Autorisation de la route : propriétaire, participant, sortie publique,
     * abonné vérifié, ou sortie collective d'un carnet que le lecteur peut
     * voir. Une sortie privée d'un carnet public n'est jamais servie ici :
     * c'est le trou que la policy historique laissait ouvert.
     */
    const carnetId = typeof safeSession.carnet_id === 'string' ? safeSession.carnet_id : null;
    const canReadSharedCarnet =
      rawVisibility === 'collective_anonymized' &&
      Boolean(carnetId) &&
      (await supabase.rpc('can_view_carnet', { p_carnet: carnetId })).data === true;
    const canRead =
      isOwner ||
      isParticipant ||
      rawVisibility === 'public' ||
      (isFollowerTraceVisibility(rawVisibility) && viewer === 'follower') ||
      canReadSharedCarnet;
    if (!canRead) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    if (!isOwner) {
      /*
       * La météo stockée porte le point exact utilisé pour l'interroger, donc
       * souvent le vrai départ. La politique centralisée `weatherForViewer`
       * supprime les coordonnées pour un lecteur autorisé et supprime toute
       * météo pour `private`, `null`, `friends` non suivi ou valeur inconnue.
       */
      safeSession.weather = weatherForViewer(
        parseStoredWeather(safeSession.weather),
        viewer,
        rawVisibility
      );
    }

    // `notes` n'est jamais sélectionné ; ceinture et bretelles si la colonne
    // revenait un jour dans le select.
    delete safeSession.notes;

    return NextResponse.json({ session: safeSession });
  } catch (err) {
    console.error('[hike-sessions] exception', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
