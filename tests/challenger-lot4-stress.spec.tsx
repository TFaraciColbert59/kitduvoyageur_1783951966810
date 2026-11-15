// @vitest-environment jsdom
// tests/challenger-lot4-stress.spec.tsx
//
// EMPIRICAL CHALLENGER LOT 4 STRESS TEST SUITE
// Stress-tests Lot 4 implementations under adversarial conditions:
// 1. Profile 60/40 shell and public profile payload privacy & resilience
// 2. Messaging thread deduplication under edge cases
// 3. Kit Studio unauthenticated access and loop prevention
// 4. Design token & contrast integrity across CookieConsentBanner and 404
//

import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { buildPublicProfilePayload } from '@/components/profile/publicProfilePayload';
import { Profile6040Shell } from '@/components/profile/Profile6040Shell';
import type {
  CompteUserProfile,
  CompteCarnet,
  CompteClubItem,
  CompteBadgeItem,
  CompteActiviteItem,
} from '@/lib/supabase/queries-compte';
import {
  filterConversations,
  conversationTitle,
  lastPreview,
} from '@/components/messaging/messagesModel';
import type { Conversation } from '@/features/messaging/types/messaging.types';
import { resolveStudioPageState } from '@/features/kit-studio/server/studioMode';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(),
  Marker: vi.fn(),
  setWorkerUrl: vi.fn(),
}));

afterEach(cleanup);

/* ──────────────────────────────────────────────────────────────────────────
   1. PROFILE 60/40 & PUBLIC PROFILE PRIVACY & EDGE CASES
   ────────────────────────────────────────────────────────────────────────── */

