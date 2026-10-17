// @vitest-environment jsdom

/*
 * PLAN-100 phase 6, lot 2 : noms d'étapes, activités, « Voici ce que j'ai compris »
 * et tiroirs « Où » (activité, parcours, quand, envies) dans la locale du site.
 * Le français reste celui d'avant (tests existants inchangés, et égalités ci-dessous).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { en, fr } from '@/lib/i18n/translations';
import { COMPAS_STEPS_SAME_IN_EN } from '@/lib/i18n/translations/compas-steps.en';
import { flattenKeys } from '../../../../scripts/i18n/compas-coverage.mjs';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({
  compasCreateTripAction: vi.fn(),
  compasApplyRouteAction: vi.fn(async () => ({ success: true })),
  compasMyRoutesAction: vi.fn(async () => ({ success: true, routes: [] })),
  compasSearchRoutesAction: vi.fn(async () => ({ success: true, routes: [] })),
  compasSetActivityAction: vi.fn(async () => ({ success: true })),
  compasSetPreferencesAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/resaActions', () => ({
  compasNearbyActivitiesAction: vi.fn(async () => ({ success: true, offers: [] })),
}));

import { COMPAS_STEPS, buildCompasModel, type CompasInput } from '../engine/compasModel';
import { COMPAS_ACTIVITIES } from '../engine/intent';
import { activityLabel, formatDayMonth, formatKm, formatMoney } from '../engine/format';
import { activityName, compasFormat, STEP_LABEL_KEY } from '../engine/compasI18n';
import { understandRequest } from '../engine/request';
import { resolveProjectContext } from '../engine/projectContext';
import { CompasStart } from '../components/CompasStart';
import {
  ACTIVITY_META,
  ActiviteFlow,
  ParcoursFlow,
  PreferencesFlow,
  QuandFlow,
} from '../components/CompasOuFlows';
import type { CompasCtl } from '../components/compasTypes';
import type { CompasData } from '../server/getCompasData';

afterEach(cleanup);
// jsdom n'a pas ResizeObserver (listes paginées du tiroir).
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

const TODAY = '2026-10-07';
const inLocale = (locale: Locale, ui: React.ReactElement) =>
  render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>);
// L'anglais garde l'apostrophe courbe : seuls les accents, guillemets français et mots courants trahissent le FR.
const FRENCH =
  /[àâéèêëîïôùûç«»]|\b(ton|ta|tes|pour|avec|dans|une|jours?|personnes?|parcours|nuits?)\b/i;

const line = (r: ReturnType<typeof understandRequest>, key: string) =>
  r.lines.find((l) => l.key === key);

/* ---------- Données d'écran minimales (moteur réel, sans réseau) ---------- */

const U1 = '22222222-2222-4222-8222-222222222222';

function makeData(): CompasData {
  const input: CompasInput = {
    trip: {
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'trek-3-vallees',
      title: 'Trek des 3 Vallées',
      destinationName: 'Pyrénées',
      startDate: '2026-10-12',
      endDate: '2026-10-13',
      primaryActivity: 'hiking',
      estimatedBudget: 900,
      budgetCurrency: 'EUR',
      partySize: 2,
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
        distanceKm: 12.4,
        elevationGainM: 900,
        elevationLossM: 300,
        accommodationName: null,
        transportMode: 'foot',
        startTime: null,
      },
      {
        id: 's2',
        dayNumber: 2,
        orderIndex: 0,
        title: 'Refuge',
        locationName: 'Refuge',
        lat: 42.7,
        lon: 0.02,
        distanceKm: 10,
        elevationGainM: 700,
        elevationLossM: 800,
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
        flatSpeedKmh: 4.6,
        experienceLevel: null,
        calibrationLevel: null,
      },
    ],
    expenses: [],
    inventory: [],
    bookings: [],
    weather: [],
    routeDurationMin: 325,
    routeHasGeometry: false,
    waterPointsCount: null,
    viewerId: U1,
    now: new Date('2026-09-30T12:00:00Z'),
    timeZone: 'Europe/Paris',
  };
  return {
    model: buildCompasModel(input),
    itinerary: input.steps.map((st) => ({
      id: st.id,
      day: st.dayNumber,
      title: st.title,
      distanceKm: st.distanceKm,
      elevationGainM: st.elevationGainM,
      accommodation: st.accommodationName,
    })),
    route: { id: 374, name: null },
    origin: { lat: 42.73, lon: -0.01 },
    weather: null,
    canEdit: true,
    viewerId: U1,
    context: resolveProjectContext({
      activity: 'trekking',
      days: 4,
      hours: null,
      partySize: 2,
      month: 10,
      project: null,
      profile: null,
    }),
  } as unknown as CompasData;
}

