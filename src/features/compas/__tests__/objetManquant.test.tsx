// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { CompasScreen } from '../components/CompasScreen';
import { compas, cart, resetScreenMocks } from './helpers/screenMocks';
import { labCompasData } from '../dev/labData';

/*
 * Objet manquant (PLAN-100 5.5) : « Emprunter · Louer · Acheter » complet, appui long → fiche +
 * historique. Jamais de paiement, de checkout ni de commande sans geste explicite.
 */

const history = vi.hoisted(() => ({
  compasItemHistoryAction: vi.fn(async (_input: unknown) => ({
    success: true as const,
    entries: [
      { id: 'pret-1', kind: 'pret' as const, date: '2026-08-01', title: 'Prêté à Marc', detail: 'rendu', tone: 'good' as const },
      { id: 'voyage-1', kind: 'voyage' as const, date: '2026-07-05', title: 'Emporté pour « Tour du Mont Blanc »', detail: '5 juil. 2026' },
    ] as Array<{ id: string; kind: 'pret' | 'voyage' | 'commande'; date: string | null; title: string; detail: string | null; tone?: 'good' | 'warn' | 'bad' }>,
    unavailable: [] as string[],
  })),
}));
vi.mock('../server/itemHistoryActions', () => history);

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
  history.compasItemHistoryAction.mockClear();
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const stepsNav = () => screen.getByRole('navigation', { name: 'Étapes du Compas' });
/** Espaces insécables de l'Intl français → espaces simples. */
const n = (t: string | null | undefined) => (t ?? '').replace(/\s/g, ' ');

