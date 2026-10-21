// @vitest-environment jsdom

/*
 * PLAN-100 4.3 et 5.5 à l'écran : le départ dit se voit et s'efface sur la carte Où (« Annuler »
 * le rétablit tel que rangé) ; l'heure de départ du jour s'enregistre et s'efface dans « Quand »,
 * et les heures de passage partent d'elle. Jamais d'heure par défaut.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({
  compasSetOriginAction: vi.fn(async () => ({ success: true })),
  compasSetDepartureTimeAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/autofillActions', () => ({ compasUndoAutofillAction: vi.fn() }));
vi.mock('@/app/voyages/kit-actions', () => ({ deleteTripItemAction: vi.fn() }));

import { buildCompasModel, type CompasInput } from '../engine/compasModel';
import { PassageSection } from '../components/CompasPassage';
import { OuCard } from '../components/CompasCards';
import { compasSetDepartureTimeAction, compasSetOriginAction } from '../server/compasActions';
import type { CompasCtl } from '../components/compasTypes';
import type { CompasData } from '../server/getCompasData';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

const TRIP = '11111111-1111-4111-8111-111111111111';
const U1 = '22222222-2222-4222-8222-222222222222';
const LYON = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' };

const inLocale = (locale: Locale, ui: React.ReactElement) =>
  render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>);

function makeCtl(extra: Partial<CompasData> = {}): CompasCtl {
  const input: CompasInput = {
    trip: {
      id: TRIP,
      slug: 'trek-3-vallees',
      title: 'Trek des 3 Vallées',
      destinationName: 'Pyrénées',
      startDate: '2026-10-12',
      endDate: '2026-10-12',
      primaryActivity: 'hiking',
      estimatedBudget: null,
      budgetCurrency: 'EUR',
      partySize: 1,
      ownerId: U1,
    },
    steps: [
      {
        id: 's1',
        dayNumber: 1,
        orderIndex: 0,
        title: 'Gavarnie',
        locationName: 'Gavarnie',
        lat: 42.73,
        lon: -0.01,
        distanceKm: 8,
        elevationGainM: 0,
        elevationLossM: 0,
        accommodationName: null,
        transportMode: 'foot',
        startTime: null,
      },
    ],
    items: [],
    members: [
      {
        userId: U1,
        name: 'Tony',
        avatarUrl: null,
        role: 'owner',
        maxCarryKg: 14,
        flatSpeedKmh: 4,
        experienceLevel: null,
        calibrationLevel: null,
      },
    ],
    expenses: [],
    inventory: [],
    bookings: [],
    weather: [],
    routeDurationMin: null,
    routeHasGeometry: false,
    waterPointsCount: null,
    viewerId: U1,
    now: new Date('2026-09-30T12:00:00Z'),
    timeZone: 'Europe/Paris',
  };
  const data = {
    model: buildCompasModel(input),
    itinerary: [],
    route: { id: null, name: null },
    origin: null,
    weather: null,
    canEdit: true,
    viewerId: U1,
    ...extra,
  } as unknown as CompasData;
  return {
    data,
    lines: [],
    busy: false,
    open: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    enlarge: vi.fn(),
    run: vi.fn(async () => true),
    togglePacked: vi.fn(),
    memberName: () => '',
    product: () => undefined,
    notify: vi.fn(),
  };
}

/** Les deux fonctions passées à `ctl.run` : l'action, puis l'annulation. */
const runArgs = (ctl: CompasCtl) => vi.mocked(ctl.run).mock.calls[0] as unknown as [
  string,
  () => Promise<unknown>,
  (() => Promise<unknown>) | undefined,
];

