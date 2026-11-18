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
  it('affiche le billet daté sans pied de capacité coupé et avec le bouton intégré en bas à droite', () => {
    render(<EventTicketV2 {...props()} />);
    expect(screen.getByText('Footing de la Bastille')).toBeTruthy();
    expect(screen.getByTestId('cv2-tile-sortie').getAttribute('data-id')).toBe('e1');
    expect(document.querySelectorAll('.lkdv-cv2-capacity').length).toBe(0);
    expect(document.querySelector('.lkdv-cv2x-gauge')).toBeNull();
    expect(document.querySelector('.lkdv-cv2x-event-cta-wrap')).toBeTruthy();
    expect(screen.getByRole('button', { name: /S’inscrire à Footing/ })).toBeTruthy();
  });

  it('affiche le vrai tracé de la sortie sur le topo quand il est fourni', () => {
    const ev = { ...props().event, routeTrace: [[10, 80], [50, 40], [90, 20]] as Array<[number, number]> };
    render(<EventTicketV2 {...props()} event={ev} />);
    const route = document.querySelector('.lkdv-cv2-ticket-route') as SVGPathElement | null;
    expect(route?.getAttribute('d')).toContain('M');
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
