// @vitest-environment jsdom

/*
 * PLAN-100 6.3 : le Compas affiche mi / ft / lb / °F quand la personne choisit l'impérial
 * (réglage du compte, enregistré dans ce navigateur) ou quand la région de sa langue l'est
 * (anglais → en-US). Les données et le moteur restent métriques : seule l'écriture change.
 * En métrique, rien ne bouge : le français reste celui des tests existants.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { ACCOUNT_SETTINGS_KEY, UNIT_SETTING_EVENT } from '@/lib/i18n/unitSetting';
import { buildProfile } from '../engine/elevation';
import type { CompasWeather } from '../server/weather';
import { CompasAccessory } from '../components/CompasAccessory';
import { KitCard, OuCard } from '../components/CompasCards';
import { ParcoursFlow, QuandFlow } from '../components/CompasOuFlows';
import { SheetContent } from '../components/CompasSheets';
import type { CompasCtl, SheetState } from '../components/compasTypes';
import type { CompasData } from '../server/getCompasData';
import { SLEEP, TENT, U1, compasData, item } from './helpers/compasData';

vi.mock('next/navigation', async () => {
  const { router } = await import('./helpers/screenMocks');
  return { useRouter: () => router, usePathname: () => '/compas' };
});
vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas);
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);

beforeEach(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/** Le réglage tel que la carte « Paramètres » du compte l'enregistre. */
const setting = (unitSystem: 'metric' | 'imperial') =>
  window.localStorage.setItem(
    ACCOUNT_SETTINGS_KEY,
    JSON.stringify({ language: 'fr', unitSystem, firstDayOfWeek: 'monday' })
  );

const inLocale = (locale: Locale, ui: React.ReactElement) =>
  render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>);

function data(patch: Partial<CompasData> = {}): CompasData {
  return compasData(
    {
      items: [
        item({ id: TENT, name: 'Tente 2 places', weightGrams: 1850, ownership: 'shared' }),
        item({ id: SLEEP, name: 'Sac de couchage', weightGrams: 900, ownerId: U1 }),
      ],
    },
    patch
  );
}

function ctlOf(d: CompasData): CompasCtl {
  return {
    data: d,
    lines: d.model.kit.lines,
    busy: false,
    open: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    enlarge: vi.fn(),
    run: vi.fn(async () => true),
    togglePacked: vi.fn(),
    memberName: (id) => (id ? 'Tony' : 'Personne'),
    product: () => undefined,
    notify: vi.fn(),
  };
}

const sheet = (locale: Locale, s: SheetState, d = data()) =>
  inLocale(locale, <SheetContent sheet={s} ctl={ctlOf(d)} />);

function weather(): CompasWeather {
  return {
    source: 'MET Norway',
    trendSource: 'NASA POWER',
    horizon: '2026-10-20',
    calendar: [],
    tripDays: [
      {
        day: 1,
        date: '2026-10-12',
        lat: 42.73,
        lon: -0.01,
        forecast: {
          date: '2026-10-12',
          tMin: -2,
          tMax: 14,
          precipPct: 20,
          precipMm: 0,
          gustMax: 30,
          code: 1,
          sunrise: '07:50',
          sunset: '19:00',
          hours: [
            {
              time: '2026-10-12T08:00',
              tempC: 3,
              precipPct: 10,
              precipMm: 0,
              windKmh: 10,
              gustKmh: 20,
              code: 1,
              freezingM: 2400,
              isDay: true,
            },
          ],
        },
      },
    ],
  };
}

/* ---------- Accessoire de la carte : dénivelé, distance, profil ---------- */

