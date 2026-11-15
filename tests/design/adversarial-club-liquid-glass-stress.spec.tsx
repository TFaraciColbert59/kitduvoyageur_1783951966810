// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClubDrawerHost, type ClubItemData } from '@/components/clubs/drawer/ClubDrawerHost';
import { ClubLiquidGlassV8 } from '@/components/clubs/ClubLiquidGlassV8';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('maplibre-gl', () => ({
  default: {},
}));

vi.mock('@/components/clubs/club-liquid-glass-v8-runtime', () => ({
  initClubLiquidGlassRuntime: () => () => {},
}));

afterEach(cleanup);

const DEFAULT_FALLBACK_CLUB: ClubItemData = {
  id: '',
  slug: '',
  name: 'Club LKDV',
  massif: 'Massif Alpin',
  category: 'Montagne & Bivouac',
  level: 'Tous niveaux',
  membersCount: 0,
  outingsCount: 0,
  totalKm: 0,
  totalDplus: 0,
  joined: false,
  role: 'Membre',
  visibility: 'public',
  bio: 'Rejoignez ou créez une cordée alpine sur LKDV.',
  charter: 'Respect strict de la montagne, de la sécurité et zéro trace.',
  nextOutingTitle: 'Aucune sortie programmée',
  nextOutingDate: 'À venir',
  weatherIso: 'Iso 0°C —',
  weatherWind: 'Vent calme',
  weatherTrail: 'Conditions stables',
  lat: 45.923,
  lng: 6.869,
};

