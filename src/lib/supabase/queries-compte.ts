import { createClient } from './client';

/* ────────────────────────────────────────────
   Types — matching UI expectations
   ──────────────────────────────────────────── */

export interface CompteLevel {
  number: string;       // roman numeral: I, II, III...
  title: string;
  current_pts: number;
  max_pts: number;
  next_level_pts: number;
  next_level_title: string;
}

export interface CompteStats {
  sorties: number;
  carnets: number;
  clubs: number;
  km_this_year: number;
  distance_2026: { value: string; diff: string };
  elevation_gain: { value: string; detail: string };
  refuge_nights: { value: string; detail: string };
  co2_saved: { value: string; detail: string };
}

export interface CompteUserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role_badge: string;
  member_since: string;
  bio: string;
  location: string;
  tenure: string;
  sorties_count: number;
  last_active: string;
  avatar_url: string;
  hero_image_url: string;
  level: CompteLevel;
  stats: CompteStats;
}

export interface CompteProchainVoyage {
  id: string;
  title: string;
  title_highlight: string;
  days_left: number;
  date_range: string;
  companions: string;
  refuges_count: number;
  preparation_percentage: number;
  preparation_detail: string;
  tasks_left: number;
  group_id: string;
}

export interface CompteAventure {
  id: string;
  title: string;
  date_detail: string;
  duration: string;
  companions: string[];
  distance: string;
  elevation: string;
  status: 'En cours' | 'Terminée' | 'Brouillon' | 'Planifiée';
  image_url: string;
}

export interface CompteCarnet {
  id: string;
  title: string;
  status: 'Publié' | 'Brouillon';
  image_url: string;
  likes?: number;
  views?: number;
  comments?: number;
  draft_detail?: string;
  edit_status?: string;
}

export interface CompteClubItem {
  id: string;
  name: string;
  role: 'Admin' | 'Membre';
  members_count: number;
  detail: string;
  badge?: string;
  logo_url: string;
  slug: string;
}

export interface CompteCommande {
  id: string;
  product_name: string;
  order_number: string;
  price: string;
  status: 'Expédiée' | 'Préparation' | 'Livrée';
  image_url: string;
}

export interface CompteBadgeItem {
  id: string;
  title: string;
  icon_name: string;
  earned: boolean;
}

export interface CompteActiviteItem {
  id: string;
  text: string;
  highlight: string;
  time: string;
  icon_type: 'like' | 'badge' | 'order' | 'comment' | 'follow';
}

export interface CompteAbonnement {
  type: string;
  details: string;
  price: string;
  status: string;
  renewal_date: string;
}

export interface CompteInventaire {
  articles_count: number;
  kits_count: number;
}

export interface CompteConstance {
  streak_weeks: number;
  subtitle: string;
  days: { day: string; count: number; active: boolean }[];
  footer_text: string;
  goal_text: string;
}

export interface CompteDashboardData {
  profile: CompteUserProfile;
  prochainVoyage: CompteProchainVoyage | null;
  aventures: CompteAventure[];
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  commandes: CompteCommande[];
  badges: CompteBadgeItem[];
  constance: CompteConstance;
  activite: CompteActiviteItem[];
  abonnement: CompteAbonnement | null;
  inventaire: CompteInventaire;
}

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

const LEVEL_TITLES: Record<number, { roman: string; title: string }> = {
  1: { roman: 'I', title: 'Novice' },
  2: { roman: 'II', title: 'Apprenti' },
  3: { roman: 'III', title: 'Explorateur' },
  4: { roman: 'IV', title: 'Aventurier' },
  5: { roman: 'V', title: 'Guide' },
  6: { roman: 'VI', title: 'Expert' },
  7: { roman: 'VII', title: 'Maître' },
  8: { roman: 'VIII', title: 'Légende' },
};

function romanLevel(lvl: number, xp: number): CompteLevel {
  const entry = LEVEL_TITLES[lvl] || LEVEL_TITLES[1]!;
  const maxPts = lvl * 500;
  const nextEntry = LEVEL_TITLES[lvl + 1] || LEVEL_TITLES[lvl]!;
  return {
    number: entry.roman,
    title: entry.title,
    current_pts: xp,
    max_pts: maxPts,
    next_level_pts: maxPts - xp,
    next_level_title: nextEntry.title.toUpperCase(),
  };
}

function fullNameSplit(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: '' };
  return { first: parts[0]!, last: parts.slice(1).join(' ') + '.' };
}

