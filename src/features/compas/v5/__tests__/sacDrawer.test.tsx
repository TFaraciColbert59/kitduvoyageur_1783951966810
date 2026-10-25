// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import type { MyKit } from '../../engine/kitApply';
import type { KitAdvice } from '../../engine/kitRules';
import { sacDrawer } from '../drawers/sac';
import { makeApi, makeData, makeInput, U, TRIP, WithApi } from './fixtures';

const server = vi.hoisted(() => ({
  compasListMyKitsAction: vi.fn(),
  compasApplyKitAction: vi.fn(async (_input: unknown) => ({ success: true })),
  compasCreateKitFromTripAction: vi.fn(async (_input: unknown) => ({ success: true, kitId: 'kit-new', count: 6 })),
  compasSetCarrierAction: vi.fn(async (_input: unknown) => ({ success: true })),
}));
const kit = vi.hoisted(() => ({
  setPurchaseStateAction: vi.fn(async (..._args: unknown[]) => ({ success: true })),
  deleteTripItemAction: vi.fn(async (..._args: unknown[]) => ({ success: true })),
  addCustomTripItemAction: vi.fn(async (..._args: unknown[]) => ({ success: true })),
}));
vi.mock('../../server/compasActions', () => server);
vi.mock('@/app/voyages/kit-actions', () => kit);

const SLUG = 'vercors-novembre';

const MY_KITS: MyKit[] = [
  {
    id: 'kit-a',
    name: 'Rando 3 saisons',
    season: 'ete',
    items: [
      { id: 'a1', name: 'Veste de pluie', category: 'clothing', weightG: 320, quantity: 1, isVital: false, productOwnershipId: null },
      { id: 'a2', name: 'Sifflet', category: 'safety', weightG: null, quantity: 1, isVital: false, productOwnershipId: null },
      { id: 'a3', name: 'Gourde 1 L', category: 'water', weightG: 160, quantity: 1, isVital: false, productOwnershipId: null },
    ],
  },
  {
    id: 'kit-b',
    name: 'Déjà tout là',
    season: null,
    items: [{ id: 'b1', name: 'Frontale', category: 'safety', weightG: 95, quantity: 1, isVital: false, productOwnershipId: null }],
  },
];

