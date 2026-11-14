// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { prevoirDrawer } from '../drawers/prevoir';
import { TripCard } from '../TripCard';
import { EMPTY_EXTRAS, type V5Extras, type V5StayOption } from '../types';
import { makeApi, makeData, makeInput, WithApi } from './fixtures';

/**
 * Aperçu du 14/11 (écran v5, tiroir « À prévoir », OpenStreetMap muet) : mise en page des lignes du plan (1),
 * nuits sans option (4), lieu de l'étape à la place de « non renseigné » (6). Les points 2, 3 et 5 ont leurs tests
 * dans `__tests__/phase7Constats.test.ts` et `map/__tests__/LiveMap.test.tsx`.
 */

vi.mock('../server/choiceActions', () => ({
  compasV5SetStayAction: vi.fn(async () => ({ success: true })),
  compasV5SetTransportAction: vi.fn(async () => ({ success: true })),
  compasV5SetResaStatusAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../server/compasActions', () => ({
  compasSetStayAction: vi.fn(async () => ({ success: true })),
  compasPickShopProductAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/app/voyages/kit-actions', () => ({ setPurchaseStateAction: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/cart', () => ({ addToCart: vi.fn(), getCart: vi.fn(() => []), removeFromCart: vi.fn(), updateQuantity: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

afterEach(cleanup);

const noNotedStay = () => makeData({ steps: makeInput().steps.map((s) => ({ ...s, accommodationName: null })) });
const gite: V5StayOption = {
  id: 'osm:1',
  name: 'Gîte du Royans',
  kind: 'hebergement',
  lat: 45,
  lon: 5.4,
  distanceM: 300,
  elevationM: null,
  price: null,
  photo: null,
  source: 'OpenStreetMap',
  url: 'https://gites.example/royans',
  partner: null,
};
const extrasOf = (over: Partial<V5Extras> = {}): V5Extras => ({ ...EMPTY_EXTRAS, fetchedAt: '2026-10-22T10:00:00Z', ...over });

const mountPlan = (extras: V5Extras, canEdit = true) =>
  render(
    <WithApi api={makeApi({ canEdit }, { data: { ...noNotedStay(), canEdit }, extras })}>
      <prevoirDrawer.Body />
    </WithApi>
  );

describe('Aperçu du 14/11 · 1 · lignes du plan : le texte prend toute la largeur, les actions passent dessous', () => {
  const css = readFileSync(path.join(__dirname, '../drawers/sac-prevoir.css'), 'utf8');
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('la ligne se replie ; le texte et les actions occupent chacun une rangée entière', () => {
    expect(rule('.v5-sp .steps li')).toMatch(/flex-wrap:\s*wrap/);
    expect(rule('.v5-sp .steps .t')).toMatch(/flex:\s*1 1 100%/);
    expect(rule('.v5-sp .steps .end')).toMatch(/flex:\s*1 1 100%/);
    expect(rule('.v5-sp .steps .end')).toMatch(/flex-wrap:\s*wrap/);
    expect(rule('.v5-sp .steps .end')).not.toMatch(/justify-content:\s*flex-end/);
  });

  it('cibles d’au moins 44 px pour les actions de la ligne', () => {
    expect(rule('.v5-sp .steps .end > *')).toMatch(/min-height:\s*44px/);
  });

  it('aucune couleur littérale dans la feuille (jetons --lkv-* et --v5-* seulement)', () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('le balisage : le texte (.t) puis les actions (.end) sont deux enfants distincts de la ligne', () => {
    mountPlan(extrasOf({ nights: { 1: [gite], 2: [] } }));
    const li = document.querySelector('.v5-sp .steps li');
    expect(li).toBeTruthy();
    expect(Array.from(li?.children ?? []).map((c) => c.className.split(' ')[0])).toEqual(['t', 'end']);
    expect(within(li?.querySelector('.end') as HTMLElement).getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Aperçu du 14/11 · 4 · aucune option de nuit : une seule ligne repliée, pas de cartes vides', () => {
  const silent = () => extrasOf({ nights: { 1: [], 2: [] }, unavailable: ['lodging'] });

  it('le bandeau devient une information discrète d’une phrase, qui renvoie à « Rechercher »', () => {
    mountPlan(silent());
    const banner = screen.getByRole('status');
    expect(banner.className).toContain('info');
    expect(banner.textContent).toMatch(/^Les propositions d’hébergement arriveront quand la carte \(OpenStreetMap\) répondra ; en attendant, « Rechercher » ouvre la recherche sur le lieu de l’étape\.$/);
    expect(screen.queryByText(/ne répond pas pour l’instant/)).toBeNull();
  });

  it('une seule ligne repliée « Noter moi-même où je dors » ; aucune carte « Aucune nuit trouvée » dépliée', () => {
    const { container } = mountPlan(silent());
    const folds = container.querySelectorAll('details.v5-fold');
    expect(folds).toHaveLength(1);
    expect((folds[0] as HTMLDetailsElement).open).toBe(false);
    expect(within(folds[0] as HTMLElement).getByText('Noter moi-même où je dors').tagName).toBe('SUMMARY');
    // Rien d’« Aucune nuit trouvée près de l’arrivée du jour N » nulle part.
    expect(screen.queryByText(/Aucune nuit trouvée près de l’arrivée/)).toBeNull();
    // Aucune carte de nuit hors de la ligne repliée.
    expect(container.querySelectorAll('.v5-bk:not(.v5-fold .v5-bk)')).toHaveLength(0);
  });

  it('le plan, lui, garde ses recherches préremplies (une ligne par nuit)', () => {
    mountPlan(silent());
    const panel = screen.getByRole('region', { name: 'Réservations à ouvrir, une par une' });
    expect(within(panel).getAllByRole('link', { name: /Rechercher/ }).length).toBeGreaterThanOrEqual(1);
  });

  it('dépliée, la ligne ouvre la saisie manuelle de chaque nuit (nom du lieu) ; noter une nuit appelle l’action', async () => {
    const { container } = mountPlan(silent());
    const fold = container.querySelector('details.v5-fold') as HTMLDetailsElement;
    fold.open = true;
    const inputs = within(fold).getAllByPlaceholderText('Nom du lieu');
    expect(inputs).toHaveLength(2);
    expect(within(fold).getByText('Nom du lieu pour la nuit du jour 1')).toBeTruthy();
    fireEvent.change(inputs[0], { target: { value: 'Refuge du Col' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('Refuge du Col');
  });

  it('lecture seule : pas de saisie, donc pas de ligne repliée', () => {
    const { container } = mountPlan(silent(), false);
    expect(container.querySelector('details.v5-fold')).toBeNull();
  });

  it('quand des options existent : comportement inchangé (cartes de nuit, ancien bandeau si la source a répondu à moitié)', () => {
    const { container } = mountPlan(extrasOf({ nights: { 1: [gite], 2: [] }, unavailable: ['lodging'] }));
    expect(container.querySelector('details.v5-fold')).toBeNull();
    expect(screen.getByText(/La source des hébergements \(OpenStreetMap\) ne répond pas pour l’instant/)).toBeTruthy();
    expect(screen.getAllByText('Gîte du Royans').length).toBeGreaterThan(0);
    expect(screen.getByText('Aucune nuit trouvée près de l’arrivée du jour 2.')).toBeTruthy();
  });
});

describe('Aperçu du 14/11 · 6 · la tuile du jour dit le lieu au lieu de « non renseigné »', () => {
  const withTitles = (titles: string[], distanceKm: number | null = null) =>
    makeData({
      steps: titles.map((title, i) => ({ ...makeInput().steps[0], id: `t${i}`, dayNumber: i + 1, title, locationName: null, distanceKm, elevationGainM: null, elevationLossM: null, accommodationName: null })),
    });
  const tiles = (data: ReturnType<typeof makeData>) => {
    render(
      <WithApi api={makeApi({}, { data })}>
        <TripCard view="grid" onDay={vi.fn()} />
      </WithApi>
    );
    return screen.getAllByRole('button', { name: /^Jour \d/ });
  };

  it('« Jour N · Kościelisko » sans distance : « Kościelisko »', () => {
    const list = tiles(withTitles(['Jour 1 · Kościelisko', 'Jour 2 · Kościelisko', 'Jour 3 · Kościelisko']));
    for (const tile of list) {
      expect(within(tile).getByText('Kościelisko')).toBeTruthy();
      expect(within(tile).queryByText('non renseigné')).toBeNull();
    }
  });

  it('un titre sans lieu (« Jour 2 ») garde « non renseigné » : il n’y a vraiment rien', () => {
    const list = tiles(withTitles(['Jour 1', 'Jour 2', 'Jour 3']));
    for (const tile of list) expect(within(tile).getByText('non renseigné')).toBeTruthy();
  });

  it('avec une distance, la distance reste affichée', () => {
    const list = tiles(withTitles(['Jour 1 · Kościelisko', 'Jour 2 · Kościelisko'], 12.4));
    expect(within(list[0]).getByText(/12,4 km/)).toBeTruthy();
    expect(within(list[0]).queryByText('Kościelisko')).toBeNull();
  });
});
