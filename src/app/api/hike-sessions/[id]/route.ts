import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import { createClient } from '@/lib/supabase/server';
import {
  projectOutingMetrics,
  resolveOutingMetricVisibility,
} from '@/features/compte/domain/metricVisibility';
import {
  isFollowerTraceVisibility,
  isShareableTraceVisibility,
  type TraceViewer,
} from '@/features/compte/server/tracePrivacy';
import { parseStoredWeather, weatherForViewer } from '@/features/compte/server/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
     * Autorisation de la route : propriétaire, participant inscrit, ou sortie
     * explicitement partageable rattachée à un carnet que le lecteur peut voir.
     * `public` et `friends` ne sont plus des passe-droits autonomes : même
     * hérités, ils passent par `can_view_carnet`. Une sortie privée d'un carnet
     * public, ou une sortie partageable sans carnet, n'est jamais servie ici.
     */
    const carnetId = typeof safeSession.carnet_id === 'string' ? safeSession.carnet_id : null;
    const wantsCarnetShare =
      isShareableTraceVisibility(rawVisibility) || isFollowerTraceVisibility(rawVisibility);
    const canViewSharedCarnet =
      carnetId && wantsCarnetShare
        ? (await supabase.rpc('can_view_carnet', { p_carnet: carnetId })).data === true
        : false;
    const canRead =
      isOwner ||
      isParticipant ||
      (isShareableTraceVisibility(rawVisibility) && canViewSharedCarnet) ||
      (isFollowerTraceVisibility(rawVisibility) &&
        viewer === 'follower' &&
        canViewSharedCarnet);
    if (!canRead) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    /*
     * S6.15 — la politique par métrique s'applique aux métadonnées agrégées de
     * cette route. Le propriétaire et le participant voient tout ; un visiteur
     * ou un abonné vérifié reçoit soit sa politique persistée, soit le socle
     * agrégé déjà publié par la visibilité. Sans clé service, la lecture RLS ne
     * rend aucune politique à un tiers : on retombe sur le socle, jamais sur
     * une autorisation inventée.
     */
    let metricPolicy: unknown;
    if (
      !isOwner &&
      !isParticipant &&
      (isShareableTraceVisibility(rawVisibility) ||
        (viewer === 'follower' && isFollowerTraceVisibility(rawVisibility)))
    ) {
      const { data: metricRow } = await sessionClient
        .from('outing_share_metrics')
        .select('visibility')
        .eq('session_id', id)
        .maybeSingle();
      metricPolicy = (metricRow as { visibility?: unknown } | null)?.visibility;
    }
    const metricVisibility = resolveOutingMetricVisibility({
      viewer,
      visibility: rawVisibility,
      policy: metricPolicy,
    });

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

    /*
     * Projection finale : une métrique non autorisée devient `null`, jamais 0.
     * Les horodatages de début/fin sont retirés avec la durée, sinon la durée
     * resterait dérivable malgré le masque.
     */
    const projectedMetrics = projectOutingMetrics(
      {
        distanceKm: numberOrNull(safeSession.distance_km),
        elevationGainM: numberOrNull(safeSession.elevation_gain_m),
        maxAltitudeM: numberOrNull(safeSession.max_altitude_m),
        durationS: numberOrNull(safeSession.duration_seconds),
        paceMinPerKm: null,
        movingTimeS: null,
        heartRateBpm: null,
        powerW: null,
        cadenceRpm: null,
        caloriesKcal: null,
      },
      metricVisibility
    );
    safeSession.distance_km = projectedMetrics.distanceKm;
    safeSession.elevation_gain_m = projectedMetrics.elevationGainM;
    safeSession.max_altitude_m = projectedMetrics.maxAltitudeM;
    safeSession.duration_seconds = projectedMetrics.durationS;
    if (!metricVisibility.duration) {
      safeSession.started_at = null;
      safeSession.ended_at = null;
    }
    /* La politique appliquée est exposée : le client ne dérive rien lui-même. */
    safeSession.metric_visibility = metricVisibility;
    safeSession.metrics_masked = projectedMetrics.masked;

    return NextResponse.json({ session: safeSession });
  } catch (err) {
    console.error('[hike-sessions] exception', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
