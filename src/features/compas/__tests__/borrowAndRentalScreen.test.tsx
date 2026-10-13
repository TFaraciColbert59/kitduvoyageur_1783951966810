// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { CompasScreen } from '../components/CompasScreen';
import { compas, cart, resetScreenMocks } from './helpers/screenMocks';
import { compasData, item, TRIP, U2 } from './helpers/compasData';
import { labCompasData } from '../dev/labData';
import type { CompasShopProduct } from '../server/getCompasData';

/*
 * Lot AH — ce que l'écran dit d'un emprunt et d'une location.
 *   - Emprunté à Léa : l'objet est disponible, l'écran le dit (« Emprunté à Léa »), ne propose plus de le
 *     trouver, et laisse annuler.
 *   - Une location ne passe pas par le panier : jamais « ajouté au panier », jamais de ligne de panier ;
 *     l'écran mène à la page Location, seul chemin de réservation, avec des mots exacts.
 */

vi.mock('next/navigation', async () => {
  const { router } = await import('./helpers/screenMocks');
  return { useRouter: () => router, usePathname: () => '/compas' };
});
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));
vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas);
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);

beforeEach(() => {
  resetScreenMocks();
  compas.compasPickShopProductAction.mockReset();
  compas.compasPickShopProductAction.mockImplementation(async () => ({ success: true }));
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const stepsNav = () => screen.getByRole('navigation', { name: 'Étapes du Compas' });

async function openKit(data = labCompasData()): Promise<HTMLElement> {
  render(<CompasScreen data={data} />);
  fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
  return screen.findByRole('dialog', { name: 'Kit' });
}

async function openAcquire(mode: RegExp): Promise<HTMLElement> {
  const sheet = await openKit();
  fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
  const item = await screen.findByRole('dialog', { name: 'Réchaud' });
  fireEvent.click(within(within(item).getByRole('group', { name: 'Trouver cet objet' })).getByRole('button', { name: mode }));
  return screen.findByRole('dialog', { name: 'Trouver : Réchaud' });
}

const RENTAL: CompasShopProduct = {
  id: 'p-loc-1',
  slug: 'jetboil-location',
  mode: 'location',
  name: 'Réchaud compact',
  brand: 'Jetboil',
  category: 'cook',
  weightG: 410,
  priceEur: null,
  pricePerDay: 6,
  rating: null,
  reviewCount: null,
  image: null,
  imageAlt: null,
};

/** Le voyage dont le réchaud vital est EMPRUNTÉ à Léa, et qui n'a rien d'autre à trouver. */
const borrowedData = () =>
  compasData({
    items: [
      item({ id: 'i-stove', name: 'Réchaud', category: 'cook', isVital: true, ownership: 'shared', ownerId: U2, borrowedFrom: U2 }),
    ],
  });

describe('emprunter : l’objet devient disponible, et l’écran le dit', () => {
  it('la ligne du kit dit « Emprunté à Léa » (prénom), pas « À trouver »', async () => {
    const sheet = await openKit(borrowedData());
    const row = within(sheet).getByRole('button', { name: /^Réchaud/ }).closest('.cp-row') as HTMLElement;
    expect(row.textContent).toContain('Emprunté à Léa');
    expect(row.textContent).not.toContain('À trouver');
  });

  it('la fiche : puce « Emprunté à Léa », plus de « Trouver cet objet », et « Annuler l’emprunt »', async () => {
    const sheet = await openKit(borrowedData());
    fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
    const fiche = await screen.findByRole('dialog', { name: 'Réchaud' });
    expect(within(fiche).getAllByText('Emprunté à Léa').length).toBeGreaterThan(0);
    expect(within(fiche).queryByRole('group', { name: 'Trouver cet objet' })).toBeNull();
    fireEvent.click(within(fiche).getByRole('button', { name: /Annuler l’emprunt/ }));
    await waitFor(() => expect(compas.compasBorrowItemAction).toHaveBeenCalledTimes(1));
    expect(compas.compasBorrowItemAction).toHaveBeenCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      itemId: 'i-stove',
      // L'état d'avant l'emprunt est gardé en base : le serveur le rétablit, l'écran n'envoie rien.
      lenderId: null,
    });
  });

  it('le résumé du sac ne compte plus l’objet emprunté parmi ceux à trouver', () => {
    render(<CompasScreen data={borrowedData()} initialStep="ou" />);
    expect(screen.queryByText(/à trouver/)).toBeNull();
  });

  it('emprunter depuis « Trouver » annonce « emprunté à Léa » et propose « Annuler », qui rétablit l’état d’avant', async () => {
    const acq = await openAcquire(/^Emprunter/);
    fireEvent.click(within(acq).getAllByRole('button', { name: 'Emprunter' }).find((b) => b.closest('.cp-row'))!);
    await waitFor(() => expect(compas.compasBorrowItemAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Réchaud emprunté à Léa')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(compas.compasBorrowItemAction).toHaveBeenCalledTimes(2));
    expect(compas.compasBorrowItemAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: 'trek-3-vallees',
      itemId: 'i-stove',
      lenderId: null,
      // Le réchaud était commun, sans porteur, avant l'emprunt.
      restore: { carrierId: null, shared: true },
    });
  });

  it('un échec serveur est dit tel quel : rien n’est annoncé comme emprunté', async () => {
    compas.compasBorrowItemAction.mockResolvedValueOnce({ success: false, error: 'Impossible d’enregistrer l’emprunt.' });
    const acq = await openAcquire(/^Emprunter/);
    fireEvent.click(within(acq).getAllByRole('button', { name: 'Emprunter' }).find((b) => b.closest('.cp-row'))!);
    expect(await screen.findByText('Impossible d’enregistrer l’emprunt.')).toBeTruthy();
    expect(screen.queryByText('Réchaud emprunté à Léa')).toBeNull();
  });
});

describe('louer : une location ne passe jamais par le panier', () => {
  it('« Choisir » une location relie l’objet, ne crée aucune ligne de panier et ne dit pas « ajouté au panier »', async () => {
    const acq = await openAcquire(/^Louer/);
    fireEvent.click(within(acq).getByRole('button', { name: 'Choisir' }));
    await waitFor(() =>
      expect(compas.compasPickShopProductAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: 'trek-3-vallees',
        itemId: 'i-stove',
        shopProductId: 'p-loc-1',
      })
    );
    expect(await screen.findByText('Location choisie et reliée au kit · pas encore réservée')).toBeTruthy();
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(screen.queryByText(/Ajouté au panier/)).toBeNull();
  });

  it('le serveur dit « pas au panier » pour une location : aucune ligne de panier, par aucune des deux règles', async () => {
    compas.compasPickShopProductAction.mockResolvedValueOnce({ success: true, inCart: false } as never);
    const acq = await openAcquire(/^Louer/);
    fireEvent.click(within(acq).getByRole('button', { name: 'Choisir' }));
    await waitFor(() => expect(compas.compasPickShopProductAction).toHaveBeenCalledTimes(1));
    expect(cart.addToCart).not.toHaveBeenCalled();
  });

  it('une location n’a jamais de ligne de panier, même si une réponse en fournissait une', async () => {
    compas.compasPickShopProductAction.mockResolvedValueOnce({
      success: true,
      inCart: true,
      cartLine: { id: 'p-loc-1', slug: 'jetboil-location', name: 'Réchaud compact', brand: 'Jetboil', priceEur: 6, weightG: 410, image: '', imageAlt: '', category: 'cook' },
    } as never);
    const acq = await openAcquire(/^Louer/);
    fireEvent.click(within(acq).getByRole('button', { name: 'Choisir' }));
    await waitFor(() => expect(compas.compasPickShopProductAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Location choisie et reliée au kit · pas encore réservée')).toBeTruthy();
    expect(cart.addToCart).not.toHaveBeenCalled();
  });

  it('le tiroir dit que rien n’est réservé ni payé, et mène à la page Location ; aucun lien vers le panier', async () => {
    const acq = await openAcquire(/^Louer/);
    const note = within(acq).getByTestId('rental-note').textContent ?? '';
    expect(note).toContain('Rien n’est réservé ni payé ici');
    expect(note).toContain('Une location ne passe pas par le panier');
    const link = within(acq).getByRole('link', { name: /Aller à la page Location/ });
    expect(link.getAttribute('href')).toBe('/location');
    expect(within(acq).queryByRole('link', { name: /panier/i })).toBeNull();
    expect(within(acq).queryByText(/le met au panier/)).toBeNull();
  });

  it('acheter garde son comportement : le produit va au panier, ligne de panier comprise', async () => {
    const acq = await openAcquire(/^Acheter/);
    expect(within(acq).getByRole('link', { name: /Voir le panier/ }).getAttribute('href')).toBe('/panier');
    fireEvent.click(within(acq).getAllByRole('button', { name: 'Choisir' })[0]);
    await waitFor(() => expect(cart.addToCart).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Ajouté au panier et relié au kit')).toBeTruthy();
  });

  it('acheter : c’est la ligne construite par le serveur qui est ajoutée, pas une autre', async () => {
    const line = {
      id: 'p-ach-1',
      slug: 'rechaud-mini',
      name: 'Mini réchaud à gaz',
      brand: 'Trangia',
      priceEur: 41,
      weightG: 85,
      image: '',
      imageAlt: 'Mini réchaud à gaz',
      category: 'cook',
    };
    compas.compasPickShopProductAction.mockResolvedValueOnce({ success: true, inCart: true, cartLine: line } as never);
    const acq = await openAcquire(/^Acheter/);
    const row = within(acq).getByText('Mini réchaud à gaz').closest('.cp-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Choisir' }));
    await waitFor(() => expect(cart.addToCart).toHaveBeenCalledWith(line));
  });

  it('acheter : si le serveur n’a PAS écrit « dans le panier », aucune ligne de panier et l’écran le dit', async () => {
    compas.compasPickShopProductAction.mockResolvedValueOnce({ success: true, inCart: false } as never);
    const acq = await openAcquire(/^Acheter/);
    fireEvent.click(within(acq).getAllByRole('button', { name: 'Choisir' })[0]);
    await waitFor(() => expect(compas.compasPickShopProductAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Relié au kit, mais pas mis au panier/)).toBeTruthy();
    expect(cart.addToCart).not.toHaveBeenCalled();
  });

  it('un produit sans prix ni fiche (achat) est relié sans panier, et l’annonce ne parle pas de panier', async () => {
    const data = labCompasData();
    data.shop = [
      ...data.shop,
      { ...RENTAL, id: 'p-sans-prix', slug: null, mode: 'achat', name: 'Réchaud sans prix', pricePerDay: null },
    ];
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Kit' })).getByRole('button', { name: /^Réchaud/ }));
    const fiche = await screen.findByRole('dialog', { name: 'Réchaud' });
    fireEvent.click(within(within(fiche).getByRole('group', { name: 'Trouver cet objet' })).getByRole('button', { name: /^Acheter/ }));
    const acq = await screen.findByRole('dialog', { name: 'Trouver : Réchaud' });
    const row = within(acq).getByText('Réchaud sans prix').closest('.cp-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Choisir' }));
    await waitFor(() => expect(compas.compasPickShopProductAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Relié au kit · pas mis au panier')).toBeTruthy();
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(screen.queryByText(/Ajouté au panier/)).toBeNull();
  });

  it('axe-core : 0 violation sur le tiroir « Louer »', async () => {
    const acq = await openAcquire(/^Louer/);
    const res = await axe.run(acq, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('une location choisie n’est jamais « dans le panier » à l’écran', () => {
  /** Un réchaud vital relié à la location, que l'ancienne écriture avait marqué « dans le panier ». */
  const rentedData = () =>
    compasData(
      {
        items: [
          item({
            id: 'i-stove',
            name: 'Réchaud',
            category: 'cook',
            isVital: true,
            ownership: 'shared',
            shopProductId: RENTAL.id,
            purchaseState: 'in_cart',
          }),
        ],
      },
      { shop: [RENTAL] }
    );

  it('la ligne dit « Location à réserver », pas « Dans le panier » : l’objet reste à trouver', async () => {
    const sheet = await openKit(rentedData());
    const row = within(sheet).getByRole('button', { name: /^Réchaud/ }).closest('.cp-row') as HTMLElement;
    expect(row.textContent).toContain('Location à réserver');
    expect(row.textContent).not.toContain('Dans le panier');
  });

  it('la fiche dit la même chose', async () => {
    const sheet = await openKit(rentedData());
    fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
    const fiche = await screen.findByRole('dialog', { name: 'Réchaud' });
    expect(within(fiche).getAllByText('Location à réserver').length).toBeGreaterThan(0);
    expect(within(fiche).queryByText('Dans le panier')).toBeNull();
    // Toujours à trouver : « Trouver cet objet » reste proposé.
    expect(within(fiche).getByRole('group', { name: 'Trouver cet objet' })).toBeTruthy();
  });
});
