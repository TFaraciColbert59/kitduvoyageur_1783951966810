import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';

export function moment(id: string, imageUrl: string | null): CarnetMomentItem {
  return { id, dayNumber: 1, time: null, caption: null, authorName: null, place: null, imageUrl };
}

export const DETAIL: CarnetDetail = {
  id: 'c1',
  title: 'Tour du Mont-Blanc',
  destination: 'France / Italie / Suisse',
  description: 'Dix jours, trois pays, deux bivouacs.',
  coverImage: 'https://cdn.test/cover.jpg',
  coverImageAlt: 'Crête au lever du jour',
  startDate: '2026-09-26',
  endDate: '2026-10-02',
  dateRange: '26 sept. – 2 oct. 2026',
  visibility: 'public',
  isPublic: true,
  verified: true,
  isOwner: false,
  author: { id: 'u1', name: 'Camille Rochat', handle: 'camille', avatarUrl: null, trustScore: 94 },
  participants: [{ userId: 'u1', name: 'Camille Rochat', handle: 'camille', avatarUrl: null, role: 'author' }],
  stats: [
    { key: 'distance', label: 'DISTANCE', value: '106,4 km' },
    { key: 'elevation', label: 'DÉNIVELÉ +', value: '2 002 m' },
    { key: 'days', label: 'JOURS', value: '7' },
  ],
  engagement: { likes: 22, comments: 3, views: 2320, liked: false, favorited: false },
  likers: [],
  moments: [moment('m1', 'https://cdn.test/1.jpg')],
  photoMoments: [moment('m1', 'https://cdn.test/1.jpg')],
  days: [],
  etapes: [],
  summary: { distanceKm: null, elevationM: null, days: 0, moments: 0 },
  kit: { totalWeightG: null, items: [] },
  trace: null,
  place: { country: null, region: null, locality: null, lat: null, lng: null },
  distanceKm: 106.4,
  elevationM: 2002,
};

export function detail(overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return { ...DETAIL, ...overrides };
}
