// @vitest-environment jsdom

/*
 * PLAN-100 6.1 / 6.3 : ce qui restait en français dans le Compas du voyageur non français :
 * compteur de l'équipe, dates des invitations, historique d'un objet, profil voyageur
 * (noms de pays, devises, langues) et semaine des calendriers selon la région.
 * Le français reste celui d'avant, au caractère près (tests existants).
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { calendarOffset, rotateWeek } from '@/lib/i18n/region';
import {
  ACCOUNT_SETTINGS_KEY,
  parseFirstDay,
  readFirstDay,
  weekStartForLocale,
} from '@/lib/i18n/unitSetting';
import { teamCount, teamCountLabel, invitationDates } from '../engine/team';
import { buildItemHistory, dayText, inventoryFacts } from '../engine/itemHistory';
import { countryOptions, currencyOptions, languageOptions } from '../engine/traveller';
import { useWeekStart } from '../components/useCompasUnits';

const actions = vi.hoisted(() => ({
  saveTravellerAction: vi.fn(),
  skipTravellerAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/travellerActions', () => actions);

import TravellerCard from '@/components/identity/TravellerCard';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const LOCALES: Locale[] = ['fr', 'en', 'es', 'de', 'it'];

describe('compteur de l’équipe par langue', () => {
  const c = teamCount(5, 2, 1);
  it('français inchangé', () => {
    expect(teamCountLabel(c)).toBe('2 présents · 1 en attente · 2 places libres · 5 au total');
    expect(teamCountLabel(teamCount(1, 1, 0), 'fr')).toBe('1 présent · 1 au total');
  });
  it('anglais, espagnol, allemand, italien', () => {
    expect(teamCountLabel(c, 'en')).toBe('2 present · 1 pending · 2 spots free · 5 in total');
    expect(teamCountLabel(c, 'es')).toBe('2 presentes · 1 en espera · 2 plazas libres · 5 en total');
    expect(teamCountLabel(c, 'de')).toBe('2 anwesend · 1 ausstehend · 2 freie Plätze · 5 insgesamt');
    expect(teamCountLabel(c, 'it')).toBe('2 presenti · 1 in attesa · 2 posti liberi · 5 in totale');
    expect(teamCountLabel(teamCount(2, 1, 0), 'en')).toBe('1 present · 1 spot free · 2 in total');
  });
  it('aucune clé laissée telle quelle', () => {
    for (const l of LOCALES) expect(teamCountLabel(c, l)).not.toMatch(/compas\.engine/);
  });
});

describe('dates des invitations', () => {
  it('français inchangé, puis la langue de la personne', () => {
    expect(invitationDates('2026-10-10', '2026-10-12')).toBe('10 oct. → 12 oct.');
    expect(invitationDates('2026-10-10', '2026-10-12', 'en')).toBe('Oct 10 → Oct 12');
    expect(invitationDates('2026-10-10', '2026-10-12', 'de')).toBe('10. Okt. → 12. Okt.');
    expect(invitationDates('2026-10-10', null, 'it')).toBe('10 ott');
    expect(invitationDates(null, null, 'en')).toBeNull();
  });
});

describe('historique d’un objet par langue', () => {
  const src = {
    loans: [
      {
        id: '1',
        status: 'en_cours',
        loaned_at: '2026-09-20',
        due_date: '2026-10-20',
        returned_at: null,
        borrower_contact: 'Marc',
      },
    ],
    trips: [{ trip_id: 't', title: null, start_date: null, end_date: null }],
    orders: [
      {
        id: 'o',
        order_number: 'LKDV-1',
        status: 'delivered',
        created_at: '2026-09-02T10:00:00Z',
        quantity: 2,
        total_price_eur: 64,
        transaction_type: 'location',
      },
    ],
  };

  it('anglais', () => {
    const e = buildItemHistory(src, 'en');
    const by = Object.fromEntries(e.map((x) => [x.kind, x]));
    expect(by.pret.title).toBe('Lent to Marc');
    expect(by.pret.detail).toBe('Sep 20, 2026 → Oct 20, 2026 · due back Oct 20, 2026 · on loan');
    expect(by.voyage.title).toBe('Taken on “an untitled trip”');
    expect(by.voyage.detail).toBe('dates not filled in');
    expect(by.commande.title).toBe('Order LKDV-1');
    expect(by.commande.detail?.replace(/ /g, ' ')).toBe('rental · 2 copies · €64 · delivered');
  });

  it('allemand : date, statut et libellés', () => {
    const e = buildItemHistory(src, 'de');
    expect(e.find((x) => x.kind === 'pret')?.title).toBe('Verliehen an Marc');
    expect(e.find((x) => x.kind === 'pret')?.detail).toContain('Rückgabe am 20. Okt. 2026 erwartet');
    expect(e.find((x) => x.kind === 'commande')?.title).toBe('Bestellung LKDV-1');
  });

  it('un statut inconnu est dit tel quel, dans toutes les langues', () => {
    for (const l of LOCALES) {
      const [e] = buildItemHistory(
        {
          loans: [
            { id: 'x', status: 'archivé', loaned_at: null, due_date: null, returned_at: null, borrower_contact: null },
          ],
          trips: [],
          orders: [],
        },
        l
      );
      expect(e.detail).toBe('archivé');
    }
  });

  it('faits de l’inventaire et jour', () => {
    const facts = inventoryFacts(
      { condition: 'worn', maintenanceDueAt: '2026-11-01', expiryDate: null, isLent: true },
      'es'
    );
    expect(facts.map((f) => f.label)).toEqual(['Estado', 'Mantenimiento pendiente', 'Préstamo']);
    expect(dayText('2026-11-01', 'en')).toBe('Nov 1, 2026');
    expect(dayText('2026-11-01')).toBe('1 nov. 2026');
  });
});

describe('listes du profil voyageur par langue', () => {
  it('pays, devises, langues dans la langue de l’interface', () => {
    expect(countryOptions('de').find((o) => o.value === 'DE')?.label).toBe('Deutschland');
    expect(countryOptions('en').find((o) => o.value === 'ES')?.label).toBe('Spain');
    expect(countryOptions('it').find((o) => o.value === 'FR')?.label).toBe('Francia');
    expect(currencyOptions('en').find((o) => o.value === 'CHF')?.label).toBe('Swiss Franc (CHF)');
    expect(languageOptions(null, 'es')[0].label).toBe('Francés');
    // français : celui d'avant
    expect(countryOptions().find((o) => o.value === 'FR')?.label).toBe('France');
    expect(languageOptions(null)[0].label).toBe('Français');
  });
  it('triés selon la langue', () => {
    for (const l of LOCALES) {
      const list = countryOptions(l);
      const tag = l;
      expect([...list].sort((x, y) => x.label.localeCompare(y.label, tag))).toEqual(list);
    }
  });
});

describe('carte du profil voyageur dans la langue de l’interface', () => {
  const inLocale = (locale: Locale, mode: 'collect' | 'edit') =>
    render(
      <LocaleProvider initialLocale={locale}>
        <TravellerCard mode={mode} />
      </LocaleProvider>
    );

  it('anglais', () => {
    inLocale('en', 'edit');
    expect(screen.getByRole('heading', { name: 'What the Compas knows about you' })).toBeTruthy();
    expect(screen.getByLabelText('Nationality')).toBeTruthy();
    expect(screen.getByLabelText('Time zone')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getAllByRole('option', { name: 'Germany' })).toHaveLength(2);
  });

  it('allemand, collecte : « Überspringen » toujours visible', () => {
    inLocale('de', 'collect');
    expect(screen.getByRole('heading', { name: 'Für passende Empfehlungen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Überspringen' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Deutschland' })).toBeTruthy();
  });

  it('chaque langue : pas de clé brute', () => {
    for (const l of LOCALES) {
      const { container, unmount } = inLocale(l, 'edit');
      expect(container.textContent).not.toMatch(/compas\.traveller/);
      unmount();
    }
  });
});

describe('semaine des calendriers selon la région', () => {
  const MON = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  it('rotation de la liste et cases vides avant le premier jour', () => {
    expect(rotateWeek(MON, 1)).toEqual(MON);
    expect(rotateWeek(MON, 7)).toEqual(['D', 'L', 'M', 'M', 'J', 'V', 'S']);
    expect(rotateWeek(MON, 6)).toEqual(['S', 'D', 'L', 'M', 'M', 'J', 'V']);
    // 2026-10-12 est un lundi
    expect(calendarOffset('2026-10-12', 1)).toBe(0);
    expect(calendarOffset('2026-10-12', 7)).toBe(1);
    expect(calendarOffset('2026-10-18', 1)).toBe(6); // dimanche
    expect(calendarOffset('2026-10-18', 7)).toBe(0);
    expect(calendarOffset('2026-10-12', 6)).toBe(2);
    expect(calendarOffset('pas une date', 1)).toBe(0);
  });

  it('région : États-Unis dimanche, Royaume-Uni et France lundi ; réglage explicite en premier', () => {
    expect(weekStartForLocale('en')).toBe(7);
    expect(weekStartForLocale('en', 'en-GB')).toBe(1);
    expect(weekStartForLocale('fr')).toBe(1);
    expect(weekStartForLocale('fr', 'fr-CA')).toBe(7);
    expect(weekStartForLocale('en', 'en-GB', 7)).toBe(7);
    expect(weekStartForLocale('en', null, 1)).toBe(1);
    expect(parseFirstDay(JSON.stringify({ firstDayOfWeek: 'sunday' }))).toBe(7);
    expect(parseFirstDay(JSON.stringify({ firstDayOfWeek: 'monday' }))).toBe(1);
    expect(parseFirstDay('{pas du json')).toBeNull();
    expect(parseFirstDay(JSON.stringify({ firstDayOfWeek: 'x' }))).toBeNull();
  });

  function Probe() {
    return <output data-testid="w">{useWeekStart()}</output>;
  }
  const probe = (locale: Locale) =>
    render(
      <LocaleProvider initialLocale={locale}>
        <Probe />
      </LocaleProvider>
    );

  it('le calendrier lit la région de la langue, puis le réglage du compte', () => {
    probe('en');
    expect(screen.getByTestId('w').textContent).toBe('7');
    cleanup();
    probe('fr');
    expect(screen.getByTestId('w').textContent).toBe('1');
    cleanup();
    window.localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify({ firstDayOfWeek: 'monday' }));
    expect(readFirstDay()).toBe(1);
    probe('en');
    expect(screen.getByTestId('w').textContent).toBe('1');
  });
});
