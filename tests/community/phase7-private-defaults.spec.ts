import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { convertTripToCarnetData } from '@/features/trips/engine/carnetConversionEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

const PHASE7_MIGRATION = 'supabase/migrations/20260911530000_phase7_carnet_private_default.sql';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Phase 7 — privé par défaut et publication figée (contrats)', () => {
  const minimalTrip = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'phase7-contract-trip',
    title: 'Voyage Phase 7',
    description: 'Voyage de test',
    destination_country_code: 'FR',
    destination_name: 'Chartreuse',
    start_date: '2026-09-01',
    end_date: '2026-09-02',
    status: 'completed',
    visibility: 'private',
    difficulty: 'easy',
    primary_activity: 'trekking',
    estimated_budget: 0,
    budget_currency: 'EUR',
    cover_image_url: null,
    user_id: 'user-owner',
    group_id: null,
    share_token: null,
    metadata: {},
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-02T18:00:00Z',
    permissions: {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageBudget: true,
      canViewDocuments: true,
    },
    collaborators: [],
    steps: [],
    items: [],
    expenses: [],
    pois: [],
    notes: [],
  } as unknown as TripFull;

  it('1. convertTripToCarnetData est privé par défaut et public uniquement sur opt-in explicite', () => {
    expect(convertTripToCarnetData(minimalTrip).carnet.visibility).toBe('private');
    expect(convertTripToCarnetData(minimalTrip, { isPublic: false }).carnet.visibility).toBe('private');
    expect(convertTripToCarnetData(minimalTrip, { isPublic: true }).carnet.visibility).toBe('public');
  });

  it('2. la migration Phase 7 rend carnets.visibility privée par défaut (SET DEFAULT, pas de réécriture)', () => {
    const sql = readRepoFile(PHASE7_MIGRATION);
    expect(sql).toMatch(/ALTER COLUMN visibility SET DEFAULT 'private'/);
    expect(sql).not.toMatch(/UPDATE\s+public\.carnets/i);
  });

  it('3. le trigger de snapshot fige le carnet à l\'insertion et ne le rafraîchit jamais sur UPDATE', () => {
    const sql = readRepoFile(PHASE7_MIGRATION);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS snapshot_payload jsonb/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS snapshot_at timestamptz/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.community_posts/);
    expect(sql).toMatch(/NEW\.snapshot_payload := OLD\.snapshot_payload/);
    expect(sql).toMatch(/NEW\.snapshot_at := OLD\.snapshot_at/);
    expect(sql).toMatch(/snapshot_exclude_location/);
  });

  it('4. plus aucune fusion silencieuse localStorage ↔ serveur dans le flux communauté', () => {
    const files = [
      'src/app/communaute/page.tsx',
      'src/components/carnets/CreateCarnetView.tsx',
      'src/components/clubs/CreateClubView.tsx',
      'src/app/nouveau-groupe/page.tsx',
      'src/app/communaute/publier/page.tsx',
    ];
    const offenders: string[] = [];
    for (const relative of files) {
      const content = readRepoFile(relative);
      for (const key of ['user_carnets_data', 'user_created_clubs', 'user_created_groups', 'user_community_posts']) {
        if (content.includes(key)) offenders.push(`${relative}: ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('5. aucun identifiant fantôme de type carnet-/club-/grp-/local- en cas d\'échec d\'insertion', () => {
    const files = [
      'src/components/carnets/CreateCarnetView.tsx',
      'src/components/clubs/CreateClubView.tsx',
      'src/app/nouveau-groupe/page.tsx',
      'src/app/communaute/publier/page.tsx',
      'src/app/api/hike-sessions/route.ts',
    ];
    const offenders: string[] = [];
    for (const relative of files) {
      const content = readRepoFile(relative);
      for (const ghost of ['`carnet-${Date.now()}', '`club-${Date.now()}', '`grp-${Date.now()}', '`local-${Date.now()}', '`guest-carnet-${Date.now()}']) {
        if (content.includes(ghost)) offenders.push(`${relative}: ${ghost}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