function makeCtl(): CompasCtl {
  return {
    data: makeData(),
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

/* ---------- Moteur : français inchangé, anglais par la locale ---------- */

describe('moteur — le français par défaut ne change pas', () => {
  it('étapes : noms français identiques, clés pour chaque étape', () => {
    expect(COMPAS_STEPS.map((s) => s.label)).toEqual(['Où', 'Nous', 'Résa', 'Verdict', 'Kit']);
    expect(COMPAS_STEPS.map((s) => en.compas.steps[s.id])).toEqual([
      'Where',
      'Us',
      'Booking',
      'Verdict',
      'Gear',
    ]);
    for (const s of COMPAS_STEPS) expect(STEP_LABEL_KEY[s.id]).toBe(`compas.steps.${s.id}`);
  });

  it('activités : activityName(fr) === activityLabel, alias compris ; aides françaises du dictionnaire', () => {
    const aliases = [
      'randonnee',
      'trek',
      'velo',
      'alpinisme',
      'kayak',
      'travel',
      'voyage',
      'bikepacking',
    ];
    for (const a of [...COMPAS_ACTIVITIES, ...aliases, 'packraft', 'road_trip', null]) {
      expect(activityName(a), String(a)).toBe(activityLabel(a));
    }
    expect(ACTIVITY_META.hiking.hint).toBe('À la journée ou sur quelques jours');
    expect(ACTIVITY_META.trail.hint).toBe('Course nature, dénivelé, sentiers');
  });

  it('understandRequest : sans locale, et avec « fr », exactement les mêmes lignes', () => {
    const phrases = [
      '5 jours de trek dans le Vercors à 3, en refuge',
      'escalade à Kalymnos',
      'quelques jours en Corse en randonnée',
      'week-end à 4 à Lisbonne, 50 € par personne',
      'week-end à Lisbonne, 50 € par personne',
      '3 jours dans le Vercors sans voiture',
      'activité cet après-midi',
      '10 jours au Japon en avril',
      '',
    ];
    for (const text of phrases) {
      expect(understandRequest(text, TODAY, {}, 'fr'), text).toEqual(
        understandRequest(text, TODAY)
      );
    }
  });

  it('formats : en français, ceux du moteur ; en anglais, Intl', () => {
    const frf = compasFormat('fr');
    expect(frf.km(12.4)).toBe(formatKm(12.4));
    expect(frf.dayMonth('2026-10-10')).toBe(formatDayMonth('2026-10-10'));
    expect(frf.money(50, 'EUR')).toBe(formatMoney(50, 'EUR'));
    expect(frf.firstOfMonth('2026-11-01')).toBe('1 nov.');
    const enf = compasFormat('en');
    expect(enf.km(12.4)).toBe('12.4 km');
    expect(enf.dayMonth('2026-10-10')).toBe('Sat, Oct 10');
    expect(enf.firstOfMonth('2026-11-01')).toBe('Nov 1');
    expect(enf.dateRange('2026-10-10', null)).toBe('Oct 10');
    expect(enf.dateRange(null, null)).toBe('Dates to be chosen');
    expect(enf.money(50, 'EUR')).toBe('€50');
    expect(enf.duration(330)).toBe('5 h 30 min');
  });
});

describe('moteur — « Voici ce que j’ai compris » en anglais', () => {
  it('libellés et valeurs en anglais, pluriels Intl ; la phrase envoyée reste le protocole français', () => {
    const r = understandRequest('5 jours de trek dans le Vercors à 3, en refuge', TODAY, {}, 'en');
    expect(line(r, 'activite')).toMatchObject({ label: 'Activity', value: 'Trekking' });
    expect(line(r, 'lieu')).toMatchObject({ label: 'Place', value: 'Vercors' });
    expect(line(r, 'quand')).toMatchObject({ label: 'Duration', value: '5 days' });
    expect(line(r, 'groupe')).toMatchObject({ label: 'Group', value: '3 people' });
    expect(line(r, 'nuits')).toMatchObject({ label: 'Nights', value: 'Mountain huts' });

    const d = understandRequest('escalade à Kalymnos', TODAY, {}, 'en');
    expect(line(d, 'quand')?.value).toBe('3 days by default · best date picked for you');
    expect(
      line(understandRequest('escalade à Kalymnos', TODAY, { party: 1 }, 'en'), 'groupe')?.value
    ).toBe('1 person');
    // Protocole relu par precisionActions : jamais traduit.
    expect(d.say).toBe('escalade à Kalymnos · 3 jours');
    expect(understandRequest('', TODAY, { activity: 'ski' }, 'en').say).toBe(
      '6 jours · activité : ski'
    );
  });

  it('seul, lieu à trouver, durée vague, budget par personne, sans voiture', () => {
    const r = understandRequest('quelques jours en Corse en randonnée', TODAY, {}, 'en');
    expect(line(r, 'groupe')?.value).toBe('Solo (default)');
    expect(line(r, 'quand')?.value).toMatch(
      /^at least \d+ days \(“quelques jours” doesn’t say how many\) · please specify$/
    );
    expect(line(understandRequest('rando', TODAY, {}, 'en'), 'lieu')?.value).toBe(
      'I’m looking for it in your sentence'
    );
    expect(line(understandRequest('', TODAY, {}, 'en'), 'lieu')?.value).toBe(
      'Say where you’re going'
    );
    const flat = (s: string) => s.replace(/\s/g, ' ');
    expect(
      flat(
        line(
          understandRequest('week-end à 4 à Lisbonne, 50 € par personne', TODAY, {}, 'en'),
          'budget'
        )?.value ?? ''
      )
    ).toBe('€200 (€50 per person × 4 people)');
    expect(
      line(
        understandRequest('3 jours dans le Vercors sans voiture', TODAY, {}, 'en'),
        'deplacements'
      )
    ).toMatchObject({
      label: 'Getting around',
      value: 'Car-free: train, bus, bike or on foot',
    });
    const when = line(understandRequest('10 jours au Japon en avril', TODAY, {}, 'en'), 'quand');
    expect(when).toMatchObject({ label: 'When', value: 'Apr 1 · 10 days' });
  });

  it('aucune valeur anglaise ne garde de français (hors mots de l’utilisateur)', () => {
    const r = understandRequest('week-end bivouac à 2, budget 300 €', TODAY, {}, 'en');
    for (const l of r.lines) {
      expect(l.label, l.key).not.toMatch(FRENCH);
      if (l.key !== 'lieu' && l.key !== 'envies') expect(l.value, l.key).not.toMatch(FRENCH);
    }
  });
});

describe('dictionnaire du lot 2', () => {
  it('chaque mot gardé identique en anglais l’est vraiment', () => {
    const flatFr = flattenKeys(fr.compas as Record<string, unknown>, 'compas') as Record<
      string,
      string
    >;
    const flatEn = flattenKeys(en.compas as Record<string, unknown>, 'compas') as Record<
      string,
      string
    >;
    for (const k of COMPAS_STEPS_SAME_IN_EN) expect(flatEn[k], k).toBe(flatFr[k]);
  });
});

/* ---------- Rendu en anglais ---------- */

describe('Compas en anglais (lot 2) — écran vide', () => {
  it('étapes et activités du Compas vide, lignes comprises', () => {
    inLocale('en', <CompasStart signedIn />);
    const nav = screen.getByRole('navigation', { name: 'Compas steps' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Where', 'Us', 'Booking', 'Verdict', 'Gear']);
    for (const d of document.querySelectorAll('details')) d.setAttribute('open', '');
    const group = screen.getByRole('group', { name: 'Activity' });
    const hiking = within(group).getByRole('button', { name: /Hiking/ });
    expect(hiking.getAttribute('title')).toBe('Day hikes or a few days out');
    expect(document.getElementById('cp-start-act-hiking')?.textContent).toBe(
      'Day hikes or a few days out'
    );
    fireEvent.change(screen.getByLabelText('Your request', { selector: 'textarea' }), {
      target: { value: '5 jours de trek dans le Vercors à 3' },
    });
    expect(screen.getByText('5 days')).toBeTruthy();
    expect(screen.getByText('3 people')).toBeTruthy();
  });

  it('français : mêmes noms d’étapes et d’activités qu’avant', () => {
    inLocale('fr', <CompasStart signedIn />);
    const nav = screen.getByRole('navigation', { name: 'Étapes du Compas' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Où', 'Nous', 'Résa', 'Verdict', 'Kit']);
  });
});

describe('Compas en anglais (lot 2) — tiroirs « Où »', () => {
  it('Activité : tuiles, aide et note', () => {
    const { container } = inLocale('en', <ActiviteFlow ctl={makeCtl()} />);
    const group = screen.getByRole('group', { name: 'Activities' });
    expect(
      within(group)
        .getByRole('button', { name: /Hiking/ })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(within(group).getByRole('button', { name: /Trail running/ })).toBeTruthy();
    expect(container.querySelector('.cp-note')?.textContent).toBe(
      'Hiking: day hikes or a few days out. Your choice sets the suggested gear and the safety rules used by the verdict.'
    );
  });

  it('Activité : en français, la note d’avant au caractère près', () => {
    const { container } = inLocale('fr', <ActiviteFlow ctl={makeCtl()} />);
    expect(container.querySelector('.cp-note')?.textContent).toBe(
      'Randonnée : à la journée ou sur quelques jours. Le choix règle le matériel proposé et les règles de sécurité du verdict.'
    );
  });

  it('Activité : l’annonce du changement est traduite', () => {
    const ctl = makeCtl();
    inLocale('en', <ActiviteFlow ctl={ctl} />);
    fireEvent.click(screen.getByRole('button', { name: /Cycling/ }));
    expect(ctl.run).toHaveBeenCalledWith(
      'Activity: Cycling',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('Parcours : sources, étapes et distances en anglais', () => {
    const { container } = inLocale('en', <ParcoursFlow ctl={makeCtl()} />);
    const sources = screen.getByRole('group', { name: 'Route sources' });
    expect(
      within(sources)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Stages · 2', 'Nearby · 50 km', 'My hikes']);
    expect(screen.getByPlaceholderText('Place, range or route name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.getByText('Custom route')).toBeTruthy();
    expect(screen.getByText('catalog')).toBeTruthy();
    expect(screen.getByText(/^Day 1 · 12\.4 km · D\+ 900 m$/)).toBeTruthy();
    expect(container.textContent ?? '').not.toMatch(FRENCH);
  });

  it('Quand : formulaire, conditions et détail du jour en anglais', () => {
    const { container } = inLocale('en', <QuandFlow ctl={makeCtl()} />);
    expect(screen.getByLabelText('Start')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Duration unit' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'days' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'hours' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Number of days' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(
      screen.getByText('Conditions unavailable for now (MET Norway isn’t responding).')
    ).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Trip day' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'D2' })).toBeTruthy();
    const day = screen.getByRole('region', { name: 'Day 1' });
    expect(within(day).getByText('Walking')).toBeTruthy();
    expect(within(day).getByText(/Hour-by-hour forecast available/)).toBeTruthy();
    expect(within(day).getByText(/steady pace$/)).toBeTruthy();
    // Nos textes seulement : PassageSection (autre lot) peut encore parler français.
    const ours = [container.querySelector('.cp-when'), day];
    for (const el of ours) expect(el?.textContent ?? '').not.toMatch(FRENCH);
  });

  it('Envies : rythme, nuits, projet, éviter et envies en anglais', () => {
    const ctl = makeCtl();
    inLocale('en', <PreferencesFlow ctl={ctl} />);
    const pace = screen.getByRole('group', { name: 'Pace' });
    expect(
      within(pace)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Easy', 'Steady', 'Brisk']);
    fireEvent.click(within(pace).getByRole('button', { name: 'Brisk' }));
    expect(ctl.run).toHaveBeenCalledWith('Pace: brisk', expect.any(Function), expect.any(Function));
    const nights = screen.getByRole('group', { name: 'Nights' });
    expect(
      within(nights)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
    ).toEqual(['Wild camp', 'Hut', 'Lodging', 'Mixed']);
    fireEvent.click(within(nights).getByRole('button', { name: /Hut/ }));
    expect(ctl.run).toHaveBeenCalledWith('Nights: hut', expect.any(Function), expect.any(Function));
    expect(screen.getByRole('group', { name: 'Level' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Experienced' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Avoid' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Crowds/ })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Wishes' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Add to “Wishes”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Lake/ }));
    expect(ctl.run).toHaveBeenCalledWith(
      'Wishes: Lake',
      expect.any(Function),
      expect.any(Function)
    );
    expect(
      screen.getByText('Visible to the whole group. Wishes become search shortcuts in Routes.')
    ).toBeTruthy();
  });

  it('Envies : en français, les annonces d’avant', () => {
    const ctl = makeCtl();
    inLocale('fr', <PreferencesFlow ctl={ctl} />);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Nuits' })).getByRole('button', { name: /Refuge/ })
    );
    expect(ctl.run).toHaveBeenCalledWith(
      'Nuits : refuge',
      expect.any(Function),
      expect.any(Function)
    );
    fireEvent.click(screen.getByRole('button', { name: /Lac/ }));
    expect(ctl.run).toHaveBeenCalledWith(
      'Envies : Lac',
      expect.any(Function),
      expect.any(Function)
    );
  });
});