describe('accessoire de carte', () => {
  const profile = buildProfile(
    [{ km: 0 }, { km: 5 }, { km: 10 }],
    [1000, 2100, 1400],
    'Open-Meteo · Copernicus DEM GLO-90'
  );
  const bare = (
    <CompasAccessory profile={null} gainM={900} distanceKm={12.4} days={2} stepsCount={2} />
  );

  it('français métrique, sans réglage : inchangé', () => {
    inLocale('fr', bare);
    expect(screen.getByText('D+ 900 m')).toBeTruthy();
    expect(screen.getByText('12,4 km')).toBeTruthy();
  });

  it('réglage explicite impérial en français : ft et mi, séparateurs français', () => {
    setting('imperial');
    inLocale('fr', bare);
    expect(screen.getByText(/^D\+ 2\s953 ft$/)).toBeTruthy();
    expect(screen.getByText('7,7 mi')).toBeTruthy();
  });

  it('anglais (région US) sans réglage : impérial', () => {
    inLocale('en', bare);
    expect(screen.getByText('D+ 2,953 ft')).toBeTruthy();
    expect(screen.getByText('7.7 mi')).toBeTruthy();
  });

  it('le réglage explicite métrique l’emporte sur la région US', () => {
    setting('metric');
    inLocale('en', bare);
    expect(screen.getByText('D+ 900 m')).toBeTruthy();
    expect(screen.getByText('12.4 km')).toBeTruthy();
  });

  it('anglais britannique (navigateur en-GB) : miles, mais mètres', () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-GB');
    inLocale('en', bare);
    expect(screen.getByText('D+ 900 m')).toBeTruthy();
    expect(screen.getByText('7.7 mi')).toBeTruthy();
  });

  it('le réglage changé dans le compte s’applique sans recharger', () => {
    inLocale('fr', bare);
    expect(screen.getByText('12,4 km')).toBeTruthy();
    act(() => {
      setting('imperial');
      window.dispatchEvent(new Event(UNIT_SETTING_EVENT));
    });
    expect(screen.getByText('7,7 mi')).toBeTruthy();
  });

  it('profil : altitude max et texte du lecteur d’écran dans les unités choisies', () => {
    setting('imperial');
    inLocale(
      'fr',
      <CompasAccessory profile={profile} gainM={1100} distanceKm={10} days={1} stepsCount={1} />
    );
    expect(screen.getByText(/^6\s890 ft$/)).toBeTruthy();
    const slider = screen.getByRole('slider', { name: 'Profil d’altitude du parcours' });
    expect(slider.getAttribute('aria-valuetext')).toBe(
      'Altitude maximale 6\u202f890 ft, minimale 3\u202f281 ft (Open-Meteo · Copernicus DEM GLO-90)'
    );
  });

  it('profil en métrique : texte du lecteur d’écran d’origine', () => {
    inLocale(
      'fr',
      <CompasAccessory profile={profile} gainM={1100} distanceKm={10} days={1} stepsCount={1} />
    );
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe(
      'Altitude maximale 2100 m, minimale 1000 m (Open-Meteo · Copernicus DEM GLO-90)'
    );
  });
});

/* ---------- Cartes d'étape ---------- */

describe('cartes', () => {
  it('Kit : poids du sac en livres en impérial, en kilos sinon', () => {
    const d = data();
    const { container, unmount } = inLocale('fr', <KitCard ctl={ctlOf(d)} />);
    const metric = container.querySelector('.cp-wl')?.textContent ?? '';
    expect(metric).toMatch(/kg|g\b/);
    expect(metric).not.toMatch(/lb|oz/);
    unmount();

    setting('imperial');
    const { container: c2 } = inLocale('fr', <KitCard ctl={ctlOf(d)} />);
    const imp = c2.querySelector('.cp-wl')?.textContent ?? '';
    expect(imp).toMatch(/lb|oz/);
    expect(imp).not.toMatch(/\d kg/);
    // Charge par membre : portée et capacité dans la même unité.
    const mb = c2.querySelector('.cp-mb b')?.textContent ?? '';
    expect(mb).toMatch(/^[\d,]+ (lb|oz) \/ 30,9 lb$/);
  });

  it('Où : distance du parcours en miles', () => {
    setting('imperial');
    const { container } = inLocale('en', <OuCard ctl={ctlOf(data())} onKit={vi.fn()} />);
    expect(container.textContent).toContain('Tour des Vallées · 13.9 mi');
  });
});

