import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { buildCarnetDetail } from './buildCarnetDetail';
import { enrichCarnetElevation } from './enrichElevation';
import { pickCarnetTrace } from './trace';
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
  KitVerdictType,
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
  'live_sharing',
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
].join(', ');

/**
 * Lit un carnet, son auteur, ses étapes, ses moments, son kit et l'engagement
 * du lecteur avec le client serveur (cookies) — la RLS voit donc la session :
 * un carnet privé reste lisible par son propriétaire.
 *
 * La trace vient des `hike_sessions` liées au carnet. Depuis la migration
 * `20261111101000_carnet_public_trace_scope` (RGPD), la table brute est
 * réservée aux participants ; un visiteur lit la vue `hike_sessions_public`
 * (tracé échantillonné, arrondi, sans horodatage). Le rôle est tranché avant
 * les sorties par `is_carnet_participant`, donc sans client à privilèges
 * élevés. La migration doit être appliquée AVANT ce code ; sans elle, la fiche
 * d'un visiteur garde une carte vide honnête, jamais les points bruts.
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

  /* RGPD (migration 20261111101000) : le rôle se tranche AVANT de lire les
     sorties. `is_carnet_participant` est la même définition que les policies
     (auteur, collaborateur, présent d'une sortie) ; anonyme ou visiteur
     connecté, elle rend false. Un visiteur lit la vue simplifiée, un
     participant la table brute. Une erreur du RPC vaut visiteur : on ne
     retombe jamais sur les points bruts par accident. */
  const participantCheck = await supabase.rpc('is_carnet_participant', {
    p_carnet: carnet.id,
  });
  const viewerIsParticipant = participantCheck.data === true;
  const sessionsSource = viewerIsParticipant ? 'hike_sessions' : 'hike_sessions_public';

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
      supabase
        .from(sessionsSource)
        .select(
          'id, carnet_id, distance_km, elevation_gain_m, duration_seconds, started_at, positions_geojson, positions_timed',
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
      supabase
        .from(sessionsSource)
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
  const sessionParticipantsResult =
    sessionIds.length > 0
      ? await supabase
          .from('hike_session_participants')
          .select('session_id, user_id, role, created_at')
          .in('session_id', sessionIds)
      : { data: [] as SessionParticipantRow[] };

  const collabRows = ((collabResult.data ?? []) as CollaboratorRow[]).filter((row) => row.user_id);
  const sessionParticipantRows = ((sessionParticipantsResult.data ?? []) as SessionParticipantRow[]).filter(
    (row) => row.user_id,
  );

  const isOwner = Boolean(viewerId && carnet.author_id && viewerId === carnet.author_id);
  const isCollab = collabRows.some(
    (row) => row.user_id === viewerId && (row.role === 'owner' || row.role === 'contributor'),
  );
  const isSessionParticipant = sessionParticipantRows.some((row) => row.user_id === viewerId);
  const isParticipant = viewerIsParticipant || isOwner || isCollab || isSessionParticipant;
  const viewerRole = isParticipant ? ('participant' as const) : ('visitor' as const);

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
    isParticipant
      ? supabase
          .from('carnet_live_positions')
          .select('lat, lng, accuracy_m, recorded_at, user_id')
          .eq('carnet_id', carnet.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    !isParticipant && carnet.live_sharing
      ? supabase.rpc('carnet_public_position', { p_carnet: carnet.id }).maybeSingle()
      : Promise.resolve({ data: null }),
    isParticipant && carnet.trip_id
      ? supabase
          .from('trip_expenses')
          .select('id, label, amount_cents, currency, category, paid_by_user_id, date')
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

  // Budget (Lot D, participant uniquement)
  let budget: CarnetBudget | null = null;
  const budgetRows = (budgetRes?.data ?? []) as Array<{
    id: string;
    label: string;
    amount_cents: number;
    currency: string;
    category: string | null;
    paid_by_user_id: string | null;
    date: string | null;
  }>;
  if (isParticipant && budgetRows.length > 0) {
    const totalCents = budgetRows.reduce((sum, item) => sum + (item.amount_cents ?? 0), 0);
    const participantCount = Math.max(1, participants.length);
    budget = {
      totalCents,
      currency: budgetRows[0]?.currency ?? 'EUR',
      perPersonCents: Math.round(totalCents / participantCount),
      items: budgetRows.map((b) => ({
        id: b.id,
        label: b.label,
        amountCents: b.amount_cents,
        currency: b.currency,
        category: b.category,
        paidByUserId: b.paid_by_user_id,
        date: b.date,
      })),
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
    hikeSession: sessions[0] ?? null,
    /* Toutes les sorties datent leurs propres points : c'est la matière de
       `buildDays` (un carnet de sept jours peut compter sept sorties). */
    sessions,
    trace: pickCarnetTrace(sessions),
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
    nights,
    dayReactions,
    momentEngagement,
    livePosition,
    publicZone,
    budget,
  });

  /* Le profil altimétrique manque partout en production : `elevationM` n'est
     renseigné par aucune sortie. `enrichCarnetElevation` demande l'altitude des
     points du tracé au MNT d'Open-Meteo (cache 1 h, 3 s de délai maximum) et
     rend la fiche inchangée si l'API ne répond pas : jamais une altitude
     inventée, jamais une exception. */
  return enrichCarnetElevation(detail);
}