beforeEach(() => {
  server.compasListMyKitsAction.mockResolvedValue({ success: true, kits: MY_KITS });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const soloInput = () => {
  const base = makeInput();
  return { trip: { ...base.trip, partySize: 1 }, members: [base.members[0]] };
};

function mount(overrides: Parameters<typeof makeApi>[0] = {}, data = makeData()) {
  const api = makeApi(overrides, { data });
  const view = render(
    <WithApi api={api}>
      <sacDrawer.Body />
    </WithApi>
  );
  return { api, ...view };
}

const lastRun = (api: ReturnType<typeof makeApi>, n = 0) => (api.ctl.run as Mock).mock.calls[n] as [string, () => Promise<unknown>, (() => Promise<unknown>) | undefined];

async function scan(root: Element): Promise<string[]> {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

describe('capsule et titre', () => {
  it('en groupe : ton sac, tes kits, qui porte quoi', () => {
    const api = makeApi();
    expect(sacDrawer.space).toBe('sac');
    expect(sacDrawer.tabs(api).map((t) => [t.icon, t.label])).toEqual([
      ['bag', 'Ton sac'],
      ['spark', 'Tes kits'],
      ['people', 'Qui porte quoi'],
    ]);
  });

  it('en solo : « Qui porte quoi » n’existe pas, et un onglet périmé est ramené sur Tes kits', () => {
    const data = makeData(soloInput());
    const api = makeApi({ tab: 2 }, { data });
    expect(api.solo).toBe(true);
    expect(sacDrawer.tabs(api).map((t) => t.label)).toEqual(['Ton sac', 'Tes kits']);
    expect(sacDrawer.title(api)).toBe('Tes kits');
  });

  it('le titre suit l’onglet et le contexte dit le nombre d’objets portés', () => {
    expect(sacDrawer.title(makeApi({ tab: 0 }))).toBe('Ton sac');
    expect(sacDrawer.title(makeApi({ tab: 2 }))).toBe('Qui porte quoi');
    // Tony porte ses 4 affaires personnelles ; la tente et le réchaud communs n’ont pas de porteur.
    expect(sacDrawer.subtitle(makeApi({ tab: 0 }))).toBe('4 objets');
    expect(sacDrawer.subtitle(makeApi({ tab: 2 }))).toBe('2 objets communs');
    expect(sacDrawer.subtitle(makeApi({ tab: 1 }))).toBeNull();
  });
});

describe('Ton sac', () => {
  it('anneau : poids par catégorie, capacité, sans compter zéro un poids inconnu', () => {
    const items = makeInput().items.map((i) => (i.id === 'i4' ? { ...i, weightGrams: null } : i));
    mount({}, makeData({ items }));
    // 1250 + 320 + 260 = 1830 g portés ; la frontale n'a pas de poids : dite, non comptée.
    expect(screen.getByRole('img', { name: /Poids de ton sac par catégorie : 1,8 kg/ })).toBeTruthy();
    expect(screen.getByText('sur 14 kg max')).toBeTruthy();
    expect(screen.getByText(/1 objet sans poids renseigné, non compté/)).toBeTruthy();
    const legend = screen.getByRole('list', { name: 'Poids de ton sac par catégorie' });
    expect(within(legend).getByText('Porter')).toBeTruthy();
    expect(within(legend).getByText('Vêtements')).toBeTruthy();
    expect(within(legend).getByText('Sécurité')).toBeTruthy();
  });

  it('adaptations : un objet ajouté dit pourquoi, et « Retirer » écrit, annonce et sait s’annuler', async () => {
    const { api } = mount();
    const card = screen.getByText('Averses le 4 au matin').closest('.v5-rc') as HTMLElement;
    expect(within(card).getByText('Veste de pluie')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Retirer Veste de pluie du sac' }));
    await waitFor(() => expect(kit.deleteTripItemAction).toHaveBeenCalledWith('i2', SLUG));
    const [message, , undo] = lastRun(api);
    expect(message).toBe('Veste de pluie retiré du sac');
    expect(undo).toBeTypeOf('function');
    await undo!();
    const call = kit.addCustomTripItemAction.mock.calls[0] as [string, string, FormData];
    expect(call[0]).toBe(TRIP);
    expect(call[1]).toBe(SLUG);
    expect(call[2].get('itemName')).toBe('Veste de pluie');
    expect(call[2].get('category')).toBe('clothing');
    expect(call[2].get('weightGrams')).toBe('320');
    expect(call[2].get('quantity')).toBe('1');
    expect(call[2].get('isVital')).toBe('false');
  });

  it('conseils non couverts : la raison et la source sont dites, « Ajouter » ouvre le flux existant', () => {
    const advice: KitAdvice[] = [
      { id: 'froid', need: 'froid', label: 'Couche chaude', reason: '0 °C le 4 au matin', source: 'MET Norway', covered: false, coveredBy: null },
      { id: 'pluie', need: 'pluie', label: 'Veste imperméable', reason: '70 % de pluie', source: 'MET Norway', covered: true, coveredBy: 'Veste de pluie' },
    ];
    const { api } = mount({}, makeData({}, { kitAdvice: advice }));
    expect(screen.getByText('0 °C le 4 au matin')).toBeTruthy();
    expect(screen.getByText('Source : MET Norway')).toBeTruthy();
    expect(screen.getByText('Conseils de kit couverts : 1 sur 2.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au sac : Couche chaude' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'add', target: 'kit', suggest: { query: 'Couche chaude', name: 'Couche chaude' } });
  });

  it('aucune adaptation : le dit', () => {
    const items = makeInput().items.map((i) => ({ ...i, reason: null }));
    mount({}, makeData({ items }));
    expect(screen.getByText('Aucune adaptation à signaler pour l’instant.')).toBeTruthy();
  });

  it('objets en cartes : illustration sans photo, photo du catalogue seulement pour le produit lié', () => {
    const data = makeData(
      { items: makeInput().items.map((i) => (i.id === 'i3' ? { ...i, shopProductId: '66666666-6666-4666-8666-666666666666' } : i)) },
      { shop: [{ id: '66666666-6666-4666-8666-666666666666', slug: 'trousse', mode: 'achat', name: 'Trousse de secours randonnée', brand: null, category: null, weightG: 260, priceEur: 24.9, pricePerDay: null, rating: null, reviewCount: null, image: 'https://cdn.example/trousse.jpg', imageAlt: 'Trousse de secours rouge' }] }
    );
    mount({}, data);
    const imgs = screen.getAllByRole('img').filter((el) => el.tagName === 'IMG') as HTMLImageElement[];
    expect(imgs.map((i) => i.alt)).toEqual(['Trousse de secours rouge']);
    expect(imgs[0].src).toBe('https://cdn.example/trousse.jpg');
    // Les autres objets : une icône, jamais une photo d'un autre objet.
    expect(document.querySelectorAll('.v5-it2 .im .fb').length).toBe(3);
  });

  it('état d’un objet : « Je l’ai » et « À acheter » écrivent par setPurchaseStateAction et s’annulent', async () => {
    const { api } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    const group = screen.getByRole('group', { name: 'État de Trousse de secours' });
    expect(within(group).getByRole('button', { name: 'À acheter' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: 'Je l’ai' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(within(group).getByRole('button', { name: 'Je l’ai' }));
    await waitFor(() => expect(kit.setPurchaseStateAction).toHaveBeenCalledWith('i3', 'added', SLUG));
    const [message, , undo] = lastRun(api);
    expect(message).toBe('Trousse de secours : tu l’as');
    await undo!();
    expect(kit.setPurchaseStateAction).toHaveBeenLastCalledWith('i3', 'needed', SLUG);
  });

  it('un objet déclaré « Je l’ai » repasse « À acheter » (et peut revenir)', async () => {
    const data = makeData({ items: makeInput().items.map((i) => (i.id === 'i3' ? { ...i, purchaseState: 'added' } : i)) });
    const { api } = mount({}, data);
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    const group = screen.getByRole('group', { name: 'État de Trousse de secours' });
    expect(within(group).getByRole('button', { name: 'Je l’ai' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: 'À acheter' }));
    await waitFor(() => expect(kit.setPurchaseStateAction).toHaveBeenCalledWith('i3', 'needed', SLUG));
    await lastRun(api)[2]!();
    expect(kit.setPurchaseStateAction).toHaveBeenLastCalledWith('i3', 'added', SLUG);
  });

  it('« À emprunter » ouvre le flux existant (groupe seulement)', () => {
    const { api } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    fireEvent.click(screen.getByRole('button', { name: 'À emprunter' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'acquire', lineId: 'i3', mode: 'emprunter' });
    cleanup();
    mount({}, makeData(soloInput()));
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    expect(screen.queryByRole('button', { name: 'À emprunter' })).toBeNull();
  });

  it('objet déjà emballé : état verrouillé et expliqué, pas de faux bouton', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Sac à dos 38 L/ }));
    expect(screen.getByText(/déjà emballé : son état ne se change pas ici/)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'État de Sac à dos 38 L' })).toBeNull();
  });

  it('raison de présence, fiche, boutique et ouverture des flux profonds', () => {
    const { api } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^Veste de pluie/ }));
    expect(screen.getByText('Là parce que : Averses le 4 au matin')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fiche de l’objet' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'item', lineId: 'i2' });
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    expect(screen.getByText('Boutique LKDV · 24,90 €')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trouver en boutique' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'acquire', lineId: 'i3', mode: 'acheter' });
  });

  it('« Ajouter un objet » ouvre le flux existant', () => {
    const { api } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un objet' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'add', target: 'kit' });
  });

  it('lecture seule : on voit tout, on ne change rien', () => {
    const data = makeData({}, { canEdit: false });
    const { api } = mount({}, data);
    expect(screen.getByText('Lecture seule : tu peux voir le sac, pas le modifier.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ajouter un objet' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Retirer/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    expect(screen.queryByRole('group', { name: 'État de Trousse de secours' })).toBeNull();
    expect(api.ctl.run).not.toHaveBeenCalled();
  });

  it('sac vide : le dit', () => {
    mount({}, makeData({ items: [] }));
    expect(screen.getByText('Ton sac est vide pour l’instant.')).toBeTruthy();
    expect(screen.getByText('Aucun poids à compter pour l’instant.')).toBeTruthy();
  });

  it('axe-core : 0 violation WCAG', async () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Trousse de secours/ }));
    expect(await scan(container)).toEqual([]);
  });
});

