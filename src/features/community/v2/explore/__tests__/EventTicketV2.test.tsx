// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventCardVM } from '../../shared/types';
import { EventTicketV2 } from '../tiles/EventTicketV2';

afterEach(cleanup);

function event(overrides: Partial<EventCardVM> = {}): EventCardVM {
  return {
    id: 'e1',
    title: 'Footing de la Bastille',
    activity: 'Trail',
    startsAt: '2026-11-14T08:00:00+01:00',
    endsAt: '2026-11-14T09:30:00+01:00',
    eventDate: '2026-11-14',
    location: 'Grenoble',
    meetingPoint: 'Téléphérique',
    level: 'facile',
    distanceKm: 7,
    elevationGainM: 260,
    duration: '1 h 30',
    coverImage: null,
    coverAlt: null,
    maxParticipants: 20,
    currentParticipants: 6,
    spotsLeft: 14,
    waitlistEnabled: false,
    myStatus: 'none',
    organizer: { id: 'u9', name: 'Nora', initials: 'N', handle: null, avatarUrl: null },
    participants: [],
    participantsTotal: 6,
    clubId: null,
    clubName: null,
    kitId: null,
    description: null,
    safetyNotes: null,
    safetyChecklist: [],
    recurrence: null,
    past: false,
    distanceKmFromMe: null,
    ...overrides,
  };
}

function props(overrides: Partial<React.ComponentProps<typeof EventTicketV2>> = {}) {
  return {
    event: event(),
    status: 'none' as const,
    spotsLeft: 14,
    onOpen: vi.fn(),
    onSignup: vi.fn(),
    onPeek: vi.fn(),
    ...overrides,
  };
}

describe('EventTicketV2 (Sorties#1-6, 19)', () => {
  it('affiche le billet daté sans doubler le pied de capacité partagé', () => {
    render(<EventTicketV2 {...props()} />);
    expect(screen.getByText('Footing de la Bastille')).toBeTruthy();
    expect(screen.getByTestId('cv2-tile-sortie').getAttribute('data-id')).toBe('e1');
    // Une seule jauge de capacité dans la tuile (le pied du composant partagé).
    expect(document.querySelectorAll('.lkdv-cv2-capacity').length).toBe(1);
    expect(screen.getByRole('button', { name: /S’inscrire à Footing/ })).toBeTruthy();
  });

  it('la tuile est un lien intercepté qui ouvre le détail', () => {
    const p = props();
    render(<EventTicketV2 {...p} />);
    const link = document.querySelector('a.lkdv-cv2-ticket') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/sorties/e1');
    fireEvent.click(link);
    expect(p.onOpen).toHaveBeenCalledTimes(1);
  });

  it('inscrit / liste d’attente / complet : libellés et états', () => {
    const onSignup = vi.fn();
    const { rerender } = render(<EventTicketV2 {...props({ status: 'registered', onSignup })} />);
    const registered = screen.getByRole('button', { name: /Inscrit à Footing/ });
    expect(registered.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(registered);
    expect(onSignup).toHaveBeenCalledTimes(1);

    rerender(<EventTicketV2 {...props({ status: 'waitlist', spotsLeft: 0 })} />);
    expect(screen.getByRole('button', { name: /En liste d’attente/ })).toBeTruthy();

    rerender(<EventTicketV2 {...props({ status: 'none', spotsLeft: 0, event: event({ waitlistEnabled: false }) })} />);
    const full = screen.getByRole('button', { name: /est complet/ });
    expect(full.hasAttribute('disabled')).toBe(true);
  });

  it('une sortie passée est terminée et non inscriptible', () => {
    render(<EventTicketV2 {...props({ event: event({ past: true }), status: 'registered' })} />);
    const past = screen.getByRole('button', { name: /est terminée/ });
    expect(past.hasAttribute('disabled')).toBe(true);
    expect(past.textContent).toContain('Terminée');
  });

  it('variante compacte : ligne datée + bouton d’action', () => {
    const p = props();
    render(<EventTicketV2 {...p} variant="compact" />);
    const row = screen.getByTestId('cv2-tile-sortie');
    expect(row.className).toContain('lkdv-cv2x-event-row');
    const link = row.querySelector('a.lkdv-cv2x-event-row-link') as HTMLAnchorElement;
    fireEvent.click(link);
    expect(p.onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /S’inscrire/ })).toBeTruthy();
  });
});