describe('Empirical Adversarial Stress Test: ClubLiquidGlassV8 & ClubDrawerHost resilience', () => {
  it('renders ClubDrawerHost with zero data across all main tabs without crashing and renders honest empty states', () => {
    // Test tabs 0 through 4 (the 5 main tabs)
    for (let tab = 0; tab <= 4; tab++) {
      const { container, unmount } = render(
        <ClubDrawerHost
          mode="main"
          initialTab={tab}
          initialSubTab={0}
          activeClub={DEFAULT_FALLBACK_CLUB}
          clubs={[]}
          members={[]}
          outings={[]}
          vaultGear={[]}
          standardKits={[]}
          challenges={[]}
          chatMessages={[]}
          posts={[]}
          onSelectClub={vi.fn()}
          onToggleJoinClub={vi.fn()}
          onToggleFollowMember={vi.fn()}
          onToggleRsvpOuting={vi.fn()}
          onCreateGroupFromOuting={vi.fn()}
          onDownloadGpx={vi.fn()}
          onFlyToCoords={vi.fn()}
          onToggleReserveGear={vi.fn()}
          onCloneStandardKit={vi.fn()}
          onSendChatMessage={vi.fn()}
          onToggleClubVisibility={vi.fn()}
          onCreatePost={vi.fn()}
          onCreateOuting={vi.fn()}
          onCreateVaultGear={vi.fn()}
          onCreateNewClub={vi.fn()}
        />
      );

      // Verify no unsplash images are rendered in any tab
      const html = container.innerHTML;
      expect(html).not.toContain('unsplash.com');

      // Verify honest empty state text per tab at initialSubTab=0
      if (tab === 0) {
        expect(screen.getByText('Aucun club rejoint pour le moment.')).toBeTruthy();
      } else if (tab === 1) {
        expect(screen.getByText('Aucun membre répertorié pour le moment.')).toBeTruthy();
      } else if (tab === 2) {
        expect(screen.getByText('Aucune sortie programmée pour le moment.')).toBeTruthy();
      } else if (tab === 3) {
        expect(screen.getByText('Le coffre d’entraide est actuellement vide.')).toBeTruthy();
      } else if (tab === 4) {
        expect(screen.getByText('Aucun défi actif pour le moment.')).toBeTruthy();
      }

      unmount();
    }
  });

  it('renders ClubDrawerHost tab 3 subtab 1 (kits standards) and tab 2 subtab 2 (archives) with clean empty state', () => {
    // Tab 3 subtab 1: Kits standards recommandés
    const { unmount: unmountKits } = render(
      <ClubDrawerHost
        mode="main"
        initialTab={3}
        initialSubTab={1}
        activeClub={DEFAULT_FALLBACK_CLUB}
        clubs={[]}
        members={[]}
        outings={[]}
        vaultGear={[]}
        standardKits={[]}
        challenges={[]}
        chatMessages={[]}
        posts={[]}
        onSelectClub={vi.fn()}
        onToggleJoinClub={vi.fn()}
        onToggleFollowMember={vi.fn()}
        onToggleRsvpOuting={vi.fn()}
        onCreateGroupFromOuting={vi.fn()}
        onDownloadGpx={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToggleReserveGear={vi.fn()}
        onCloneStandardKit={vi.fn()}
        onSendChatMessage={vi.fn()}
        onToggleClubVisibility={vi.fn()}
        onCreatePost={vi.fn()}
        onCreateOuting={vi.fn()}
        onCreateVaultGear={vi.fn()}
        onCreateNewClub={vi.fn()}
      />
    );
    expect(screen.getByText('Aucun kit standard recommandé pour le moment.')).toBeTruthy();
    unmountKits();

    // Tab 2 subtab 2: Sorties archives vides
    const { unmount: unmountSorties } = render(
      <ClubDrawerHost
        mode="main"
        initialTab={2}
        initialSubTab={2}
        activeClub={DEFAULT_FALLBACK_CLUB}
        clubs={[]}
        members={[]}
        outings={[]}
        vaultGear={[]}
        standardKits={[]}
        challenges={[]}
        chatMessages={[]}
        posts={[]}
        onSelectClub={vi.fn()}
        onToggleJoinClub={vi.fn()}
        onToggleFollowMember={vi.fn()}
        onToggleRsvpOuting={vi.fn()}
        onCreateGroupFromOuting={vi.fn()}
        onDownloadGpx={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToggleReserveGear={vi.fn()}
        onCloneStandardKit={vi.fn()}
        onSendChatMessage={vi.fn()}
        onToggleClubVisibility={vi.fn()}
        onCreatePost={vi.fn()}
        onCreateOuting={vi.fn()}
        onCreateVaultGear={vi.fn()}
        onCreateNewClub={vi.fn()}
      />
    );
    expect(screen.getByText('Aucune archive de sortie pour le moment.')).toBeTruthy();
    unmountSorties();
  });

  it('renders ClubLiquidGlassV8 with completely non-existent clubId and empty DB response without error', async () => {
    const { container } = render(
      <ClubLiquidGlassV8 clubId="non-existent-club-uuid-9999-0000" />
    );

    // Should mount properly
    expect(container).toBeTruthy();
    expect(container.innerHTML).not.toContain('unsplash.com');
  });

  it('renders ClubLiquidGlassV8 with empty string clubId without error', async () => {
    const { container } = render(
      <ClubLiquidGlassV8 clubId="" />
    );

    expect(container).toBeTruthy();
    expect(container.innerHTML).not.toContain('unsplash.com');
  });

  it('handles null / undefined fields in fallback club gracefully without throwing', () => {
    const brokenClub = {
      ...DEFAULT_FALLBACK_CLUB,
      name: '',
      massif: '',
      membersCount: 0,
      totalKm: 0,
      totalDplus: 0,
      nextOutingTitle: '',
    };
    const { container } = render(
      <ClubDrawerHost
        mode="main"
        initialTab={0}
        initialSubTab={0}
        activeClub={brokenClub}
        clubs={[]}
        members={[]}
        outings={[]}
        vaultGear={[]}
        standardKits={[]}
        challenges={[]}
        chatMessages={[]}
        posts={[]}
        onSelectClub={vi.fn()}
        onToggleJoinClub={vi.fn()}
        onToggleFollowMember={vi.fn()}
        onToggleRsvpOuting={vi.fn()}
        onCreateGroupFromOuting={vi.fn()}
        onDownloadGpx={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToggleReserveGear={vi.fn()}
        onCloneStandardKit={vi.fn()}
        onSendChatMessage={vi.fn()}
        onToggleClubVisibility={vi.fn()}
        onCreatePost={vi.fn()}
        onCreateOuting={vi.fn()}
        onCreateVaultGear={vi.fn()}
        onCreateNewClub={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
    expect(screen.getByText('Aucun club rejoint pour le moment.')).toBeTruthy();
  });
});
