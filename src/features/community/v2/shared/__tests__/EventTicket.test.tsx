// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { EventCardVM } from '../types';
import { formatDateFull } from '../format';
import { EventTicket } from '../EventTicket';

afterEach(cleanup);

const organizer = {
  id: 'u1',
  name: 'Léa Martin',
  handle: 'lea',
  avatarUrl: null,
  initials: 'LM',
};

function makeEvent(overrides: Partial<EventCardVM> = {}): EventCardVM {
  return {
    id: 'e1',
    title: 'Traversée du Vercors',
    activity: 'rando',
    startsAt: '2026-11-14T08:00:00+01:00',
    endsAt: null,
    eventDate: '2026-11-14',
    location: 'Vercors',
    meetingPoint: null,
    level: 'moyen',
    distanceKm: 18.4,
    elevationGainM: 950,
    duration: '5 h',
    coverImage: null,
    coverAlt: null,
    maxParticipants: 12,
    currentParticipants: 9,
    spotsLeft: 3,
    waitlistEnabled: true,
    myStatus: 'none',
    organizer,
    participants: [],
    participantsTotal: 9,
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

describe('EventTicket', () => {
  it('rend un billet daté menant à la fiche sortie avec un libellé complet', () => {
    render(<EventTicket event={makeEvent()} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/sorties/e1');
    const label = link.getAttribute('aria-label') ?? '';
    expect(label).toContain('Traversée du Vercors');
    expect(label).toContain(formatDateFull('2026-11-14T08:00:00+01:00'));
    expect(label).toContain('08 h 00');
    expect(label).toContain('Vercors');
    expect(label).toContain('niveau moyen');
    expect(label).toContain('18,4 km');
    expect(label).toContain('+950 m de dénivelé');
  });

  it('affiche le cartouche jour / mois, la méta et les chips', () => {
    const { container } = render(<EventTicket event={makeEvent()} />);
    expect(container.querySelector('.lkdv-cv2-ticket-day')?.textContent).toBe('14');
    expect(container.querySelector('.lkdv-cv2-ticket-mo')?.textContent).toBe('NOV');
    expect(container.querySelector('.lkdv-cv2-ticket-wd')?.textContent).toBe('sam.');
    const chips = Array.from(container.querySelectorAll('.lkdv-cv2-ticket-chips i')).map(
      (node) => node.textContent,
    );
    expect(chips).toEqual(['moyen', '18,4 km', '+950 m', '5 h']);
    expect(container.querySelector('.lkdv-cv2-ticket-meta')?.textContent).toContain(
      '08:00 · Vercors',
    );
  });

  it('affiche la jauge de places et les places restantes', () => {
    render(<EventTicket event={makeEvent()} />);
    const progress = screen.getByRole('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('9');
    expect(progress.getAttribute('aria-valuemax')).toBe('12');
    expect(screen.getByText('9/12')).toBeTruthy();
    expect(screen.getByText('3 places restantes')).toBeTruthy();
  });

  it('marque l’état complet', () => {
    render(<EventTicket event={makeEvent({ currentParticipants: 12, spotsLeft: 0 })} />);
    const ticket = document.querySelector('.lkdv-cv2-ticket');
    expect(ticket?.getAttribute('data-state')).toBe('full');
    expect(screen.getByText('Complet')).toBeTruthy();
  });

  it('marque l’état liste d’attente', () => {
    render(
      <EventTicket
        event={makeEvent({ myStatus: 'waitlist', currentParticipants: 12, spotsLeft: 0 })}
      />,
    );
    expect(document.querySelector('.lkdv-cv2-ticket')?.getAttribute('data-state')).toBe('waitlist');
    expect(screen.getByText('Liste d’attente')).toBeTruthy();
  });

  it('marque l’état inscrit', () => {
    render(<EventTicket event={makeEvent({ myStatus: 'registered' })} />);
    expect(document.querySelector('.lkdv-cv2-ticket')?.getAttribute('data-state')).toBe('registered');
    expect(screen.getByText('Inscrit')).toBeTruthy();
  });

  it('marque l’état passé et n’affiche plus la jauge', () => {
    render(<EventTicket event={makeEvent({ past: true })} />);
    const ticket = document.querySelector('.lkdv-cv2-ticket');
    expect(ticket?.getAttribute('data-state')).toBe('past');
    expect(screen.getByText('Terminée')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('9 participants')).toBeTruthy();
  });

  it('rend la variante preview sans lien ni pied de billet', () => {
    const { container } = render(<EventTicket event={makeEvent()} variant="preview" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(container.querySelector('.lkdv-cv2-ticket.is-preview')).toBeTruthy();
    expect(container.querySelector('.lkdv-cv2-ticket-foot')).toBeNull();
    expect(screen.getByLabelText('Aperçu : Traversée du Vercors')).toBeTruthy();
  });

  it('accepte une destination de lien personnalisée', () => {
    render(<EventTicket event={makeEvent()} href="/communaute?sortie=e1" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/communaute?sortie=e1');
  });

  it('ne contient aucune couleur littérale ni courbe littérale', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/community/v2/shared/EventTicket.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toContain('cubic-bezier(');
  });
});
