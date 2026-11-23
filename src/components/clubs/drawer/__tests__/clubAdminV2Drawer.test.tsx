// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubDrawerHost, type ClubItemData, type ClubMemberData } from '../ClubDrawerHost';
import { ClubSalonsDrawerBody } from '../ClubSalonsDrawerBody';
import { ClubAdminDrawerShell } from '../admin/ClubAdminDrawerShell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: vi.fn(),
    from: () => ({
      select: () => ({
        eq: () => ({ limit: async () => ({ data: [], error: null }) }),
      }),
    }),
  }),
}));

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
});

const BASE_CLUB: ClubItemData = {
  id: 'club-demo',
  slug: 'cordee-des-alpes',
  name: 'Cordée des Alpes',
  massif: 'Écrins',
  category: 'Alpinisme',
  level: 'Tous niveaux',
  membersCount: 12,
  outingsCount: 2,
  totalKm: 120,
  totalDplus: 6000,
  joined: true,
  role: 'Fondateur',
  viewerRole: 'founder',
  visibility: 'public',
  bio: 'Club alpin',
  charter: 'Sécurité',
  nextOutingTitle: 'Marathon Alpin',
  nextOutingDate: 'Dim 12 juil',
  weatherIso: '2800 m',
  weatherWind: '10 km/h',
  weatherTrail: 'Sec',
  lat: 44.9,
  lng: 6.3,
};

const MEMBERS: ClubMemberData[] = [
  {
    id: 'u-founder',
    userId: 'u-founder',
    name: 'Alexandre Dumas',
    handle: 'alex_dumas',
    role: 'Fondateur',
    rawRole: 'founder',
    massif: 'Écrins',
    skills: ['Alpinisme'],
  },
  {
    id: 'u-vol',
    userId: 'u-vol',
    name: 'Camille Orga',
    handle: 'camille_orga',
    role: 'Bénévole',
    rawRole: 'volunteer',
    massif: 'Écrins',
    skills: ['Trail'],
  },
];

describe('Club Admin V2 UI — Salons publics, Timeline membre & Drawer Admin par rôle', () => {
  it('retire les boutons de gestion de salons du drawer public Salons même pour le Fondateur', () => {
    render(
      <ClubSalonsDrawerBody
        active
        activeClub={BASE_CLUB}
        members={MEMBERS}
        currentUserId="u-founder"
      />,
    );

    expect(screen.queryByLabelText('Créer un salon')).toBeNull();
    expect(screen.queryByLabelText('Gérer les salons')).toBeNull();
  });

  it('replie et verrouille la carte profil membre sur l’onglet Timeline (m-outings) puis la redéplie sur Stats', () => {
    render(
      <ClubDrawerHost
        mode="main"
        initialTab={1}
        initialMemberId="u-founder"
        currentUserId="u-founder"
        activeClub={BASE_CLUB}
        clubs={[BASE_CLUB]}
        members={MEMBERS}
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
      />,
    );

    const preview = screen.getByTestId('club-member-hero-preview');
    expect(preview.classList.contains('is-collapsed')).toBe(false);

    // Passer sur l'onglet Sorties (m-outings) => auto-replié immédiatement
    const sortiesTab = screen.getByRole('tab', { name: 'Sorties' });
    fireEvent.click(sortiesTab);
    expect(screen.getByTestId('club-member-hero-preview').classList.contains('is-collapsed')).toBe(true);

    // Tenter de redéplier en cliquant sur la pilule compacte => reste verrouillé replié
    const expandBtn = screen.getByLabelText('Déplier l’aperçu : Alexandre Dumas');
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('club-member-hero-preview').classList.contains('is-collapsed')).toBe(true);

    // Revenir sur Perf & Stats => se redéplie automatiquement
    const statsTab = screen.getByRole('tab', { name: 'Perf & Stats' });
    fireEvent.click(statsTab);
    expect(screen.getByTestId('club-member-hero-preview').classList.contains('is-collapsed')).toBe(false);
  });

  it('affiche les 4 pôles pour le Fondateur, uniquement Pilotage+Opérations pour un Bénévole, et masque la roue crantée pour un Membre sans surcharge', () => {
    // 1. Fondateur -> 4 pôles
    const { rerender } = render(
      <ClubAdminDrawerShell
        activeClub={{ ...BASE_CLUB, viewerRole: 'founder' }}
        members={MEMBERS}
        currentUserId="u-founder"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Pilotage' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Communauté' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Opérations' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Équipe & Droits' })).toBeTruthy();

    // 2. Bénévole -> Pilotage + Opérations uniquement
    rerender(
      <ClubAdminDrawerShell
        activeClub={{ ...BASE_CLUB, viewerRole: 'volunteer', viewerCapabilities: undefined }}
        members={MEMBERS}
        currentUserId="u-vol"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Pilotage' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Opérations' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Communauté' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Équipe & Droits' })).toBeNull();

    cleanup();

    // 3. Membre simple sans surcharge -> pas de roue crantée
    const memberClub: ClubItemData = {
      ...BASE_CLUB,
      viewerRole: 'member',
      viewerCapabilities: ['salons.post', 'feed.post'],
      createdBy: 'u-founder',
    };
    const { rerender: rerenderHost } = render(
      <ClubDrawerHost
        mode="main"
        currentUserId="u-plain"
        activeClub={memberClub}
        clubs={[memberClub]}
        members={MEMBERS}
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
      />,
    );
    expect(screen.queryByLabelText('Administration du club')).toBeNull();

    // 4. Membre avec surcharge individuelle budget.propose_expense -> roue crantée visible !
    const delegatedMemberClub: ClubItemData = {
      ...memberClub,
      viewerCapabilities: ['salons.post', 'feed.post', 'budget.propose_expense'],
    };
    rerenderHost(
      <ClubDrawerHost
        mode="main"
        currentUserId="u-plain"
        activeClub={delegatedMemberClub}
        clubs={[delegatedMemberClub]}
        members={MEMBERS}
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
      />,
    );
    expect(screen.getByLabelText('Administration du club')).toBeTruthy();

    // 5. Admin dont TOUS les droits ont été révoqués (viewerCapabilities: []) -> pas de fallback par défaut, roue crantée masquée !
    const revokedAdminClub: ClubItemData = {
      ...memberClub,
      viewerRole: 'admin',
      viewerCapabilities: [],
    };
    rerenderHost(
      <ClubDrawerHost
        mode="main"
        currentUserId="u-revoked-admin"
        activeClub={revokedAdminClub}
        clubs={[revokedAdminClub]}
        members={MEMBERS}
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
      />,
    );
    expect(screen.queryByLabelText('Administration du club')).toBeNull();
  });
});
