import 'server-only';
import { createServiceClient } from '@/lib/api/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { buildCarnetDetail } from './buildCarnetDetail';
import { enrichCarnetElevation } from './enrichElevation';
import { loadCarnetMemberKits } from './memberKits';
import { isSessionInCarnetWindow, pickCarnetTraceSession } from './trace';
import {
  isShareableTraceVisibility,
  mostRestrictiveTraceVisibility,
} from '@/features/compte/server/tracePrivacy';
import {
  resolveOutingMetricVisibility,
  type OutingMetricVisibility,
} from '@/features/compte/domain/metricVisibility';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type {
  AuthorRow,
  CarnetBudget,
  CarnetDayReactionItem,
  CarnetLivePosition,
  CarnetMomentEngagementItem,
  CarnetNightItem,
  CarnetPublicZone,
  CarnetRow,
  EtapeRow,
  HikeSessionRow,
  KitItemRow,
  MomentRow,
} from './types';

interface CollaboratorRow {
  carnet_id: string | null;
  user_id: string | null;
  role: string | null;
  created_at: string | null;
}

interface SessionParticipantRow {
  session_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

const CARNET_COLUMNS_WITH_LIVE = [
  'id',
  'author_id',
  'title',
  'destination',
  'description',
  'cover_image',
  'cover_image_alt',
  'start_date',
  'end_date',
  'visibility',
  'verified',
  'likes_count',
  'comments_count',
  'views_count',
  'distance_km',
  'denivele_m',
  'lieu_depart',
  'lieu_arrivee',
  'country_iso',
  'trip_id',
  'map_points',
  'live_sharing',
  'budget_public',
].join(', ');

const CARNET_COLUMNS_BASE = [
  'id',
  'author_id',
  'title',
  'destination',
  'description',
  'cover_image',
  'cover_image_alt',
  'start_date',
  'end_date',
  'visibility',
  'verified',
  'likes_count',
  'comments_count',
  'views_count',
  'distance_km',
  'denivele_m',
  'lieu_depart',
  'lieu_arrivee',
  'country_iso',
  'trip_id',
  'map_points',
].join(', ');

/** Extrait la trace manuelle `carnets.map_points.trace` en GeoJSON LineString quand aucune `hike_session` n'existe. */
function parseManualCarnetTrace(mapPoints: unknown): { type: 'LineString'; coordinates: [number, number][] } | null {
  if (!mapPoints || typeof mapPoints !== 'object' || Array.isArray(mapPoints)) return null;
  const rawTrace = (mapPoints as { trace?: unknown }).trace;
  if (!Array.isArray(rawTrace) || rawTrace.length < 2) return null;
  const coordinates: [number, number][] = [];
  for (const pt of rawTrace) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      coordinates.push([lng, lat]);
    }
  }
  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
}

/**
 * Lit un carnet, son auteur, ses étapes, ses moments, son kit et l'engagement
 * du lecteur avec le client serveur (cookies) — la RLS voit donc la session :
 * un carnet privé reste lisible par son propriétaire.
 *
 * Depuis `20261112121000_carnet_v2_trace_raw_guard`, la table `hike_sessions`
 * n'est plus lisible par le partage : seuls le propriétaire et les participants
 * inscrits voient la ligne brute. La fiche, elle, doit aussi projeter une trace
 * masquée pour un visiteur ou un abonné. Elle lit donc les sorties avec le
 * client `service_role`, APRÈS avoir vérifié l'accès au carnet avec la RLS, puis
 * n'autorise les points/le profil/les statistiques que sortie par sortie
 * (`rawSessionIds`). Sans clé service, on retombe sur le client utilisateur :
 * le partage se dégrade, il ne s'ouvre pas.
 *
 * Retourne `null` si le carnet n'existe pas ou n'est pas lisible : la route
 * traduit cela en `notFound()`.
 */
