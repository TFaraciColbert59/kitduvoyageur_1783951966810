// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClubItemData, ClubMemberData } from '../ClubDrawerTypes';
import { ClubAdminDrawerShell } from '../admin/ClubAdminDrawerShell';
import { AdminQrCodeSvg, encodeQrMatrix } from '../admin/AdminQrCodeSvg';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@number-flow/react', () => ({
  default: ({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) => (
    <span>
      {prefix}
      {value}
      {suffix}
    </span>
  ),
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
  vi.restoreAllMocks();
});

const DEMO_CLUB: ClubItemData = {
  id: 'club-demo',
  slug: 'cordee-des-alpes',
  name: 'Cordée des Alpes',
  massif: 'Écrins',
  category: 'Alpinisme',
  level: 'Tous niveaux',
  membersCount: 12,
  outingsCount: 1,
  totalKm: 120,
  totalDplus: 6000,
  joined: true,
  role: 'Fondateur',
  viewerRole: 'founder',
  visibility: 'public',
  bio: 'Club alpin',
  charter: 'Sécurité',
  nextOutingTitle: 'Arête des Écrins',
  nextOutingDate: 'Dim 12 juil',
  weatherIso: '2800 m',
  weatherWind: '10 km/h',
  weatherTrail: 'Sec',
  pendingRequestsCount: 2,
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

describe('Club Admin 12 sub-drawers — compact & visual overhaul', () => {
  it('renders AdminQrCodeSvg with valid ISO/IEC 18004 format info and V7 version info', () => {
    const url = 'https://lkdv.app/clubs/cordee-des-alpes?invite=abc123';
    render(<AdminQrCodeSvg value={url} />);
    const img = screen.getByRole('img', { name: 'QR code d’invitation du club' });
    expect(img).toBeTruthy();
    const path = img.querySelector('path');
    expect(path?.getAttribute('d')).toContain('M0,0');

    // Verify ISO/IEC 18004 format info (0x77c4: bit 14 MSB at (8,0), bit 0 LSB at (0,8))
    const { size, modules } = encodeQrMatrix(url);
    const formatBits = 0x77c4;
    const at = (r: number, c: number) => modules[r * size + c];
    for (let b = 0; b <= 5; b++) {
      expect(at(b, 8)).toBe((formatBits >>> b) & 1);
      expect(at(8, size - 1 - b)).toBe((formatBits >>> b) & 1);
    }
    expect(at(7, 8)).toBe((formatBits >>> 6) & 1);
    expect(at(8, 8)).toBe((formatBits >>> 7) & 1);
    expect(at(8, 7)).toBe((formatBits >>> 8) & 1);
    for (let b = 9; b <= 14; b++) {
      expect(at(8, 14 - b)).toBe((formatBits >>> b) & 1);
      expect(at(size - 15 + b, 8)).toBe((formatBits >>> b) & 1);
    }

    // Verify Version 7 (>134 bytes) 18-bit Version Info (0x07c94)
    const longUrl = `https://lkdv.app/clubs/cordee-des-alpes?invite=${'x'.repeat(100)}`;
    const v7 = encodeQrMatrix(longUrl);
    expect(v7.size).toBe(45);
    const v7Bits = 0x07c94;
    for (let i = 0; i < 18; i++) {
      const expected = (v7Bits >>> i) & 1;
      const a = Math.floor(i / 3);
      const b = v7.size - 11 + (i % 3);
      expect(v7.modules[a * v7.size + b]).toBe(expected);
      expect(v7.modules[b * v7.size + a]).toBe(expected);
    }
  });

  it('Pilotage: Overview, Settings (SegmentedControl + Accordion) & Security (collapsed critical zones + ConfirmDialog)', () => {
    render(
      <ClubAdminDrawerShell
        activeClub={DEMO_CLUB}
        members={MEMBERS}
        outings={[
          {
            id: 'out-1',
            clubId: DEMO_CLUB.id,
            title: 'Arête des Écrins',
            date: 'Dim 12 juil',
            massif: 'Écrins',
            km: 14,
            dplus: 1200,
            maxAlt: 3200,
            status: 'upcoming',
            leaderName: 'Alexandre Dumas',
            leaderHandle: 'alex_dumas',
            participantsCount: 6,
            maxParticipants: 10,
            rsvpJoined: true,
            carpoolCity: 'Grenoble',
            carpoolSeatsLeft: 2,
            requiredGear: ['Crampons'],
            lat: 44.9,
            lng: 6.3,
          },
        ]}
        currentUserId="u-founder"
      />,
    );

    expect(screen.getByTestId('admin-pane-overview')).toBeTruthy();
    expect(screen.getByText('Adhésions')).toBeTruthy();
    expect(screen.getByText('À valider')).toBeTruthy();

    // Switch to Paramètres & Identité
    fireEvent.click(screen.getByRole('tab', { name: 'Paramètres & Identité' }));
    expect(screen.getByTestId('admin-pane-settings')).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Visibilité du club' })).toBeTruthy();
    // Charte & Règlement is collapsed by default
    const charterBtn = screen.getByRole('button', { name: /Charte & Règlement/i });
    expect(charterBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(charterBtn);
    expect(screen.getByLabelText('Charte et règlement du club')).toBeTruthy();

    // Switch to Sécurité & Audit
    fireEvent.click(screen.getByRole('tab', { name: 'Sécurité & Audit' }));
    expect(screen.getByTestId('admin-pane-security-audit')).toBeTruthy();
    const deleteAccordion = screen.getByRole('button', { name: /Supprimer le club/i });
    expect(deleteAccordion.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(deleteAccordion);
    fireEvent.change(screen.getByLabelText('Confirmer le slug du club à supprimer'), {
      target: { value: 'cordee-des-alpes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement le club' }));
    expect(screen.getByText(`Supprimer ${DEMO_CLUB.name} ?`)).toBeTruthy();
  });

  it('Communauté: Members QR code generation, Salons collapsible form & Moderation segmented tabs', async () => {
    render(
      <ClubAdminDrawerShell
        activeClub={DEMO_CLUB}
        members={MEMBERS}
        currentUserId="u-founder"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Communauté' }));
    expect(screen.getByTestId('admin-pane-members-access')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Générer un lien d’invitation/i }));
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'QR code d’invitation du club' })).toBeTruthy();
    });

    // Salons du club: collapsible form + channel creation & reordering
    fireEvent.click(screen.getByRole('tab', { name: 'Salons du club' }));
    expect(screen.getByTestId('admin-pane-salons')).toBeTruthy();
    const newSalonBtn = screen.getByRole('button', { name: 'Nouveau salon' });
    expect(newSalonBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(newSalonBtn);
    const salonInput = screen.getByPlaceholderText(/bureau-admin/i);
    expect(salonInput).toBeTruthy();
    fireEvent.change(salonInput, { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le salon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau salon' }));
    fireEvent.change(screen.getByPlaceholderText(/bureau-admin/i), { target: { value: 'beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le salon' }));
    expect(screen.getByRole('button', { name: 'Monter beta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Monter beta' }));
    expect(screen.getByRole('button', { name: 'Descendre beta' })).toBeTruthy();

    // Modération & Signalements
    fireEvent.click(screen.getByRole('tab', { name: 'Modération & Signalements' }));
    expect(screen.getByTestId('admin-pane-moderation')).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Catégories de modération' })).toBeTruthy();
  });

  it('Opérations & Équipe: Budget ratio/collapsible form, Challenges ProgressBar & RoleMatrix without redundant labels', () => {
    render(
      <ClubAdminDrawerShell
        activeClub={DEMO_CLUB}
        members={MEMBERS}
        challenges={[
          {
            id: 'ch-1',
            title: 'Défi 100 km',
            subtitle: 'Octobre',
            current: 45,
            target: 100,
            unit: 'km',
            rewardBadge: '🏔️',
          },
        ]}
        currentUserId="u-founder"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Opérations' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Budget collaboratif' }));
    expect(screen.getByTestId('admin-pane-budget')).toBeTruthy();
    expect(screen.getByLabelText('Ratio recettes et dépenses')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Écriture' }));
    expect(screen.getByRole('tablist', { name: 'Type de mouvement' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Défis du club' }));
    expect(screen.getByTestId('admin-pane-challenges')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progression Défi 100 km' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Équipe & Droits' }));
    expect(screen.getByTestId('admin-pane-team-roles')).toBeTruthy();
    expect(screen.queryByText('hérité')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Matrice des rôles' }));
    expect(screen.getByTestId('admin-pane-role-matrix')).toBeTruthy();
    expect(screen.queryByText('défaut système')).toBeNull();
  });

  it('Overview fetches real-time budget & moderation KPIs when activeClub.id is a UUID', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/budget')) {
        return new Response(
          JSON.stringify({
            data: {
              entries: [
                { id: '1', kind: 'income', amountCents: 25000, status: 'approved' },
                { id: '2', kind: 'expense', amountCents: 5000, status: 'paid' },
                { id: '3', kind: 'expense', amountCents: 1000, status: 'proposed' },
              ],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('/moderation')) {
        return new Response(
          JSON.stringify({ data: { reports: [{ id: 'r-1', reason: 'Spam' }] } }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ClubAdminDrawerShell
        activeClub={{
          ...DEMO_CLUB,
          id: '11111111-1111-4111-8111-111111111111',
        }}
        members={MEMBERS}
        currentUserId="u-founder"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('1 à valider')).toBeTruthy();
      expect(screen.getByText('Signalement')).toBeTruthy();
    });
  });
});
