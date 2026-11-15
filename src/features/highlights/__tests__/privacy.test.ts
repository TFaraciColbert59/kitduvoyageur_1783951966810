import { describe, expect, it } from 'vitest';
import { canViewAudience, projectCollection, projectHighlight, viewerRelation } from '../privacy';
import { ANON, FOLLOWER, OTHER, OWNER, makeCollection, makeHighlight, makePhoto } from './fixtures';

describe('P01 — projection d’un highlight', () => {
  it('ne laisse jamais sortir une photo masquée ni sa légende', () => {
    const highlight = makeHighlight({ photos: [makePhoto({ masked: true, caption: 'secret' })] });
    const view = projectHighlight(highlight, OTHER);
    expect(view?.photos).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(JSON.stringify(view)).not.toContain('cdn.example.test');
    expect(projectHighlight(highlight, OWNER)?.photos).toHaveLength(1);
  });

  it('retire une photo dont l’EXIF n’a pas été nettoyé', () => {
    const highlight = makeHighlight({ photos: [makePhoto({ exifStripped: false })] });
    expect(projectHighlight(highlight, OTHER)?.photos).toEqual([]);
    expect(projectHighlight(highlight, OWNER)?.photos).toHaveLength(1);
  });

  it('retire une photo sans consentement public', () => {
    const highlight = makeHighlight({ photos: [makePhoto({ consentPublic: false })] });
    expect(projectHighlight(highlight, OTHER)?.photos).toEqual([]);
  });

  it('retire la coordonnée exacte quand la position est masquée', () => {
    const highlight = makeHighlight({
      privacy: { ...makeHighlight().privacy, hideExactLocation: true },
    });
    const view = projectHighlight(highlight, OTHER);
    expect(view?.location).toBeNull();
    expect(view?.locationHidden).toBe(true);
    expect(JSON.stringify(view)).not.toContain('45.9237');
    expect(projectHighlight(highlight, OWNER)?.location).toEqual({ lat: 45.9237, lng: 6.8694 });
  });

  it('masque toute la galerie si hidePhotos est actif', () => {
    const highlight = makeHighlight({
      photos: [makePhoto()],
      privacy: { ...makeHighlight().privacy, hidePhotos: true },
    });
    expect(projectHighlight(highlight, OTHER)?.photos).toEqual([]);
    expect(projectHighlight(highlight, OTHER)?.photosHidden).toBe(true);
    expect(projectHighlight(highlight, OWNER)?.photos).toHaveLength(1);
  });

  it('respecte les audiences privée et abonnés', () => {
    const privateHighlight = makeHighlight({ audience: 'private' });
    expect(projectHighlight(privateHighlight, OWNER)).not.toBeNull();
    expect(projectHighlight(privateHighlight, FOLLOWER)).toBeNull();
    expect(projectHighlight(privateHighlight, ANON)).toBeNull();

    const followers = makeHighlight({ audience: 'followers' });
    expect(projectHighlight(followers, FOLLOWER)).not.toBeNull();
    expect(projectHighlight(followers, OTHER)).toBeNull();
    expect(projectHighlight(followers, ANON)).toBeNull();
  });

  it('un highlight caché ou retiré n’est visible que par son auteur', () => {
    expect(projectHighlight(makeHighlight({ status: 'hidden' }), OTHER)).toBeNull();
    expect(projectHighlight(makeHighlight({ status: 'hidden' }), OWNER)).not.toBeNull();
    expect(projectHighlight(makeHighlight({ status: 'removed' }), OWNER)).toBeNull();
  });

  it('ferme les contributions quand l’auteur le décide', () => {
    const highlight = makeHighlight({
      privacy: { ...makeHighlight().privacy, allowContributions: false },
    });
    expect(projectHighlight(highlight, OTHER)?.canContribute).toBe(false);
    expect(projectHighlight(makeHighlight(), OTHER)?.canContribute).toBe(true);
  });

  it('relation : propriétaire, abonné, authentifié, anonyme', () => {
    expect(viewerRelation(OWNER, 'user-owner')).toBe('owner');
    expect(viewerRelation(FOLLOWER, 'user-owner')).toBe('follower');
    expect(viewerRelation(OTHER, 'user-owner')).toBe('authenticated');
    expect(viewerRelation(ANON, 'user-owner')).toBe('anonymous');
    expect(canViewAudience('public', 'anonymous')).toBe(true);
    expect(canViewAudience('followers', 'authenticated')).toBe(false);
    expect(canViewAudience('private', 'follower')).toBe(false);
  });
});

describe('P01 — projection d’une collection', () => {
  it('une collection privée n’est pas lisible par un autre compte', () => {
    expect(projectCollection(makeCollection(), OTHER)).toBeNull();
    expect(projectCollection(makeCollection(), OWNER)).not.toBeNull();
  });

  it('une collection non listée n’est pas lisible sans lien', () => {
    expect(projectCollection(makeCollection({ visibility: 'unlisted' }), OTHER)).toBeNull();
    expect(projectCollection(makeCollection({ visibility: 'unlisted' }), OWNER)).not.toBeNull();
  });

  it('un lien partagé est en lecture seule et n’expose pas le propriétaire', () => {
    const collection = makeCollection({
      shareLinks: [
        {
          id: 'link-1',
          collectionId: 'collection-1',
          token: 'token-1',
          createdBy: 'user-owner',
          createdAt: '2026-11-01T10:00:00.000Z',
          expiresAt: '2026-12-01T10:00:00.000Z',
          revokedAt: null,
        },
      ],
      items: [
        {
          id: 'item-1',
          type: 'highlight',
          refId: 'highlight-1',
          title: 'Lac',
          sport: 'hike',
          position: 0,
        },
      ],
    });
    const view = projectCollection(collection, ANON, { shared: true });
    expect(view?.shared).toBe(true);
    expect(view?.ownerName).toBeNull();
    expect(view?.canEdit).toBe(false);
    expect(view?.canShare).toBe(false);
    expect(view?.links).toEqual([]);
    expect(view?.items).toHaveLength(1);
  });

  it('filtre les items devenus invisibles', () => {
    const collection = makeCollection({
      items: [
        { id: 'item-1', type: 'highlight', refId: 'h1', title: 'A', sport: 'hike', position: 1 },
        { id: 'item-2', type: 'route', refId: 'r1', title: 'B', sport: 'mtb', position: 0 },
      ],
    });
    const view = projectCollection(collection, OWNER, {
      canIncludeItem: (type) => type !== 'highlight',
    });
    expect(view?.items.map((item) => item.refId)).toEqual(['r1']);
    expect(view?.itemCount).toBe(1);
  });
});