describe('Tes kits', () => {
  const open = async (overrides: Parameters<typeof makeApi>[0] = {}, data = makeData()) => {
    const view = mount({ tab: 1, ...overrides }, data);
    await screen.findByText('Rando 3 saisons');
    return view;
  };

  it('chargement puis liste : le kit du voyage et ceux de la personne, avec leurs cartes', async () => {
    mount({ tab: 1 });
    expect(screen.getByText('Lecture de tes kits…')).toBeTruthy();
    await screen.findByText('Rando 3 saisons');
    const list = screen.getByRole('list', { name: 'Choisir un kit' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(within(list).getByText('Créé pour ce voyage')).toBeTruthy();
    expect(within(list).getByText('3 objets')).toBeTruthy();
  });

  it('aucun kit : le dit, et le kit du voyage reste enregistrable', async () => {
    server.compasListMyKitsAction.mockResolvedValue({ success: true, kits: [] });
    mount({ tab: 1 });
    await screen.findByText('Tu n’as encore aucun kit enregistré.');
    expect(screen.getByRole('button', { name: 'Enregistrer le kit' })).toBeTruthy();
  });

  it('lecture impossible : erreur dite avec un message, pas de page blanche', async () => {
    server.compasListMyKitsAction.mockResolvedValue({ success: false, error: 'Connexion requise.' });
    mount({ tab: 1 });
    expect((await screen.findByRole('alert')).textContent).toBe('Connexion requise.');
    cleanup();
    server.compasListMyKitsAction.mockRejectedValue(new Error('réseau'));
    mount({ tab: 1 });
    expect((await screen.findByRole('alert')).textContent).toBe('Connexion perdue : réessaie.');
  });

  it('créé pour ce voyage : enregistre le kit du voyage par compasCreateKitFromTripAction, sans filiation', async () => {
    const { api } = await open();
    const form = screen.getByRole('form', { name: 'Enregistrer dans Mon matériel' });
    const name = within(form).getByLabelText('Nom du kit') as HTMLInputElement;
    expect(name.value).toBe('Kit · Randonnée · Vercors');
    fireEvent.change(name, { target: { value: 'Vercors novembre' } });
    fireEvent.change(within(form).getByLabelText('Saison'), { target: { value: 'automne' } });
    fireEvent.submit(form);
    await waitFor(() => expect(server.compasCreateKitFromTripAction).toHaveBeenCalled());
    expect(server.compasCreateKitFromTripAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, name: 'Vercors novembre', season: 'automne' });
    expect(lastRun(api)[0]).toBe('Kit « Vercors novembre » créé');
    // Le kit est « manuel » côté serveur : l'écran n'envoie ni parent ni origine.
    const sent = server.compasCreateKitFromTripAction.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['name', 'season', 'tripId', 'tripSlug']);
    expect(server.compasApplyKitAction).not.toHaveBeenCalled();
    // La liste est relue après la création.
    await waitFor(() => expect(server.compasListMyKitsAction).toHaveBeenCalledTimes(2));
  });

  it('un kit de la personne : décompte, compatibilité, et « Partir de ce kit » applique SON kit (jamais de filiation)', async () => {
    const { api } = await open();
    fireEvent.click(screen.getByRole('button', { name: /Rando 3 saisons/ }));
    // Veste de pluie est déjà dans le voyage : 1 déjà là, 2 à ajouter.
    expect(screen.getByText('1 déjà dans le voyage · 2 à ajouter')).toBeTruthy();
    expect(screen.getByText("dont 1 sans poids renseigné")).toBeTruthy();
    expect(screen.getByText(/Ton kit reste tel quel/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Partir du kit Rando 3 saisons' }));
    await waitFor(() => expect(server.compasApplyKitAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, kitId: 'kit-a' }));
    expect(lastRun(api)[0]).toBe('2 objets ajoutés');
    expect(server.compasCreateKitFromTripAction).not.toHaveBeenCalled();
    const sent = server.compasApplyKitAction.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['kitId', 'tripId', 'tripSlug']);
  });

  it('un kit déjà entièrement dans le voyage : « Déjà complet », rien à écrire', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Déjà tout là/ }));
    const done = screen.getByRole('button', { name: 'Partir du kit Déjà tout là' }) as HTMLButtonElement;
    expect(done.textContent).toBe('Déjà complet');
    expect(done.disabled).toBe(true);
  });

  it('lecture seule : aucun bouton d’écriture', async () => {
    await open({}, makeData({}, { canEdit: false }));
    expect(screen.queryByRole('form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Rando 3 saisons/ }));
    expect(screen.queryByRole('button', { name: /Partir du kit/ })).toBeNull();
  });

  it('axe-core : 0 violation WCAG', async () => {
    const { container } = await open();
    expect(await scan(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Rando 3 saisons/ }));
    expect(await scan(container)).toEqual([]);
  });
});

