// @vitest-environment jsdom
/**
 * I14 — profil privé : aucune fuite de contenu dans le navigateur.
 *
 * La page /profil/[id] doit trancher la visibilité AVANT de lancer les cinq
 * requêtes de contenu. Un profil privé sans invitation ne doit émettre qu'UNE
 * lecture `public_profiles` (la sonde RLS) puis afficher l'état verrouillé
 * existant, sans appeler fetchFullProfile / carnets / clubs / badges / activités.
 *
 * Les chargements de contenu sont mockés : le test observe le contrat de la
 * page (quelles requêtes partent, dans quel ordre), pas leur SQL interne.
 */

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PROFILE_ID = '22222222-2222-4222-8222-222222222222';

const state = vi.hoisted(() => ({
  profileId: '22222222-2222-4222-8222-222222222222',
  client: null as unknown as {
    auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
    from: (table: string) => unknown;
  },
}));

const queries = vi.hoisted(() => ({
  fetchFullProfile: vi.fn(),
  fetchUserCarnets: vi.fn(),
  fetchUserClubs: vi.fn(),
  fetchUserBadges: vi.fn(),
  fetchUserActivities: vi.fn(),
}));

vi.mock('@/lib/supabase/queries-compte', () => queries);
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => state.client,
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: state.profileId }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}));
vi.mock('@/hooks/useUserPresence', () => ({
  useUserPresence: () => false,
}));

vi.mock('@/components/ui', () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
  LoadingState: ({ label }: { label: string }) => <div>{label}</div>,
  IconButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/AppIcon', () => ({ default: () => null }));
vi.mock('@/components/ui/ReportBlockModal', () => ({ default: () => null }));
vi.mock('@/components/Header', () => ({ default: () => <header /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer /> }));
vi.mock('@/components/shell/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/compte/HeroProfil', () => ({
  default: ({ profile }: { profile: { first_name: string } }) => (
    <div data-testid="hero-profil">{profile.first_name}</div>
  ),
}));
vi.mock('@/components/compte/StatsBandeau', () => ({ default: () => null }));
vi.mock('@/components/compte/MesCarnetsCard', () => ({ default: () => null }));
vi.mock('@/components/compte/MesClubsCard', () => ({ default: () => null }));
vi.mock('@/components/compte/BadgesCard', () => ({ default: () => null }));
vi.mock('@/components/compte/ConstanceCard', () => ({ default: () => null }));
vi.mock('@/components/profile/PublicProfileV2', () => ({
  default: ({ profile }: { profile: { first_name?: string; full_name?: string; handle?: string } }) => (
    <div data-testid="hero-profil">{profile.first_name || profile.full_name || profile.handle || 'profil'}</div>
  ),
}));
vi.mock('@/components/profile/PublicProfilePostsGrid', () => ({ default: () => null }));

import PublicProfilePage from '../page';

interface ClientCalls {
  tables: string[];
  selectColumns: string[];
  filters: Array<{ column: string; value: unknown }>;
  maybeSingleCount: number;
}

function installClient(options: {
  viewer: { id: string } | null;
  visibleProfile: { id: string } | null;
}): ClientCalls {
  const calls: ClientCalls = {
    tables: [],
    selectColumns: [],
    filters: [],
    maybeSingleCount: 0,
  };

  const chain = {
    select: (columns: string) => {
      calls.selectColumns.push(columns);
      return chain;
    },
    eq: (column: string, value: unknown) => {
      calls.filters.push({ column, value });
      return chain;
    },
    maybeSingle: async () => {
      calls.maybeSingleCount += 1;
      return { data: options.visibleProfile, error: null };
    },
  };

  state.client = {
    auth: {
      getUser: async () => ({ data: { user: options.viewer } }),
    },
    from: (table: string) => {
      calls.tables.push(table);
      return chain;
    },
  };

  return calls;
}

const PROFILE = {
  id: PROFILE_ID,
  first_name: 'Léa',
  last_name: 'Montagne',
  role_badge: 'VOYAGEUR',
  member_since: '2024',
  bio: 'Sur les sentiers',
  location: 'Annecy',
  tenure: '2 ans',
  sorties_count: 12,
  last_active: 'hier',
  avatar_url: '/avatar.jpg',
  hero_image_url: '/hero.jpg',
  level: {
    number: 'II',
    title: 'Marcheuse',
    current_pts: 120,
    max_pts: 500,
    next_level_pts: 500,
    next_level_title: 'EXPLORATRICE',
  },
  stats: {
    sorties: 12,
    carnets: 2,
    clubs: 1,
    km_this_year: 80,
    distance_2026: { value: '80 km', diff: '' },
    elevation_gain: { value: '—', detail: '' },
    refuge_nights: { value: '—', detail: '' },
    co2_saved: { value: '—', detail: '' },
  },
};

beforeEach(() => {
  state.profileId = PROFILE_ID;
  queries.fetchFullProfile.mockReset().mockResolvedValue(PROFILE);
  queries.fetchUserCarnets.mockReset().mockResolvedValue([]);
  queries.fetchUserClubs.mockReset().mockResolvedValue([]);
  queries.fetchUserBadges.mockReset().mockResolvedValue([]);
  queries.fetchUserActivities.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Page /profil/[id] — visibilité avant chargement', () => {
  it('profil privé non invité : une seule sonde public_profiles, aucune requête de contenu, état verrouillé', async () => {
    const calls = installClient({ viewer: null, visibleProfile: null });

    render(<PublicProfilePage />);

    expect(screen.queryByTestId('hero-profil')).toBeNull();

    // Une seule lecture, celle de la vue publique bornée par la RLS.
    await waitFor(() => expect(calls.tables).toEqual(['public_profiles']));
    expect(calls.selectColumns).toEqual(['id']);
    expect(calls.filters).toEqual([{ column: 'id', value: PROFILE_ID }]);
    expect(calls.maybeSingleCount).toBe(1);

    // Les cinq requêtes de contenu ne partent jamais.
    expect(queries.fetchFullProfile).not.toHaveBeenCalled();
    expect(queries.fetchUserCarnets).not.toHaveBeenCalled();
    expect(queries.fetchUserClubs).not.toHaveBeenCalled();
    expect(queries.fetchUserBadges).not.toHaveBeenCalled();
    expect(queries.fetchUserActivities).not.toHaveBeenCalled();
  });

  it('profil public : la sonde passe puis les cinq requêtes historiques partent', async () => {
    const calls = installClient({
      viewer: null,
      visibleProfile: { id: PROFILE_ID },
    });

    render(<PublicProfilePage />);

    expect(await screen.findByTestId('hero-profil')).toBeTruthy();
    expect(screen.getByText('Léa')).toBeTruthy();

    expect(calls.tables).toEqual(['public_profiles']);
    expect(queries.fetchFullProfile).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserCarnets).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserClubs).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserBadges).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserActivities).toHaveBeenCalledTimes(1);
    expect(queries.fetchFullProfile).toHaveBeenCalledWith(PROFILE_ID);
  });

  it('soi-même : pas de sonde, les cinq requêtes historiques partent toujours', async () => {
    const calls = installClient({
      viewer: { id: PROFILE_ID },
      visibleProfile: null,
    });

    render(<PublicProfilePage />);

    expect(await screen.findByTestId('hero-profil')).toBeTruthy();
    expect(calls.tables).toEqual([]);
    expect(queries.fetchFullProfile).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserCarnets).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserClubs).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserBadges).toHaveBeenCalledTimes(1);
    expect(queries.fetchUserActivities).toHaveBeenCalledTimes(1);
  });
});