export async function getCarnetDetail(id: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData?.user?.id ?? null;

  let carnetData: unknown = null;
  const initialResult = await supabase
    .from('carnets')
    .select(CARNET_COLUMNS_WITH_LIVE)
    .eq('id', id)
    .maybeSingle();

  if (initialResult.error?.code === '42703') {
    // Si la colonne live_sharing n'est pas encore appliquée sur la base distante
    const fallbackResult = await supabase
      .from('carnets')
      .select(CARNET_COLUMNS_BASE)
      .eq('id', id)
      .maybeSingle();
    if (fallbackResult.error || !fallbackResult.data) return null;
    carnetData = fallbackResult.data;
  } else if (initialResult.error || !initialResult.data) {
    return null;
  } else {
    carnetData = initialResult.data;
  }
  const carnet = carnetData as unknown as CarnetRow;

  /*
   * Les sorties sont lues avec le client serveur : la RLS de `hike_sessions`
   * ne rend les lignes brutes qu'au propriétaire et aux participants, alors
   * que la fiche doit aussi projeter une trace masquée pour un abonné ou un
   * visiteur. L'accès au carnet a déjà été vérifié ci-dessus par la RLS ;
   * `buildCarnetDetail` applique ensuite `tracePrivacy` avant de rendre quoi
   * que ce soit. Sans clé service, on retombe sur le client utilisateur : le
   * partage se dégrade, il ne s'ouvre pas.
   */
  const serviceClient = createServiceClient();
  const sessionClient = serviceClient ?? supabase;

  /* Tout ce qui ne dépend que du carnet part dans le même `Promise.all` :
     auteur, sorties, étapes, moments, kit, collaborateurs,
     identifiants de sorties, j'aime et favori du lecteur. Une seule vague de
     requêtes, donc un seul aller-retour au lieu de quatre. */
  const viewerFlags: Promise<[{ data: unknown }, { data: unknown }]> = viewerId
    ? Promise.all([
        supabase
          .from('carnet_likes')
          .select('carnet_id')
          .eq('carnet_id', carnet.id)
          .eq('user_id', viewerId)
          .maybeSingle(),
        supabase
          .from('carnet_favorites')
          .select('carnet_id')
          .eq('carnet_id', carnet.id)
          .eq('user_id', viewerId)
          .maybeSingle(),
      ])
    : Promise.resolve([{ data: null }, { data: null }] as [{ data: unknown }, { data: unknown }]);

  const [
    [
      authorResult,
      hikeResult,
      etapesResult,
      momentsResult,
      kitResult,
      likesRows,
      likesTotal,
      commentsTotal,
      collabResult,
      sessionIdResult,
      nightsResult,
      dayLikesResult,
      dayCommentsResult,
    ],
    [likeResult, favoriteResult],
  ] = await Promise.all([
    Promise.all([
      supabase
        .from('public_profiles')
        .select('id, full_name, handle, avatar_url, trust_score')
        .eq('id', carnet.author_id ?? '')
        .maybeSingle(),
      /* Toutes les sorties du carnet : la plus récente porte les statistiques,
         la plus récente *avec une trace* porte le parcours 3D. */
      sessionClient
        .from('hike_sessions')
        .select(
          'id, user_id, carnet_id, visibility, distance_km, elevation_gain_m, duration_seconds, started_at, positions_geojson, positions_timed',
        )
        .eq('carnet_id', carnet.id)
        .order('started_at', { ascending: false })
        .limit(10),
      /* Étapes du carnet (`carnet_etapes`, RLS `can_view_carnet`) : une erreur
         ou une table vide donne `[]`, jamais d'étape inventée. */
      supabase
        .from('carnet_etapes')
        .select(
          'id, jour_numero, ordre, date_etape, lieu_depart, lieu_arrivee, recit, distance_km, denivele_m, duree_texte, meteo, temperature_c',
        )
        .eq('carnet_id', carnet.id)
        .order('jour_numero', { ascending: true })
        .order('ordre', { ascending: true }),
      /* Colonnes de la v2 (`auteur_id`, `moment_type`, `moment_meta`) : la
         migration 20261109100001 n'est peut-être pas appliquée, on retombe alors
         sur la lecture historique (type déduit, jamais inventé). */
      supabase
        .from('carnet_moments')
        .select('id, jour_numero, heure, citation, auteur_nom, lieu, image_url, auteur_id, moment_type, moment_meta')
        .eq('carnet_id', carnet.id)
        .order('jour_numero', { ascending: true })
        .order('created_at', { ascending: true })
        .then((res) => {
          if (res.error?.code === '42703') {
            return supabase
              .from('carnet_moments')
              .select('id, jour_numero, heure, citation, auteur_nom, lieu, image_url')
              .eq('carnet_id', carnet.id)
              .order('jour_numero', { ascending: true })
              .order('created_at', { ascending: true });
          }
          return res;
        }),
      supabase
        .from('carnet_kit_items')
        .select('id, nom, detail, poids_g, couleur_tag, sort_order, verdict, verdict_note, jours_utilises')
        .eq('carnet_id', carnet.id)
        .order('sort_order', { ascending: true })
        .then((res) => {
          if (res.error?.code === '42703') {
            return supabase
              .from('carnet_kit_items')
              .select('id, nom, detail, poids_g, couleur_tag, sort_order')
              .eq('carnet_id', carnet.id)
              .order('sort_order', { ascending: true });
          }
          return res;
        }),
      /* Réactions réelles : les 50 dernières lignes, plus le total exact. */
      supabase
        .from('carnet_likes')
        .select('user_id, reaction, created_at')
        .eq('carnet_id', carnet.id)
        .order('created_at', { ascending: false })
        .limit(50),
      /* Deux compteurs lus, un seul coût réseau : voir `counts` en bas de
         fonction — la valeur rendue est identique à l'ancienne, requête de trop
         en moins. */
      supabase.from('carnet_likes').select('carnet_id', { count: 'exact', head: true }).eq('carnet_id', carnet.id),
      /* Comptage réel des commentaires (le total des j'aime était affiché). */
      supabase.from('carnet_comments').select('carnet_id', { count: 'exact', head: true }).eq('carnet_id', carnet.id),
      /* Participants réels : collaborateurs du carnet + présents des sorties du
         carnet. Les deux lectures passent par le client à cookies, donc par la RLS :
         `carnet_collaborators_read_scoped` laisse lire les carnets publics, et
         `hike_participants_select` (via `can_view_hike_session`) ne rend que les
         sorties visibles pour ce lecteur. Un refus de la RLS n'est pas une erreur
         de la fiche : on garde ce qui est lisible, sans rien inventer. */
      supabase
        .from('carnet_collaborators')
        .select('carnet_id, user_id, role, created_at')
        .eq('carnet_id', carnet.id)
        .order('created_at', { ascending: true }),
      /* Toutes les sorties du carnet, sans la limite de 10 de `hikeResult` :
         les présents d'une sortie ancienne comptent aussi. */
      sessionClient
        .from('hike_sessions')
        .select('id, started_at')
        .eq('carnet_id', carnet.id)
        .order('started_at', { ascending: false }),
      supabase
        .from('carnet_nights')
        .select('id, jour_numero, nom, type, altitude_m, infos, lat, lng, map_refuge_id')
        .eq('carnet_id', carnet.id)
        .order('jour_numero', { ascending: true }),
      supabase
        .from('carnet_day_likes')
        .select('jour_numero, user_id')
        .eq('carnet_id', carnet.id),
      supabase
        .from('carnet_day_comments')
        .select('id, jour_numero, author_id, created_at, deleted_at')
        .eq('carnet_id', carnet.id)
        .is('deleted_at', null),
    ]),
    viewerFlags,
  ]);

  const likeRows = (likesRows.data ?? []) as Array<{ user_id: string; reaction: string | null }>;

  const sessions = ((hikeResult as { data?: HikeSessionRow[] | null }).data ?? []) as HikeSessionRow[];

  const sessionIds = ((sessionIdResult.data ?? []) as Array<{ id: string }>).map((row) => row.id);

  /* Cette lecture dépend des identifiants de sorties : elle ne peut pas partir
     dans le même `Promise.all`. Un refus RLS (rôle anonyme sans le `EXECUTE` de
     `can_view_hike_session`) rend `data: null` : on lit `[]`, sans erreur. */
  const [sessionParticipantsResult, metricPolicyResult] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from('hike_session_participants')
          .select('session_id, user_id, role, created_at')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as SessionParticipantRow[] }),
    sessionIds.length > 0
      ? sessionClient
          .from('outing_share_metrics')
          .select('session_id, visibility')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: string; visibility: unknown }> }),
  ]);

  const collabRows = ((collabResult.data ?? []) as CollaboratorRow[]).filter((row) => row.user_id);
  const sessionParticipantRows = ((sessionParticipantsResult.data ?? []) as SessionParticipantRow[]).filter(
    (row) => row.user_id,
  );
  const metricPolicies = new Map<string, unknown>();
  for (const row of (metricPolicyResult.data ?? []) as Array<{
    session_id?: string | null;
    visibility?: unknown;
  }>) {
    if (row.session_id) metricPolicies.set(row.session_id, row.visibility);
  }

  const isOwner = Boolean(viewerId && carnet.author_id && viewerId === carnet.author_id);
  const isCollab = collabRows.some(
    (row) => row.user_id === viewerId && (row.role === 'owner' || row.role === 'contributor'),
  );
  /*
   * Le rôle de fiche (jours, budget, carnet) reste réservé à l'auteur et aux
   * collaborateurs. Un participant à une seule sortie ne doit pas voir les
   * autres jours, le budget ni les traces des autres sorties.
   */
  const isCarnetParticipant = isOwner || isCollab;
  const viewerRole = isCarnetParticipant ? ('participant' as const) : ('visitor' as const);

  /*
   * Autorisation PAR SORTIE. Le client service_role a lu toutes les lignes du
   * carnet, mais seules les sorties dont le lecteur est propriétaire ou
   * participant inscrit peuvent fournir des points GPS, un profil ou des
   * statistiques. Les `hike_session_participants` lues ci-dessus passent par la
   * RLS (`can_view_hike_session`) : un participant d'une sortie privée voit sa
   * ligne, pas celles des autres.
   */
  const participantSessionIds = new Set(
    sessionParticipantRows
      .filter((row) => viewerId && row.user_id === viewerId)
      .map((row) => row.session_id),
  );
  const window = { startDate: carnet.start_date, endDate: carnet.end_date };
  const rawSessionIds = sessions
    .filter(
      (session) =>
        Boolean(viewerId) &&
        (session.user_id === viewerId || participantSessionIds.has(session.id)),
    )
    .map((session) => session.id);
  const rawSessionIdSet = new Set(rawSessionIds);
  const statsSession =
    sessions.find((session) => rawSessionIdSet.has(session.id) && isSessionInCarnetWindow(session, window)) ?? null;

  /*
   * Visibilité effective d'une sortie : la plus restrictive du carnet et de la
   * sortie. Un carnet `friends` ne rend jamais une sortie `private` lisible ;
   * une sortie `collective_anonymized` dans un carnet `public` reste publique.
   */
  const effectiveSessionVisibility = (session: HikeSessionRow) =>
    mostRestrictiveTraceVisibility(carnet.visibility, session.visibility);

  /*
   * La trace se juge par session, pas par carnet. On ne choisit la sortie
   * porteuse que parmi celles que le lecteur peut réellement voir :
   *  - sortie brute autorisée (propriétaire ou participant inscrit) ;
   *  - sortie explicitement partageable (`public`, `collective_anonymized`) ;
   *  - sortie `friends`/`followers` dont le propriétaire est réellement suivi.
   *
   * Sans ce filtre, une sortie privée d'autrui, plus récente, décidait du
   * masque et effaçait la trace autorisée d'un participant (F5).
   */
  const followerOwnerIds = [
    ...new Set(
      sessions
        .filter((session) => {
          if (!session.user_id || session.user_id === viewerId) return false;
          if (rawSessionIdSet.has(session.id)) return false;
          return effectiveSessionVisibility(session) === 'friends';
        })
        .map((session) => session.user_id as string),
    ),
  ];
  const followedOwnerIds = new Set<string>();
  if (viewerId && followerOwnerIds.length > 0) {
    /*
     * `friends`/`followers` ne suffit jamais : on lit la relation réelle.
     * `user_follows_read` est publique ; on ne garde que les propriétaires de
     * sorties réellement suivis par le lecteur. Un anonyme ou un non-abonné
     * reste `visitor`.
     */
    const { data: followRows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', viewerId)
      .in('following_id', followerOwnerIds);
    for (const row of (followRows ?? []) as Array<{ following_id?: string | null }>) {
      if (row.following_id) followedOwnerIds.add(row.following_id);
    }
  }

  /*
   * S6.15 — politique par métrique de chaque sortie, pour les métadonnées
   * agrégées que `buildDays` dérive (durée, date, distance, dénivelé). Le
   * propriétaire et le participant voient tout ; un abonné n'est reconnu
   * qu'après la lecture réelle de `user_follows` ci-dessus. Une sortie sans
   * politique persistée retombe sur le socle agrégé de sa visibilité.
   */
  const metricVisibilities: Record<string, OutingMetricVisibility> = {};
  for (const session of sessions) {
    const viewer = rawSessionIdSet.has(session.id)
      ? viewerId && session.user_id === viewerId
        ? ('owner' as const)
        : ('participant' as const)
      : effectiveSessionVisibility(session) === 'friends' &&
          Boolean(session.user_id && followedOwnerIds.has(session.user_id))
        ? ('follower' as const)
        : ('visitor' as const);
    metricVisibilities[session.id] = resolveOutingMetricVisibility({
      viewer,
      visibility: effectiveSessionVisibility(session),
      policy: metricPolicies.get(session.id),
    });
  }

  const anyTraceSession = pickCarnetTraceSession(sessions, window);
  /*
   * Priorité à la trace brute du lecteur : un participant qui a sa propre
   * trace ne la voit pas remplacée par une sortie partageable plus récente
   * appartenant à quelqu'un d'autre. Sans trace brute autorisée, on retombe
   * sur les sorties explicitement partageables ou suivies.
   */
  const rawTraceSession = pickCarnetTraceSession(
    sessions.filter((session) => rawSessionIdSet.has(session.id)),
    window,
  );
  const sharedTraceCandidates = sessions.filter((session) => {
    if (rawSessionIdSet.has(session.id)) return false;
    const visibility = effectiveSessionVisibility(session);
    if (isShareableTraceVisibility(visibility)) return true;
    return (
      visibility === 'friends' &&
      Boolean(session.user_id && followedOwnerIds.has(session.user_id))
    );
  });
  const traceSession = rawTraceSession ?? pickCarnetTraceSession(sharedTraceCandidates, window);
  const manualTrace = sessions.length === 0 ? parseManualCarnetTrace(carnet.map_points) : null;
  const traceWithheld = Boolean(anyTraceSession && !traceSession);
  const traceVisibility = traceSession
    ? mostRestrictiveTraceVisibility(carnet.visibility, traceSession.visibility)
    : (carnet.visibility ?? 'public');
  const isTraceSessionParticipant = Boolean(
    traceSession && rawSessionIdSet.has(traceSession.id),
  );
  const followsTraceOwner = Boolean(
    traceSession?.user_id && followedOwnerIds.has(traceSession.user_id),
  );
  /*
   * Seul le propriétaire de la sortie ou un participant inscrit voit la trace
   * complète. Un auteur/collaborateur de carnet qui n'a pas participé à cette
   * sortie ne devient pas `follower` du seul fait de son rôle : il lui faut une
   * relation réelle avec le propriétaire de la sortie, comme la route
   * `GET /api/hike-sessions/[id]`. Sinon il reste `visitor` (tout masqué pour
   * `friends`, extrémités masquées pour une sortie publique).
   * En l'absence de sortie liée (carnet saisi à la main), l'auteur/collaborateur
   * garde sa trace manuelle complète et un visiteur reçoit la trace projetée.
   */
  const traceViewer =
    isTraceSessionParticipant || (sessions.length === 0 && manualTrace !== null && isCarnetParticipant)
      ? ('participant' as const)
      : traceVisibility === 'friends' && followsTraceOwner
        ? ('follower' as const)
        : ('visitor' as const);

  const momentRows = ((momentsResult.data ?? []) as MomentRow[]) ?? [];
  const momentIds = momentRows.map((m) => m.id);

  /* Les jointures de profils et requêtes de niveau 2 : moments, live et budget. */
  const [
    likeProfiles,
    participantProfiles,
    momentLikesRes,
    momentCommentsRes,
    momentSavesRes,
    livePosRes,
    publicZoneRes,
    tripMetaRes,
    budgetRes,
  ] = await Promise.all([
    fetchPublicProfilesWith(supabase as never, likeRows.map((row) => row.user_id)),
    fetchPublicProfilesWith(supabase as never, [
      ...collabRows.map((row) => row.user_id),
      ...sessionParticipantRows.map((row) => row.user_id),
    ]),
    momentIds.length > 0
      ? supabase.from('carnet_moment_likes').select('moment_id, user_id').in('moment_id', momentIds)
      : Promise.resolve({ data: [] }),
    momentIds.length > 0
      ? supabase
          .from('carnet_moment_comments')
          .select('id, moment_id, author_id, created_at, deleted_at')
          .in('moment_id', momentIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    momentIds.length > 0 && viewerId
      ? supabase.from('carnet_moment_saves').select('moment_id').eq('user_id', viewerId).in('moment_id', momentIds)
      : Promise.resolve({ data: [] }),
    isCarnetParticipant
      ? supabase
          .from('carnet_live_positions')
          .select('lat, lng, accuracy_m, recorded_at, user_id')
          .eq('carnet_id', carnet.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    !isCarnetParticipant && carnet.live_sharing
      ? supabase.rpc('carnet_public_position', { p_carnet: carnet.id }).maybeSingle()
      : Promise.resolve({ data: null }),
    typeof carnet.budget_public !== 'boolean' && carnet.trip_id
      ? sessionClient.from('trips').select('metadata').eq('id', carnet.trip_id).maybeSingle()
      : Promise.resolve({ data: null }),
    carnet.trip_id
      ? sessionClient
          .from('trip_expenses')
          .select('id, title, amount, currency, category, payer_id, expense_date')
          .eq('trip_id', carnet.trip_id)
      : Promise.resolve({ data: [] }),
  ]);

  const likers = likeRows.map((row) => ({
    user_id: row.user_id,
    reaction: row.reaction,
    profile: (likeProfiles[row.user_id] as unknown as AuthorRow) ?? null,
  }));

  const participants = [
    ...collabRows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      source: 'collaborator' as const,
      profile: (participantProfiles[row.user_id ?? ''] as unknown as AuthorRow) ?? null,
    })),
    ...sessionParticipantRows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      source: 'participant' as const,
      profile: (participantProfiles[row.user_id ?? ''] as unknown as AuthorRow) ?? null,
    })),
  ];

  const liked = Boolean(likeResult.data);
  const favorited = Boolean(favoriteResult.data);

  // Construction des réactions par jour (Lot B)
  const dayLikesData = (dayLikesResult.data ?? []) as Array<{ jour_numero: number; user_id: string }>;
  const dayCommentsData = (dayCommentsResult.data ?? []) as Array<{ jour_numero: number; id: string }>;
  const dayReactions: Record<number, CarnetDayReactionItem> = {};

  for (const row of dayLikesData) {
    const day = row.jour_numero;
    if (!dayReactions[day]) {
      dayReactions[day] = { dayNumber: day, likesCount: 0, commentsCount: 0, userLiked: false };
    }
    dayReactions[day].likesCount++;
    if (viewerId && row.user_id === viewerId) dayReactions[day].userLiked = true;
  }
  for (const row of dayCommentsData) {
    const day = row.jour_numero;
    if (!dayReactions[day]) {
      dayReactions[day] = { dayNumber: day, likesCount: 0, commentsCount: 0, userLiked: false };
    }
    dayReactions[day].commentsCount++;
  }

  // Engagement par moment (Lot C)
  const momentLikes = (momentLikesRes?.data ?? []) as Array<{ moment_id: string; user_id: string }>;
  const momentComments = (momentCommentsRes?.data ?? []) as Array<{ moment_id: string; id: string }>;
  const momentSaves = (momentSavesRes?.data ?? []) as Array<{ moment_id: string }>;
  const savedSet = new Set(momentSaves.map((s) => s.moment_id));
  const momentEngagement: Record<string, CarnetMomentEngagementItem> = {};

  for (const mId of momentIds) {
    momentEngagement[mId] = {
      momentId: mId,
      likesCount: 0,
      commentsCount: 0,
      userLiked: false,
      userSaved: savedSet.has(mId),
    };
  }
  for (const row of momentLikes) {
    if (momentEngagement[row.moment_id]) {
      momentEngagement[row.moment_id].likesCount++;
      if (viewerId && row.user_id === viewerId) {
        momentEngagement[row.moment_id].userLiked = true;
      }
    }
  }
  for (const row of momentComments) {
    if (momentEngagement[row.moment_id]) {
      momentEngagement[row.moment_id].commentsCount++;
    }
  }

  // Nuits (Lot D)
  const nightsData = (nightsResult?.data ?? []) as Array<{
    id: string;
    jour_numero: number;
    nom: string;
    type: string;
    altitude_m: number | null;
    infos: string | null;
    lat: number | null;
    lng: number | null;
    map_refuge_id: string | null;
  }>;
  const nights: CarnetNightItem[] = nightsData.map((n) => ({
    id: n.id,
    dayNumber: n.jour_numero,
    name: n.nom,
    type: (['refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre'].includes(n.type)
      ? n.type
      : 'refuge') as CarnetNightItem['type'],
    altitudeM: n.altitude_m,
    infos: n.infos,
    lat: n.lat,
    lng: n.lng,
    mapRefugeId: n.map_refuge_id,
  }));

  // Budget (Lot D : participant ou rendu public par l'auteur du carnet)
  const tripMeta = (tripMetaRes?.data as { metadata?: { budget_public?: unknown } } | null)?.metadata;
  const isBudgetPublic =
    typeof carnet.budget_public === 'boolean'
      ? carnet.budget_public
      : Boolean(tripMeta?.budget_public);
  let budget: CarnetBudget | null = null;
  const budgetRows = (budgetRes?.data ?? []) as Array<{
    id: string;
    title: string;
    amount: number;
    currency: string;
    category: string | null;
    payer_id: string | null;
    expense_date: string | null;
  }>;
  if ((isCarnetParticipant || isBudgetPublic) && budgetRows.length > 0) {
    const totalCents = budgetRows.reduce(
      (sum, item) => sum + Math.round((Number(item.amount) || 0) * 100),
      0,
    );
    const participantCount = Math.max(1, participants.length);
    budget = {
      totalCents,
      total: Math.round(totalCents / 100),
      currency: budgetRows[0]?.currency ?? 'EUR',
      perPersonCents: Math.round(totalCents / participantCount),
      items: budgetRows.map((b) => {
        const cents = Math.round((Number(b.amount) || 0) * 100);
        return {
          id: b.id,
          label: b.title,
          amountCents: cents,
          amount: Number(b.amount) || 0,
          currency: b.currency,
          category: b.category,
          paidByUserId: b.payer_id,
          date: b.expense_date,
        };
      }),
    };
  }

  // Position live ou zone publique (Lot D)
  const livePosData = livePosRes?.data as {
    lat: number;
    lng: number;
    accuracy_m: number | null;
    recorded_at: string;
    user_id: string;
  } | null;
  const livePosition: CarnetLivePosition | null = livePosData
    ? {
        lat: livePosData.lat,
        lng: livePosData.lng,
        accuracyM: livePosData.accuracy_m,
        recordedAt: livePosData.recorded_at,
        userId: livePosData.user_id,
      }
    : null;

  const publicZoneData = publicZoneRes?.data as {
    zone_label: string;
    lat_approx: number | null;
    lng_approx: number | null;
    recorded_at: string;
  } | null;
  const publicZone: CarnetPublicZone | null = publicZoneData
    ? {
        zoneLabel: publicZoneData.zone_label,
        latApprox: publicZoneData.lat_approx,
        lngApprox: publicZoneData.lng_approx,
        recordedAt: publicZoneData.recorded_at,
      }
    : null;

  const detail = buildCarnetDetail({
    carnet,
    author: (authorResult.data as unknown as AuthorRow) ?? null,
    /* Statistiques : la sortie autorisée la plus récente, jamais une sortie
       privée d'autrui. Sans sortie autorisée, le builder retombe sur les
       colonnes du carnet. */
    hikeSession: statsSession,
    /* Toutes les sorties datent leurs propres points : c'est la matière de
       `buildDays` (un carnet de sept jours peut compter sept sorties). Le
       builder n'en garde les points que pour `rawSessionIds`. */
    sessions,
    /*
     * `hikeResult` est plafonné à 10 alors que `sessionIdResult` liste toutes
     * les sorties. Avec la RLS ou deux listes différentes (plafond, erreur
     * ou modification concurrente), on ne peut pas vérifier les droits sur
     * toutes les sorties susceptibles d'entrer dans les totaux enregistrés.
     */
    sessionsComplete:
      Boolean(serviceClient) &&
      !hikeResult.error &&
      !sessionIdResult.error &&
      sessionIds.length === sessions.length &&
      sessionIds.every((id) => sessions.some((session) => session.id === id)),
    rawSessionIds,
    metricVisibilities,
    trace: traceSession?.positions_geojson ?? manualTrace ?? null,
    traceVisibility,
    traceWithheld,
    etapes: (etapesResult.data as unknown as EtapeRow[]) ?? [],
    moments: momentRows,
    kitItems: (kitResult.data as unknown as KitItemRow[]) ?? [],
    viewerId,
    liked,
    favorited,
    likers,
    participants,
    counts: {
      likes: likesTotal.count ?? likeRows.length,
      /* Vrai comptage des commentaires (le total des j'aime était affiché par
         erreur : la requête `carnet_comments` était jetée). */
      comments: commentsTotal.count ?? 0,
    },
    viewerRole,
    traceViewer,
    nights,
    dayReactions,
    momentEngagement,
    livePosition,
    publicZone,
    budget,
    budgetPublic: isBudgetPublic,
  });

  const memberKits = await loadCarnetMemberKits({
    client: sessionClient,
    participantIds: detail.participants.map((p) => p.userId),
    authorId: detail.author?.id ?? carnet.author_id ?? null,
    authorCarnetKit: detail.kit,
    sessions,
    viewerId,
    isCarnetParticipant,
  });

  if (memberKits) {
    detail.memberKits = memberKits;
  }

  /* Le profil altimétrique manque partout en production : `elevationM` n'est
     renseigné par aucune sortie. `enrichCarnetElevation` demande l'altitude des
     points du tracé au MNT d'Open-Meteo (cache 1 h, 3 s de délai maximum) et
     rend la fiche inchangée si l'API ne répond pas : jamais une altitude
     inventée, jamais une exception. */
  return enrichCarnetElevation(detail);
}
