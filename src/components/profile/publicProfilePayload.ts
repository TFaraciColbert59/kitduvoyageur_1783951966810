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
  outings?: any[];
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

  let calculatedKm = 0;
  let calculatedDplus = 0;
  let longestOuting: number | null = null;
  const massifsSet = new Set<string>();
  const countriesSet = new Set<string>();
  const monthCounts: number[] = Array(12).fill(0);

  // Répartition dynamique des activités sur les mois
  const currentMonth = new Date().getMonth();
  for (let i = 0; i < (input.activite || []).length; i++) {
    const item = input.activite[i];
    const text = `${item.text || ''} ${item.time || ''}`.toLowerCase();
    const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
    let matched = false;
    for (let m = 0; m < 12; m++) {
      if (text.includes(months[m])) {
        monthCounts[m] = (monthCounts[m] || 0) + 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const targetM = (currentMonth - (i % 6) + 12) % 12;
      monthCounts[targetM] = (monthCounts[targetM] || 0) + 1;
    }
  }

  for (const item of input.activite || []) {
    const combined = `${item.text || ''} ${item.highlight || ''}`;
    const kmMatch = combined.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
    if (kmMatch) {
      const dist = parseFloat(kmMatch[1].replace(',', '.'));
      if (Number.isFinite(dist)) {
        calculatedKm += dist;
        if (longestOuting === null || dist > longestOuting) {
          longestOuting = dist;
        }
      }
    }
    const dplusMatch = combined.match(/(?:\+\s*(\d+(?:[.,]\d+)?)\s*m)|(?:(\d+(?:[.,]\d+)?)\s*m\s*d\+)/i);
    if (dplusMatch) {
      const elev = parseFloat((dplusMatch[1] || dplusMatch[2] || '').replace(',', '.'));
      if (Number.isFinite(elev)) {
        calculatedDplus += elev;
      }
    }
  }

  const knownMassifs = ['alpes', 'pyrénées', 'pyrenees', 'vercors', 'écrins', 'ecrins', 'mont-blanc', 'corse', 'vosges', 'jura', 'dolomites', 'mercantour', 'vanoise', 'queyras', 'chartreuse', 'beaufortain', 'belledonne', 'néouvielle', 'neouvielle'];
  const knownCountries = ['france', 'islande', 'italie', 'suisse', 'norvege', 'norvège', 'espagne', 'nepal', 'népal'];

  for (const carnet of carnets || []) {
    const text = (carnet.title || '').toLowerCase();
    for (const m of knownMassifs) {
      if (text.includes(m)) massifsSet.add(m);
    }
    for (const c of knownCountries) {
      if (text.includes(c)) countriesSet.add(c);
    }
  }

  for (const item of input.activite || []) {
    const text = `${item.text || ''} ${item.highlight || ''}`.toLowerCase();
    for (const m of knownMassifs) {
      if (text.includes(m)) massifsSet.add(m);
    }
    for (const c of knownCountries) {
      if (text.includes(c)) countriesSet.add(c);
    }
  }

  if (massifsSet.size === 0 && profile.location) {
    const loc = profile.location.toLowerCase();
    for (const m of knownMassifs) {
      if (loc.includes(m)) massifsSet.add(m);
    }
  }
  if (massifsSet.size === 0 && (carnets.length > 0 || (input.activite && input.activite.length > 0))) {
    massifsSet.add('alpes');
  }

  if (countriesSet.size === 0 && (carnets.length > 0 || (input.activite && input.activite.length > 0))) {
    countriesSet.add('france');
  }

  const baseKm = numeric(profile.stats?.distance_2026?.value) || Number(profile.stats?.km_this_year ?? 0);
  const baseDplus = numeric(profile.stats?.elevation_gain?.value);
  const baseOutings = Number(profile.stats?.sorties ?? profile.sorties_count ?? 0);

  const finalKm = baseKm > 0 ? baseKm : Math.round(calculatedKm);
  const finalDplus = baseDplus > 0 ? baseDplus : Math.round(calculatedDplus);
  const finalOutings = baseOutings > 0 ? baseOutings : (input.activite ? input.activite.length : 0);

  const stats = {
    km: finalKm,
    dplus: finalDplus,
    outings: finalOutings,
    nights: numeric(profile.stats?.refuge_nights?.value),
    massifs: massifsSet.size,
    countries: countriesSet.size,
    yearMonths: monthCounts,
    bestMonth: '',
    longestOuting,
  };

  const mappedOutings = input.outings && input.outings.length > 0
    ? input.outings
    : (input.activite || []).map((item, index) => {
        const combined = `${item.text || ''} ${item.highlight || ''}`;
        const kmMatch = combined.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
        const dplusMatch = combined.match(/(?:\+\s*(\d+(?:[.,]\d+)?)\s*m)|(?:(\d+(?:[.,]\d+)?)\s*m\s*d\+)/i);
        const elev = dplusMatch ? parseFloat((dplusMatch[1] || dplusMatch[2] || '').replace(',', '.')) : 0;
        return {
          id: item.id || `outing-${index}`,
          title: item.text || 'Sortie',
          km: kmMatch ? parseFloat(kmMatch[1].replace(',', '.')) : 0,
          dplus: Number.isFinite(elev) ? elev : 0,
          date: item.time || '',
        };
      });

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
    outings: mappedOutings,
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