describe('heure de départ (Quand)', () => {
  it('sans heure enregistrée : rien de calculé, rien de prérempli', () => {
    inLocale('fr', <PassageSection ctl={makeCtl()} />);
    const input = screen.getByLabelText('Si tu pars à (heure de départ de chaque jour)') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText(/Aucune heure de départ/)).toBeTruthy();
    expect(screen.getByText('non renseigné')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Effacer/ })).toBeNull();
  });

  it('une heure tapée est une simulation tant qu’elle n’est pas enregistrée', async () => {
    const ctl = makeCtl();
    inLocale('fr', <PassageSection ctl={ctl} />);
    fireEvent.change(screen.getByLabelText('Si tu pars à (heure de départ de chaque jour)'), { target: { value: '08:00' } });
    expect(screen.getByText('Simulation : cette heure n’est pas enregistrée.')).toBeTruthy();
    expect(screen.getByText(/Départ 08:00 \(simulation\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer cette heure' }));
    const [message, action, undo] = runArgs(ctl);
    expect(message).toBe('Heure de départ enregistrée : 08:00');
    await action();
    expect(compasSetDepartureTimeAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      time: '08:00',
    });
    // « Annuler » rétablit l'état d'avant : aucune heure.
    await undo?.();
    expect(compasSetDepartureTimeAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      time: null,
    });
  });

  it('l’heure enregistrée sert au calcul et s’efface, « Annuler » la rétablit', async () => {
    const ctl = makeCtl({ departureTime: '07:30' });
    inLocale('fr', <PassageSection ctl={ctl} />);
    expect((screen.getByLabelText('Si tu pars à (heure de départ de chaque jour)') as HTMLInputElement).value).toBe('07:30');
    expect(screen.getByText(/Départ 07:30 \(heure enregistrée\)/)).toBeTruthy();
    expect(screen.getByText(/Enregistrée pour chaque jour du voyage/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer cette heure' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer l’heure enregistrée (07:30)' }));
    const [message, action, undo] = runArgs(ctl);
    expect(message).toBe('Heure de départ effacée');
    await action();
    expect(compasSetDepartureTimeAction).toHaveBeenLastCalledWith(expect.objectContaining({ time: null }));
    await undo?.();
    expect(compasSetDepartureTimeAction).toHaveBeenLastCalledWith(expect.objectContaining({ time: '07:30' }));
  });

  it('un lecteur simule sans pouvoir enregistrer', () => {
    inLocale('fr', <PassageSection ctl={makeCtl({ canEdit: false })} />);
    fireEvent.change(screen.getByLabelText('Si tu pars à (simulation, non enregistrée)'), {
      target: { value: '09:00' },
    });
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull();
  });

  it('en anglais', () => {
    inLocale('en', <PassageSection ctl={makeCtl({ departureTime: '07:30' })} />);
    expect(screen.getByLabelText('If you leave at (departure time each day)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear the saved time (07:30)' })).toBeTruthy();
    expect(screen.getByText(/Departure 07:30 \(saved time\)/)).toBeTruthy();
  });
});

describe('départ dit (carte Où)', () => {
  it('se voit et s’efface ; « Annuler » le rétablit tel que rangé', async () => {
    const ctl = makeCtl({ originSaid: LYON, originName: 'Lyon' });
    inLocale('fr', <OuCard ctl={ctl} onKit={() => {}} />);
    expect(screen.getByText('Lyon')).toBeTruthy();
    expect(screen.getByText(/trajet d’approche se chiffre depuis là/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le départ' }));
    const [message, action, undo] = runArgs(ctl);
    expect(message).toBe('Départ « Lyon » effacé');
    await action();
    expect(compasSetOriginAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      place: null,
    });
    await undo?.();
    expect(compasSetOriginAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      place: 'Lyon',
      restore: LYON,
    });
  });

  it('un lecteur le voit sans pouvoir l’effacer', () => {
    inLocale('fr', <OuCard ctl={makeCtl({ originSaid: LYON, canEdit: false })} onKit={() => {}} />);
    expect(screen.getByText('Lyon')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Effacer le départ' })).toBeNull();
  });

  it('sans départ dit : aucune ligne', () => {
    inLocale('fr', <OuCard ctl={makeCtl()} onKit={() => {}} />);
    expect(screen.queryByText(/Départ dit/)).toBeNull();
  });

  it('en anglais', () => {
    inLocale('en', <OuCard ctl={makeCtl({ originSaid: LYON })} onKit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Clear the departure' })).toBeTruthy();
    expect(screen.getByText(/Stated departure:/)).toBeTruthy();
  });
});
