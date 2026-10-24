import type {
  CompteActiviteItem,
  CompteBadgeItem,
  CompteCarnet,
  CompteClubItem,
  CompteUserProfile,
} from '@/lib/supabase/queries-compte';

export type PublicProfileViewer = 'owner' | 'visitor';

export interface PublicProfileInput {
  profile: CompteUserProfile;
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  badges: CompteBadgeItem[];
  activite: CompteActiviteItem[];
  viewer: PublicProfileViewer;
  visibility: 'public' | 'prive';
}

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPublicProfilePayload(input: PublicProfileInput) {
  const { profile, carnets, clubs, badges, viewer, visibility } = input;
  const name =
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Voyageur';
  const handle =
    (profile.handle || profile.first_name || 'voyageur')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 24);
  const trust = Number(profile.trust_score ?? 0);

  const stats = {
    km: numeric(profile.stats?.distance_2026?.value) || Number(profile.stats?.km_this_year ?? 0),
    dplus: numeric(profile.stats?.elevation_gain?.value),
    outings: Number(profile.stats?.sorties ?? profile.sorties_count ?? 0),
    nights: numeric(profile.stats?.refuge_nights?.value),
    massifs: 0,
    countries: 0,
    yearMonths: [] as number[],
    bestMonth: '',
    longestOuting: null as number | null,
  };

  return {
    viewer,
    visibility: { profile: visibility },
    profile: {
      id: profile.id,
      name,
      handle,
      avatarUrl: profile.avatar_url || null,
      coverUrl: profile.hero_image_url || null,
      bio: profile.bio || '',
      location: profile.location || '',
      trustScore: trust,
      visibility,
      memberSince: profile.member_since || '',
      level: profile.level?.title || '',
    },
    stats,
    stamps: [] as unknown[],
    outings: [] as unknown[],
    // Les carnets publics sont la seule source publique d'albums.
    highlights: carnets.slice(0, 8).map((carnet, index) => ({
      id: carnet.id,
      title: carnet.title || 'Carnet',
      items: 0,
      coverStoryId: null,
      cover: carnet.image_url || '',
      position: index,
    })),
    reposts: [] as unknown[],
    badges: badges.map((badge) => ({
      id: badge.id,
      name: badge.title,
      earned: badge.earned === true,
      rarity: '',
    })),
    clubs: clubs.map((club) => ({
      id: club.id,
      n: club.name,
      role: club.role,
      members: club.members_count,
      joined: true,
      category: club.detail || '',
    })),
    challenges: [] as unknown[],
    companions: [] as unknown[],
    followers: [] as unknown[],
    following: [] as unknown[],
    loans: [] as unknown[],
    trust: {
      verified: trust >= 70,
      active: 0,
      onTimeRate: null,
      rating: null,
    },
  };
}
