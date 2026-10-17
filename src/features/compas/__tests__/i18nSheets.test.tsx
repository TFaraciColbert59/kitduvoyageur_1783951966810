// @vitest-environment jsdom

/*
 * PLAN-100 phase 6, lot 4 : les tiroirs du Compas (`CompasSheets.tsx`) lisent la locale du
 * site. Le français reste celui des tests existants ; ici, l'anglais rendu (textes du
 * fichier, pluriels Intl, montants et poids formatés) sur des tiroirs représentatifs. Les
 * textes venus du moteur (statut d'objet, conseils, libellés d'onglets) sont des données
 * traitées dans d'autres lots : on ne lit que les textes écrits dans les tiroirs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import { en, fr } from '@/lib/i18n/translations';
import { t as translate } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/i18n/locale';
import { SheetContent, sheetTitle } from '../components/CompasSheets';
import type { CompasCtl, SheetState } from '../components/compasTypes';
import type { CompasData } from '../server/getCompasData';
import { SLEEP, TENT, U1, U2, compasData, item } from './helpers/compasData';

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
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

// L'anglais garde l'apostrophe courbe (’) : seuls accents, guillemets français et mots courants trahissent le FR.
const FRENCH = /[àâéèêëîïôùûç«»]|\b(ton|ta|tes|pour|avec|dans|une|sur|personne|porte)\b/i;

function data(): CompasData {
  return compasData({
    items: [
      item({
        id: TENT,
        name: 'Tente 2 places',
        weightGrams: 1850,
        ownership: 'shared',
        isVital: true,
      }),
      item({ id: SLEEP, name: 'Sac de couchage', weightGrams: 900, ownerId: U1, isPacked: true }),
    ],
  });
}

function ctlOf(d: CompasData, over: Partial<CompasCtl> = {}): CompasCtl {
  const names = new Map(d.model.crew.loads.map((m) => [m.userId, m.name]));
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
    memberName: (id) => (id ? (names.get(id) ?? 'Member') : 'Nobody'),
    product: () => undefined,
    notify: vi.fn(),
    ...over,
  };
}

const inLocale = (locale: Locale, sheet: SheetState, ctl: CompasCtl) =>
  render(
    <LocaleProvider initialLocale={locale}>
      <SheetContent sheet={sheet} ctl={ctl} />
    </LocaleProvider>
  );

describe('tiroirs du Compas en anglais (lot 4)', () => {
  it('titres : anglais avec `t`, français identique sans (appel historique)', () => {
    const ctl = ctlOf(data());
    const tEn = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
      translate(en, k, v);
    const tent = { kind: 'acquire', lineId: TENT, mode: 'louer' } as const;
    expect(sheetTitle(tent, ctl)).toBe('Trouver : Tente 2 places');
    expect(sheetTitle(tent, ctl, tEn)).toBe('Find: Tente 2 places');
    expect(sheetTitle({ kind: 'bag', userId: U1 }, ctl, tEn)).toBe('My pack');
    expect(sheetTitle({ kind: 'bag', userId: U2 }, ctl, tEn)).toBe('Léa’s pack');
    expect(sheetTitle({ kind: 'bag', userId: U2 }, ctl)).toBe('Sac de Léa');
    expect(sheetTitle({ kind: 'add', target: 'inventaire' }, ctl, tEn)).toBe('Add to inventory');
    expect(sheetTitle({ kind: 'step', step: 'resa', flow: 'nuits' }, ctl, tEn)).toBe('My bookings');
    expect(sheetTitle({ kind: 'step', step: 'resa', flow: 'nuits' }, ctl)).toBe('Mes réservations');
  });

  it('fiche objet : onglets, puces, poids, porteur et actions', () => {
    const { container } = inLocale('en', { kind: 'item', lineId: TENT }, ctlOf(data()));
    expect(screen.getByRole('button', { name: /Details/ })).toBeTruthy();
    expect(screen.getByText('Essential')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
    const kv = container.querySelector('dl.cp-kv') as HTMLElement;
    expect(kv.textContent).toContain('Weight1.9 kg');
    expect(kv.textContent).toContain('Carriernobody yet');
    expect(screen.getByRole('group', { name: 'Find this item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Borrow/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Remove from kit/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Remove from kit/ }));
    expect(screen.getByRole('button', { name: /Confirm removal/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(kv.textContent ?? '').not.toMatch(FRENCH);
  });

  it('ajouter un objet libre : champs, catégories et cases en anglais ; catégorie stockée en français', async () => {
    const run = vi.fn(async (_msg: string, _action: () => Promise<unknown>) => true);
    const ctl = ctlOf(data(), { run });
    const { container } = inLocale('en', { kind: 'add', target: 'inventaire' }, ctl);
    fireEvent.click(screen.getByRole('button', { name: /Other/ }));
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Weight (g), if known')).toBeTruthy();
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Safety',
      'Shelter',
      'Sleeping',
      'Clothing',
      'Cooking',
      'Water',
      'Electronics',
      'Misc.',
    ]);
    expect(container.querySelector('form')?.textContent ?? '').not.toMatch(FRENCH);

    const { compas } = await import('./helpers/screenMocks');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Frontale' } });
    fireEvent.change(select, { target: { value: 'tech' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    expect(run.mock.calls[0][0]).toBe('Frontale added to your inventory');
    await run.mock.calls[0][1]();
    // La catégorie est une donnée de l'inventaire : elle reste le libellé français, quelle que soit la langue.
    expect(compas.compasAddInventoryItemAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Frontale', category: 'Électronique' })
    );
  });

  it('porteur : type d’objet, membres, « (me) » et charge portée', () => {
    const { container } = inLocale('en', { kind: 'carrier', lineId: TENT }, ctlOf(data()));
    expect(screen.getByRole('button', { name: /Shared with the group/ })).toBeTruthy();
    const team = container.querySelector('.cp-list[aria-label="Team"]') as HTMLElement;
    expect(within(team).getByText('Tony (me)')).toBeTruthy();
    expect(within(team).getAllByText(/^carrying .* of \d+ kg$/).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Nobody for now' })).toBeTruthy();
  });

  it('Nous · Budget : enveloppe, montants formatés en anglais, formulaire de dépense', () => {
    const { container } = inLocale(
      'en',
      { kind: 'step', step: 'nous', flow: 'budget' },
      ctlOf(data())
    );
    expect(screen.getByLabelText('Trip budget (EUR)')).toBeTruthy();
    const kv = container.querySelector('dl.cp-kv') as HTMLElement;
    expect(kv.textContent).toContain('Budget€900');
    expect(kv.textContent).toContain('Per person');
    expect(screen.getByText('No expenses entered for this trip yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add an expense/ }));
    expect(screen.getByText('Enter an amount.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Per person' }));
    fireEvent.change(screen.getByLabelText('Amount (EUR)'), { target: { value: '12.5' } });
    expect(screen.getByText('That’s €25 for 2 people, split equally.')).toBeTruthy();
    // Navigation du tiroir.
    expect(screen.getByRole('button', { name: /Previous tab: / })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Next/ })).toBeTruthy();
  });

  it('Résa · États et Nuits : aides, puces et notes en anglais', () => {
    inLocale('en', { kind: 'step', step: 'resa', flow: 'etats' }, ctlOf(data()));
    expect(screen.getByText('To book')).toBeTruthy();
    expect(screen.getByText('Request sent, waiting for the supplier.')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(
      screen.getByText('Clicking through to a partner never confirms a booking.')
    ).toBeTruthy();
    cleanup();

    inLocale('en', { kind: 'step', step: 'resa', flow: 'nuits' }, ctlOf(data()));
    expect(screen.getByText('Night of day 1')).toBeTruthy();
    expect(screen.getByLabelText('Accommodation for the night of day 1')).toBeTruthy();
    expect(screen.getByText('To find')).toBeTruthy();
  });

  it('Kit · Eau : pluriels, litres et jours en anglais', () => {
    const { container } = inLocale('en', { kind: 'step', step: 'kit', flow: 'eau' }, ctlOf(data()));
    const note = container.querySelector('.cp-row__t b')?.textContent ?? '';
    expect(note).toMatch(/^Water per person: (up to [\d.]+ L|not set)$/);
    expect(container.querySelector('.cp-list[aria-label="Kit containers"]')).toBeTruthy();
    expect(screen.getByText('No water bottle, bladder or flask in the kit.')).toBeTruthy();
    expect(container.textContent).toContain('Rule of thumb: ');
    expect(container.textContent).not.toMatch(/Repère|marche/);
  });
});

describe('dictionnaire des tiroirs', () => {
  it('chaque clé FR a son anglais, distinct du français', () => {
    const frS = fr.compas.sheets as unknown as Record<string, Record<string, string>>;
    const enS = en.compas.sheets as unknown as Record<string, Record<string, string>>;
    for (const zone of Object.keys(frS)) {
      for (const key of Object.keys(frS[zone])) {
        expect(enS[zone]?.[key], `${zone}.${key}`).toBeTruthy();
        expect(enS[zone][key], `${zone}.${key}`).not.toBe(frS[zone][key]);
      }
    }
  });
});
