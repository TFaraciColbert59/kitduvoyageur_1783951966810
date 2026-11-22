/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ClubSortiesDrawerBody } from '../ClubSortiesDrawerBody';
import { ClubCoffreDrawerBody } from '../ClubCoffreDrawerBody';
import { ClubCreateDrawerBody } from '../ClubCreateDrawerBody';
import { ClubRuntimeOverlays } from '../ClubRuntimeOverlays';
import type {
  ClubChallengeItem,
  ClubChatMessage,
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubStandardKit,
} from '../ClubDrawerTypes';

const MOCK_CLUB: ClubItemData = {
  id: 'club-1',
  slug: 'sentiers-pour-tous',
  name: 'Sentiers pour Tous',
  massif: 'Calanques',
  category: 'Rando & Joëlette',
  level: 'Tous niveaux',
  membersCount: 42,
  outingsCount: 12,
  totalKm: 480,
  totalDplus: 18500,
  joined: true,
  role: 'Fondateur',
  visibility: 'public',
  bio: 'Tribu handi-rando et montagne inclusive.',
  charter: 'Respect du rythme de la cordée, entraide et matériel vérifié.',
  nextOutingTitle: 'Sortie en joëlette — Calanques',
  nextOutingDate: 'Samedi · 09h00',
  weatherIso: '2 800 m',
  weatherWind: '15 km/h NO',
  weatherTrail: 'Sentiers calcaires secs, accès Belvédère ouvert.',
  lat: 43.21,
  lng: 5.44,
};

const MOCK_MEMBERS: ClubMemberData[] = [
  {
    id: 'm-1',
    name: 'Tony Faraci',
    handle: 'tony_frc',
    role: 'Fondateur',
    massif: 'Calanques',
    skills: ['Guidage', 'Secourisme'],
    availableWeekend: true,
  },
  {
    id: 'm-2',
    name: 'Léa Fontaine',
    handle: 'lea.fontaine',
    role: 'Guide & Sécurité',
    massif: 'Écrins',
    skills: ['Alpi', 'Météo'],
    availableWeekend: true,
  },
];

const MOCK_OUTINGS: ClubOutingData[] = [
  {
    id: 'out-1',
    clubId: 'club-1',
    title: 'Sortie en joëlette — Calanques',
    date: '4 nov., 10:00',
    massif: 'Marseille',
    km: 14,
    dplus: 620,
    maxAlt: 565,
    status: 'upcoming',
    leaderName: 'Sentiers pour Tous',
    leaderHandle: 'sentiers-pour-tous',
    participantsCount: 6,
    maxParticipants: 12,
    rsvpJoined: false,
    carpoolCity: 'Marseille',
    carpoolSeatsLeft: 3,
    requiredGear: ['Chaussures crantées', 'Eau 2L'],
    lat: 43.21,
    lng: 5.44,
  },
];

const MOCK_GEAR: ClubGearVaultItem[] = [
  {
    id: 'gear-1',
    clubId: 'club-1',
    name: 'Tente MSR Hubba 2P',
    brand: 'MSR',
    category: 'Bivouac',
    weightG: 1540,
    ownerName: 'Tony Faraci',
    ownerHandle: 'tony_frc',
    available: true,
    reservedByMe: false,
  },
  {
    id: 'gear-2',
    clubId: 'club-1',
    name: 'Réchaud Titane PocketRocket',
    brand: 'MSR',
    category: 'Cuisine',
    weightG: 73,
    ownerName: 'Léa Fontaine',
    ownerHandle: 'lea.fontaine',
    available: true,
    reservedByMe: true,
  },
];

const MOCK_KITS: ClubStandardKit[] = [
  {
    id: 'kit-1',
    title: 'Kit Bivouac 3 Saisons',
    season: 'Printemps / Été / Automne',
    totalWeightG: 4200,
    itemsCount: 4,
    items: ['Abri 2P', 'Duvet 0°C', 'Matelas R3.2', 'Frontale 300 lm'],
    cloned: false,
  },
];