describe('Qui porte quoi', () => {
  it('chaque membre avec sa charge et sa capacité (inconnue dite inconnue), et le commun à répartir', () => {
    const { api } = mount({ tab: 2 });
    const rows = screen.getAllByRole('listitem');
    expect(screen.getByText('À répartir')).toBeTruthy();
    expect(screen.getByText('Tente 2 places')).toBeTruthy();
    expect(screen.getByText('Réchaud et popote')).toBeTruthy();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const leo = screen.getByText('Léo').closest('li') as HTMLElement;
    expect(within(leo).getByText('capacité non renseignée')).toBeTruthy();
    const tony = screen.getByText('Tony').closest('li') as HTMLElement;
    expect(within(tony).getByText('sur 14 kg')).toBeTruthy();
    fireEvent.click(within(tony).getByRole('button', { name: 'Voir le sac de Tony' }));
    expect(api.ctl.open).toHaveBeenCalledWith({ kind: 'bag', userId: U.tony });
  });

  it('confier un objet commun écrit par compasSetCarrierAction, annonce et sait s’annuler', async () => {
    const { api } = mount({ tab: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Confier Tente 2 places à Claire' }));
    await waitFor(() => expect(server.compasSetCarrierAction).toHaveBeenCalled());
    expect(server.compasSetCarrierAction).toHaveBeenCalledWith({ tripId: TRIP, tripSlug: SLUG, itemId: 'i5', carrierId: U.claire, shared: true });
    const [message, , undo] = lastRun(api);
    expect(message).toBe('Claire porte Tente 2 places');
    await undo!();
    expect(server.compasSetCarrierAction).toHaveBeenLastCalledWith({ tripId: TRIP, tripSlug: SLUG, itemId: 'i5', carrierId: null, shared: true });
  });

  it('matériel commun déjà confié : listé chez son porteur', () => {
    const data = makeData({ items: makeInput().items.map((i) => (i.id === 'i5' ? { ...i, ownerId: U.claire } : i)) });
    mount({ tab: 2 }, data);
    const claire = screen.getByText('Claire').closest('li') as HTMLElement;
    expect(within(claire).getByText('Tente 2 places')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confier Tente 2 places à Claire' })).toBeNull();
  });

  it('lecture seule : aucune attribution', () => {
    mount({ tab: 2 }, makeData({}, { canEdit: false }));
    expect(screen.queryByRole('button', { name: /Confier/ })).toBeNull();
  });

  it('axe-core : 0 violation WCAG', async () => {
    const { container } = mount({ tab: 2 });
    expect(await scan(container)).toEqual([]);
  });
});

