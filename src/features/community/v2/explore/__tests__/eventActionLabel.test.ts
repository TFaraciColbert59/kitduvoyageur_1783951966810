import { describe, expect, it } from 'vitest';
import type { EventCardVM } from '../../shared/types';
import { eventActionLabel } from '../tiles/EventTicketV2';

function event(overrides: Partial<EventCardVM> = {}): EventCardVM {
  return {
    id: 'e1',
    title: 'Footing de la Bastille',
    activity: 'Trail',
    startsAt: '2026-11-14T08:00:00+01:00',
    endsAt: '2026-11-14T09:30:00+01:00',
    eventDate: '2026-11-14',
    location: 'Grenoble',
    meetingPoint: null,
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
    organizer: { id: 'u1', name: 'Nora', initials: 'N', handle: null, avatarUrl: null },
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

describe('eventActionLabel (Sorties#5)', () => {
  it('propose S’inscrire quand il reste des places', () => {
    expect(eventActionLabel(event(), 'none', 14)).toMatchObject({
      label: 'S’inscrire',
      disabled: false,
      tone: 'join',
    });
  });

  it('propose la liste d’attente quand la sortie est complète avec liste', () => {
    expect(eventActionLabel(event({ waitlistEnabled: true }), 'none', 0)).toMatchObject({
      label: 'Liste d’attente',
      disabled: false,
      tone: 'waitlist',
    });
  });

  it('marque Complet sans liste d’attente', () => {
    expect(eventActionLabel(event({ waitlistEnabled: false }), 'none', 0)).toMatchObject({
      label: 'Complet',
      disabled: true,
      tone: 'full',
    });
  });

  it('affiche Inscrit / En liste d’attente pour les états réels', () => {
    expect(eventActionLabel(event(), 'registered', 5)).toMatchObject({ label: 'Inscrit ✓', tone: 'member' });
    expect(eventActionLabel(event(), 'waitlist', 0)).toMatchObject({
      label: 'En liste d’attente',
      tone: 'waitlist',
    });
  });

  it('désactive une sortie passée', () => {
    expect(eventActionLabel(event({ past: true }), 'registered', 5)).toMatchObject({
      label: 'Terminée',
      disabled: true,
      tone: 'past',
    });
  });

  it('ne déclare pas complète une capacité illimitée', () => {
    expect(eventActionLabel(event({ maxParticipants: 0 }), 'none', 0).tone).toBe('join');
  });
});
