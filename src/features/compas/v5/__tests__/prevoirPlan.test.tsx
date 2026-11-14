// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { prevoirDrawer } from '../drawers/prevoir';
import { type V5Extras, type V5StayOption, type V5TransportOption, EMPTY_EXTRAS } from '../types';
import { makeApi, makeData, makeInput, TRIP, WithApi } from './fixtures';

/**
 * Tiroir « À prévoir » : le plan complet (tout ce qu'il faut réserver pour CE type de voyage), ouvert d'office,
 * avec son compteur, « Pas besoin », « D'où pars-tu ? » et le retour à « à faire » quand on change après avoir réservé.
 */

const choices = vi.hoisted(() => ({
  compasV5SetStayAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasV5SetTransportAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasV5SetResaStatusAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
const server = vi.hoisted(() => ({
  compasSetStayAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasPickShopProductAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
vi.mock('../server/choiceActions', () => choices);
vi.mock('../../server/compasActions', () => server);
vi.mock('@/app/voyages/kit-actions', () => ({ setPurchaseStateAction: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/cart', () => ({ addToCart: vi.fn(), getCart: vi.fn(() => []), removeFromCart: vi.fn(), updateQuantity: vi.fn() }));

const SLUG = 'vercors-novembre';

const stay = (p: Partial<V5StayOption> & { id: string; name: string }): V5StayOption => ({
  kind: 'hebergement',
  lat: 45,
  lon: 5.4,
  distanceM: 300,
  elevationM: null,
  price: null,
  photo: null,
  source: 'OpenStreetMap',
  url: null,
  partner: null,
  ...p,
});
const gite = stay({ id: 'osm:1', name: 'Gîte du Royans', url: 'https://gites.example/royans' });
const chambre = stay({ id: 'osm:4', name: 'Chambre d’hôtes Les Coulmes', url: 'https://booking.example/coulmes' });
const car: V5TransportOption = { id: 'car', label: 'Voiture', detail: null, amountEur: 64, perPerson: false, source: 'barème', url: null, partner: null };
const train: V5TransportOption = { id: 'train', label: 'Train et bus', detail: null, amountEur: 19, perPerson: true, source: 'SNCF', url: 'https://sncf.example/horaires', partner: 'SNCF Connect' };

const extrasOf = (over: Partial<V5Extras> = {}): V5Extras => ({
  nights: { 1: [gite, chambre], 2: [] },
  dayPhotos: {},
  transport: [car, train],
  fetchedAt: '2026-10-22T10:00:00Z',
  unavailable: [],
  ...over,
});

const noNotedStay = () => makeData({ steps: makeInput().steps.map((s) => ({ ...s, accommodationName: null })) });

/** Ski en Pologne depuis la France, arrivée en train : de quoi faire sortir toutes les familles de lignes du plan. */
const skiAbroad = (extra: Partial<ReturnType<typeof makeData>> = {}) =>
  makeData(
    { trip: { ...makeInput().trip, primaryActivity: 'ski', destinationName: 'Zakopane' }, steps: makeInput().steps.map((s) => ({ ...s, accommodationName: null })) },
    { countryCode: 'pl', originSaid: { name: 'Paris', lat: 48.85, lon: 2.35, countryCode: 'FR' }, originName: 'Paris', readerTravel: { nationality: 'FR', abroad: true, entry: null }, ...extra }
  );
const trainOnly = () => extrasOf({ nights: {}, transport: [train], hub: null });

function mount(overrides: Parameters<typeof makeApi>[0] = {}, opts: Parameters<typeof makeApi>[1] = {}) {
  const api = makeApi(overrides, opts);
  const view = render(
    <WithApi api={api}>
      <prevoirDrawer.Body />
    </WithApi>
  );
  return { api, ...view };
}
const runCall = (api: ReturnType<typeof makeApi>, n = 0) => (api.ctl.run as Mock).mock.calls[n] as [string, () => Promise<unknown>, (() => Promise<unknown>) | undefined];
const panelOf = () => screen.getByRole('region', { name: 'Réservations à ouvrir, une par une' });
const keysOf = (panel: HTMLElement) => within(panel).getAllByRole('listitem').map((li) => li.getAttribute('data-key'));
const rowOf = (panel: HTMLElement, key: string) => within(panel).getAllByRole('listitem').find((li) => li.getAttribute('data-key') === key)!;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('plan complet pour ce type de voyage', () => {
  it('assurance (barème), trajet, transfert, location, nuits, forfait : dans l’ordre, chacun avec son pourquoi, son moment et son prix ou « Prix sur le site »', () => {
    mount({}, { data: skiAbroad(), extras: trainOnly() });
    const panel = panelOf();
    expect(keysOf(panel)).toEqual(['extra:insurance', 'transport', 'extra:transfer', 'extra:rental-gear', 'night:1', 'night:2', 'extra:lift-pass']);
    // Assurance : prix du barème versionné, par personne, avec sa base ; « avant le départ ».
    expect(within(rowOf(panel, 'extra:insurance')).getByText(/par personne · barème Compas/)).toBeTruthy();
    expect(within(rowOf(panel, 'extra:insurance')).getByText(/Avant le départ/)).toBeTruthy();
    // Transfert : depuis la gare (aucune gare n'est devinée) jusqu'à la localité de la première étape (« A → B » : B),
    // pas le nom du voyage ; le lien est un itinéraire en transports en commun.
    expect(within(rowOf(panel, 'extra:transfer')).getByText('Rejoindre Rencurel depuis la gare')).toBeTruthy();
    expect(within(rowOf(panel, 'extra:transfer')).getByRole('link', { name: /Rechercher/ }).getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Rencurel&travelmode=transit'
    );
    // Forfait et location : jamais de prix inventé.
    expect(within(rowOf(panel, 'extra:lift-pass')).getByText('Prix sur le site')).toBeTruthy();
    expect(within(rowOf(panel, 'extra:rental-gear')).getByText('Prix sur le site')).toBeTruthy();
    expect(within(rowOf(panel, 'extra:lift-pass')).getByRole('link', { name: /Rechercher : Forfait de remontées mécaniques/ }).getAttribute('href')).toBe(
      'https://duckduckgo.com/?q=forfait%20remont%C3%A9es%20m%C3%A9caniques%20Zakopane'
    );
    // Compteur : tout est à faire.
    expect(screen.getByText('7 à réserver · 0 fait')).toBeTruthy();
  });

  it('l’aéroport lu avec les extras nomme le transfert (avion)', () => {
    const flight: V5TransportOption = { id: 'flight', label: 'Avion', detail: null, amountEur: 180, perPerson: true, source: 'barème', url: null, partner: null };
    mount({}, { data: skiAbroad(), extras: extrasOf({ nights: {}, transport: [flight], hub: { iata: 'KRK', name: 'Kraków John Paul II International Airport' } }) });
    expect(within(rowOf(panelOf(), 'extra:transfer')).getByText('Rejoindre Rencurel depuis Kraków John Paul II International Airport')).toBeTruthy();
  });

  it('un voyage sans besoin particulier n’a aucune ligne superflue : rando à la journée en France, en voiture', () => {
    mount({}, { data: makeData({ steps: [makeInput().steps[0]] }), extras: extrasOf({ nights: {}, transport: [car] }) });
    expect(keysOf(panelOf())).toEqual(['transport']);
  });

  it('« J’ai réservé » sur une ligne du plan range `extra:<clé>` ; le compteur suit', async () => {
    mount({}, { data: skiAbroad(), extras: trainOnly() });
    fireEvent.click(within(panelOf()).getByRole('button', { name: 'J’ai réservé : Assurance voyage et rapatriement' }));
    await waitFor(() => expect(choices.compasV5SetResaStatusAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, keys: ['extra:insurance'], status: 'booked' }));
    await waitFor(() => expect(screen.getByText('6 à réserver · 1 fait')).toBeTruthy());
  });

  it('« Pas besoin » masque la ligne (statut skipped rangé), le dit ; annuler la remet', async () => {
    const { api } = mount({}, { data: skiAbroad(), extras: trainOnly() });
    const panel = panelOf();
    fireEvent.click(within(panel).getByRole('button', { name: 'Pas besoin : Forfait de remontées mécaniques' }));
    await waitFor(() => expect(choices.compasV5SetResaStatusAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, keys: ['extra:lift-pass'], status: 'skipped' }));
    expect(runCall(api)[0]).toBe('Masqué : Forfait de remontées mécaniques');
    await waitFor(() => expect(keysOf(panel)).not.toContain('extra:lift-pass'));
    expect(screen.getByText('6 à réserver · 0 fait')).toBeTruthy();
    expect(screen.getByText('1 ligne masquée')).toBeTruthy();
    await runCall(api)[2]!();
    expect(choices.compasV5SetResaStatusAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, keys: ['extra:lift-pass'], status: 'todo' });
    await waitFor(() => expect(keysOf(panel)).toContain('extra:lift-pass'));
  });

  it('« Pas besoin » refusé par le serveur : la ligne reste', async () => {
    choices.compasV5SetResaStatusAction.mockResolvedValueOnce({ success: false, error: 'Droits insuffisants' } as never);
    mount({}, { data: skiAbroad(), extras: trainOnly() });
    const panel = panelOf();
    fireEvent.click(within(panel).getByRole('button', { name: 'Pas besoin : Forfait de remontées mécaniques' }));
    await waitFor(() => expect(choices.compasV5SetResaStatusAction).toHaveBeenCalled());
    await waitFor(() => expect(keysOf(panel)).toContain('extra:lift-pass'));
  });

  it('« Tout remettre » rétablit toutes les lignes masquées en une écriture', async () => {
    mount({ resa: { 'extra:lift-pass': 'skipped', 'extra:rental-gear': 'skipped' } }, { data: skiAbroad(), extras: trainOnly() });
    const panel = panelOf();
    expect(keysOf(panel)).not.toContain('extra:lift-pass');
    expect(screen.getByText('2 lignes masquées')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remettre toutes les lignes masquées dans la liste' }));
    await waitFor(() =>
      expect(choices.compasV5SetResaStatusAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, keys: ['extra:rental-gear', 'extra:lift-pass'], status: 'todo' })
    );
    await waitFor(() => expect(keysOf(panel)).toContain('extra:lift-pass'));
  });

  it('une ligne du plan est relue comme réservée au rechargement ; une nuit ne se masque pas', () => {
    mount({ resa: { 'extra:insurance': 'booked', 'night:1': 'skipped' } }, { data: skiAbroad(), extras: trainOnly() });
    const panel = panelOf();
    expect(within(rowOf(panel, 'extra:insurance')).getByText('Réservation faite')).toBeTruthy();
    expect(within(rowOf(panel, 'night:1')).queryByRole('button', { name: /Pas besoin/ })).toBeNull();
  });

  it('lecture seule : on voit le plan, aucun bouton d’écriture', () => {
    mount({ canEdit: false }, { data: skiAbroad({ canEdit: false }), extras: trainOnly() });
    const panel = panelOf();
    expect(within(panel).queryAllByRole('button')).toEqual([]);
    expect(within(panel).getAllByRole('listitem').length).toBeGreaterThan(3);
  });

  it('axe-core : 0 violation WCAG avec le plan complet', async () => {
    const { container } = mount({}, { data: skiAbroad(), extras: trainOnly() });
    const results = await axe.run(container as HTMLElement, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});

describe('« D’où pars-tu ? » quand le départ est inconnu', () => {
  it('première ligne du plan ; le bouton ouvre « Dis-le » sur « Depuis » (le parcours existant), sans la compter comme réservation', () => {
    const { api } = mount({}, { data: noNotedStay(), extras: extrasOf({ transport: [] }) });
    const items = within(panelOf()).getAllByRole('listitem');
    expect(items[0].getAttribute('data-key')).toBe('origin');
    expect(within(items[0]).getByText('D’où pars-tu ?')).toBeTruthy();
    fireEvent.click(within(items[0]).getByRole('button', { name: 'Dire d’où je pars' }));
    expect(api.openSay).toHaveBeenCalledWith('Depuis ');
    expect(screen.getByText('2 à réserver · 0 fait')).toBeTruthy();
  });

  it('pas de question quand le départ est dit', () => {
    mount({}, { data: makeData({}, { originName: 'Lyon', originSaid: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' } }), extras: extrasOf({ transport: [] }) });
    expect(document.querySelector('[data-key="origin"]')).toBeNull();
  });

  it('pas de question quand un trajet existe', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf({ transport: [car] }) });
    expect(document.querySelector('[data-key="origin"]')).toBeNull();
  });

  it('pas de question tant que les extras ne sont pas lus', () => {
    mount({}, { data: noNotedStay(), extras: EMPTY_EXTRAS });
    expect(document.querySelector('[data-key="origin"]')).toBeNull();
  });

  it('pas de bouton en lecture seule', () => {
    mount({ canEdit: false }, { data: { ...noNotedStay(), canEdit: false }, extras: extrasOf({ transport: [] }) });
    expect(document.querySelector('[data-key="origin"]')).toBeNull();
  });
});

describe('changer après « J’ai réservé »', () => {
  it('autre hébergement pour une nuit réservée : « à faire » à l’écran ; annuler rétablit « réservé »', async () => {
    const { api } = mount({ resa: { 'night:1': 'booked' } }, { extras: extrasOf() });
    const setResa = api.setResa as Mock;
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Chambre d’hôtes Les Coulmes pour la nuit du jour 1' }));
    await waitFor(() => expect(choices.compasV5SetStayAction).toHaveBeenCalled());
    await waitFor(() => expect(setResa).toHaveBeenCalledWith({ 'night:1': 'todo' }));
    await runCall(api)[2]!();
    expect(choices.compasV5SetResaStatusAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'booked' });
    expect(setResa).toHaveBeenLastCalledWith({ 'night:1': 'booked' });
  });

  it('nuit seulement « à faire » : changer d’hébergement n’écrit aucun statut', async () => {
    const { api } = mount({}, { extras: extrasOf() });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Chambre d’hôtes Les Coulmes pour la nuit du jour 1' }));
    await waitFor(() => expect(choices.compasV5SetStayAction).toHaveBeenCalled());
    expect(choices.compasV5SetResaStatusAction).not.toHaveBeenCalled();
    expect(api.setResa).not.toHaveBeenCalled();
  });

  it('nuit réservée puis nuit notée à la main : l’autre action ne touche pas au statut, donc il est repassé à « à faire » ici', async () => {
    const data = noNotedStay();
    const { api } = mount({ resa: { 'night:1': 'booked' } }, { data, extras: extrasOf({ nights: {} }) });
    const input = screen.getByLabelText('Nom du lieu pour la nuit du jour 1');
    fireEvent.change(input, { target: { value: 'Chez Marie' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(server.compasSetStayAction).toHaveBeenCalled());
    await runCall(api)[1]();
    expect(choices.compasV5SetResaStatusAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, key: 'night:1', status: 'todo' });
  });

  it('autre mode de trajet pour un trajet réservé : « à faire » à l’écran', async () => {
    const withChoice = { choices: { transport: { id: 'car', amountEur: 64, perPerson: false, source: 'x' }, stays: {}, resa: {} } } as Partial<V5Extras>;
    const { api } = mount({ resa: { transport: 'booked' } }, { extras: extrasOf(withChoice) });
    fireEvent.click(screen.getAllByRole('button', { name: 'Choisir le trajet : Train et bus' })[0]);
    await waitFor(() => expect(choices.compasV5SetTransportAction).toHaveBeenCalled());
    await waitFor(() => expect(api.setResa as Mock).toHaveBeenCalledWith({ transport: 'todo' }));
  });
});
