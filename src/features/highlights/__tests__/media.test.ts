import { describe, expect, it } from 'vitest';
import { indexTrailPhotos, routeCommunityMedia } from '../engine/trailView';
import { coarseArea, normalizeRouteTag, synthesizeRouteCommunity } from '../engine/communityRoute';
import { FOLLOWER, ANON, OTHER, makeActivity, makeObservation, makeRoutePhoto } from './fixtures';

const route = {
  id: 'route-1',
  points: [
    { lat: 45.9237, lng: 6.8694 },
    { lat: 45.9247, lng: 6.8694 },
  ],
};

describe('K2.26 — Trail View indexé sur la géométrie', () => {
  it('projette une photo sur le tracé sans exposer sa coordonnée', () => {
    const markers = indexTrailPhotos(route, [
      makeRoutePhoto({ location: { lat: 45.9242, lng: 6.8694 } }),
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0].distanceAlongM).toBeGreaterThan(40);
    expect(markers[0].distanceAlongM).toBeLessThan(70);
    expect(markers[0].offsetM).toBeLessThan(10);
    const serialized = JSON.stringify(markers);
    expect(serialized).not.toContain('45.9242');
    expect(serialized).not.toContain('6.8694');
  });

  it('rejette une photo trop loin du tracé', () => {
    const markers = indexTrailPhotos(route, [
      makeRoutePhoto({ location: { lat: 45.9337, lng: 6.8694 } }),
    ]);
    expect(markers).toEqual([]);
  });

  it('rejette photos masquées, EXIF non nettoyé, privées ou sans consentement', () => {
    const photos = [
      makeRoutePhoto({ id: 'masked', masked: true }),
      makeRoutePhoto({ id: 'exif', exifStripped: false }),
      makeRoutePhoto({ id: 'private', audience: 'private' }),
      makeRoutePhoto({ id: 'consent', consentPublic: false }),
    ];
    expect(indexTrailPhotos(route, photos)).toEqual([]);
  });

  it('trie par distance parcourue et borne la liste', () => {
    const photos = [
      makeRoutePhoto({ id: 'second', location: { lat: 45.9246, lng: 6.8694 } }),
      makeRoutePhoto({ id: 'first', location: { lat: 45.924, lng: 6.8694 } }),
    ];
    expect(indexTrailPhotos(route, photos, { limit: 1 }).map((item) => item.photoId)).toEqual([
      'first',
    ]);
  });
});

describe('S3.05 — photos publiques et activités récentes', () => {
  it('filtre les photos non publiables et les activités privées', () => {
    const media = routeCommunityMedia(
      'route-1',
      [
        makeRoutePhoto(),
        makeRoutePhoto({ id: 'masked', masked: true }),
        makeRoutePhoto({ id: 'other-route', routeId: 'route-2' }),
      ],
      [
        makeActivity(),
        makeActivity({ id: 'private', audience: 'private' }),
        makeActivity({ id: 'followers', audience: 'followers' }),
      ],
      ANON
    );
    expect(media.photos.map((photo) => photo.id)).toEqual(['route-photo-1']);
    expect(media.activities.map((activity) => activity.id)).toEqual(['activity-1']);
  });

  it('un abonné voit les activités réservées aux abonnés', () => {
    const media = routeCommunityMedia(
      'route-1',
      [],
      [makeActivity({ id: 'followers', audience: 'followers' })],
      FOLLOWER
    );
    expect(media.activities).toHaveLength(1);
  });

  it('masque distance et durée sans inventer de valeur', () => {
    const media = routeCommunityMedia('route-1', [], [makeActivity({ hideStats: true })], OTHER);
    expect(media.activities[0].distanceKm).toBeNull();
    expect(media.activities[0].durationS).toBeNull();
    expect(JSON.stringify(media)).not.toContain('12.4');
  });
});

describe('S3.24 — tags et descriptions communautaires', () => {
  it('n’expose un tag qu’avec plusieurs sources distinctes', () => {
    const summary = synthesizeRouteCommunity('route-1', [
      makeObservation({ id: 'o1', userId: 'u1' }),
      makeObservation({ id: 'o2', userId: 'u2', tags: ['boueux', 'vue'] }),
    ]);
    expect(summary.tags.find((tag) => tag.tag === 'boueux')).toMatchObject({
      sources: 2,
      count: 2,
    });
    expect(summary.tags.find((tag) => tag.tag === 'vue')).toBeUndefined();
    expect(summary.sourceCount).toBe(2);
  });

  it('ignore les observations privées, retirées ou non consenties', () => {
    const summary = synthesizeRouteCommunity('route-1', [
      makeObservation({ id: 'private', audience: 'private' }),
      makeObservation({ id: 'hidden', status: 'hidden' }),
      makeObservation({ id: 'no-consent', consentAggregate: false }),
    ]);
    expect(summary.tags).toEqual([]);
    expect(summary.description).toBeNull();
    expect(summary.updatedAt).toBeNull();
  });

  it('assemble une description à partir des textes publics les plus récents', () => {
    const summary = synthesizeRouteCommunity('route-1', [
      makeObservation({
        id: 'o1',
        userId: 'u1',
        text: 'Passage boueux après la pluie.',
        createdAt: '2026-11-01T10:00:00.000Z',
      }),
      makeObservation({
        id: 'o2',
        userId: 'u2',
        text: 'Fontaine au col, eau claire.',
        createdAt: '2026-11-02T10:00:00.000Z',
      }),
    ]);
    expect(summary.description).toContain('Fontaine au col');
    expect(summary.description).toContain('Passage boueux');
    expect(summary.updatedAt).toBe('2026-11-02T10:00:00.000Z');
  });

  it('normalise les tags et arrondit une zone grossière', () => {
    expect(normalizeRouteTag('#Boueux!!')).toBe('boueux');
    expect(normalizeRouteTag('a')).toBeNull();
    expect(coarseArea({ lat: 45.923712, lng: 6.869349 })).toEqual({ lat: 45.92, lng: 6.87 });
  });
});