describe('CHALLENGE 1: Profile 60/40 & Privacy Stress Test', () => {
  const dummyProfile = (overrides: Partial<CompteUserProfile> = {}): CompteUserProfile => ({
    id: 'user-adversarial-1',
    first_name: 'Éléonore-François',
    last_name: "d'Hauteville",
    handle: 'eleonore_haut',
    bio: 'Alpiniste en terrain hostile',
    location: 'Chamonix-Mont-Blanc',
    avatar_url: '',
    hero_image_url: '',
    trust_score: 85,
    sorties_count: 0,
    member_since: '2025',
    role_badge: 'VOYAGEUR',
    tenure: '1 an',
    last_active: '',
    level: { number: 'III', title: 'Explorateur', current_pts: 1200, max_pts: 1500, next_level_pts: 300, next_level_title: 'Aventurier' },
    stats: {
      sorties: 0,
      carnets: 0,
      clubs: 0,
      km_this_year: 0,
      distance_2026: { value: '0 km', diff: '' },
      elevation_gain: { value: '0 m D+', detail: '' },
      refuge_nights: { value: '—', detail: '' },
      co2_saved: { value: '—', detail: '' },
    },
    ...overrides,
  });

  it('génère un payload vide propre sans crash quand un profil n’a aucune sortie ni carnet', () => {
    const payload = buildPublicProfilePayload({
      profile: dummyProfile(),
      carnets: [],
      clubs: [],
      badges: [],
      activite: [],
      viewer: 'visitor',
      visibility: 'public',
    });

    expect(payload).toBeDefined();
    expect(payload.stats.km).toBe(0);
    expect(payload.stats.dplus).toBe(0);
    expect(payload.stats.outings).toBe(0);
    expect(payload.outings).toEqual([]);
    expect(payload.highlights).toEqual([]);
    expect(payload.badges).toEqual([]);
    expect(payload.clubs).toEqual([]);
    expect(payload.visibility.profile).toBe('public');
  });

  it('ne fait fuiter AUCUNE coordonnée GPS privée ou donnée de tracé dans le payload public', () => {
    const payload = buildPublicProfilePayload({
      profile: dummyProfile({
        location: 'Massif des Écrins (secret spot: 44.9123, 6.3456)',
      }),
      carnets: [
        {
          id: 'carnet-secret',
          title: 'Traversée secrète Vercors',
          image_url: 'https://images/secret.jpg',
          days_count: 3,
        } as unknown as CompteCarnet,
      ],
      clubs: [{ id: 'club-1', name: 'Alpinisme Isère', members_count: 42, role: 'Membre' } as CompteClubItem],
      badges: [{ id: 'b1', title: 'Sommet', earned: true } as CompteBadgeItem],
      activite: [
        {
          id: 'act-1',
          text: 'Randonnée secrète · 14.5 km · +850 m D+',
          highlight: '45.1234, 5.6789 (private waypoint)',
          time: 'Il y a 3 jours',
          icon_type: 'like',
        } as CompteActiviteItem,
      ],
      outings: [
        {
          id: 'out-1',
          title: 'Sortie publique',
          km: 14.5,
          dplus: 850,
          date: '2026-10-10',
        },
      ],
      viewer: 'visitor',
      visibility: 'public',
    });

    // Audit récursif : vérifier qu'aucune coordonnée n'apparaît
    function checkNoCoordinates(obj: unknown, pathTrail: string = ''): void {
      if (!obj || typeof obj !== 'object') return;

      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const fullKey = `${pathTrail}.${k}`;
        expect(
          ['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'geometry', 'points', 'gpx', 'geojson']
        ).not.toContain(k.toLowerCase());

        if (typeof v === 'object' && v !== null) {
          checkNoCoordinates(v, fullKey);
        }
      }
    }

    checkNoCoordinates(payload);
  });

  it('gère les entrées adversariales : caractères accentués, symboles, formats km farfelus', () => {
    const payload = buildPublicProfilePayload({
      profile: dummyProfile({
        first_name: 'Жан-Luc 🌲',
        last_name: 'O’Connor & Son',
        handle: 'jean_luc_🌲_test',
        trust_score: 99.9,
      }),
      carnets: [],
      clubs: [],
      badges: [],
      activite: [
        {
          id: 'malformed-1',
          text: 'Sortie extrême avec 99999.9 km et +12345.5 m d+ sous la pluie',
          highlight: '',
          time: 'janv',
          icon_type: 'like',
        },
        {
          id: 'malformed-2',
          text: 'Sortie invalide NaN km et +-500 m d+',
          highlight: '',
          time: 'août',
          icon_type: 'like',
        },
      ],
      viewer: 'visitor',
      visibility: 'prive',
    });

    expect(payload.profile.handle).toMatch(/^[a-z0-9_]+$/);
    expect(payload.visibility.profile).toBe('prive');
    expect(Number.isFinite(payload.stats.km)).toBe(true);
    expect(Number.isFinite(payload.stats.dplus)).toBe(true);
    expect(payload.stats.yearMonths).toHaveLength(12);
    expect(payload.stats.yearMonths.every((c) => Number.isFinite(c))).toBe(true);
  });

  it('résiste à une charge de 2 000 activités sans explosion mémoire ni dépassement de temps', () => {
    const massiveActivities: CompteActiviteItem[] = Array.from({ length: 2000 }, (_, i) => ({
      id: `act-${i}`,
      text: `Sortie de test massif #${i} · 12 km · +600 m d+`,
      highlight: i % 2 === 0 ? 'Vercors' : 'Alpes',
      time: 'juil',
      icon_type: 'like',
    }));

    const start = performance.now();
    const payload = buildPublicProfilePayload({
      profile: dummyProfile(),
      carnets: [],
      clubs: [],
      badges: [],
      activite: massiveActivities,
      viewer: 'visitor',
      visibility: 'public',
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(payload.stats.outings).toBe(2000);
    expect(payload.stats.km).toBe(2000 * 12);
  });

  it('affiche un état vide confidentiel sans planter quand signature_visibility est "prive"', () => {
    const profileWithPrivateSig = {
      ...dummyProfile(),
      signature_visibility: 'prive',
    } as any;

    render(
      <Profile6040Shell
        mode="visitor"
        profile={profileWithPrivateSig}
        carnets={[]}
        clubs={[]}
        badges={[]}
        activite={[]}
      />
    );

    expect(screen.getByText('Empreinte confidentielle')).toBeDefined();
    expect(
      screen.getByText('Ce voyageur a choisi de garder ses traces et coordonnées GPS privées.')
    ).toBeDefined();
    expect(document.querySelector('.lkdv-6040-map-private')).not.toBeNull();
  });

  it('affiche des statistiques à zéro et les initiales quand un visiteur ouvre un profil sans sorties', () => {
    render(
      <Profile6040Shell
        mode="visitor"
        profile={dummyProfile({ first_name: 'Camille', last_name: 'Alpin', avatar_url: '' })}
        carnets={[]}
        clubs={[]}
        badges={[]}
        activite={[]}
      />
    );

    // Initiales générées correctement
    expect(screen.getByText('CA')).toBeDefined();
    // 4 statistiques à 0 rendues proprement (sorties, carnets, clubs, badges)
    expect(screen.getAllByText('0')).toHaveLength(4);
    // Aucun conteneur highlights ne doit être rendu quand carnets est vide
    expect(document.querySelector('.lkdv-6040-highlights-wrap')).toBeNull();
  });

  it('survit à un profil null sans planter et affiche le fallback "Voyageur"', () => {
    render(
      <Profile6040Shell
        mode="visitor"
        profile={null}
        carnets={[]}
        clubs={[]}
        badges={[]}
        activite={[]}
      />
    );

    expect(screen.getByText('Voyageur')).toBeDefined();
    expect(screen.getByText('@voyageur')).toBeDefined();
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   2. MESSAGES THREAD DEDUPLICATION STRESS TESTS
   ────────────────────────────────────────────────────────────────────────── */

describe('CHALLENGE 2: Messaging Deduplication & Filter Stress Test', () => {
  const makeConv = (overrides: Partial<Conversation> = {}): Conversation => ({
    id: `conv-${Math.random().toString(36).slice(2, 8)}`,
    type: 'direct',
    last_message_at: '2026-10-26T12:00:00Z',
    created_at: '2026-10-25T12:00:00Z',
    updated_at: '2026-10-26T12:00:00Z',
    unread_count: 0,
    status: 'active',
    other_member: { id: 'user-recipient-1', full_name: 'Thomas Mercier' } as Conversation['other_member'],
    last_message: {
      id: 'msg-1',
      conversation_id: 'conv-1',
      sender_id: 'user-recipient-1',
      sender_name: 'Thomas Mercier',
      content: 'On part à 7h ?',
      message_type: 'text',
      created_at: '2026-10-26T12:00:00Z',
    } as Conversation['last_message'],
    ...overrides,
  });

  it('déduplique strictement quand N conversations directes partagent le même interlocuteur', () => {
    const list: Conversation[] = [
      makeConv({ id: 'thread-1', other_member: { id: 'user-dup', full_name: 'Alice' } as any }),
      makeConv({ id: 'thread-2', other_member: { id: 'user-dup', full_name: 'Alice' } as any }),
      makeConv({ id: 'thread-3', other_member: { id: 'user-dup', full_name: 'Alice' } as any }),
      makeConv({ id: 'thread-4', other_member: { id: 'user-other', full_name: 'Bob' } as any }),
    ];

    const result = filterConversations(list, { filter: 'all', query: '' });
    expect(result.map((c) => c.id)).toEqual(['thread-1', 'thread-4']);
  });

  it('déduplique par full_name ou titre quand l’identifiant id est absent', () => {
    const list: Conversation[] = [
      makeConv({ id: 't-1', other_member: { full_name: 'Camille Guide' } as any }),
      makeConv({ id: 't-2', other_member: { full_name: 'Camille Guide' } as any }),
      makeConv({ id: 't-3', other_member: null, title: 'Camille Guide' }),
    ];

    const result = filterConversations(list, { filter: 'direct', query: '' });
    expect(result.map((c) => c.id)).toEqual(['t-1']);
  });

  it('ne bloque pas une conversation active si un fil antérieur supprimé (left_at) partage le même id', () => {
    const list: Conversation[] = [
      makeConv({
        id: 't-deleted',
        left_at: '2026-10-20T10:00:00Z',
        other_member: { id: 'user-shared', full_name: 'David' } as any,
      }),
      makeConv({
        id: 't-active',
        other_member: { id: 'user-shared', full_name: 'David' } as any,
      }),
    ];

    const result = filterConversations(list, { filter: 'all', query: '' });
    expect(result.map((c) => c.id)).toEqual(['t-active']);
  });

  it('ne déduplique PAS les groupes partageant un même titre', () => {
    const list: Conversation[] = [
      makeConv({ id: 'g-1', type: 'group', title: 'Tour du Mont-Blanc 2026' }),
      makeConv({ id: 'g-2', type: 'group', title: 'Tour du Mont-Blanc 2026' }),
    ];

    const result = filterConversations(list, { filter: 'group', query: '' });
    expect(result.map((c) => c.id)).toEqual(['g-1', 'g-2']);
  });

  it('filtre 5 000 conversations en moins de 50 ms', () => {
    const massiveConvs: Conversation[] = Array.from({ length: 5000 }, (_, i) =>
      makeConv({
        id: `c-${i}`,
        type: i % 5 === 0 ? 'group' : 'direct',
        other_member: { id: `u-${i % 250}`, full_name: `Interlocuteur ${i % 250}` } as any,
        title: i % 5 === 0 ? `Groupe ${i}` : undefined,
      })
    );

    const start = performance.now();
    const filtered = filterConversations(massiveConvs, { filter: 'all', query: '12' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
    expect(filtered.length).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   3. KIT STUDIO UNAUTHENTICATED ACCESS & ROUTING LOOP
   ────────────────────────────────────────────────────────────────────────── */

describe('CHALLENGE 3: Kit Studio Unauthenticated State', () => {
  it('résout en state "login" sans lancer d’exception quand l’utilisateur n’est pas connecté', async () => {
    const state = await resolveStudioPageState({
      debug: undefined,
      next: '/kit-studio',
      getUser: async () => null,
      getData: async () => {
        throw new Error('Should not be called when unauthenticated');
      },
    });

    expect(state).toEqual({ kind: 'login', next: '/kit-studio' });
  });

  it('vérifie que page.tsx de kit-studio ne lance pas redirect() en mode login', () => {
    const pagePath = path.resolve(process.cwd(), 'src/app/kit-studio/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    expect(content).toContain("case 'login':");
    expect(content).toContain('<StudioEmptyState unauthenticated />');
    expect(content).not.toMatch(/case 'login':\s*redirect\(/);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   4. DESIGN TOKENS & CONTRAST INTEGRITY
   ────────────────────────────────────────────────────────────────────────── */

describe('CHALLENGE 4: Zero Dark Mode & Liquid Glass Contrast Integrity', () => {
  it('CookieConsentBanner.tsx n’utilise aucun noir pur (#000) ni classe sombre (.dark)', () => {
    const bannerPath = path.resolve(process.cwd(), 'src/components/CookieConsentBanner.tsx');
    const content = fs.readFileSync(bannerPath, 'utf8');

    expect(content).not.toContain('dark:');
    expect(content).not.toContain('.dark');
    expect(content).not.toMatch(/#[0]{3,6}\b/i);
    expect(content).not.toContain('#101010');
    expect(content).not.toContain('#121815');
    // Fond clair liquid glass conforme
    expect(content).toContain('rgba(240,245,238,0.92)');
    expect(content).toContain('#172B24');
  });

  it('not-found.tsx utilise une carte en verre sauge clair sans mode sombre ni noir pur', () => {
    const notFoundPath = path.resolve(process.cwd(), 'src/app/not-found.tsx');
    const content = fs.readFileSync(notFoundPath, 'utf8');

    expect(content).not.toContain('dark:');
    expect(content).not.toContain('.dark');
    expect(content).not.toMatch(/#[0]{3,6}\b/i);
    expect(content).not.toContain('#101010');
    expect(content).not.toContain('#121815');
    // Rebranding conforme "Kits & Studio"
    expect(content).toContain('Kits & Studio');
    expect(content).toContain('/kit-studio');
    // Fond carte clair liquid glass
    expect(content).toContain('rgba(240,245,238,0.88)');
    expect(content).toContain('#17402C');
  });
});
