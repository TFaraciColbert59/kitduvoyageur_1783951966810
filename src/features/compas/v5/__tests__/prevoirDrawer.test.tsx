// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { prevoirDrawer } from '../drawers/prevoir';
import { EMPTY_EXTRAS, type V5Extras, type V5Photo, type V5StayOption, type V5TransportOption } from '../types';
import { makeApi, makeData, makeInput, TRIP, WithApi } from './fixtures';

const choices = vi.hoisted(() => ({
  compasV5SetStayAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasV5SetTransportAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
const server = vi.hoisted(() => ({
  compasSetStayAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasPickShopProductAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
const kit = vi.hoisted(() => ({ setPurchaseStateAction: vi.fn(async (..._args: unknown[]) => ({ success: true })) }));
const cart = vi.hoisted(() => ({
  addToCart: vi.fn(),
  getCart: vi.fn(() => [] as Array<{ id: string; quantity: number }>),
  removeFromCart: vi.fn(),
  updateQuantity: vi.fn(),
}));
vi.mock('../server/choiceActions', () => choices);
vi.mock('../../server/compasActions', () => server);
vi.mock('@/app/voyages/kit-actions', () => kit);
vi.mock('@/lib/cart', () => cart);

const SLUG = 'vercors-novembre';

const photo: V5Photo = { url: 'https://upload.wikimedia.org/royans.jpg', credit: 'Jean Photographe', license: 'CC BY-SA 4.0', pageUrl: 'https://commons.wikimedia.org/wiki/File:Royans.jpg' };

function stay(p: Partial<V5StayOption> & { id: string; name: string }): V5StayOption {
  return { kind: 'hebergement', lat: 45, lon: 5.4, distanceM: 300, elevationM: null, price: null, photo: null, source: 'OpenStreetMap', url: null, partner: null, ...p };
}
const gite = stay({ id: 'osm:1', name: 'Gîte du Royans', photo, price: { perPerson: 38, currency: 'EUR', basis: 'bareme', asOf: '2026-10-20' }, url: 'https://gites.example/royans' });
const chambre = stay({ id: 'osm:4', name: 'Chambre d’hôtes Les Coulmes', price: { perPerson: 46, currency: 'EUR', basis: 'partenaire', asOf: '2026-10-21' }, url: 'https://booking.example/coulmes', partner: 'Booking.com' });
const camping = stay({ id: 'osm:3', name: 'Camping des Écouges', kind: 'camping', distanceM: 2500 });
const refuge = stay({ id: 'osm:2', name: 'Refuge de la Molière', kind: 'refuge', distanceM: 4000, price: { perPerson: 24, currency: 'EUR', basis: 'bareme', asOf: '2026-10-20' }, url: 'https://refuges.example/moliere' });

const car: V5TransportOption = { id: 'car', label: 'Voiture', detail: '1 h 45 depuis Lyon', amountEur: 64, perPerson: false, source: 'barème carburant du 20 oct.', url: null, partner: null };
const train: V5TransportOption = { id: 'train', label: 'Train et bus', detail: 'Lyon → Saint-Marcellin', amountEur: 19, perPerson: true, source: 'SNCF', url: 'https://sncf.example/horaires', partner: 'SNCF Connect' };

const extrasOf = (over: Partial<V5Extras> = {}): V5Extras => ({
  nights: { 1: [gite, chambre, camping], 2: [refuge] },
  dayPhotos: {},
  transport: [car, train],
  fetchedAt: '2026-10-22T10:00:00Z',
  unavailable: [],
  ...over,
});

/** Aucune nuit encore notée (la fixture note le gîte du jour 1). */
const noNotedStay = () => makeData({ steps: makeInput().steps.map((s) => ({ ...s, accommodationName: null })) });

beforeEach(() => {
  cart.getCart.mockReturnValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

async function scan(root: Element): Promise<string[]> {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

describe('capsule et titre', () => {
  it('deux onglets en icônes : à réserver, à acheter', () => {
    const api = makeApi();
    expect(prevoirDrawer.space).toBe('prevoir');
    expect(prevoirDrawer.tabs(api).map((t) => [t.icon, t.label])).toEqual([
      ['bed', 'À réserver'],
      ['cart', 'À acheter'],
    ]);
    expect(prevoirDrawer.title(makeApi({ tab: 1 }))).toBe('À acheter');
    expect(prevoirDrawer.subtitle(makeApi({ tab: 0 }))).toBe('2 nuits');
    expect(prevoirDrawer.subtitle(makeApi({ tab: 1 }))).toBe('4 objets à acheter');
  });
});

describe('À réserver · extras vides ou indisponibles', () => {
  it('extras pas encore lus : le dit, reste utilisable, la nuit notée à la main est possible', async () => {
    const { api } = mount({}, { data: noNotedStay(), extras: EMPTY_EXTRAS });
    expect(screen.getByText(/n’ont pas encore été lus/)).toBeTruthy();
    expect(screen.getByText('Aucune nuit trouvée près de l’arrivée du jour 1.')).toBeTruthy();
    expect(screen.getByText('Aucun trajet proposé pour ce voyage.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tout réserver' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Rien n’est encore choisi : le total apparaît dès qu’une nuit ou un trajet l’est.')).toBeTruthy();

    expect(screen.getAllByRole('form', { name: 'Noter une nuit toi-même' })).toHaveLength(2);
    const input = screen.getByLabelText('Nom du lieu pour la nuit du jour 1');
    fireEvent.change(input, { target: { value: 'Chez Marie' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(server.compasSetStayAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 1, name: 'Chez Marie' }));
    const [message, , undo] = runCall(api);
    expect(message).toBe('Nuit du jour 1 : Chez Marie');
    await undo!();
    expect(server.compasSetStayAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 1, name: '' });
  });

  it('hébergements injoignables : message clair, rien n’est comblé', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf({ nights: {}, unavailable: ['lodging', 'photos', 'transport'], transport: [] }) });
    expect(screen.getByText(/OpenStreetMap\) ne répond pas pour l’instant/)).toBeTruthy();
    expect(screen.getByText(/Les photos ne sont pas disponibles/)).toBeTruthy();
    expect(screen.getByText('La source des trajets ne répond pas pour l’instant. Rien n’est comblé.')).toBeTruthy();
    expect(screen.getAllByLabelText(/Nom du lieu pour la nuit du jour/)).toHaveLength(2);
  });

  it('une nuit déjà notée reste affichée même sans extras', () => {
    mount({}, { extras: EMPTY_EXTRAS });
    expect(screen.getByText('Gîte du Royans')).toBeTruthy();
    expect(screen.getByText(/Notée par toi/)).toBeTruthy();
    expect(screen.getByText('prix non renseigné')).toBeTruthy();
  });

  it('un voyage d’un jour n’a pas de nuit', () => {
    const base = makeInput();
    mount({}, { data: makeData({ steps: [base.steps[0]] }), extras: extrasOf() });
    expect(screen.getByText('Ce voyage n’a pas de nuit à prévoir.')).toBeTruthy();
  });
});

describe('À réserver · nuits', () => {
  it('grande carte : photo de la nuit proposée avec son crédit, prix par personne × groupe et sa source datée', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf() });
    const card = document.querySelector('[data-day="1"]') as HTMLElement;
    const img = card.querySelector('.bh img') as HTMLImageElement;
    expect(img.alt).toBe('Gîte du Royans');
    expect(img.src).toBe(photo.url);
    expect(within(card).getByRole('link', { name: 'Jean Photographe · CC BY-SA 4.0' }).getAttribute('href')).toBe(photo.pageUrl);
    expect(within(card).getByText('38 € × 4 pers.')).toBeTruthy();
    expect(within(card).getByText(/à 300 m de l’arrivée · Hébergement/)).toBeTruthy();
    expect(within(card).getByText(/Source : OpenStreetMap/)).toBeTruthy();
    expect(within(card).getByText(/Repère de barème au/)).toBeTruthy();
    expect(within(card).getByText('Proposée')).toBeTruthy();
  });

  it('sans photo : une illustration sobre, jamais la photo d’un autre lieu', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf() });
    const card = document.querySelector('[data-day="2"]') as HTMLElement;
    expect(within(card).queryAllByRole('img').filter((el) => el.tagName === 'IMG')).toEqual([]);
    expect(card.querySelector('.ill')).not.toBeNull();
    expect(within(card).getByText('Refuge de la Molière')).toBeTruthy();
  });

  it('alternatives en vignettes : aria-pressed seulement sur le choix fait, prix de chaque vignette', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf() });
    const list = screen.getByRole('list', { name: 'Nuits possibles pour la nuit du jour 1' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(within(list).getByText('46 €')).toBeTruthy();
    expect(within(list).getAllByText('prix non renseigné')).toHaveLength(1);
  });

  it('choisir une alternative : compasV5SetStayAction avec la nuit, annonce, annulation vers l’état d’avant', async () => {
    const { api } = mount({}, { data: noNotedStay(), extras: extrasOf() });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Chambre d’hôtes Les Coulmes pour la nuit du jour 1' }));
    await waitFor(() => expect(choices.compasV5SetStayAction).toHaveBeenCalled());
    expect(choices.compasV5SetStayAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 1, option: chambre });
    const [message, , undo] = runCall(api);
    expect(message).toBe('Nuit du jour 1 : Chambre d’hôtes Les Coulmes');
    await undo!();
    expect(choices.compasV5SetStayAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 1, option: null });
  });

  it('« Choisir » sur la carte montre la nuit proposée ; l’annulation rétablit la nuit précédente', async () => {
    const { api } = mount({}, { extras: extrasOf() });
    // Le gîte du jour 1 est déjà noté : choisir le camping le remplace ; annuler le remet.
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Camping des Écouges pour la nuit du jour 1' }));
    await waitFor(() => expect(choices.compasV5SetStayAction).toHaveBeenCalled());
    expect((choices.compasV5SetStayAction.mock.calls[0][0] as { option: V5StayOption }).option.id).toBe('osm:3');
    await runCall(api)[2]!();
    const restored = (choices.compasV5SetStayAction.mock.calls[1][0] as { option: V5StayOption }).option;
    expect(restored.id).toBe('osm:1');
  });

  it('la nuit choisie est pressée ; « Retirer » écrit null et s’annule', async () => {
    const { api } = mount({}, { extras: extrasOf() });
    const list = screen.getByRole('list', { name: 'Nuits possibles pour la nuit du jour 1' });
    expect(within(list).getByRole('button', { name: /Gîte du Royans/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('Ton choix · à confirmer').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le choix de la nuit du jour 1' }));
    await waitFor(() => expect(choices.compasV5SetStayAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 1, option: null }));
    expect(runCall(api)[0]).toBe('Nuit du jour 1 retirée');
    await runCall(api)[2]!();
    expect((choices.compasV5SetStayAction.mock.calls[1][0] as { option: V5StayOption }).option.id).toBe('osm:1');
  });

  it('« Choisir » sur la nuit proposée écrit ce choix', async () => {
    mount({}, { data: noNotedStay(), extras: extrasOf() });
    const card = document.querySelector('[data-day="2"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Choisir Refuge de la Molière pour la nuit du jour 2' }));
    await waitFor(() => expect(choices.compasV5SetStayAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 2, option: refuge }));
  });

  it('une écriture refusée par le serveur n’est pas présentée comme faite', async () => {
    choices.compasV5SetStayAction.mockResolvedValueOnce({ success: false, error: 'Droits insuffisants' } as never);
    const { api } = mount({}, { data: noNotedStay(), extras: extrasOf() });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Camping des Écouges pour la nuit du jour 1' }));
    await waitFor(() => expect(api.ctl.run).toHaveBeenCalled());
    expect(screen.queryByText('Réservation faite')).toBeNull();
  });
});

