import { describe, expect, it } from 'vitest';
import { buildPublicProfilePayload } from '../publicProfilePayload';
import type { CompteUserProfile } from '@/lib/supabase/queries-compte';

const profile = {
  id: 'u1',
  first_name: 'Léa',
  last_name: 'Roux',
  handle: 'lea_drawer',
  role_badge: 'VOYAGEUR',
  member_since: '2026',
  bio: 'Compagnon de cordée',
  location: 'Alpes',
  tenure: '',
  sorties_count: 0,
  last_active: '',
  avatar_url: '',
  hero_image_url: '',
  trust_score: 78,
  level: { number: 'I', title: 'Novice', current_pts: 0, max_pts: 1, next_level_pts: 1, next_level_title: 'II' },
  stats: {
    sorties: 0,
    carnets: 0,
    clubs: 0,
    km_this_year: 0,
    distance_2026: { value: '0 km', diff: '' },
    elevation_gain: { value: '0 m', detail: '' },
    refuge_nights: { value: '0 nuit', detail: '' },
    co2_saved: { value: '0 kg', detail: '' },
  },
} satisfies CompteUserProfile;

describe('publicProfilePayload', () => {
  it('mappe les données publiques réelles sans inventer de sortie', () => {
    const payload = buildPublicProfilePayload({
      profile,
      carnets: [
        { id: 'c1', title: 'Vercors', status: 'Publié', image_url: 'https://img.test/1.jpg' },
      ],
      clubs: [{ id: 'cl1', name: 'Trekkeurs', role: 'Membre', members_count: 12, detail: '', logo_url: '', slug: 'trek' }],
      badges: [{ id: 'b1', title: 'Premier pas', icon_name: 'badge', earned: true }],
      activite: [],
      viewer: 'visitor',
      visibility: 'public',
    });

    expect(payload.profile.handle).toBe('lea_drawer');
    expect(payload.profile.name).toBe('Léa Roux');
    expect(payload.viewer).toBe('visitor');
    expect(payload.outings).toEqual([]);
    expect(payload.highlights).toHaveLength(1);
    expect(payload.badges[0]).toMatchObject({ name: 'Premier pas', earned: true });
    expect(payload.clubs[0]).toMatchObject({ n: 'Trekkeurs', members: 12 });
    expect(payload.trust.verified).toBe(true);
  });
});
