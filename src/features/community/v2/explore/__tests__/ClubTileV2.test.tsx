// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClubCardVM } from '../../shared/types';
import { ClubTileV2, clubJoinLabel } from '../tiles/ClubTileV2';

afterEach(cleanup);

function club(overrides: Partial<ClubCardVM> = {}): ClubCardVM {
  return {
    id: 'k1',
    slug: 'la-cordee',
    name: 'La Cordée du Vercors',
    description: '',
    category: 'rando',
    emoji: null,
    activities: ['rando'],
    privacy: 'open',
    coverImage: null,
    coverColor: null,
    crestSeed: 'k1',
    membersCount: 12,
    myStatus: 'none',
    eventsThisMonth: 3,
    lastPostAt: null,
    distanceKmFromMe: null,
    zoneLabel: 'Grenoble',
    friends: [],
    friendsTotal: 0,
    rules: null,
    joinQuestions: [],
    ...overrides,
  };
}

describe('clubJoinLabel / ClubTileV2 (Clubs#4-5, 20)', () => {
  it('donne un libellé clair pour chaque état d’adhésion', () => {
    expect(clubJoinLabel(club(), 'none')).toBe('Rejoindre');
    expect(clubJoinLabel(club({ privacy: 'closed' }), 'none')).toBe('Demander');
    expect(clubJoinLabel(club(), 'pending')).toBe('Demande envoyée');
    expect(clubJoinLabel(club(), 'member')).toBe('Membre ✓');
    expect(clubJoinLabel(club(), 'admin')).toBe('Membre ✓');
  });

  it('affiche le blason, l’activité, le lieu et le nombre de membres', () => {
    render(<ClubTileV2 club={club()} status="none" membersCount={12} onOpen={() => {}} onJoin={() => {}} onPeek={() => {}} />);
    expect(screen.getByText('La Cordée du Vercors')).toBeTruthy();
    expect(screen.getByText(/Randonnée · Grenoble · 12 membres/)).toBeTruthy();
    expect(screen.getByTestId('club-crest')).toBeTruthy();
    expect(screen.getByTestId('cv2-tile-club').getAttribute('data-id')).toBe('k1');
  });

  it('cadenas si adhésion sur validation, pilule libellée + aria-pressed', () => {
    const onJoin = vi.fn();
    render(
      <ClubTileV2
        club={club({ privacy: 'closed' })}
        status="none"
        membersCount={12}
        onOpen={() => {}}
        onJoin={onJoin}
        onPeek={() => {}}
      />,
    );
    expect(screen.getByTitle('Adhésion sur validation')).toBeTruthy();
    const join = screen.getByRole('button', { name: /Demander à rejoindre le club/ });
    expect(join.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(join);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('passe en Membre ✓ / Envoi… avec bouton occupé non cliquable', () => {
    const onJoin = vi.fn();
    const { rerender } = render(
      <ClubTileV2 club={club()} status="member" membersCount={13} onOpen={() => {}} onJoin={onJoin} onPeek={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Membre du club/ }).textContent).toContain('Membre ✓');
    rerender(
      <ClubTileV2 club={club()} status="none" membersCount={12} busy onOpen={() => {}} onJoin={onJoin} onPeek={() => {}} />,
    );
    const busy = screen.getByRole('button', { name: /Rejoindre le club/ });
    expect(busy.hasAttribute('disabled')).toBe(true);
    expect(busy.textContent).toContain('Envoi…');
    fireEvent.click(busy);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('la tuile est un lien intercepté qui ouvre le détail empilé', () => {
    const onOpen = vi.fn();
    render(<ClubTileV2 club={club()} status="none" membersCount={12} onOpen={onOpen} onJoin={() => {}} onPeek={() => {}} />);
    const link = screen.getByRole('link', { name: /La Cordée du Vercors/ });
    expect(link.getAttribute('href')).toBe('/clubs/la-cordee');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]?.id).toBe('k1');
  });

  it('affiche le badge « Club du mois » en pleine largeur', () => {
    render(
      <ClubTileV2 club={club()} status="none" membersCount={12} month onOpen={() => {}} onJoin={() => {}} onPeek={() => {}} />,
    );
    expect(screen.getByText('Club du mois')).toBeTruthy();
    expect(screen.getByTestId('cv2-tile-club').className).toContain('lkdv-cv2-tile--wide');
  });
});
