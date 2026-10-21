import type { SupabaseClient } from '@supabase/supabase-js';

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
  likes_count?: number | null;
  comments_count?: number | null;
  audience?: string | null;
  created_at?: string | null;
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
};

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

export type ClubMemberRow = {
  club_id: string;
  role?: string | null;
  status?: string | null;
};

export type ClubRow = {
  id: string;
  name?: string | null;
  members_count?: number | null;
  next_event?: string | null;
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
  };
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
    const mediaCount = Array.isArray(row.media_urls) ? row.media_urls.length : (row.image_url ? 1 : 0);
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
      status: row.audience === 'public' ? 'pub' : 'draft',
      photos: mediaCount,
      species: [] as string[],
      likes: Number(row.likes_count ?? 0),
      views: Number(row.comments_count ?? 0),
      quote: row.content || '',
      x: p.x,
      y: p.y,
      h: p.h,
    };
  });
}

export function mapOutings(rows: HikeRow[], routes: RouteRow[]) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const now = Date.now();
  return rows.map((row, index) => {
    const p = position(index);
    const route = row.route_id ? routeById.get(row.route_id) : undefined;
    const ended = row.ended_at ? new Date(row.ended_at).getTime() : 0;
    const done = ended > 0 && ended < now;
    return {
      id: row.id,
      title: route?.name || 'Sortie enregistrée',
      mass: route?.region || 'Sortie',
      date: formatDate(row.started_at) || 'Sortie',
      km: Number(row.distance_km ?? 0),
      dplus: Number(row.elevation_gain_m ?? 0),
      maxAlt: null as number | null,
      status: done ? 'done' : 'upcoming',
      ready: done ? 100 : 0,
      proven: Boolean(row.positions_timed),
      comp: [] as string[],
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
  }));
}

export function mapClubs(members: ClubMemberRow[], clubs: ClubRow[]) {
  const clubById = new Map(clubs.map((club) => [club.id, club]));
  return members.map((member) => {
    const club = clubById.get(member.club_id);
    return {
      id: member.club_id,
      n: club?.name || 'Club',
      role: member.role || 'Membre',
      members: Number(club?.members_count ?? 0),
      next: club?.next_event || '',
      joined: member.status !== 'pending',
    };
  });
}

// ---------------------------------------------------------------------------
// Chargement serveur (léger, tolérant aux tables optionnelles)
// ---------------------------------------------------------------------------

type SupabaseLike = SupabaseClient;

async function safeRows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function loadAccountBootstrap(supabase: SupabaseLike) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { authenticated: false as const };

  const [profileRes, followersRes, followingRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_follows').select('follower_id').eq('following_id', user.id),
    supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
  ]);

  const profile = (profileRes.data ?? null) as AccountProfileRow | null;
  const followers = Array.isArray(followersRes.data) ? followersRes.data.length : 0;
  const followingIds = Array.isArray(followingRes.data)
    ? followingRes.data.map((row) => row.following_id).filter(Boolean)
    : [];

  const [carnetsRes, outingsRes, ordersRes, notificationsRes, followsRes, clubMembersRes] =
    await Promise.all([
      supabase
        .from('community_posts')
        .select('id,title,content,image_url,media_urls,likes_count,comments_count,audience,created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('hike_sessions')
        .select('id,route_id,started_at,ended_at,distance_km,elevation_gain_m,positions_timed,kit_id')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(24),
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase
        .from('notifications')
        .select('id,type,title,message,read,created_at,link')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      followingIds.length
        ? safeRows(
            supabase
              .from('public_profiles')
              .select('id,handle,full_name,avatar_url,trust_score,location')
              .in('id', followingIds)
          )
        : Promise.resolve([]),
      supabase.from('club_members').select('club_id,role,status').eq('user_id', user.id),
    ]);

  const outings = (outingsRes.data ?? []) as HikeRow[];
  const routeIds = [...new Set(outings.map((row) => row.route_id).filter((id): id is number => typeof id === 'number'))];
  const routes = routeIds.length
    ? await safeRows<RouteRow>(supabase.from('hiking_routes').select('id,name,region').in('id', routeIds))
    : [];

  const clubMembers = (clubMembersRes.data ?? []) as ClubMemberRow[];
  const clubIds = clubMembers.map((member) => member.club_id);
  const clubs = clubIds.length
    ? await safeRows<ClubRow>(
        supabase.from('clubs').select('id,name,members_count,next_event').in('id', clubIds)
      )
    : [];

  const orderRows = (ordersRes.data ?? []) as OrderRow[];
  const { orders, bookings } = mapOrders(orderRows);

  return {
    authenticated: true as const,
    profile: mapProfile(profile, followers, followingIds.length),
    carnets: mapPosts((carnetsRes.data ?? []) as PostRow[]),
    outings: mapOutings(outings, routes),
    orders,
    bookings,
    notifications: mapNotifications((notificationsRes.data ?? []) as NotificationRow[]),
    tribu: mapTribu(followsRes as FollowProfileRow[]),
    clubs: mapClubs(clubMembers, clubs),
  };
}