describe('À réserver · trajet', () => {
  it('options du serveur, prix total ou par personne, sources', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf() });
    const card = document.querySelector('[data-kind="transport"]') as HTMLElement;
    expect(card.querySelector('.ill b')?.textContent).toBe('Voiture');
    expect(within(card).getAllByText('64 € au total').length).toBeGreaterThan(0);
    expect(within(card).getByText('19 € par personne')).toBeTruthy();
    expect(within(card).getByText('Source : barème carburant du 20 oct.')).toBeTruthy();
  });

  it('choisir un trajet écrit par compasV5SetTransportAction et alimente le total', async () => {
    mount({}, { data: noNotedStay(), extras: extrasOf() });
    expect(screen.getByText('Rien n’est encore choisi : le total apparaît dès qu’une nuit ou un trajet l’est.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choisir le trajet : Train et bus' }));
    await waitFor(() => expect(choices.compasV5SetTransportAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, transport: { id: 'train', amountEur: 19, perPerson: true, source: 'SNCF' } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choisir le trajet : Train et bus' }).getAttribute('aria-pressed')).toBe('true'));
    // 19 € par personne × 4 personnes
    const total = screen.getByRole('group', { name: 'Total des réservations' });
    expect(within(total).getByText('Trajet').nextElementSibling?.textContent).toMatch(/^76\s€$/);
  });

  it('le trajet déjà écrit est relu au rechargement et compte dans le total', () => {
    const persisted = extrasOf({ choices: { transport: { id: 'train', amountEur: 19, perPerson: true, source: 'SNCF' }, stays: {} } } as Partial<V5Extras>);
    mount({}, { data: noNotedStay(), extras: persisted });
    expect(screen.getByRole('button', { name: 'Choisir le trajet : Train et bus' }).getAttribute('aria-pressed')).toBe('true');
    const total = screen.getByRole('group', { name: 'Total des réservations' });
    expect(within(total).getByText('Trajet').nextElementSibling?.textContent).toMatch(/^76\s€$/);
  });

  it('changer de trajet s’annule vers le précédent', async () => {
    const { api } = mount({}, { data: noNotedStay(), extras: extrasOf() });
    const pick = (label: string) => screen.getAllByRole('button', { name: `Choisir le trajet : ${label}` })[0];
    fireEvent.click(pick('Voiture'));
    await waitFor(() => expect(choices.compasV5SetTransportAction).toHaveBeenCalledTimes(1));
    expect(runCall(api)[2]).toBeUndefined();
    await waitFor(() => expect(pick('Voiture').getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(pick('Train et bus'));
    await waitFor(() => expect(choices.compasV5SetTransportAction).toHaveBeenCalledTimes(2));
    await runCall(api, 1)[2]!();
    expect(choices.compasV5SetTransportAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, transport: { id: 'car', amountEur: 64, perPerson: false, source: 'barème carburant du 20 oct.' } });
  });

  it('trajet sans prix : « prix non renseigné », compté comme choix sans prix', async () => {
    const bus: V5TransportOption = { id: 'carpool', label: 'Covoiturage', detail: null, amountEur: null, perPerson: true, source: 'BlaBlaCar', url: null, partner: null };
    mount({}, { data: noNotedStay(), extras: extrasOf({ transport: [bus] }) });
    expect(screen.getAllByText('prix non renseigné').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Choisir le trajet : Covoiturage' }));
    await screen.findByText('1 choix sans prix renseigné, non compté');
  });
});

describe('À réserver · total et « Tout réserver »', () => {
  it('total des nuits choisies par personne × groupe, par personne, et repères de barème dits', () => {
    mount({}, { extras: extrasOf() });
    // Jour 1 noté : gîte à 38 € × 4 = 152 € (repère de barème).
    const total = screen.getByText('Total des réservations').closest('.v5-tot') as HTMLElement;
    const amount = (label: string) => within(total).getByText(label).nextElementSibling?.textContent?.replace(/\s/g, ' ');
    expect(amount('Nuits')).toBe('152 €');
    expect(amount('Total')).toBe('152 €');
    expect(amount('Par personne')).toBe('38 €');
    expect(within(total).getByText(/repères de barème ne sont pas les tarifs/)).toBeTruthy();
  });

  it('le panneau reste fermé tant qu’on ne l’ouvre pas, et rien ne s’ouvre seul', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mount({}, { extras: extrasOf() });
    const button = screen.getByRole('button', { name: /Tout réserver/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Réservations à ouvrir, une par une' })).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('un lien par choix, dans l’ordre, ouvert par la personne dans un nouvel onglet, partenaire signalé', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const noted = makeData({ steps: makeInput().steps.map((s) => (s.dayNumber === 2 ? { ...s, accommodationName: 'Refuge de la Molière' } : s)) });
    mount({}, { data: noted, extras: extrasOf() });
    fireEvent.click(screen.getAllByRole('button', { name: 'Choisir le trajet : Train et bus' })[0]);
    await waitFor(() => expect(choices.compasV5SetTransportAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Choisir le trajet : Train et bus' })[0].getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: /Tout réserver/ }));
    const panel = screen.getByRole('region', { name: 'Réservations à ouvrir, une par une' });
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    const links = within(panel).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://gites.example/royans', 'https://refuges.example/moliere', 'https://sncf.example/horaires']);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
    // Le lien du partenaire SNCF Connect est balisé ; les sites officiels non.
    expect(links[2].getAttribute('rel')).toBe('sponsored nofollow noopener');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(panel).getByText(/SNCF Connect/)).toBeTruthy();
    expect(screen.getByText(/Le Compas ne réserve ni ne paie rien/)).toBeTruthy();
    // Les clics n'ont rien confirmé : toutes les étapes restent « à confirmer ».
    expect(within(panel).queryByText('Réservation faite')).toBeNull();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('« J’ai réservé » note la nuit par compasSetStayAction et passe l’étape à « Réservation faite »', async () => {
    const { api } = mount({}, { extras: extrasOf() });
    fireEvent.click(screen.getByRole('button', { name: /Tout réserver/ }));
    const panel = screen.getByRole('region', { name: 'Réservations à ouvrir, une par une' });
    fireEvent.click(within(panel).getByRole('button', { name: 'J’ai réservé : Gîte du Royans' }));
    await waitFor(() => expect(server.compasSetStayAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, day: 1, name: 'Gîte du Royans' }));
    expect(runCall(api)[0]).toBe('Réservation faite : Gîte du Royans');
    await waitFor(() => expect(within(panel).getByText('Réservation faite')).toBeTruthy());
    expect(screen.getByText('Tout est noté comme réservé.')).toBeTruthy();
  });

  it('un choix sans lien est listé sans lien, avec la conduite à tenir', () => {
    mount({}, { extras: extrasOf({ nights: { 1: [camping] } }), data: makeData({ steps: makeInput().steps.map((s) => (s.dayNumber === 1 ? { ...s, accommodationName: 'Camping des Écouges' } : s)) }) });
    fireEvent.click(screen.getByRole('button', { name: /Tout réserver/ }));
    const panel = screen.getByRole('region', { name: 'Réservations à ouvrir, une par une' });
    expect(within(panel).queryAllByRole('link')).toEqual([]);
    expect(within(panel).getByText(/Pas de lien : à réserver directement/)).toBeTruthy();
  });

  it('un lien non https n’est jamais proposé', () => {
    const bad = stay({ id: 'osm:9', name: 'Gîte douteux', url: 'javascript:alert(1)' });
    mount({}, { extras: extrasOf({ nights: { 1: [bad] } }), data: makeData({ steps: makeInput().steps.map((s) => (s.dayNumber === 1 ? { ...s, accommodationName: 'Gîte douteux' } : s)) }) });
    fireEvent.click(screen.getByRole('button', { name: /Tout réserver/ }));
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });
});

describe('À réserver · mentions, mode test, réservations réelles', () => {
  it('mention partenaire quand une option est un lien partenaire, absente sinon', () => {
    const { unmount } = mount({}, { data: noNotedStay(), extras: extrasOf() });
    expect(document.querySelector('.cp-aff')).not.toBeNull();
    unmount();
    cleanup();
    mount({}, { data: noNotedStay(), extras: extrasOf({ nights: { 1: [gite] }, transport: [car] }) });
    expect(document.querySelector('.cp-aff')).toBeNull();
  });

  it('le lien partenaire d’une carte est balisé sponsored nofollow noopener, ouvert dans un nouvel onglet', () => {
    mount({}, { data: noNotedStay(), extras: extrasOf({ nights: { 1: [chambre] } }) });
    const link = screen.getByRole('link', { name: /Voir chez Booking\.com : Chambre d’hôtes Les Coulmes/ });
    expect(link.getAttribute('rel')).toBe('sponsored nofollow noopener');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/Tarif du partenaire au/)).toBeTruthy();
  });

  it('un fournisseur en mode test est toujours signalé', () => {
    mount({}, { data: makeData({}, { providers: { routestack: 'sandbox', viator: 'sandbox' } }), extras: extrasOf() });
    expect(screen.getByText(/Mode test du fournisseur RouteStack/)).toBeTruthy();
    expect(screen.getByText(/Mode test du fournisseur Viator/)).toBeTruthy();
    cleanup();
    mount({}, { data: makeData({}, { providers: { routestack: 'live', viator: 'disabled' } }), extras: extrasOf() });
    expect(screen.queryByText(/Mode test du fournisseur/)).toBeNull();
  });

  it('réservations réelles enregistrées : listées avec leur état, les annulées écartées', () => {
    const bookings = [
      { id: 'b1', vertical: 'hotel', provider: 'routestack', status: 'confirmed', amountEur: 120 },
      { id: 'b2', vertical: 'flight', provider: 'affiliate', status: 'cancelled', amountEur: 300 },
    ];
    mount({}, { data: makeData({ bookings }, { bookings }), extras: extrasOf() });
    expect(screen.getByText('Réservations enregistrées')).toBeTruthy();
    expect(screen.getByText('RouteStack · Confirmée')).toBeTruthy();
    expect(screen.getByText('120 €')).toBeTruthy();
    expect(screen.queryByText('Vol')).toBeNull();
  });

  it('lecture seule : on voit tout, rien ne s’écrit', () => {
    const { api } = mount({}, { data: makeData({}, { canEdit: false }), extras: extrasOf() });
    expect(screen.getByText('Lecture seule : tu peux voir ce qui est prévu, pas le modifier.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Choisir/ }).every((b) => b.hasAttribute('disabled'))).toBe(true);
    expect(screen.queryByRole('button', { name: /J’ai réservé/ })).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    const pressed = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(pressed.every((b) => b.hasAttribute('disabled'))).toBe(true);
    expect(api.ctl.run).not.toHaveBeenCalled();
  });

  it('axe-core : 0 violation WCAG, panneau « Tout réserver » ouvert compris', async () => {
    const { container } = mount({}, { extras: extrasOf({ nights: { 1: [gite, chambre], 2: [refuge] } }) });
    expect(await scan(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Tout réserver/ }));
    expect(await scan(container)).toEqual([]);
  });

  it('axe-core : 0 violation WCAG avec des extras vides', async () => {
    const { container } = mount({}, { data: noNotedStay(), extras: EMPTY_EXTRAS });
    expect(await scan(container)).toEqual([]);
  });
});

describe('À acheter', () => {
  const shop = [
    { id: '66666666-6666-4666-8666-666666666666', slug: 'trousse-secours', mode: 'achat' as const, name: 'Trousse de secours randonnée', brand: 'Forclaz', category: 'Sécurité', weightG: 260, priceEur: 24.9, pricePerDay: null, rating: 4.6, reviewCount: 120, image: 'https://cdn.example/trousse.jpg', imageAlt: 'Trousse de secours rouge' },
  ];
  const dataWithShop = (extra: Parameters<typeof makeData>[1] = {}) => makeData({}, { shop, ...extra });

  it('un objet à acheter par carte : photo du catalogue, produit réel, prix, source boutique', () => {
    mount({ tab: 1 }, { data: dataWithShop() });
    const card = screen.getByText('Trousse de secours').closest('li') as HTMLElement;
    expect((within(card).getByRole('img', { name: 'Trousse de secours rouge' }) as HTMLImageElement).src).toBe('https://cdn.example/trousse.jpg');
    expect(within(card).getByText('Trousse de secours randonnée · 24,90 €')).toBeTruthy();
    expect(screen.getByText('24,90 € en boutique LKDV · 3 objets sans prix renseigné')).toBeTruthy();
  });

  it('sans produit correspondant : le dit, sans prix inventé', () => {
    mount({ tab: 1 }, { data: makeData({}, { shop: [] }) });
    const card = screen.getByText('Trousse de secours').closest('li') as HTMLElement;
    expect(within(card).getByText('Aucun produit de la boutique ne correspond pour l’instant.')).toBeTruthy();
    expect(card.querySelector('.th .fb')).not.toBeNull();
    expect(screen.getByText('4 objets sans prix renseigné')).toBeTruthy();
  });

  it('boutique LKDV : relie le produit, met dans le panier, annonce et sait s’annuler', async () => {
    const { api } = mount({ tab: 1 }, { data: dataWithShop() });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir Trousse de secours randonnée en boutique LKDV pour Trousse de secours' }));
    await waitFor(() => expect(server.compasPickShopProductAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, itemId: 'i3', shopProductId: shop[0].id }));
    expect(runCall(api)[0]).toBe('Trousse de secours : choisi en boutique, dans le panier');
    await waitFor(() => expect(cart.addToCart).toHaveBeenCalled());
    expect(cart.addToCart.mock.calls[0][0]).toMatchObject({ id: shop[0].id, slug: 'trousse-secours', priceEur: 24.9 });
    await runCall(api)[2]!();
    expect(cart.removeFromCart).toHaveBeenCalledWith(shop[0].id);
    expect(kit.setPurchaseStateAction).toHaveBeenLastCalledWith('i3', 'needed', SLUG);
  });

  it('rien n’est acheté ni payé sans geste : aucun appel à l’ouverture', () => {
    mount({ tab: 1 }, { data: dataWithShop() });
    expect(server.compasPickShopProductAction).not.toHaveBeenCalled();
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(kit.setPurchaseStateAction).not.toHaveBeenCalled();
    expect(screen.getByText(/rien n’est payé sans ton geste/)).toBeTruthy();
  });

  it('dans le panier : état dit, choix pressé, lien vers le panier', () => {
    const data = makeData({ items: makeInput().items.map((i) => (i.id === 'i3' ? { ...i, purchaseState: 'in_cart', shopProductId: shop[0].id } : i)) }, { shop });
    mount({ tab: 1 }, { data });
    const card = screen.getByText('Trousse de secours').closest('li') as HTMLElement;
    expect(within(card).getByText('Dans le panier · Trousse de secours randonnée')).toBeTruthy();
    const store = within(card).getByRole('button', { name: /en boutique LKDV/ });
    expect(store.getAttribute('aria-pressed')).toBe('true');
    expect(store.hasAttribute('disabled')).toBe(true);
    expect(within(card).getByRole('link', { name: 'Voir le panier' }).getAttribute('href')).toBe('/panier');
  });

  it('« Déjà acheté » écrit par setPurchaseStateAction et s’annule vers l’état d’avant', async () => {
    const { api } = mount({ tab: 1 }, { data: dataWithShop() });
    fireEvent.click(screen.getByRole('button', { name: 'Déjà acheté : Trousse de secours' }));
    await waitFor(() => expect(kit.setPurchaseStateAction).toHaveBeenCalledWith('i3', 'added', SLUG));
    expect(runCall(api)[0]).toBe('Trousse de secours : déjà acheté');
    await runCall(api)[2]!();
    expect(kit.setPurchaseStateAction).toHaveBeenLastCalledWith('i3', 'needed', SLUG);
  });

  it('emprunter (groupe) et autre produit ouvrent les flux existants ; en solo, pas d’emprunt', () => {
    const { api } = mount({ tab: 1 }, { data: dataWithShop() });
    fireEvent.click(screen.getByRole('button', { name: 'Emprunter : Trousse de secours' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'acquire', lineId: 'i3', mode: 'emprunter' });
    fireEvent.click(screen.getByRole('button', { name: 'Chercher un autre produit pour Trousse de secours' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'acquire', lineId: 'i3', mode: 'acheter' });
    cleanup();
    const base = makeInput();
    mount({ tab: 1 }, { data: makeData({ trip: { ...base.trip, partySize: 1 }, members: [base.members[0]] }, { shop }) });
    expect(screen.queryByRole('button', { name: /Emprunter/ })).toBeNull();
  });

  it('magasin repéré sur la route : nom, distance et limites dites, lien vers le jour', () => {
    const data = dataWithShop({
      points: [...makeData().points, { id: 'p1', lat: 45.001, lon: 5.4, label: 'Épicerie du village', category: 'commerce', kind: 'poi' as const }],
    });
    const { api } = mount({ tab: 1 }, { data });
    expect(screen.getByText(/Épicerie du village, à 111 m de l’arrivée du jour 1\. Assortiment et prix non renseignés/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voir le jour 1' }));
    expect(api.openSpace).toHaveBeenCalledWith('day', { day: 0 });
  });

  it('rien à acheter : état vide', () => {
    const data = makeData({ items: makeInput().items.map((i) => ({ ...i, isPacked: true })) });
    mount({ tab: 1 }, { data });
    expect(screen.getByText('Rien à acheter')).toBeTruthy();
    expect(screen.getByText('Tout est dans ton sac.')).toBeTruthy();
  });

  it('lecture seule : aucune action d’achat', () => {
    mount({ tab: 1 }, { data: dataWithShop({ canEdit: false }) });
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('axe-core : 0 violation WCAG', async () => {
    const { container } = mount({ tab: 1 }, { data: dataWithShop() });
    expect(await scan(container)).toEqual([]);
  });
});
