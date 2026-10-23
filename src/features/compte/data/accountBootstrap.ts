import type { SupabaseClient } from '@supabase/supabase-js';
import {
  signatureVisibilityForValue,
  type SignatureVisibility,
} from './accountVisibility';

/**
 * Mapping pur des données Supabase vers les formes attendues par le runtime
 * du Compte. Aucun accès réseau ici : les tests peuvent appeler ces fonctions
 * avec des fixtures.
 */

export type AccountProfileRow = {
  id?: string;
  handle?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  trust_score?: number | null;
  store_credit_eur?: number | null;
  loyalty_points?: number | null;
  profile_visibility?: string | null;
  signature_visibility?: string | null;
};

export type CarnetRow = {
  id: string;
  title?: string | null;
  destination?: string | null;
  description?: string | null;
  cover_image?: string | null;
  likes_count?: number | null;
  views_count?: number | null;
  visibility?: string | null;
  created_at?: string | null;
};

export type PostRow = {
  id: string;
  title?: string | null;
  content?: string | null;
  image_url?: string | null;
  media_urls?: unknown;
  shares_count?: number | null;
  likes_count?: number | null;
  comments_count?: number | null;
  audience?: string | null;
  created_at?: string | null;
  author_id?: string | null;
  club_id?: string | null;
  reposted_from_id?: string | null;
};

export type RepostRow = {
  id: string;
  reposted_from_id?: string | null;
  created_at?: string | null;
  audience?: string | null;
  club_id?: string | null;
  /** Champs copiés depuis la source immédiate lors de la republication. */
  title?: string | null;
  content?: string | null;
  author_id?: string | null;
};

export type StoryHighlightRow = {
  id: string;
  title?: string | null;
  cover_story_id?: string | null;
  position?: number | null;
};

export type StoryHighlightItemRow = {
  highlight_id: string;
};

export type CompanionSessionRow = {
  session_id: string;
  user_id: string;
  started_at?: string | null;
  massif?: string | null;
};

export type CompanionProfileRow = {
  handle?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type BadgeRow = {
  id: string;
  name: string;
  description?: string | null;
  rarity?: string | null;
  points_reward?: number | null;
  requirement_type?: string | null;
  requirement_value?: number | null;
  active?: boolean | null;
};

export type UserBadgeRow = {
  badge_id?: string | null;
  earned_at?: string | null;
};

export type ChallengeRow = {
  id: string;
  title: string;
  category?: string | null;
  difficulty?: string | null;
  xp?: number | null;
  total?: number | null;
  deadline?: string | null;
  active?: boolean | null;
};

export type UserChallengeRow = {
  challenge_id?: string | null;
  progress?: number | null;
  completed?: boolean | null;
  completed_at?: string | null;
};

export type ProgressionChallengeRow = {
  id: string;
  title: string;
  skill?: string | null;
  points_reward?: number | null;
  difficulty?: string | null;
  target_progress?: number | null;
};

export type UserProgressionRow = {
  current_challenge_id?: string | null;
  challenge_progress?: number | null;
};

export type LoanRow = {
  id: string;
  product_ownership_id: string;
  lender_id: string;
  borrower_id?: string | null;
  borrower_contact?: string | null;
  status: string;
  loaned_at?: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  lender_rating?: number | string | null;
  borrower_rating?: number | string | null;
};

export type OwnershipRow = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  weight_g?: number | null;
  price_cents?: number | null;
  condition?: string | null;
  photo_url?: string | null;
  is_lent?: boolean | null;
};

export type GeoMassifRow = {
  geoname_id?: number | null;
  name: string;
  name_plain?: string | null;
  country_code?: string | null;
};

export type ClubTopicRow = {
  id: string;
  club_id?: string | null;
  title: string;
  is_pinned?: boolean | null;
};

export type ClubMembershipStatus = 'active' | 'banned' | 'pending';

/**
 * Recommandation de kit d'un club, déjà résolue vers sa fiche réelle
 * (`kits` — la cible de la contrainte `club_recommended_kits.kit_id` — ou, en
 * repli, `materiel_kits`). Aucun nom, visuel ou poids n'est inventé : une
 * recommandation sans fiche lisible est ignorée.
 */
export type ClubRecommendedKitRow = {
  club_id: string;
  kit_id: string;
  name?: string | null;
  image?: string | null;
  weight_g?: number | null;
  items?: number | null;
  note?: string | null;
};

type ClubRecommendedKitLinkRow = {
  club_id: string;
  kit_id: string;
  note?: string | null;
};

type ClubKitCatalogRow = {
  id: string;
  nom?: string | null;
  image?: string | null;
  poids_total_g?: number | null;
  nb_articles?: number | null;
};

type ClubMaterialKitRow = {
  id: string;
  name?: string | null;
  total_weight_g?: number | null;
  cover_image_url?: string | null;
};

export type HikeRow = {
  id: string;
  route_id?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  distance_km?: number | string | null;
  elevation_gain_m?: number | string | null;
  positions_timed?: unknown;
  kit_id?: string | null;
  title?: string | null;
  max_altitude_m?: number | null;
  visibility?: string | null;
};

/**
 * Agrégats toutes sessions : le passeport et la Cordée ont besoin de
 * l'identifiant de session et de la trace GPS, comme la liste d'affichage.
 */
export type StatsHikeRow = Pick<
  HikeRow,
  | 'id'
  | 'route_id'
  | 'started_at'
  | 'ended_at'
  | 'distance_km'
  | 'elevation_gain_m'
  | 'positions_timed'
>;

export type RouteRow = {
  id: number;
  name?: string | null;
  region?: string | null;
};

export type OrderRow = {
  id: string;
  order_number?: string | null;
  status?: string | null;
  total_eur?: number | string | null;
  created_at?: string | null;
  items?: Array<{ product_name?: string | null; quantity?: number | null }> | null;
};

export type NotificationRow = {
  id: string;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  read?: boolean | null;
  created_at?: string | null;
  link?: string | null;
};

export type FollowProfileRow = {
  id: string;
  handle?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  trust_score?: number | null;
  location?: string | null;
};

export type StoryRow = {
  id: string;
  caption?: string | null;
  media_type?: string | null;
  created_at?: string | null;
  storage_path?: string | null;
  image_url?: string | null;
};

export type KitRow = {
  id: string;
  name?: string | null;
  description?: string | null;
  total_weight_g?: number | null;
  generation?: number | null;
  field_proven_count?: number | null;
  ancestors?: unknown;
  lineage_root_id?: string | null;
  is_souche?: boolean | null;
  cover_image_url?: string | null;
  created_at?: string | null;
};

export type KitItemRow = {
  kit_id: string;
};

export type KitItemImageRow = KitItemRow & {
  name?: string | null;
  product_ownership_id?: string | null;
};

export type CatalogKitItemRow = {
  nom?: string | null;
  image?: string | null;
};

export type CompanionCandidateRow = {
  id: string;
  user_id?: string | null;
  route_id?: number | null;
  started_at?: string | null;
};

export type ClubMemberRow = {
  club_id: string;
  role?: string | null;
  status?: string | null;
};

export type ClubRow = {
  id: string;
  name?: string | null;
  members_count?: number | null;
  emoji?: string | null;
  category?: string | null;
};

export type ClubEventRow = {
  id?: string;
  club_id?: string | null;
  title?: string | null;
  event_date?: string | null;
  location?: string | null;
  participants_count?: number | null;
  max_participants?: number | null;
};

export type ClubEventParticipantRow = {
  event_id: string;
  user_id?: string | null;
};

export type ClubNextEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string;
  participants_count: number;
  max_participants: number;
  participants: number;
  max: number;
  /** Présence de l'appelant (`club_event_participants`), false sans ligne. */
  attending: boolean;
};

export type ClubTopic = {
  id: string;
  title: string;
  is_pinned: boolean;
};

const monthShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${monthShort[date.getMonth()]}`;
}

function position(index: number): { x: number; y: number; h: number } {
  return {
    x: 52 + ((index * 61) % 246),
    y: 92 + ((index * 47) % 118),
    h: 140 + ((index * 23) % 70),
  };
}

const monthLong = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/** Clé de rapprochement stable : accents et ponctuation neutralisés. */
function normalizeKey(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Clé éditoriale de `geo_massifs.name_plain` : mots séparés par une espace. */
function normalizePlain(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Nom de massif lisible : `name_plain` est stocké en minuscules par le
 * backfill. Seule l'initiale de chaque mot est relevée, pour l'affichage ;
 * les identifiants et les clés de rapprochement restent inchangés.
 */
function displayMassifLabel(value: string): string {
  return value.replace(/(^|\s)([a-zà-ÿ])/g, (_, space: string, letter: string) => `${space}${letter.toUpperCase()}`);
}

function displayPlaceName(value?: string | null): string {
  return (value || '')
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function sessionDayKey(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function calendarNights(startedAt?: string | null, endedAt?: string | null): number {
  if (!startedAt || !endedAt) return 0;
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((endDay - startDay) / 86_400_000));
}

function isProven(positionsTimed: unknown): boolean {
  if (Array.isArray(positionsTimed)) return positionsTimed.length > 0;
  return Boolean(positionsTimed);
}

/** Index unique des massifs par nom normalisé (accents/ponctuation neutralisés). */
function indexMassifsByKey(massifs: GeoMassifRow[]): Map<string, GeoMassifRow> {
  const byKey = new Map<string, GeoMassifRow>();
  for (const massif of massifs) {
    const key = normalizeKey(massif.name_plain || massif.name);
    if (key && !byKey.has(key)) byKey.set(key, massif);
  }
  return byKey;
}

export function mapProfile(
  profile: AccountProfileRow | null,
  followers: number,
  following: number
) {
  const name = profile?.full_name?.trim() || profile?.handle || 'Voyageur';
  const handle = profile?.handle || profile?.id?.slice(0, 8) || 'voyageur';
  return {
    handle,
    name,
    followersCount: followers,
    followingCount: following,
    followersLabel: followers.toLocaleString('fr-FR'),
    bioLine: [profile?.location, profile?.bio].filter(Boolean).join(' · '),
    avatarUrl: profile?.avatar_url || null,
    isGuest: false,
    isDemo: false,
    storeCreditEur: Number(profile?.store_credit_eur ?? 0),
    loyaltyPoints: Number(profile?.loyalty_points ?? 0),
    trustScore: Number(profile?.trust_score ?? 0),
  };
}

export function mapVisibility(profile: AccountProfileRow | null, invited = true) {
  const signature =
    profile?.signature_visibility === 'private' ||
    profile?.signature_visibility === 'communaute' ||
    profile?.signature_visibility === 'public'
      ? profile.signature_visibility
      : null;
  return {
    profile: profile?.profile_visibility === 'prive' ? ('prive' as const) : ('public' as const),
    invited,
    ...(signature ? { signature } : {}),
  };
}

/** Index historique du runtime (`S.vis`) pour une valeur `signature_visibility`. */
export type SignatureVisibilityIndex = 0 | 1 | 2;

/**
 * Colonne SQL (`private | communaute | public`) → index runtime `S.vis`.
 *
 * L'inverse exact de `signatureVisibilityForValue` : par défaut la base est
 * `private`, donc le runtime doit démarrer sur `0` et jamais sur le `1`
 * historique de la maquette.
 */
export function signatureVisibilityIndex(value: unknown): SignatureVisibilityIndex | null {
  if (value === 'private') return 0;
  if (value === 'communaute') return 1;
  if (value === 'public') return 2;
  return null;
}

/**
 * Patch runtime minimal pour les deux réglages de visibilité du profil.
 *
 * `vis` est la visibilité de l'empreinte (`signature_visibility`) et
 * `profileVisibility` la confidentialité du compte (`profile_visibility`).
 * Une colonne absente ou inconnue n'écrase pas l'état runtime existant.
 */
export function mapProfileRuntimeVisibility(profile: AccountProfileRow | null): {
  vis?: SignatureVisibilityIndex;
  profileVisibility?: 'public' | 'prive';
} {
  const patch: {
    vis?: SignatureVisibilityIndex;
    profileVisibility?: 'public' | 'prive';
  } = {};
  const index = signatureVisibilityIndex(profile?.signature_visibility);
  if (index !== null) patch.vis = index;
  if (profile?.profile_visibility === 'public' || profile?.profile_visibility === 'prive') {
    patch.profileVisibility = profile.profile_visibility;
  }
  return patch;
}

/**
 * Client Supabase minimal pour relire la visibilité écrite. Structurel pour
 * rester testable avec un faux client, sans dépendre du type complet.
 */
export interface SignatureVisibilityClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): {
        select(columns: string): {
          maybeSingle(): Promise<{
            data: { signature_visibility?: string | null } | null;
            error: unknown;
          }>;
        };
      };
    };
  };
}

export interface SignatureVisibilityFailureDetail {
  value: SignatureVisibility;
  persisted: false;
  revertedTo?: SignatureVisibility;
}

export interface PersistSignatureVisibilityOptions {
  client: unknown;
  userId: string;
  /** Index runtime demandé (`S.vis`) ou valeur SQL déjà résolue. */
  value: unknown;
  /** Index/valeur d'avant la mutation, pour un rétablissement exact. */
  previous: unknown;
  /** Appelé uniquement après relecture de la valeur écrite. */
  onPersisted: (value: SignatureVisibility) => void;
  /** Appelé pour tout échec (erreur PostgREST ou valeur relue différente). */
  onFailed: (detail: SignatureVisibilityFailureDetail) => void;
  /** Rétablit l'index runtime d'avant mutation si l'écriture échoue. */
  onRollback?: (index: SignatureVisibilityIndex) => void;
}

/**
 * Écrit `user_profiles.signature_visibility` puis **relit** la valeur.
 *
 * Le succès n'est signalé qu'après confirmation : une erreur RLS, une ligne
 * non retournée ou une valeur différente déclenchent un échec et le
 * rétablissement de l'index runtime précédent. Aucun service role.
 */
export async function persistSignatureVisibility(
  options: PersistSignatureVisibilityOptions
): Promise<boolean> {
  const target = signatureVisibilityForValue(options.value);
  if (!target) return false;

  const previous = signatureVisibilityForValue(options.previous);
  const previousIndex = signatureVisibilityIndex(previous);

  try {
    const { data, error } = await (options.client as SignatureVisibilityClient)
      .from('user_profiles')
      .update({
        signature_visibility: target,
        updated_at: new Date().toISOString(),
      })
      .eq('id', options.userId)
      .select('signature_visibility')
      .maybeSingle();

    if (error || data?.signature_visibility !== target) {
      throw error ?? new Error('signature_visibility_not_persisted');
    }
  } catch {
    if (previousIndex !== null) options.onRollback?.(previousIndex);
    options.onFailed({
      value: target,
      persisted: false,
      ...(previous ? { revertedTo: previous } : {}),
    });
    return false;
  }

  // Callback hors du try : un bug d'affichage ne devient pas un échec.
  options.onPersisted(target);
  return true;
}

export function mapCarnets(rows: CarnetRow[]) {
  return rows.map((row, index) => {
    const p = position(index);
    const date = formatDate(row.created_at);
    return {
      id: row.id,
      title: row.title || 'Carnet sans titre',
      short: row.destination || row.title || 'Carnet',
      mass: row.destination || 'Carnet',
      massId: 'm1',
      date: date ? `Publié · ${date}` : 'Carnet',
      status: row.visibility === 'private' ? 'draft' : 'pub',
      photos: 0,
      species: [] as string[],
      likes: Number(row.likes_count ?? 0),
      views: Number(row.views_count ?? 0),
      quote: row.description || '',
      x: p.x,
      y: p.y,
      h: p.h,
    };
  });
}

export function mapPosts(rows: PostRow[]) {
  return rows.map((row, index) => {
    const p = position(index);
    const date = formatDate(row.created_at);
    const mediaUrls = [
      row.image_url,
      ...(Array.isArray(row.media_urls) ? row.media_urls : []),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    const title = row.title?.trim() || (row.content || 'Publication').split('\n')[0].slice(0, 48);
    return {
      id: row.id,
      realId: row.id,
      postId: row.id,
      title,
      short: 'Publication',
      mass: 'Communauté',
      massId: 'm1',
      date: date ? `Publié · ${date}` : 'Publication',
      status: 'pub',
      photos: mediaUrls.length,
      species: [] as string[],
      likes: Number(row.likes_count ?? 0),
      comments: Number(row.comments_count ?? 0),
      shares: Number(row.shares_count ?? 0),
      views: Number(row.comments_count ?? 0),
      quote: row.content || '',
      coverImage: mediaUrls[0] ?? null,
      image_url: mediaUrls[0] ?? null,
      media_urls: mediaUrls,
      audience: row.audience || 'public',
      author_id: row.author_id || null,
      reposted_from_id: row.reposted_from_id || null,
      created_at: row.created_at || null,
      x: p.x,
      y: p.y,
      h: p.h,
    };
  });
}

export function mapOutings(
  rows: HikeRow[],
  routes: RouteRow[],
  coverBySession?: Map<string, string>
) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const now = Date.now();
  return rows.map((row, index) => {
    const p = position(index);
    const route = row.route_id ? routeById.get(row.route_id) : undefined;
    const ended = row.ended_at ? new Date(row.ended_at).getTime() : 0;
    const done = ended > 0 && ended < now;
    return {
      id: row.id,
      realId: row.id,
      title: row.title?.trim() || route?.name || 'Sortie enregistrée',
      mass: displayPlaceName(route?.region) || 'Sortie',
      date: formatDate(row.started_at) || 'Sortie',
      startedAt: row.started_at || '',
      endedAt: row.ended_at || '',
      km: Number(row.distance_km ?? 0),
      dplus: Number(row.elevation_gain_m ?? 0),
      maxAlt: row.max_altitude_m ?? null,
      status: done ? 'done' : 'upcoming',
      ready: done ? 100 : 0,
      proven: Boolean(row.positions_timed),
      comp: [] as string[],
      photos: [] as string[],
      coverImage: coverBySession?.get(row.id) ?? null,
      kit: row.kit_id || null,
      x: p.x,
      y: p.y,
    };
  });
}

export function mapOrders(rows: OrderRow[]) {
  const orders = rows.map((row, index) => ({
    id: row.order_number || row.id,
    realId: row.id,
    d: formatDate(row.created_at) || 'Commande',
    t: row.items?.[0]?.product_name || 'Commande LKDV',
    st: row.status || 'En cours',
    amt: Number(row.total_eur ?? 0),
    index,
  }));
  return {
    orders: orders.map(({ index: _index, ...order }) => order),
    bookings: [] as Array<{
      id: string;
      kind: string;
      n: string;
      sub: string;
      price: number;
      status: string;
      prov: string;
    }>,
  };
}

export function mapNotifications(rows: NotificationRow[]) {
  return rows.map((row) => ({
    id: row.id,
    type: row.type || 'info',
    title: row.title || 'Notification',
    message: row.message || '',
    read: Boolean(row.read),
    created_at: row.created_at || '',
    link: row.link || '',
  }));
}

export function mapTribu(rows: FollowProfileRow[]) {
  return rows.map((row) => ({
    id: row.id,
    n: row.full_name || row.handle || 'Voyageur',
    i: (row.full_name || row.handle || 'V').charAt(0).toUpperCase(),
    ps: row.handle || row.id.slice(0, 8),
    rel: 'Abonnés',
    tr: Number(row.trust_score ?? 0),
    mass: row.location || '',
    online: 0,
    avatar: row.avatar_url || null,
  }));
}

export function mapStories(rows: StoryRow[]) {
  return rows
    .filter((row) => Boolean(row.storage_path || row.image_url))
    .map((row) => {
      const caption = (row.caption || '').trim();
      return {
        id: `story_${row.id}`,
        storyId: row.id,
        title: caption ? caption.slice(0, 22) : 'Story',
        sub: caption || 'Moment terrain',
        image: `/api/stories/${row.id}/media`,
        mediaType: row.media_type || 'image',
        createdAt: row.created_at || '',
        isStory: true,
      };
    });
}

export function mapKits(rows: KitRow[], itemCounts: Map<string, number>, fallbackImages?: Map<string, string>) {
  return rows.map((row, index) => {
    const image = row.cover_image_url || fallbackImages?.get(row.id) || null;
    return {
      id: row.id,
      n: row.name || 'Kit',
      gen: row.generation ? `Lignée G${row.generation}` : row.is_souche ? 'Kit souche' : 'Kit',
      proven: Number(row.field_proven_count ?? 0),
      prop: Array.isArray(row.ancestors) ? row.ancestors.length : 0,
      endur: 0,
      credit: 0,
      w: Number(row.total_weight_g ?? 0),
      items: itemCounts.get(row.id) ?? 0,
      desc: row.description || '',
      image,
      coverImage: row.cover_image_url || null,
      realId: row.id,
      x: 106 + ((index * 61) % 246),
      y: 170 + ((index * 47) % 118),
    };
  });
}

/**
 * Première image réelle d'un kit, dans l'ordre de la chaîne produit :
 * photo de l'objet possédé (`product_ownership.photo_url`) puis image
 * d'objet catalogue (`kit_items.image`). `cover_image_url` est prioritaire en
 * amont dans `mapKits` ; aucune image générée ici : un kit sans visuel réel
 * reste sans image et le visuel de repli est produit par la carte.
 */
export function resolveKitImages(
  kitItems: Array<{ kit_id: string; name?: string | null; product_ownership_id?: string | null }>,
  catalogItems: Array<{ nom?: string | null; image?: string | null }>,
  ownerships: Array<{ id: string; photo_url?: string | null }>
): Map<string, string> {
  const imageByName = new Map<string, string>();
  for (const item of catalogItems) {
    const key = normalizeKey(item.nom);
    const image = item.image?.trim();
    if (key && image && !imageByName.has(key)) imageByName.set(key, image);
  }
  const photoById = new Map<string, string>();
  for (const item of ownerships) {
    const photo = item.photo_url?.trim();
    if (photo) photoById.set(item.id, photo);
  }

  const images = new Map<string, string>();
  for (const item of kitItems) {
    if (!item.kit_id) continue;
    const catalogImage = item.name ? imageByName.get(normalizeKey(item.name)) : undefined;
    const ownershipPhoto = item.product_ownership_id ? photoById.get(item.product_ownership_id) : undefined;
    const image = ownershipPhoto || catalogImage;
    if (image && !images.has(item.kit_id)) images.set(item.kit_id, image);
  }
  return images;
}

export function mapHighlights(rows: StoryHighlightRow[], itemCounts: Map<string, number>) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title || '',
    items: itemCounts.get(row.id) ?? 0,
    coverStoryId: row.cover_story_id || null,
    position: Number(row.position ?? 0),
  }));
}

export function mapCompanions(
  rows: CompanionSessionRow[],
  profiles: Map<string, CompanionProfileRow>
) {
  const byUser = new Map<
    string,
    { sessions: Set<string>; massif: string; lastStartedAt: number }
  >();

  for (const row of rows) {
    if (!row.user_id || !row.session_id) continue;
    const entry = byUser.get(row.user_id) ?? { sessions: new Set<string>(), massif: '', lastStartedAt: 0 };
    entry.sessions.add(row.session_id);
    const startedAt = row.started_at ? new Date(row.started_at).getTime() : 0;
    if (row.massif && (startedAt >= entry.lastStartedAt || !entry.massif)) {
      entry.massif = row.massif;
      entry.lastStartedAt = startedAt;
    }
    byUser.set(row.user_id, entry);
  }

  return [...byUser.entries()].map(([id, entry]) => {
    const profile = profiles.get(id);
    const name = profile?.full_name?.trim() || profile?.handle?.trim() || 'Voyageur';
    const handle = profile?.handle?.trim() || id.slice(0, 8);
    const massif = displayPlaceName(entry.massif);
    return {
      id,
      n: name,
      ps: handle,
      i: name.charAt(0).toUpperCase(),
      outings: entry.sessions.size,
      massif,
      mass: massif,
      avatar: profile?.avatar_url || null,
    };
  });
}

export function mapReposts(
  rows: RepostRow[],
  sources: PostRow[],
  profiles: Map<string, CompanionProfileRow>
) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return rows
    .filter((row) => Boolean(row.reposted_from_id))
    .map((row) => {
      const source = row.reposted_from_id ? sourceById.get(row.reposted_from_id) : undefined;
      // Racine invisible (RLS) : la ligne de republication porte déjà une copie
      // du titre et du contenu. On s'y replie pour le texte, mais jamais pour
      // l'attribution : l'auteur de la racine reste inconnu, et le relayeur
      // n'est pas présenté comme la source.
      const sourceTitle = source
        ? source.title?.trim() || (source.content || '').split('\n')[0].slice(0, 80) || ''
        : row.title?.trim() || (row.content || '').split('\n')[0].slice(0, 80) || '';
      const sourceAuthorProfile = source?.author_id
        ? profiles.get(source.author_id)
        : undefined;
      const sourceAuthor = source
        ? sourceAuthorProfile?.handle
          ? `@${sourceAuthorProfile.handle}`
          : sourceAuthorProfile?.full_name || ''
        : null;
      return {
        id: row.id,
        // Sans racine résolue, le lien pointe vers la ligne relayée visible :
        // une racine cachée par la RLS ne doit jamais être proposée.
        sourceId: source ? row.reposted_from_id || '' : row.id,
        sourceTitle,
        sourceAuthor,
        sourceCreatedAt: source?.created_at || '',
        sourceImageUrl: source?.image_url?.trim() || null,
        ...(source ? {} : { sourceUnavailable: true as const }),
        createdAt: row.created_at || '',
        audience: row.audience || 'public',
      };
    });
}

export function mapChallenges(
  rows: ChallengeRow[],
  progressByChallenge: Map<string, { progress?: number | null; completed?: boolean | null } | number>,
  progressionRows: ProgressionChallengeRow[] = [],
  currentProgression?: UserProgressionRow | null
) {
  const progressOf = (id: string) => {
    const entry = progressByChallenge.get(id);
    if (typeof entry === 'number') return entry;
    return Number(entry?.progress ?? 0);
  };
  const completedOf = (id: string) => {
    const entry = progressByChallenge.get(id);
    if (typeof entry === 'number') return false;
    return Boolean(entry?.completed);
  };

  const challenges = rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category || '',
    difficulty: row.difficulty || '',
    xp: Number(row.xp ?? 0),
    deadline: row.deadline || '',
    progress: progressOf(row.id),
    target: row.total === null || row.total === undefined ? null : Number(row.total),
    completed: completedOf(row.id),
    active: row.active !== false,
  }));

  // Catalogue transversal de progression : la progression réelle vient de
  // `user_progression.current_challenge_id` (aucune valeur par défaut inventée).
  for (const row of progressionRows) {
    const isCurrent = currentProgression?.current_challenge_id === row.id;
    const progress = isCurrent ? Number(currentProgression?.challenge_progress ?? 0) : 0;
    const target =
      row.target_progress === null || row.target_progress === undefined ? null : Number(row.target_progress);
    challenges.push({
      id: row.id,
      title: row.title,
      category: row.skill || '',
      difficulty: row.difficulty || '',
      xp: Number(row.points_reward ?? 0),
      deadline: '',
      progress,
      target,
      completed: isCurrent && target !== null && target > 0 && progress >= target,
      active: true,
    });
  }

  // Les seeds historiques ont créé plusieurs lignes pour un même défi.
  // La lentille Communauté ne doit afficher qu'une carte par intitulé : on
  // fusionne les progressions (max) et l'état terminé (OU logique).
  const byTitle = new Map<string, (typeof challenges)[number]>();
  for (const challenge of challenges) {
    const key = normalizeKey(challenge.title);
    if (!key) continue;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, { ...challenge });
      continue;
    }
    existing.progress = Math.max(existing.progress, challenge.progress);
    existing.completed = existing.completed || challenge.completed;
    existing.active = existing.active || challenge.active;
    if (challenge.target !== null) {
      existing.target =
        existing.target === null ? challenge.target : Math.max(existing.target, challenge.target);
    }
    existing.xp = Math.max(existing.xp, challenge.xp);
    if (!existing.category) existing.category = challenge.category;
    if (!existing.difficulty) existing.difficulty = challenge.difficulty;
    if (!existing.deadline) existing.deadline = challenge.deadline;
  }
  return [...byTitle.values()];
}

export function mapStamps(rows: HikeRow[], routes: RouteRow[], massifs: GeoMassifRow[] = []) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const massifByKey = indexMassifsByKey(massifs);

  const stamps = new Map<
    string,
    { id: string; name: string; kind: 'massif'; outings: number; verified: boolean }
  >();

  for (const row of rows) {
    const region = row.route_id ? routeById.get(row.route_id)?.region?.trim() : '';
    // Itinéraire sans massif identifié (pas de géométrie ou massif à plus de
    // 25 km) : aucun tampon n'est fabriqué.
    if (!region) continue;
    const key = normalizeKey(region);
    if (!key) continue;
    const massif = massifByKey.get(key);
    const name = massif?.name || displayMassifLabel(region);
    const existing = stamps.get(key) ?? {
      id: massif?.geoname_id ? `massif_${massif.geoname_id}` : `massif_${key}`,
      name,
      kind: 'massif' as const,
      outings: 0,
      verified: false,
    };
    existing.outings += 1;
    existing.verified = existing.verified || isProven(row.positions_timed);
    stamps.set(key, existing);
  }

  return [...stamps.values()];
}

export function mapStats(rows: StatsHikeRow[], routes: RouteRow[], massifs: GeoMassifRow[] = []) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const massifByKey = indexMassifsByKey(massifs);

  const currentYear = new Date().getUTCFullYear();
  const yearMonths = Array.from({ length: 12 }, () => 0);
  const regions = new Set<string>();
  const countries = new Set<string>();
  let km = 0;
  let dplus = 0;
  let nights = 0;
  let longestOuting = 0;

  for (const row of rows) {
    const distance = toNumber(row.distance_km);
    const elevation = toNumber(row.elevation_gain_m);
    km += distance;
    dplus += elevation;
    nights += calendarNights(row.started_at, row.ended_at);
    longestOuting = Math.max(longestOuting, distance);

    const route = row.route_id ? routeById.get(row.route_id) : undefined;
    const region = route?.region?.trim();
    if (region) {
      regions.add(normalizeKey(region));
      const massif = massifByKey.get(normalizeKey(region));
      if (massif?.country_code) countries.add(massif.country_code.toUpperCase());
    }

    if (row.started_at) {
      const startedAt = new Date(row.started_at);
      if (!Number.isNaN(startedAt.getTime()) && startedAt.getUTCFullYear() === currentYear) {
        yearMonths[startedAt.getUTCMonth()] += distance;
      }
    }
  }

  const bestMonthValue = Math.max(...yearMonths);
  const bestMonthIndex = yearMonths.indexOf(bestMonthValue);

  return {
    km: round1(km),
    dplus: Math.round(dplus),
    outings: rows.length,
    nights,
    massifs: regions.size,
    countries: countries.size,
    yearMonths: yearMonths.map((value) => round1(value)),
    bestMonth: bestMonthValue > 0 ? monthLong[bestMonthIndex] : '',
    longestOuting: round1(longestOuting),
  };
}

export function mapGearItems(
  rows: OwnershipRow[],
  loanedToByItem: Map<string, string> = new Map()
) {
  return rows.map((row) => {
    const priceCents = Number(row.price_cents ?? 0);
    const loanedTo = loanedToByItem.get(row.id) || null;
    return {
      id: `gear_${row.id}`,
      realId: row.id,
      n: row.name,
      b: row.brand || '',
      c: row.category || '',
      w: Number(row.weight_g ?? 0),
      paid: Math.round(priceCents) / 100,
      so: 0,
      cond: row.condition || '',
      lent: loanedTo,
      photo_url: row.photo_url || null,
      // Alias de compatibilité pour l'hydratation existante du Compte.
      name: row.name,
      brand: row.brand || '',
      category: row.category || '',
      weight_g: Number(row.weight_g ?? 0),
      price_cents: priceCents,
      outings_count: 0,
      condition: row.condition || '',
      is_lent: Boolean(row.is_lent) || Boolean(loanedTo),
      loaned_to: loanedTo,
    };
  });
}

export function mapLoans(
  rows: LoanRow[],
  ownershipById: Map<string, OwnershipRow>,
  profiles: Map<string, CompanionProfileRow>,
  userId: string
) {
  return rows.map((row) => {
    const role = row.lender_id === userId ? 'lender' : 'borrower';
    const counterpartId = role === 'lender' ? row.borrower_id : row.lender_id;
    const profile = counterpartId ? profiles.get(counterpartId) : undefined;
    const profileName = profile?.full_name?.trim() || profile?.handle?.trim() || '';
    // Côté emprunteur, `borrower_contact` est le contact de l'emprunteur
    // lui-même : il ne doit jamais servir de nom au prêteur.
    const counterpart = role === 'lender' ? profileName || row.borrower_contact?.trim() || '' : profileName || 'Prêteur';
    const rating = role === 'lender' ? row.borrower_rating : row.lender_rating;
    return {
      id: row.id,
      itemName: ownershipById.get(row.product_ownership_id)?.name || '',
      counterpart,
      role,
      status: row.status,
      loanedAt: row.loaned_at || '',
      dueDate: row.due_date || '',
      returnedAt: row.returned_at || '',
      rating: rating === null || rating === undefined ? null : toNumber(rating),
    };
  });
}

/** Retour à temps : une échéance sans heure est inclusive jusqu'à sa fin. */
function isReturnedOnTime(returnedAt: string, dueDate: string): boolean {
  const returned = new Date(returnedAt).getTime();
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(returned) || Number.isNaN(due)) return returnedAt <= dueDate;
  const endOfDueDay = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? due + 86_400_000 - 1 : due;
  return returned <= endOfDueDay;
}

/**
 * Confiance du propriétaire, calculée sur **ses** notes reçues et **son**
 * comportement d'emprunteur. Les notes qu'il a données et les retours de ses
 * emprunteurs ne sont jamais comptés à sa place ; sans donnée, la valeur reste
 * `null` plutôt qu'un faux 0.
 */
export function mapTrust(rows: LoanRow[], userId: string, verified: boolean) {
  const involvesOwner = (row: LoanRow) =>
    row.lender_id === userId || row.borrower_id === userId;

  const active = rows.filter(
    (row) =>
      involvesOwner(row) && (row.status === 'en_cours' || row.status === 'en_retard')
  ).length;

  const receivedRatings = rows
    .flatMap((row) => {
      if (row.lender_id === userId) return [row.borrower_rating];
      if (row.borrower_id === userId) return [row.lender_rating];
      return [];
    })
    .filter((rating): rating is number | string => rating !== null && rating !== undefined)
    .map((rating) => (typeof rating === 'string' ? Number(rating) : rating))
    .filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating));

  const borrowerReturns = rows.filter(
    (row) => row.borrower_id === userId && Boolean(row.returned_at) && Boolean(row.due_date)
  );
  const onTime = borrowerReturns.filter((row) =>
    isReturnedOnTime(String(row.returned_at), String(row.due_date))
  ).length;

  return {
    verified,
    active,
    onTimeRate: borrowerReturns.length
      ? Math.round((onTime / borrowerReturns.length) * 100)
      : null,
    rating: receivedRatings.length
      ? round1(receivedRatings.reduce((sum, rating) => sum + rating, 0) / receivedRatings.length)
      : null,
  };
}

export function mapBadges(rows: BadgeRow[], userBadges: UserBadgeRow[]) {
  const earnedById = new Map<string, string>();
  for (const row of userBadges) {
    if (row.badge_id) earnedById.set(row.badge_id, row.earned_at || '');
  }

  const byName = new Map<
    string,
    {
      id: string;
      name: string;
      description: string;
      rarity: string;
      requirement: string;
      requirementValue: number;
      points: number;
      earned: boolean;
      earnedAt: string;
      active: boolean;
    }
  >();

  // Un badge actif prime sur un badge obtenu ; à statut égal, la fiche
  // réellement obtenue est préférée.
  const rank = (entry: { active: boolean; earned: boolean }) =>
    (entry.active ? 2 : 0) + (entry.earned ? 1 : 0);

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    const earnedAt = earnedById.get(row.id);
    const candidate = {
      id: row.id,
      name,
      description: row.description || '',
      rarity: row.rarity || '',
      requirement: row.requirement_type || '',
      requirementValue: Number(row.requirement_value ?? 0),
      points: Number(row.points_reward ?? 0),
      earned: earnedAt !== undefined,
      earnedAt: earnedAt || '',
      active: row.active !== false,
    };
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, candidate);
      continue;
    }
    // L'obtention est une information utilisateur : elle ne se perd pas quand
    // la fiche active du même nom est retenue.
    const earned = existing.earned || candidate.earned;
    const earnedAtValue = existing.earnedAt || candidate.earnedAt;
    if (rank(candidate) > rank(existing)) {
      byName.set(name, { ...candidate, earned, earnedAt: earnedAtValue });
    } else {
      existing.earned = earned;
      existing.earnedAt = earnedAtValue;
    }
  }

  return [...byName.values()];
}

export function mapClubs(
  members: ClubMemberRow[],
  clubs: ClubRow[],
  events: ClubEventRow[] = [],
  topics: ClubTopicRow[] = [],
  recommendedKits: ClubRecommendedKitRow[] = [],
  attendances: ClubEventParticipantRow[] = [],
  /**
   * Décomptes réels d'adhésions `active` par club. `null` signale une lecture
   * en échec : on se replie alors sur `clubs.members_count`, sans inventer.
   */
  activeMemberCounts: Map<string, number> | null = null
) {
  const clubById = new Map(clubs.map((club) => [club.id, club]));
  const now = Date.now();
  const attendingEventIds = new Set(
    attendances.map((attendance) => attendance.event_id).filter(Boolean)
  );
  const nextEventByClub = new Map<string, ClubNextEvent>();
  const topicsByClub = new Map<string, ClubTopic[]>();
  const recommendedKitsByClub = new Map<
    string,
    Array<{
      id: string;
      name: string;
      image: string | null;
      cover: string | null;
      weight: number | null;
      items: number | null;
      note: string;
    }>
  >();

  for (const recommendation of recommendedKits) {
    const name = recommendation.name?.trim();
    if (!recommendation.club_id || !recommendation.kit_id || !name) continue;
    const image = recommendation.image?.trim() || null;
    const weight = recommendation.weight_g === null || recommendation.weight_g === undefined
      ? null
      : Number(recommendation.weight_g);
    const items = recommendation.items === null || recommendation.items === undefined
      ? null
      : Number(recommendation.items);
    const entry = recommendedKitsByClub.get(recommendation.club_id) ?? [];
    entry.push({
      id: recommendation.kit_id,
      name,
      image,
      cover: image,
      weight: weight !== null && Number.isFinite(weight) ? weight : null,
      items: items !== null && Number.isFinite(items) ? items : null,
      note: recommendation.note?.trim() || '',
    });
    recommendedKitsByClub.set(recommendation.club_id, entry);
  }

  for (const topic of topics) {
    if (!topic.club_id) continue;
    const entry = topicsByClub.get(topic.club_id) ?? [];
    entry.push({ id: topic.id, title: topic.title, is_pinned: Boolean(topic.is_pinned) });
    topicsByClub.set(topic.club_id, entry);
  }

  for (const event of events) {
    const clubId = event.club_id;
    const title = event.title?.trim();
    const eventDate = event.event_date;
    if (!clubId || !title || !eventDate) continue;
    const startsAt = new Date(eventDate).getTime();
    if (Number.isNaN(startsAt) || startsAt < now) continue;
    const current = nextEventByClub.get(clubId);
    if (current && new Date(current.event_date).getTime() <= startsAt) continue;
    const participants = Number(event.participants_count ?? 0);
    const max = Number(event.max_participants ?? 0);
    const eventId = event.id || '';
    nextEventByClub.set(clubId, {
      id: eventId,
      title,
      event_date: eventDate,
      location: event.location || '',
      participants_count: participants,
      max_participants: max,
      participants,
      max,
      attending: Boolean(eventId) && attendingEventIds.has(eventId),
    });
  }

  return members.map((member) => {
    const club = clubById.get(member.club_id);
    const nextEvent = nextEventByClub.get(member.club_id) ?? null;
    const status = member.status;
    const membershipStatus: ClubMembershipStatus | null =
      status === 'active' || status === 'banned' || status === 'pending' ? status : null;
    return {
      id: member.club_id,
      n: club?.name || 'Club',
      // Un banni ou un candidat n'est pas présenté comme membre actif.
      role: membershipStatus === 'active' ? member.role || 'Membre' : null,
      members: activeMemberCounts
        ? activeMemberCounts.get(member.club_id) ?? 0
        : Number(club?.members_count ?? 0),
      emoji: club?.emoji?.trim() || null,
      category: club?.category?.trim() || null,
      next: nextEvent ? [nextEvent.title, formatDate(nextEvent.event_date)].filter(Boolean).join(' · ') : '',
      nextEvent,
      topics: topicsByClub.get(member.club_id) ?? [],
      recommendedKits: recommendedKitsByClub.get(member.club_id) ?? [],
      // Un membre banni ou en attente n'est jamais « joined » : le drawer ne
      // doit pas lui proposer Quitter ni RSVP.
      membershipStatus,
      joined: membershipStatus === 'active',
    };
  });
}

// ---------------------------------------------------------------------------
// Chargement serveur (léger, tolérant aux tables optionnelles)
// ---------------------------------------------------------------------------

type SupabaseLike = SupabaseClient;

/**
 * Lecture tolérante qui distingue « vide » de « échec » : `null` signifie que
 * la requête n'a pas abouti, un tableau vide qu'elle a réellement rien renvoyé.
 */
async function safeRowsOrNull<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[] | null> {
  try {
    const { data, error } = await query;
    if (error) {
      // Jamais de bruit en production : une table optionnelle absente ou une
      // RLS refusée doit rester un état vide silencieux côté client.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[compte] lecture bootstrap ignorée', error);
      }
      return null;
    }
    if (!data) return [];
    return data;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[compte] lecture bootstrap échouée', error);
    }
    return null;
  }
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  return (await safeRowsOrNull(query)) ?? [];
}

export async function loadAccountBootstrap(supabase: SupabaseLike) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { authenticated: false as const };

  const [profileRes, followerRows, followingRows] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    safeRows<{ follower_id?: string | null }>(
      supabase.from('user_follows').select('follower_id').eq('following_id', user.id)
    ),
    safeRows<{ following_id?: string | null }>(
      supabase.from('user_follows').select('following_id').eq('follower_id', user.id)
    ),
  ]);

  const profile = (profileRes.data ?? null) as AccountProfileRow | null;
  const followerIds = [
    ...new Set(
      followerRows
        .map((row) => row.follower_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const followingIds = [
    ...new Set(
      followingRows
        .map((row) => row.following_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const followers = followerIds.length;

  const [
    postRows,
    outings,
    statsSessions,
    orderRows,
    notificationRows,
    followingProfiles,
    followerProfiles,
    clubMembers,
    kitRows,
    storyRows,
    badgeRows,
    userBadgeRows,
    challengeRows,
    userChallengeRows,
    progressionRows,
    userProgressionRows,
    ownershipRows,
    loanRows,
    highlightRows,
  ] = await Promise.all([
    safeRows<PostRow>(
      supabase
        .from('community_posts')
        .select(
          'id,title,content,author_id,image_url,media_urls,likes_count,comments_count,shares_count,audience,club_id,created_at,reposted_from_id'
        )
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(24)
    ),
    safeRows<HikeRow>(
      supabase
        .from('hike_sessions')
        .select('id,route_id,started_at,ended_at,distance_km,elevation_gain_m,positions_timed,kit_id,title,max_altitude_m,visibility')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(24)
    ),
    // Agrégats Vitrine, Passeport et Cordée : toutes les sessions, sans
    // plafond de liste. La trace GPS est lue pour vérifier les tampons.
    safeRows<StatsHikeRow>(
      supabase
        .from('hike_sessions')
        .select(
          'id,route_id,started_at,ended_at,distance_km,elevation_gain_m,positions_timed'
        )
        .eq('user_id', user.id)
    ),
    safeRows<OrderRow>(
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    ),
    safeRows<NotificationRow>(
      supabase
        .from('notifications')
        .select('id,type,title,message,read,created_at,link')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    followingIds.length
      ? safeRows<FollowProfileRow>(
          supabase
            .from('public_profiles')
            .select('id,handle,full_name,avatar_url,trust_score,location')
            .in('id', followingIds)
        )
      : Promise.resolve([] as FollowProfileRow[]),
    followerIds.length
      ? safeRows<FollowProfileRow>(
          supabase
            .from('public_profiles')
            .select('id,handle,full_name,avatar_url,trust_score,location')
            .in('id', followerIds)
        )
      : Promise.resolve([] as FollowProfileRow[]),
    safeRows<ClubMemberRow>(supabase.from('club_members').select('club_id,role,status').eq('user_id', user.id)),
    safeRows<KitRow>(
      supabase
        .from('materiel_kits')
        .select(
          'id,name,description,total_weight_g,generation,field_proven_count,ancestors,lineage_root_id,is_souche,cover_image_url,created_at'
        )
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })
        .limit(24)
    ),
    safeRows<StoryRow>(
      supabase
        .from('post_stories')
        .select('id,caption,media_type,created_at,storage_path,image_url')
        .eq('author_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(12)
    ),
    safeRows<BadgeRow>(
      supabase
        .from('badges')
        .select('id,name,description,rarity,points_reward,requirement_type,requirement_value,active')
    ),
    safeRows<UserBadgeRow>(
      supabase.from('user_badges').select('badge_id,earned_at').eq('user_id', user.id)
    ),
    safeRows<ChallengeRow>(
      supabase
        .from('challenges')
        .select('id,title,category,difficulty,xp,total,deadline,active')
    ),
    safeRows<UserChallengeRow>(
      supabase
        .from('user_challenges')
        .select('challenge_id,progress,completed,completed_at')
        .eq('user_id', user.id)
    ),
    safeRows<ProgressionChallengeRow>(
      supabase
        .from('progression_challenges')
        .select('id,title,skill,points_reward,difficulty,target_progress')
    ),
    safeRows<UserProgressionRow>(
      supabase
        .from('user_progression')
        .select('current_challenge_id,challenge_progress')
        .eq('user_id', user.id)
    ),
    safeRows<OwnershipRow>(
      supabase
        .from('product_ownership')
        .select('id,name,brand,category,weight_g,price_cents,condition,photo_url,is_lent')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500)
    ),
    safeRows<LoanRow>(
      supabase
        .from('materiel_loans')
        .select(
          'id,product_ownership_id,lender_id,borrower_id,borrower_contact,status,loaned_at,due_date,returned_at,lender_rating,borrower_rating'
        )
        .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`)
        .order('loaned_at', { ascending: false })
        .limit(100)
    ),
    safeRows<StoryHighlightRow>(
      supabase
        .from('story_highlights')
        .select('id,title,cover_story_id,position')
        .eq('owner_id', user.id)
        .order('position', { ascending: true })
    ),
  ]);

  // Couverture réelle des sorties : première photo de `hike_session_photos`,
  // résolue en URL signée. Une sortie sans photo reste sans couverture.
  const outingIds = outings.map((row) => row.id).filter(Boolean);
  const outingPhotoRows = outingIds.length
    ? await safeRows<{ session_id: string; storage_path: string; position: number | null }>(
        supabase
          .from('hike_session_photos')
          .select('session_id,storage_path,position')
          .in('session_id', outingIds)
          .order('position', { ascending: true })
      )
    : [];
  const coverBySession = new Map<string, string>();
  const paths = [...new Set(outingPhotoRows.map((row) => row.storage_path).filter(Boolean))];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('outing-media')
      .createSignedUrls(paths.slice(0, 48), 3600);
    const urlByPath = new Map(
      ((signed ?? []) as Array<{ path?: string; signedUrl?: string }>).map((entry) => [
        entry.path ?? '',
        entry.signedUrl ?? '',
      ])
    );
    for (const row of outingPhotoRows) {
      if (coverBySession.has(row.session_id)) continue;
      const url = urlByPath.get(row.storage_path);
      if (url) coverBySession.set(row.session_id, url);
    }
  }

  const routeIds = [
    ...new Set(
      [...outings, ...statsSessions]
        .map((row) => row.route_id)
        .filter((id): id is number => typeof id === 'number')
    ),
  ];
  const clubIds = [...new Set(clubMembers.map((member) => member.club_id).filter(Boolean))];
  const kitIds = kitRows.map((kit) => kit.id);
  const highlightIds = highlightRows.map((highlight) => highlight.id);
  const loanOwnershipIds = [
    ...new Set(
      loanRows
        .map((loan) => loan.product_ownership_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const repostRows = postRows.filter((row): row is PostRow => Boolean(row.reposted_from_id));
  const repostSourceIds = [
    ...new Set(
      repostRows
        .map((row) => row.reposted_from_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  const [routes, clubs, clubEvents, clubTopics, clubRecommendedKitLinks, kitItems, catalogItems, highlightItems, repostSources, companionCandidates, loanOwnershipRows, clubActiveMemberRows] =
    await Promise.all([
      routeIds.length
        ? safeRows<RouteRow>(supabase.from('hiking_routes').select('id,name,region').in('id', routeIds))
        : Promise.resolve([] as RouteRow[]),
      clubIds.length
        ? safeRows<ClubRow>(
            supabase
              .from('clubs')
              .select('id,name,members_count,emoji,category')
              .in('id', clubIds)
          )
        : Promise.resolve([] as ClubRow[]),
      clubIds.length
        ? safeRows<ClubEventRow>(
            supabase
              .from('club_events')
              .select('id,club_id,title,event_date,location,participants_count,max_participants')
              .in('club_id', clubIds)
              .gte('event_date', new Date().toISOString())
              .order('event_date', { ascending: true })
              .limit(200)
          )
        : Promise.resolve([] as ClubEventRow[]),
      clubIds.length
        ? safeRows<ClubTopicRow>(
            supabase
              .from('club_topics')
              .select('id,club_id,title,is_pinned')
              .in('club_id', clubIds)
              .order('is_pinned', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(200)
          )
        : Promise.resolve([] as ClubTopicRow[]),
      // `club_recommended_kits.kit_id` référence `public.kits` (contrainte
      // réelle). Les fiches sont résolues plus bas pour les clubs de l'utilisateur.
      clubIds.length
        ? safeRows<ClubRecommendedKitLinkRow>(
            supabase
              .from('club_recommended_kits')
              .select('club_id,kit_id,note')
              .in('club_id', clubIds)
          )
        : Promise.resolve([] as ClubRecommendedKitLinkRow[]),
      kitIds.length
        ? safeRows<KitItemImageRow>(
            supabase
              .from('materiel_kit_items')
              .select('kit_id,name,product_ownership_id,created_at')
              .in('kit_id', kitIds)
              .order('created_at', { ascending: true })
          )
        : Promise.resolve([] as KitItemImageRow[]),
      safeRows<CatalogKitItemRow>(supabase.from('kit_items').select('nom,image').limit(500)),
      highlightIds.length
        ? safeRows<StoryHighlightItemRow>(
            supabase.from('story_highlight_items').select('highlight_id').in('highlight_id', highlightIds)
          )
        : Promise.resolve([] as StoryHighlightItemRow[]),
      repostSourceIds.length
        ? safeRows<PostRow>(
            supabase
              .from('community_posts')
              .select('id,title,content,author_id,image_url,created_at')
              .in('id', repostSourceIds)
          )
        : Promise.resolve([] as PostRow[]),
      routeIds.length
        ? safeRows<CompanionCandidateRow>(
            supabase
              .from('hike_sessions')
              .select('id,user_id,route_id,started_at')
              .in('route_id', routeIds)
              .neq('user_id', user.id)
              .limit(500)
          )
        : Promise.resolve([] as CompanionCandidateRow[]),
      // Objets prêtés (côté prêteur comme côté emprunteur) : la policy
      // `product_ownership_select_loan_involved` autorise ces lignes sans
      // élargir la lecture de l'inventaire complet d'autrui.
      loanOwnershipIds.length
        ? safeRows<OwnershipRow>(
            supabase
              .from('product_ownership')
              .select('id,name,brand,category,weight_g,price_cents,condition,photo_url,is_lent')
              .in('id', loanOwnershipIds)
          )
        : Promise.resolve([] as OwnershipRow[]),
      // Décompte réel des membres actifs des clubs de l'utilisateur, agrégé
      // côté client. `null` sur échec : `mapClubs` se replie alors sur le
      // compteur dénormalisé au lieu d'afficher un faux 0.
      clubIds.length
        ? safeRowsOrNull<{ club_id: string }>(
            supabase
              .from('club_members')
              .select('club_id,status')
              .in('club_id', clubIds)
              .eq('status', 'active')
          )
        : Promise.resolve([] as Array<{ club_id: string }>),
    ]);

  const recommendedKitIds = [
    ...new Set(
      clubRecommendedKitLinks
        .map((link) => link.kit_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  const activeMemberCounts = clubActiveMemberRows
    ? clubActiveMemberRows.reduce((counts, row) => {
        if (row.club_id) counts.set(row.club_id, (counts.get(row.club_id) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())
    : null;

  const regionByRouteId = new Map(routes.map((route) => [route.id, route.region?.trim() || '']));

  // Compagnons : autres marcheurs ayant enregistré une sortie le même jour sur
  // le même itinéraire. L'historique complet (`statsSessions`) est utilisé pour
  // que les sorties communes ne s'arrêtent pas aux 24 sorties affichées.
  // Aucun participant n'est inventé, aucun lien n'est déduit sans une session
  // réelle des deux côtés.
  const ownerSessionsByRouteDay = new Map<string, StatsHikeRow[]>();
  for (const outing of statsSessions) {
    if (typeof outing.route_id !== 'number') continue;
    const day = sessionDayKey(outing.started_at);
    if (!day) continue;
    const key = `${outing.route_id}:${day}`;
    const list = ownerSessionsByRouteDay.get(key) ?? [];
    list.push(outing);
    ownerSessionsByRouteDay.set(key, list);
  }

  const companionRows: CompanionSessionRow[] = [];
  const seenCompanionSessions = new Set<string>();
  for (const candidate of companionCandidates) {
    if (!candidate.user_id || candidate.user_id === user.id || typeof candidate.route_id !== 'number') continue;
    const day = sessionDayKey(candidate.started_at);
    if (!day) continue;
    const ownerSessions = ownerSessionsByRouteDay.get(`${candidate.route_id}:${day}`);
    if (!ownerSessions) continue;
    for (const ownerSession of ownerSessions) {
      const dedupe = `${ownerSession.id}:${candidate.user_id}`;
      if (seenCompanionSessions.has(dedupe)) continue;
      seenCompanionSessions.add(dedupe);
      companionRows.push({
        session_id: ownerSession.id,
        user_id: candidate.user_id,
        started_at: candidate.started_at,
        massif: regionByRouteId.get(candidate.route_id) || '',
      });
    }
  }

  const loanCounterpartIds = loanRows
    .flatMap((loan) => [loan.lender_id, loan.borrower_id])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const relationIds = [
    ...new Set([
      ...companionRows.map((row) => row.user_id),
      ...repostSources
        .map((source) => source.author_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ...loanCounterpartIds,
    ]),
  ];
  const regionKeys = [
    ...new Set(
      routes
        .map((route) => normalizePlain(route.region))
        .filter((key) => key.length > 0)
    ),
  ];
  const clubEventIds = [
    ...new Set(
      clubEvents
        .map((event) => event.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  const [
    relationProfiles,
    geoMassifs,
    clubEventParticipantRows,
    recommendedCatalogKits,
    recommendedMaterialKits,
  ] = await Promise.all([
    relationIds.length
      ? safeRows<FollowProfileRow>(
          supabase
            .from('public_profiles')
            .select('id,handle,full_name,avatar_url,trust_score,location')
            .in('id', relationIds)
        )
      : Promise.resolve([] as FollowProfileRow[]),
    regionKeys.length
      ? safeRows<GeoMassifRow>(
          supabase
            .from('geo_massifs')
            .select('geoname_id,name,name_plain,country_code')
            .in('name_plain', regionKeys)
            .limit(1000)
        )
      : Promise.resolve([] as GeoMassifRow[]),
    // Présence de l'appelant aux prochains événements de ses clubs. La table
    // est vide pour un utilisateur sans RSVP : `attending` reste alors false.
    clubEventIds.length
      ? safeRows<ClubEventParticipantRow>(
          supabase
            .from('club_event_participants')
            .select('event_id,user_id')
            .in('event_id', clubEventIds)
            .eq('user_id', user.id)
        )
      : Promise.resolve([] as ClubEventParticipantRow[]),
    recommendedKitIds.length
      ? safeRows<ClubKitCatalogRow>(
          supabase
            .from('kits')
            .select('id,nom,image,poids_total_g,nb_articles')
            .in('id', recommendedKitIds)
        )
      : Promise.resolve([] as ClubKitCatalogRow[]),
    // Repli documenté : si une recommandation référence un kit personnel
    // (`materiel_kits`) au lieu du catalogue `kits`, la fiche réelle est lue
    // sous la RLS de session (kit public ou appartenant à l'utilisateur).
    recommendedKitIds.length
      ? safeRows<ClubMaterialKitRow>(
          supabase
            .from('materiel_kits')
            .select('id,name,total_weight_g,cover_image_url')
            .in('id', recommendedKitIds)
        )
      : Promise.resolve([] as ClubMaterialKitRow[]),
  ]);

  const profileById = new Map<string, CompanionProfileRow>();
  for (const row of [...followingProfiles, ...followerProfiles, ...relationProfiles]) {
    profileById.set(row.id, row);
  }
  // Le profil courant n'appartient à aucune des listes ci-dessus : il reste
  // nécessaire pour attribuer une republication repliée sur sa ligne copiée.
  if (profile) profileById.set(user.id, profile);

  const loanOwnershipById = new Map(
    [...ownershipRows, ...loanOwnershipRows].map((row) => [row.id, row])
  );
  const loanedToByItem = new Map<string, string>();
  for (const loan of loanRows) {
    if (loan.lender_id !== user.id) continue;
    if (loan.status !== 'en_cours' && loan.status !== 'en_retard') continue;
    const counterpart = loan.borrower_id ? profileById.get(loan.borrower_id) : undefined;
    const name =
      counterpart?.full_name?.trim() || counterpart?.handle?.trim() || loan.borrower_contact?.trim() || '';
    if (name) loanedToByItem.set(loan.product_ownership_id, name);
  }

  const kitItemCounts = new Map<string, number>();
  for (const item of kitItems) {
    kitItemCounts.set(item.kit_id, (kitItemCounts.get(item.kit_id) ?? 0) + 1);
  }
  const kitImages = resolveKitImages(kitItems, catalogItems, ownershipRows);

  // Fiches des kits recommandés : `kits` d'abord (cible réelle de la clé
  // étrangère), puis `materiel_kits` pour un kit personnel recommandé. Une
  // recommandation sans fiche lisible n'est pas transformée en kit fictif.
  const recommendedKitById = new Map<string, Omit<ClubRecommendedKitRow, 'club_id'>>();
  for (const row of recommendedCatalogKits) {
    recommendedKitById.set(row.id, {
      kit_id: row.id,
      name: row.nom,
      image: row.image,
      weight_g: row.poids_total_g,
      items: row.nb_articles,
    });
  }
  for (const row of recommendedMaterialKits) {
    if (recommendedKitById.has(row.id)) continue;
    recommendedKitById.set(row.id, {
      kit_id: row.id,
      name: row.name,
      image: row.cover_image_url,
      weight_g: row.total_weight_g,
      items: null,
    });
  }
  const clubRecommendedKits: ClubRecommendedKitRow[] = [];
  for (const link of clubRecommendedKitLinks) {
    if (!link.club_id || !link.kit_id) continue;
    const kit = recommendedKitById.get(link.kit_id);
    if (!kit) continue;
    clubRecommendedKits.push({
      ...kit,
      club_id: link.club_id,
      note: link.note || '',
    });
  }

  const highlightItemCounts = new Map<string, number>();
  for (const item of highlightItems) {
    highlightItemCounts.set(item.highlight_id, (highlightItemCounts.get(item.highlight_id) ?? 0) + 1);
  }

  const challengeProgress = new Map<string, { progress: number; completed: boolean }>();
  for (const row of userChallengeRows) {
    if (!row.challenge_id) continue;
    challengeProgress.set(row.challenge_id, {
      progress: Number(row.progress ?? 0),
      completed: Boolean(row.completed),
    });
  }

  const orderRowsMapped = mapOrders(orderRows);

  return {
    authenticated: true as const,
    profile: mapProfile(profile, followers, followingIds.length),
    carnets: mapPosts(postRows),
    outings: mapOutings(outings, routes, coverBySession),
    stats: mapStats(statsSessions, routes, geoMassifs),
    orders: orderRowsMapped.orders,
    bookings: orderRowsMapped.bookings,
    notifications: mapNotifications(notificationRows),
    tribu: mapTribu(followingProfiles),
    followers: mapTribu(followerProfiles),
    following: mapTribu(followingProfiles),
    reposts: mapReposts(repostRows, repostSources, profileById),
    badges: mapBadges(badgeRows, userBadgeRows),
    challenges: mapChallenges(challengeRows, challengeProgress, progressionRows, userProgressionRows[0] ?? null),
    kits: mapKits(kitRows, kitItemCounts, kitImages),
    gearItems: mapGearItems(ownershipRows, loanedToByItem),
    loans: mapLoans(loanRows, loanOwnershipById, profileById, user.id),
    trust: mapTrust(loanRows, user.id, Boolean(user.email_confirmed_at)),
    // Passeport et lieux visités sur l'historique complet, pas sur la liste
    // d'affichage plafonnée à 24 sorties.
    stamps: mapStamps(statsSessions, routes, geoMassifs),
    highlights: mapHighlights(highlightRows, highlightItemCounts),
    clubs: mapClubs(
      clubMembers,
      clubs,
      clubEvents,
      clubTopics,
      clubRecommendedKits,
      clubEventParticipantRows,
      activeMemberCounts
    ),
    companions: mapCompanions(companionRows, profileById),
    // Le bootstrap n'est servi qu'au propriétaire authentifié : il voit son
    // propre profil privé sans passer par une invitation.
    visibility: mapVisibility(profile),
    stories: mapStories(storyRows),
    // Aucune table d'espèces ni de massifs personnels : on ne fabrique rien.
    species: [] as Array<Record<string, unknown>>,
    massifs: [] as Array<Record<string, unknown>>,
  };
}