/* ---------- Tiroirs ---------- */

describe('tiroirs', () => {
  it('fiche objet : poids en livres (anglais, région US), en kilos avec le réglage métrique', () => {
    const { container, unmount } = sheet('en', { kind: 'item', lineId: TENT });
    expect(container.querySelector('dl.cp-kv')?.textContent).toContain('Weight4.1 lb');
    unmount();
    setting('metric');
    const { container: c2 } = sheet('en', { kind: 'item', lineId: TENT });
    expect(c2.querySelector('dl.cp-kv')?.textContent).toContain('Weight1.9 kg');
  });

  it('porteur : charge et capacité dans la même unité', () => {
    const { container } = sheet('en', { kind: 'carrier', lineId: TENT });
    const team = container.querySelector('.cp-list[aria-label="Team"]') as HTMLElement;
    expect(within(team).getAllByText(/^carrying .* of [\d.]+ lb$/).length).toBe(2);
  });

  it('Météo : températures en °F et isotherme 32 °F en pieds', () => {
    setting('imperial');
    const { container } = sheet(
      'en',
      { kind: 'step', step: 'verdict', flow: 'meteo' },
      data({ weather: weather() })
    );
    const text = container.querySelector('.cp-wx')?.textContent ?? '';
    expect(text).toContain('28 °F / 57 °F');
    expect(text).toContain('32 °F at 7,874 ft');
    expect(text).not.toMatch(/°C|\d m\b/);
  });

  it('Météo en métrique : inchangée', () => {
    const { container } = sheet(
      'fr',
      { kind: 'step', step: 'verdict', flow: 'meteo' },
      data({ weather: weather() })
    );
    const text = container.querySelector('.cp-wx')?.textContent ?? '';
    expect(text).toContain('-2 °C / 14 °C');
    expect(text).toContain('0 °C à 2\u202f400 m');
  });

  it('Eau : seuil de chaleur en °F', () => {
    setting('imperial');
    const { container } = sheet('en', { kind: 'step', step: 'kit', flow: 'eau' });
    expect(container.textContent).toMatch(/above \d+ °F \(that day’s forecast\)/);
    expect(container.textContent).not.toContain('°C');
  });
});

/* ---------- Tiroirs « Où » ---------- */

describe('tiroirs Où', () => {
  it('Parcours : étapes en miles et en pieds', () => {
    setting('imperial');
    inLocale('en', <ParcoursFlow ctl={ctlOf(data())} />);
    expect(screen.getByText(/^Day 1 · 7\.7 mi · D\+ 2,953 ft$/)).toBeTruthy();
  });

  it('Parcours en métrique : inchangé', () => {
    inLocale('fr', <ParcoursFlow ctl={ctlOf(data())} />);
    expect(screen.getByText(/^Jour 1 · 12,4 km · D\+ 900 m$/)).toBeTruthy();
  });

  it('Quand · détail du jour : °F, isotherme en pieds, marche en miles', () => {
    setting('imperial');
    inLocale('en', <QuandFlow ctl={ctlOf(data({ weather: weather() }))} />);
    const day = screen.getByRole('region', { name: 'Day 1' });
    expect(within(day).getByText('28°F / 57°F')).toBeTruthy();
    expect(within(day).getByText('32 °F at 7,874 ft')).toBeTruthy();
    expect(within(day).getByText('37°F')).toBeTruthy();
    expect(within(day).getByText(/· 7\.7 mi, /)).toBeTruthy();
  });

  it('Quand · détail du jour en métrique : inchangé', () => {
    inLocale('fr', <QuandFlow ctl={ctlOf(data({ weather: weather() }))} />);
    const day = screen.getByRole('region', { name: 'Jour 1' });
    expect(within(day).getByText('-2° / 14°')).toBeTruthy();
    expect(within(day).getByText(/^0 °C à 2\s400 m$/)).toBeTruthy();
    expect(within(day).getByText('3°')).toBeTruthy();
  });
});
