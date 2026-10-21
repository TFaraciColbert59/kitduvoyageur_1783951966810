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
    expect(rows[1].status).toBe('upcoming');
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
});
