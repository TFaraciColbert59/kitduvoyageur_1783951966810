import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { buildCarnetDetail } from './buildCarnetDetail';
import { pickCarnetTrace } from './trace';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type {
  AuthorRow,
  CarnetRow,
  EtapeRow,
  HebergementRow,
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

const CARNET_COLUMNS = [
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
  'groupe_id',
  'lieu_depart',
  'lieu_arrivee',
  'country_iso',
].join(', ');

/**
 * Lit un carnet, son auteur, ses étapes, ses moments, son kit et l'engagement
 * du lecteur avec le client serveur (cookies) — la RLS voit donc la session :
 * un carnet privé reste lisible par son propriétaire.
 *
 * La trace vient des `hike_sessions` liées au carnet : la policy
 * `hike_sessions_select_owner_or_public_carnet` autorise déjà la lecture
 * anonyme des sorties d'un carnet public (vérifié à la clé anon), donc aucune
 * policy supplémentaire et aucun client à privilèges élevés ne sont nécessaires.
 *
 * Retourne `null` si le carnet n'existe pas ou n'est pas lisible : la route
 * traduit cela en `notFound()`.
 */
export async function getCarnetDetail(id: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData?.user?.id ?? null;

  const { data: carnetData, error: carnetError } = await supabase
    .from('carnets')
    .select(CARNET_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (carnetError || !carnetData) return null;
  const carnet = carnetData as unknown as CarnetRow;

  /* Tout ce qui ne dépend que du carnet part dans le même `Promise.all` :
     auteur, sorties, étapes, hébergements, moments, kit, collaborateurs,
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
      hebergementsResult,
      momentsResult,
      kitResult,
      likesRows,
      likesTotal,
      commentsCount,
      collabResult,
      sessionIdResult,
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
        .from('hike_sessions')
        .select('id, carnet_id, distance_km, elevation_gain_m, duration_seconds, started_at, positions_geojson')
        .eq('carnet_id', carnet.id)
        .order('started_at', { ascending: false })
        .limit(10),
      carnet.groupe_id
        ? supabase
            .from('groupe_etapes')
            .select(
              'id, jour_numero, ordre, date_etape, lieu_depart, lieu_arrivee, recit, distance_km, denivele_m, duree_texte, meteo, temperature_c',
            )
            .eq('groupe_id', carnet.groupe_id)
            .order('ordre', { ascending: true })
        : Promise.resolve({ data: [] as EtapeRow[] }),
      carnet.groupe_id
        ? supabase
            .from('groupe_hebergements')
            .select('id, apres_jour_numero, nom, prix_cents, prix_note, altitude_m, note, hote')
            .eq('groupe_id', carnet.groupe_id)
            .order('apres_jour_numero', { ascending: true })
        : Promise.resolve({ data: [] as HebergementRow[] }),
      supabase
        .from('carnet_moments')
        .select('id, jour_numero, heure, citation, auteur_nom, lieu, image_url')
        .eq('carnet_id', carnet.id)
        .order('jour_numero', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('carnet_kit_items')
        .select('id, nom, detail, poids_g, couleur_tag, sort_order')
        .eq('carnet_id', carnet.id)
        .order('sort_order', { ascending: true }),
      /* Réactions réelles : les 50 dernières lignes, plus le total exact. */
      supabase
        .from('carnet_likes')
        .select('user_id, reaction, created_at')
        .eq('carnet_id', carnet.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('carnet_likes').select('carnet_id', { count: 'exact', head: true }).eq('carnet_id', carnet.id),
      supabase
        .from('carnet_comments')
        .select('carnet_id', { count: 'exact', head: true })
        .eq('carnet_id', carnet.id),
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
        .from('hike_sessions')
        .select('id, started_at')
        .eq('carnet_id', carnet.id)
        .order('started_at', { ascending: false }),
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

  /* Les deux jointures de profils sont indépendantes : une seule vague. */
  const [likeProfiles, participantProfiles] = await Promise.all([
    fetchPublicProfilesWith(supabase as never, likeRows.map((row) => row.user_id)),
    fetchPublicProfilesWith(supabase as never, [
      ...collabRows.map((row) => row.user_id),
      ...sessionParticipantRows.map((row) => row.user_id),
    ]),
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

  return buildCarnetDetail({
    carnet,
    author: (authorResult.data as unknown as AuthorRow) ?? null,
    hikeSession: sessions[0] ?? null,
    trace: pickCarnetTrace(sessions),
    etapes: (etapesResult.data as unknown as EtapeRow[]) ?? [],
    hebergements: (hebergementsResult.data as unknown as HebergementRow[]) ?? [],
    moments: (momentsResult.data as unknown as MomentRow[]) ?? [],
    kitItems: (kitResult.data as unknown as KitItemRow[]) ?? [],
    viewerId,
    liked,
    favorited,
    likers,
    participants,
    counts: {
      likes: likesTotal.count ?? likeRows.length,
      comments: commentsCount.count ?? 0,
    },
  });
}