function formatMemberSince(iso: string | null): string {
  if (!iso) return 'Membre';
  const d = new Date(iso);
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `Membre depuis ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ────────────────────────────────────────────
   Query functions
   ──────────────────────────────────────────── */

export async function fetchFullProfile(userId: string): Promise<CompteUserProfile | null> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  // Compute derived stats
  const [carnetsCount, clubsCount, ordersCount, activitiesCount] = await Promise.all([
    supabase.from('carnets').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase.from('club_members').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const sorties = activitiesCount.count ?? 0;
  const totalCarnets = carnetsCount.count ?? 0;
  const totalClubs = clubsCount.count ?? 0;

  // Get total distance from activities
  const { data: activities } = await supabase
    .from('activities')
    .select('distance_km')
    .eq('user_id', userId);

  const totalKm = (activities ?? []).reduce((sum, a) => sum + Number(a.distance_km ?? 0), 0);

  const { first, last } = fullNameSplit(profile.full_name ?? '');

  return {
    id: profile.id,
    first_name: first,
    last_name: last,
    role_badge: `VOYAGEUR${profile.role ? ' · ' + profile.role.toUpperCase() : ''}`,
    member_since: formatMemberSince(profile.created_at),
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    tenure: `${new Date().getFullYear() - new Date(profile.created_at ?? Date.now()).getFullYear()} ans · ${sorties} sorties`,
    sorties_count: sorties,
    last_active: 'En ligne',
    avatar_url: profile.avatar_url ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=85',
    level: romanLevel(profile.level ?? 1, profile.xp ?? 0),
    stats: {
      sorties,
      carnets: totalCarnets,
      clubs: totalClubs,
      km_this_year: Math.round(totalKm),
      distance_2026: { value: `${Math.round(totalKm)} km`, diff: '↗ depuis le début' },
      elevation_gain: { value: '—', detail: 'Données à venir' },
      refuge_nights: { value: '—', detail: 'Données à venir' },
      co2_saved: { value: '—', detail: 'Données à venir' },
    },
  };
}

export async function fetchUserCarnets(userId: string): Promise<CompteCarnet[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('carnets')
    .select('*')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    status: c.visibility === 'private' ? 'Brouillon' as const : 'Publié' as const,
    image_url: c.cover_image ?? 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    likes: c.likes_count ?? 0,
    views: c.views_count ?? 0,
    comments: c.comments_count ?? 0,
  }));
}

export async function fetchUserClubs(userId: string): Promise<CompteClubItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('club_members')
    .select('role, clubs(*)')
    .eq('user_id', userId);

  return (data ?? [])
    // Le join `clubs(*)` peut être NULL si le club a été supprimé : on ignore
    // ces lignes au lieu de crasher sur `m.clubs.id`.
    .filter((m: any) => m.clubs)
    .map((m: any) => ({
      id: m.clubs.id,
      name: m.clubs.name,
      role: m.role === 'admin' ? 'Admin' as const : 'Membre' as const,
      members_count: m.clubs.members_count ?? 0,
      detail: m.clubs.type ?? '',
      badge: m.clubs.is_verified ? 'Vérifié' : undefined,
      logo_url: m.clubs.cover_image ?? 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=200&q=80',
      slug: m.clubs.slug,
    }));
}

export async function fetchUserOrders(userId: string): Promise<CompteCommande[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((o: any) => {
    const firstItem = o.items?.[0];
    const statusMap: Record<string, 'Expédiée' | 'Préparation' | 'Livrée'> = {
      shipped: 'Expédiée',
      processing: 'Préparation',
      delivered: 'Livrée',
      paid: 'Expédiée',
      pending: 'Préparation',
      cancelled: 'Préparation',
    };
    return {
      id: o.id,
      product_name: firstItem?.name ?? 'Commande',
      order_number: o.order_number,
      price: `${o.total_eur}€`,
      status: statusMap[o.status] ?? 'Préparation',
      image_url: firstItem?.image_url ?? 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=200&q=80',
    };
  });
}

export async function fetchUserBadges(userId: string): Promise<CompteBadgeItem[]> {
  const supabase = createClient();

  const { data: allBadges } = await supabase
    .from('badges')
    .select('*')
    .eq('active', true);

  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);

  const earnedIds = new Set((userBadges ?? []).map((ub: any) => ub.badge_id));

  const iconMap: Record<string, string> = {
    summit: 'MountainIcon',
    distance: 'SparklesIcon',
    author: 'PencilIcon',
    lightweight: 'ShoppingBagIcon',
    social: 'HeartIcon',
    regions: 'MapPinIcon',
    guide: 'StarIcon',
    complete: 'CheckBadgeIcon',
  };

  return (allBadges ?? []).map((b: any) => ({
    id: b.id,
    title: b.name,
    icon_name: iconMap[b.slug] ?? 'StarIcon',
    earned: earnedIds.has(b.id),
  }));
}

export async function fetchUserActivities(userId: string): Promise<CompteActiviteItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((a: any) => ({
    id: a.id,
    text: a.title ?? 'Activité enregistrée',
    highlight: '',
    time: timeAgo(a.created_at),
    icon_type: 'like' as const,
  }));
}

export async function fetchNextTrip(userId: string): Promise<CompteProchainVoyage | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('groupes')
    .select('*, groupe_membres!inner(user_id)')
    .eq('groupe_membres.user_id', userId)
    .gte('departure_date', new Date().toISOString().split('T')[0])
    .order('departure_date', { ascending: true })
    .limit(1);

  if (!data || data.length === 0) return null;

  const g = data[0]!;
  const daysLeft = g.departure_date
    ? Math.ceil((new Date(g.departure_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    id: g.id,
    title: g.destination ?? 'Voyage',
    title_highlight: '',
    days_left: Math.max(0, daysLeft),
    date_range: g.departure_date && g.return_date
      ? `${g.departure_date} → ${g.return_date}`
      : 'Dates à confirmer',
    companions: '',
    refuges_count: 0,
    preparation_percentage: 0,
    preparation_detail: 'À préparer',
    tasks_left: 0,
    group_id: g.id,
  };
}

export async function fetchDashboardData(userId: string): Promise<CompteDashboardData> {
  const [profile, carnets, clubs, commandes, badges, activite, prochainVoyage] = await Promise.all([
    fetchFullProfile(userId),
    fetchUserCarnets(userId),
    fetchUserClubs(userId),
    fetchUserOrders(userId),
    fetchUserBadges(userId),
    fetchUserActivities(userId),
    fetchNextTrip(userId),
  ]);

  const defaultProfile: CompteUserProfile = {
    id: userId,
    first_name: 'Utilisateur',
    last_name: '',
    role_badge: 'VOYAGEUR',
    member_since: 'Membre',
    bio: '',
    location: '',
    tenure: '',
    sorties_count: 0,
    last_active: '',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=85',
    level: { number: 'I', title: 'Novice', current_pts: 0, max_pts: 500, next_level_pts: 500, next_level_title: 'APPRENTI' },
    stats: { sorties: 0, carnets: 0, clubs: 0, km_this_year: 0, distance_2026: { value: '0 km', diff: '' }, elevation_gain: { value: '—', detail: '' }, refuge_nights: { value: '—', detail: '' }, co2_saved: { value: '—', detail: '' } },
  };

  return {
    profile: profile ?? defaultProfile,
    prochainVoyage: prochainVoyage ?? {
      id: '', title: 'Aucun', title_highlight: 'voyage prévu', days_left: 0, date_range: '', companions: '', refuges_count: 0, preparation_percentage: 0, preparation_detail: '', tasks_left: 0, group_id: '',
    },
    aventures: [],
    carnets,
    clubs,
    commandes,
    badges,
    constance: {
      streak_weeks: 0,
      subtitle: 'Commencez votre série d\'activités',
      days: [
        { day: 'L', count: 0, active: false },
        { day: 'M', count: 0, active: false },
        { day: 'M', count: 0, active: false },
        { day: 'J', count: 0, active: false },
        { day: 'V', count: 0, active: false },
        { day: 'S', count: 0, active: false },
        { day: 'D', count: 0, active: false },
      ],
      footer_text: 'Cette semaine · 0 sortie',
      goal_text: 'Objectif : 2',
    },
    activite,
    abonnement: {
      type: 'Gratuit',
      details: 'Abonnement de base',
      price: '0€',
      status: 'Actif',
      renewal_date: '',
    },
    inventaire: {
      articles_count: 0,
      kits_count: 0,
    },
  };
}

/* ────────────────────────────────────────────
   Utility
   ──────────────────────────────────────────── */

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return `${Math.floor(days / 7)} sem.`;
}
