import type {
  Collection,
  Highlight,
  HighlightPhoto,
  RouteActivity,
  RouteObservation,
  RoutePhoto,
  Viewer,
} from '../types';

export const OWNER: Viewer = { id: 'user-owner', relation: 'authenticated' };
export const OTHER: Viewer = { id: 'user-other', relation: 'authenticated' };
export const FOLLOWER: Viewer = { id: 'user-follower', relation: 'follower' };
export const ANON: Viewer = { id: null, relation: 'anonymous' };

export function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    id: 'highlight-1',
    authorId: 'user-owner',
    authorName: 'Tony',
    kind: 'place',
    target: { type: 'place', id: 'place-1' },
    title: 'Belvédère du lac',
    description: 'Vue nette sur les aiguilles.',
    sport: 'hike',
    areaLabel: 'Chamonix',
    location: { lat: 45.9237, lng: 6.8694 },
    privacy: {
      hideExactLocation: false,
      hidePhotos: false,
      requireExifStripped: true,
      allowContributions: true,
    },
    audience: 'public',
    photos: [],
    tips: [],
    votes: [],
    status: 'published',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makePhoto(overrides: Partial<HighlightPhoto> = {}): HighlightPhoto {
  return {
    id: 'photo-1',
    authorId: 'user-owner',
    url: 'https://cdn.example.test/highlight.jpg',
    caption: 'Le lac',
    masked: false,
    exifStripped: true,
    consentPublic: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'collection-1',
    ownerId: 'user-owner',
    ownerName: 'Tony',
    kind: 'personal',
    title: 'Mes lieux',
    description: ' mes favoris',
    theme: 'lacs',
    region: 'Chamonix',
    partner: null,
    visibility: 'private',
    items: [],
    shareLinks: [],
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeRoutePhoto(overrides: Partial<RoutePhoto> = {}): RoutePhoto {
  return {
    id: 'route-photo-1',
    routeId: 'route-1',
    authorId: 'user-owner',
    authorName: 'Tony',
    url: 'https://cdn.example.test/route.jpg',
    caption: 'Le passage',
    location: { lat: 45.924, lng: 6.87 },
    takenAt: '2026-11-01T10:00:00.000Z',
    audience: 'public',
    exifStripped: true,
    masked: false,
    consentPublic: true,
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<RouteActivity> = {}): RouteActivity {
  return {
    id: 'activity-1',
    routeId: 'route-1',
    userId: 'user-owner',
    displayName: 'Tony',
    date: '2026-11-02T08:00:00.000Z',
    distanceKm: 12.4,
    durationS: 14_400,
    sport: 'hike',
    audience: 'public',
    hideStats: false,
    ...overrides,
  };
}

export function makeObservation(overrides: Partial<RouteObservation> = {}): RouteObservation {
  return {
    id: 'observation-1',
    routeId: 'route-1',
    userId: 'user-owner',
    text: 'Passage boueux après la pluie, bâtons utiles.',
    tags: ['boueux', 'technique'],
    audience: 'public',
    consentAggregate: true,
    status: 'published',
    createdAt: '2026-11-02T08:00:00.000Z',
    ...overrides,
  };
}