const MOCK_CHALLENGES: ClubChallengeItem[] = [
  {
    id: 'ch-1',
    title: '100 000 m D+ Collectif',
    subtitle: 'Cumul de dénivelé de la cordée',
    current: 64500,
    target: 100000,
    unit: 'm D+',
    rewardBadge: 'Sceau Alpin Or',
  },
];

const MOCK_CHAT: ClubChatMessage[] = [
  {
    id: 'msg-1',
    authorName: 'Léa Fontaine',
    authorHandle: 'lea.fontaine',
    roleBadge: 'Guide',
    text: 'Il reste 2 places en covoiturage depuis la gare !',
    time: '09:15',
  },
];

describe('Milestones M2, M3 & M5 — Sorties, Coffre, Tribu, Create & Runtime Overlays', () => {
  it('D09–D13: renders upcoming CarnetHorizontalTimeline, filters, weather reports, GPX archives, and multi-lens Fiche Sortie', () => {
    const onInspectOuting = vi.fn();
    const onToggleRsvpOuting = vi.fn();
    const onToast = vi.fn();

    const { rerender } = render(
      <ClubSortiesDrawerBody
        activeSubTab={0}
        activeClub={MOCK_CLUB}
        outings={MOCK_OUTINGS}
        members={MOCK_MEMBERS}
        vaultGear={MOCK_GEAR}
        inspectedOuting={null}
        onInspectOuting={onInspectOuting}
        onToggleRsvpOuting={onToggleRsvpOuting}
        onCreateGroupFromOuting={vi.fn()}
        onDownloadGpx={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToast={onToast}
      />,
    );

    expect(screen.getByTestId('club-outings-upcoming-pane')).toBeTruthy();
    expect(screen.getByText('Sortie en joëlette — Calanques')).toBeTruthy();

    // Weather subTab (D10)
    rerender(
      <ClubSortiesDrawerBody
        activeSubTab={1}
        activeClub={MOCK_CLUB}
        outings={MOCK_OUTINGS}
        members={MOCK_MEMBERS}
        vaultGear={MOCK_GEAR}
        inspectedOuting={null}
        onInspectOuting={onInspectOuting}
        onToggleRsvpOuting={onToggleRsvpOuting}
        onCreateGroupFromOuting={vi.fn()}
        onDownloadGpx={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToast={onToast}
      />,
    );
    expect(screen.getByTestId('club-weather-pane')).toBeTruthy();
    const reportInput = screen.getByLabelText('Signaler une condition terrain');
    fireEvent.change(reportInput, { target: { value: 'Source fraîche au col' } });
    fireEvent.submit(reportInput.closest('form')!);
    expect(screen.getByText('Source fraîche au col')).toBeTruthy();

    // Inspected Outing multi-lens Fiche Sortie (D13)
    rerender(
      <ClubSortiesDrawerBody
        activeSubTab={0}
        activeClub={MOCK_CLUB}
        outings={MOCK_OUTINGS}
        members={MOCK_MEMBERS}
        vaultGear={MOCK_GEAR}
        inspectedOuting={MOCK_OUTINGS[0]}
        onInspectOuting={onInspectOuting}
        onToggleRsvpOuting={onToggleRsvpOuting}
        onCreateGroupFromOuting={vi.fn()}
        onDownloadGpx={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToast={onToast}
      />,
    );
    expect(screen.getByText('Fiche Sortie & Covoiturage')).toBeTruthy();
    expect(screen.getByText('Profil Altimétrique & Waypoints')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Covoiturage/i }));
    expect(screen.getAllByText(/Réserver une place/i).length).toBeGreaterThan(0);
  });

  it('D16–D18: filters Coffre items, expands Standard Kits, and auto-balances collective cordée weight', () => {
    const onToggleReserveGear = vi.fn();
    const onCloneStandardKit = vi.fn();
    const onToast = vi.fn();

    const { rerender } = render(
      <ClubCoffreDrawerBody
        activeSubTab={0}
        activeClub={MOCK_CLUB}
        vaultGear={MOCK_GEAR}
        standardKits={MOCK_KITS}
        members={MOCK_MEMBERS}
        outings={MOCK_OUTINGS}
        onToggleReserveGear={onToggleReserveGear}
        onCloneStandardKit={onCloneStandardKit}
        onToast={onToast}
      />,
    );

    expect(screen.getByText(/Tente MSR Hubba 2P/i)).toBeTruthy();
    const searchInput = screen.getByLabelText('Rechercher dans le coffre matériel');
    fireEvent.change(searchInput, { target: { value: 'Titane' } });
    expect(screen.queryByText(/Tente MSR Hubba 2P/i)).toBeNull();
    expect(screen.getByText(/Réchaud Titane PocketRocket/i)).toBeTruthy();

    // SubTab 1: Kits
    rerender(
      <ClubCoffreDrawerBody
        activeSubTab={1}
        activeClub={MOCK_CLUB}
        vaultGear={MOCK_GEAR}
        standardKits={MOCK_KITS}
        members={MOCK_MEMBERS}
        outings={MOCK_OUTINGS}
        onToggleReserveGear={onToggleReserveGear}
        onCloneStandardKit={onCloneStandardKit}
        onToast={onToast}
      />,
    );
    fireEvent.click(screen.getByLabelText('Voir le détail du kit'));
    expect(screen.getByText('Composition détaillée du kit')).toBeTruthy();

    // SubTab 2: Weight balancer
    rerender(
      <ClubCoffreDrawerBody
        activeSubTab={2}
        activeClub={MOCK_CLUB}
        vaultGear={MOCK_GEAR}
        standardKits={MOCK_KITS}
        members={MOCK_MEMBERS}
        outings={MOCK_OUTINGS}
        onToggleReserveGear={onToggleReserveGear}
        onCloneStandardKit={onCloneStandardKit}
        onToast={onToast}
      />,
    );
    fireEvent.click(screen.getByText('Équilibrer automatiquement'));
    expect(onToast).toHaveBeenCalled();
  });

  it('D23–D27 & D38–D43: renders Create forms with live preview and Runtime Overlays without Tribu', () => {
    const onCreateOuting = vi.fn();
    const onToast = vi.fn();

    // Create Outing form (D25)
    render(
      <ClubCreateDrawerBody
        activeTab={1}
        activeClub={MOCK_CLUB}
        onTabChange={vi.fn()}
        onCreatePost={vi.fn()}
        onCreateOuting={onCreateOuting}
        onCreateVaultGear={vi.fn()}
        onCreateNewClub={vi.fn()}
        onToast={onToast}
      />,
    );
    const titleInput = screen.getByPlaceholderText(/Traversée des Arêtes/i);
    fireEvent.change(titleInput, { target: { value: ' Traversée Grande Candelle ' } });
    fireEvent.submit(titleInput.closest('form')!);
    expect(onCreateOuting).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Traversée Grande Candelle' }),
    );

    // Runtime Overlays (D38..D43)
    render(
      <ClubRuntimeOverlays
        overlay={{ kind: 'seal' }}
        onClose={vi.fn()}
        activeClub={MOCK_CLUB}
        clubs={[MOCK_CLUB]}
        members={MOCK_MEMBERS}
        outings={MOCK_OUTINGS}
        vaultGear={MOCK_GEAR}
        challenges={MOCK_CHALLENGES}
        posts={[]}
        onSelectClub={vi.fn()}
        onToggleJoinClub={vi.fn()}
        onToggleRsvpOuting={vi.fn()}
        onCreateGroupFromOuting={vi.fn()}
        onOpenClubDrawer={vi.fn()}
        onFlyToCoords={vi.fn()}
        onToast={onToast}
      />,
    );
    expect(screen.getByTestId('club-runtime-overlay-seal')).toBeTruthy();
  });
});
