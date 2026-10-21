import { describe, it, expect } from 'vitest';
import {
  mapProfile,
  mapCarnets,
  mapOutings,
  mapPosts,
  mapOrders,
  mapNotifications,
  mapTribu,
  mapClubs,
  mapKits,
  mapStories,
  mapHighlights,
  mapCompanions,
  mapReposts,
  mapChallenges,
  mapStamps,
} from '../../src/features/compte/data/accountBootstrap';

describe('Compte bootstrap — mapping réel', () => {
  it('mappe le profil et les compteurs', () => {
    const p = mapProfile({ id: 'u1', handle: 'tony_frc', full_name: 'Tony', location: 'Lyon', bio: 'Bivouac' }, 12, 3);
    expect(p.handle).toBe('tony_frc');
    expect(p.name).toBe('Tony');
    expect(p.followersCount).toBe(12);
    expect(p.followingCount).toBe(3);
    expect(p.bioLine).toBe('Lyon · Bivouac');
    expect(p.isGuest).toBe(false);
  });

  it('mappe les carnets avec des positions stables', () => {
    const rows = mapCarnets([
      { id: 'c1', title: 'Lac Blanc', destination: 'Mont-Blanc', description: 'Aube', likes_count: 4, views_count: 12, visibility: 'public', created_at: '2026-09-19T08:00:00Z' },
      { id: 'c2', title: 'Vercors', destination: 'Vercors', visibility: 'private' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('pub');
    expect(rows[1].status).toBe('draft');
    expect(rows[0].likes).toBe(4);
    expect(rows[0].x).toBeGreaterThan(0);
    expect(rows[1].h).toBeGreaterThan(100);
  });

  it('mappe les publications community_posts, pas les carnets', () => {
    const rows = mapPosts([
      { id: 'p1', title: 'Lac Blanc', content: 'Aube parfaite', image_url: 'x.jpg', media_urls: [], likes_count: 7, comments_count: 2, audience: 'public', created_at: '2026-09-19T08:00:00Z' },
    ]);
    expect(rows[0].postId).toBe('p1');
    expect(rows[0].title).toBe('Lac Blanc');
    expect(rows[0].likes).toBe(7);
    expect(rows[0].views).toBe(2);
  });

  it('mappe les sorties et le statut fait/à venir', () => {
    const rows = mapOutings(
      [
        { id: 'h1', route_id: 1, started_at: '2026-09-01T06:00:00Z', ended_at: '2026-09-01T15:00:00Z', distance_km: 12.5, elevation_gain_m: 800, positions_timed: [], kit_id: 'k1' },
        { id: 'h2', route_id: 2, started_at: '2026-10-28T06:00:00Z', ended_at: '2026-10-28T15:00:00Z' },
      ],
      [{ id: 1, name: 'Lac Blanc', region: 'Mont-Blanc' }, { id: 2, name: 'Néouvielle', region: 'Pyrénées' }]
    );
    expect(rows[0].status).toBe('done');
    expect(rows[0].mass).toBe('Mont-Blanc');
    expect(rows[0].km).toBe(12.5);
    expect(rows[0].dplus).toBe(800);
    expect(rows[0].startedAt).toBe('2026-09-01T06:00:00Z');
    expect(rows[0].photos).toEqual([]);
    expect(rows[1].status).toBe('upcoming');
  });

  it('mappe les kits réels et les stories actives', () => {
    const kits = mapKits(
      [
        { id: 'k1', name: 'Kit test', description: 'Sac réel', total_weight_g: 4200, generation: 2, field_proven_count: 3, ancestors: ['root'], is_souche: false },
        { id: 'k2', name: 'Souche', generation: 0, is_souche: true },
      ],
      new Map([['k1', 7]])
    );
    expect(kits[0].n).toBe('Kit test');
    expect(kits[0].gen).toBe('Lignée G2');
    expect(kits[0].items).toBe(7);
    expect(kits[0].prop).toBe(1);
    expect(kits[0].w).toBe(4200);
    expect(kits[1].gen).toBe('Kit souche');

    const stories = mapStories([
      { id: 's1', caption: 'Sommet', storage_path: 'u/s1.jpg', created_at: '2026-10-21T10:00:00Z' },
      { id: 's2', caption: 'Sans média' },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].storyId).toBe('s1');
    expect(stories[0].image).toBe('/api/stories/s1/media');
    expect(stories[0].title).toBe('Sommet');
  });

  it('mappe commandes, notifications, tribu et clubs', () => {
    const { orders, bookings } = mapOrders([
      { id: 'o1', order_number: '#LK-1', status: 'paid', total_eur: 42, created_at: '2026-09-01T10:00:00Z', items: [{ product_name: 'Duvet' }] },
    ]);
    expect(orders[0].id).toBe('#LK-1');
    expect(orders[0].amt).toBe(42);
    expect(bookings).toEqual([]);

    const notifications = mapNotifications([{ id: 'n1', type: 'like', title: 'Nouveau like', read: false }]);
    expect(notifications[0].type).toBe('like');
    expect(notifications[0].read).toBe(false);

    const tribu = mapTribu([{ id: 'u2', handle: 'lea', full_name: 'Léa', trust_score: 91 }]);
    expect(tribu[0].ps).toBe('lea');
    expect(tribu[0].i).toBe('L');

    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 142 }]
    );
    expect(clubs[0].n).toBe('Club Alpin');
    expect(clubs[0].joined).toBe(true);
  });

  it('mappe les kits avec image de repli', () => {
    const kits = mapKits(
      [{ id: 'k1', name: 'Kit', cover_image_url: null, total_weight_g: 4200 }],
      new Map([['k1', 10]]),
      new Map([['k1', 'https://img/x.jpg']])
    );
    expect(kits[0].image).toBe('https://img/x.jpg');

    const covered = mapKits(
      [{ id: 'k2', name: 'Kit couvert', cover_image_url: 'https://img/cover.jpg' }],
      new Map(),
      new Map([['k2', 'https://img/x.jpg']])
    );
    expect(covered[0].image).toBe('https://img/cover.jpg');
  });

  it('mappe les À la une avec leur nombre d’éléments', () => {
    const highlights = mapHighlights(
      [{ id: 'h1', title: 'Néouvielle', cover_story_id: 's1', position: 1 }],
      new Map([['h1', 4]])
    );
    expect(highlights[0].id).toBe('h1');
    expect(highlights[0].title).toBe('Néouvielle');
    expect(highlights[0].items).toBe(4);
    expect(highlights[0].coverStoryId).toBe('s1');
    expect(highlights[0].position).toBe(1);
  });

  it('mappe les compagnons avec leurs sorties communes', () => {
    const companions = mapCompanions(
      [
        { session_id: 's1', user_id: 'u2' },
        { session_id: 's2', user_id: 'u2' },
        { session_id: 's3', user_id: 'u3' },
      ],
      new Map([['u2', { handle: 'lea', full_name: 'Léa', avatar_url: 'https://img/lea.jpg' }]])
    );
    expect(companions).toHaveLength(2);
    expect(companions[0].id).toBe('u2');
    expect(companions[0].ps).toBe('lea');
    expect(companions[0].n).toBe('Léa');
    expect(companions[0].i).toBe('L');
    expect(companions[0].outings).toBe(2);
    expect(companions[0].avatar).toBe('https://img/lea.jpg');
    expect(companions[1].outings).toBe(1);
  });

  it('mappe les republications avec l’attribution de la source', () => {
    const reposts = mapReposts(
      [
        {
          id: 'p2',
          reposted_from_id: 'p1',
          created_at: '2026-10-01T08:00:00Z',
          audience: 'public',
          club_id: null,
        },
      ],
      [{ id: 'p1', title: 'Lac Blanc', content: 'Aube parfaite', author_id: 'u2' }],
      new Map([['u2', { handle: 'lea', full_name: 'Léa' }]])
    );
    expect(reposts).toHaveLength(1);
    expect(reposts[0].id).toBe('p2');
    expect(reposts[0].sourceId).toBe('p1');
    expect(reposts[0].sourceTitle).toBe('Lac Blanc');
    expect(reposts[0].sourceAuthor).toBe('@lea');
    expect(reposts[0].audience).toBe('public');
    expect(reposts[0].clubId).toBeNull();
  });

  it('mappe les défis avec la progression réelle', () => {
    const challenges = mapChallenges(
      [
        {
          id: 'c1',
          title: 'Bivouac étoilé',
          category: 'Explorer',
          difficulty: 'Moyen',
          xp: 120,
          total: 5,
          deadline: '2026-11-30',
        },
        { id: 'c2', title: 'Sans progression', total: 3, xp: 50 },
      ],
      new Map([['c1', { progress: 3, completed: false }]])
    );
    expect(challenges[0].progress).toBe(3);
    expect(challenges[0].target).toBe(5);
    expect(challenges[0].completed).toBe(false);
    expect(challenges[0].xp).toBe(120);
    expect(challenges[1].progress).toBe(0);
    expect(challenges[1].target).toBe(3);
  });

  it('dérive les tampons du passeport des sorties réelles', () => {
    const stamps = mapStamps(
      [
        { id: 's1', route_id: 1, started_at: '2026-08-01T06:00:00Z', ended_at: '2026-08-01T15:00:00Z', positions_timed: [{ lat: 1 }] },
        { id: 's2', route_id: 1, started_at: '2026-08-02T06:00:00Z', ended_at: '2026-08-02T15:00:00Z' },
        { id: 's3', route_id: 2, started_at: '2026-08-03T06:00:00Z', ended_at: '2026-08-03T15:00:00Z', positions_timed: [] },
      ],
      [
        { id: 1, name: 'Lac Blanc', region: 'Mont-Blanc' },
        { id: 2, name: 'Néouvielle', region: 'Pyrénées' },
      ],
      [{ geoname_id: 9001, name: 'Mont-Blanc', name_plain: 'mont-blanc', country_code: 'FR' }]
    );
    expect(stamps).toHaveLength(2);
    expect(stamps[0].name).toBe('Mont-Blanc');
    expect(stamps[0].kind).toBe('massif');
    expect(stamps[0].outings).toBe(2);
    expect(stamps[0].verified).toBe(true);
    expect(stamps[1].name).toBe('Pyrénées');
    expect(stamps[1].verified).toBe(false);
  });

  it('mapClubs renvoie null sans événement futur', () => {
    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
      []
    );
    expect(clubs[0].nextEvent).toBeNull();
  });

  it('mapClubs ignore un événement passé', () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
      [{ id: 'e1', club_id: 'c1', title: 'Sortie passée', event_date: past }]
    );
    expect(clubs[0].nextEvent).toBeNull();
  });

  it('mapClubs garde le prochain événement le plus proche avec son identifiant', () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
      [
        { id: 'e-later', club_id: 'c1', title: 'Sortie lointaine', event_date: later },
        { id: 'e-soon', club_id: 'c1', title: 'Sortie proche', event_date: soon },
      ]
    );
    expect(clubs[0].nextEvent?.id).toBe('e-soon');
    expect(clubs[0].nextEvent?.title).toBe('Sortie proche');
    expect(clubs[0].nextEvent?.event_date).toBe(soon);
  });
});