async function openKit(): Promise<HTMLElement> {
  render(<CompasScreen data={labCompasData()} />);
  fireEvent.click(within(stepsNav()).getByRole('button', { name: /Kit/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Détails : Kit' }));
  return screen.findByRole('dialog', { name: 'Kit' });
}

const stoveRow = (sheet: HTMLElement) =>
  within(sheet).getByRole('button', { name: /^Réchaud/ }).closest('.cp-row') as HTMLElement;

async function openAcquire(mode: RegExp): Promise<HTMLElement> {
  const sheet = await openKit();
  fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
  const item = await screen.findByRole('dialog', { name: 'Réchaud' });
  const group = within(item).getByRole('group', { name: 'Trouver cet objet' });
  fireEvent.click(within(group).getByRole('button', { name: mode }));
  return screen.findByRole('dialog', { name: 'Trouver : Réchaud' });
}

async function scan(root: Element): Promise<string[]> {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } },
  });
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((x) => x.target.join(' ')).join(' | ')}`);
}

describe('appui long sur un objet : fiche en grand, puis historique', () => {
  it('l’appui long ouvre la fiche en grande hauteur, avec ses deux onglets', async () => {
    const sheet = await openKit();
    const row = stoveRow(sheet);
    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 520));
    });
    const item = await screen.findByRole('dialog', { name: 'Réchaud' });
    expect(item.getAttribute('data-detent')).toBe('large');
    const tabs = within(item).getByRole('group', { name: 'Fiche de l’objet' });
    expect(within(tabs).getByRole('button', { name: 'Fiche' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(tabs).getByRole('button', { name: 'Historique' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('« Historique » lit l’objet sur le serveur et dit chaque événement ; rien n’est écrit', async () => {
    const sheet = await openKit();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
    const item = await screen.findByRole('dialog', { name: 'Réchaud' });
    fireEvent.click(within(item).getByRole('button', { name: 'Historique' }));
    const list = await within(item).findByRole('list', { name: 'Événements de l’objet' });
    expect(within(list).getByText('Prêté à Marc')).toBeTruthy();
    expect(within(list).getByText(/Emporté pour « Tour du Mont Blanc »/)).toBeTruthy();
    expect(history.compasItemHistoryAction).toHaveBeenCalledWith({
      tripId: '11111111-1111-4111-8111-111111111111',
      itemId: 'i-stove',
    });
    expect(Object.values(compas).every((f) => f.mock.calls.length === 0)).toBe(true);
    // Objet non relié à l'inventaire : l'écran le dit au lieu d'inventer un suivi.
    expect(within(item).getByText(/n’est pas relié à ton inventaire/)).toBeTruthy();
  });

  it('une source illisible est nommée ; sans événement, « aucun événement enregistré »', async () => {
    history.compasItemHistoryAction.mockResolvedValueOnce({ success: true, entries: [], unavailable: ['commandes'] });
    const sheet = await openKit();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
    const item = await screen.findByRole('dialog', { name: 'Réchaud' });
    fireEvent.click(within(item).getByRole('button', { name: 'Historique' }));
    expect(await within(item).findByText('Lecture impossible pour : commandes.')).toBeTruthy();
    expect(within(item).getByText('Rien à montrer pour les sources lisibles.')).toBeTruthy();
  });

  it('une erreur est annoncée (alerte) et « Réessayer » relit', async () => {
    history.compasItemHistoryAction.mockResolvedValueOnce({ success: false, error: 'Connexion perdue : réessaie.' } as never);
    const sheet = await openKit();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
    const item = await screen.findByRole('dialog', { name: 'Réchaud' });
    fireEvent.click(within(item).getByRole('button', { name: 'Historique' }));
    expect((await within(item).findByRole('alert')).textContent).toContain('Connexion perdue');
    fireEvent.click(within(item).getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(history.compasItemHistoryAction).toHaveBeenCalledTimes(2));
    expect(await within(item).findByRole('list', { name: 'Événements de l’objet' })).toBeTruthy();
  });

  it('axe-core : 0 violation sur l’historique', async () => {
    const sheet = await openKit();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Réchaud/ }));
    const item = await screen.findByRole('dialog', { name: 'Réchaud' });
    fireEvent.click(within(item).getByRole('button', { name: 'Historique' }));
    await within(item).findByRole('list', { name: 'Événements de l’objet' });
    expect(await scan(item)).toEqual([]);
  });
});

describe('Emprunter · Louer · Acheter', () => {
  it('chaque mode dit son nombre de choix et sa phrase', async () => {
    const acq = await openAcquire(/^Emprunter/);
    const group = within(acq).getByRole('group', { name: 'Comment trouver l’objet' });
    expect(within(group).getByRole('button', { name: 'Emprunter · 2' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Louer · 1' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Acheter · 3' })).toBeTruthy();
    const note = () => n(within(acq).getByTestId('acquire-overview').textContent);
    expect(note()).toContain('2 personnes dans l’équipe');
    expect(note()).toContain('n’est pas visible ici');
    fireEvent.click(within(group).getByRole('button', { name: /^Louer/ }));
    expect(note()).toBe('1 location en boutique, dès 30 € pour 5 jours.');
    fireEvent.click(within(group).getByRole('button', { name: /^Acheter/ }));
    expect(note()).toBe('3 produits en boutique, dès 22 €.');
  });

  it('emprunter : l’équipe sans moi ; l’action reste explicite et ne touche ni le panier ni la boutique', async () => {
    const acq = await openAcquire(/^Emprunter/);
    expect(within(acq).queryByText('Tony')).toBeNull();
    fireEvent.click(within(acq).getAllByRole('button', { name: 'Emprunter' }).find((b) => b.closest('.cp-row'))!);
    await waitFor(() => expect(compas.compasSetCarrierAction).toHaveBeenCalledTimes(1));
    expect(cart.addToCart).not.toHaveBeenCalled();
    expect(compas.compasPickShopProductAction).not.toHaveBeenCalled();
  });

  it('louer : le total pour les jours DATÉS du voyage, le prix par jour, la fiche produit', async () => {
    const acq = await openAcquire(/^Louer/);
    const row = within(acq).getByText('Réchaud compact').closest('.cp-row') as HTMLElement;
    expect(n(row.textContent)).toContain('Jetboil · 410 g · 6 € / jour · 5 jours = 30 €');
    expect(within(row).getByRole('link', { name: 'Fiche produit : Réchaud compact' }).getAttribute('href')).toBe('/produit/jetboil-location');
  });

  it('acheter : prix, écart de poids avec l’objet prévu s’il est connu, occasion dite', async () => {
    const acq = await openAcquire(/^Acheter/);
    const mini = within(acq).getByText('Mini réchaud à gaz').closest('.cp-row') as HTMLElement;
    expect(n(mini.textContent)).toContain('Trangia · 85 g · 39 €');
    // Le réchaud prévu n'a pas de poids : aucun écart n'est inventé.
    expect(n(mini.textContent)).not.toMatch(/par rapport à l’objet prévu/);
    const occ = within(acq).getByText(/Réchaud gaz, occasion/).closest('.cp-row') as HTMLElement;
    expect(occ.textContent).toContain('occasion');
  });

  it('acheter, poids connu (matelas) : l’écart est dit en toutes lettres', async () => {
    const sheet = await openKit();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Matelas isolant/ }));
    const item = await screen.findByRole('dialog', { name: 'Matelas isolant' });
    fireEvent.click(within(within(item).getByRole('group', { name: 'Trouver cet objet' })).getByRole('button', { name: /Acheter/ }));
    const acq = await screen.findByRole('dialog', { name: 'Trouver : Matelas isolant' });
    // Seuls des réchauds en boutique : le texte d'écart se calcule sur le poids prévu (480 g).
    const rows = within(acq).getAllByText(/par rapport à l’objet prévu/);
    expect(rows.map((r) => r.textContent)).toContain('−395 g par rapport à l’objet prévu');
  });

  it('rien ne se paie ici : « Choisir » relie le produit et remplit le panier, aucun lien de checkout, la phrase le dit', async () => {
    const acq = await openAcquire(/^Acheter/);
    expect(within(acq).getByText(/Rien n’est payé ici/)).toBeTruthy();
    for (const a of acq.querySelectorAll('a')) expect(a.getAttribute('href')).not.toMatch(/checkout|stripe|pay/i);
    expect(compas.compasPickShopProductAction).not.toHaveBeenCalled();
    fireEvent.click(within(acq).getAllByRole('button', { name: 'Choisir' })[0]);
    await waitFor(() => expect(compas.compasPickShopProductAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(cart.addToCart).toHaveBeenCalledTimes(1));
  });

  it('axe-core : 0 violation sur le tiroir « Trouver »', async () => {
    const acq = await openAcquire(/^Louer/);
    expect(await scan(acq)).toEqual([]);
  });
});
