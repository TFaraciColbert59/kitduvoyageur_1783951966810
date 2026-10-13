// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { CompasScreen } from '../components/CompasScreen';
import { TRIP, compasData } from './helpers/compasData';
import { compas, resetScreenMocks } from './helpers/screenMocks';
import {
  DEPARTURE_GPS,
  DEPARTURE_HOME,
  departureRowValue,
  departureText,
  type Departure,
} from '../engine/departure';
import { UNKNOWN_ORIGIN_LINE } from '../engine/travel';
import { resolveProjectContext } from '../engine/projectContext';
import type { CompasData } from '../server/getCompasData';

/*
 * Où · Départ (PLAN-100 4.3) : d'où part le trajet d'approche et d'où ça vient. Le départ dit est nommé et
 * se remplace ou s'efface ; le domicile du profil et la position ne le sont jamais ; sans départ, le
 * trajet est dit non chiffré et un champ « Ville de départ » le pose par la même écriture que « Dis-le ».
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
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const LYON = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' };
const SLUG = 'trek-3-vallees';

/** Un voyage avec ce départ : la préparation est faite (rien ne se relance), la personne peut modifier. */
const dataWith = (
  departure: Departure | undefined,
  patch: Partial<CompasData> = {}
): CompasData => ({
  ...compasData({}, { autofillStale: [], ...patch }),
  departure,
});
const withSaid = (patch: Partial<CompasData> = {}) =>
  dataWith({ source: 'dit', name: 'Lyon' }, { originName: 'Lyon', originSaid: LYON, ...patch });

const cardRow = () => screen.getByText('Départ').closest('.cp-fr') as HTMLElement;

async function openDeparture(data: CompasData): Promise<HTMLElement> {
  render(<CompasScreen data={data} initialStep="ou" />);
  fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
  const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
  fireEvent.click(within(sheet).getByRole('button', { name: /Préférences/ }));
  return sheet;
}
const block = (sheet: HTMLElement) => within(sheet).getByTestId('departure');
const field = (sheet: HTMLElement) =>
  within(sheet).getByLabelText('Ville de départ') as HTMLInputElement;

async function scan(root: Element): Promise<string[]> {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });
  return res.violations.map(
    (v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
  );
}

describe('Où · carte : la ligne « Départ »', () => {
  it('départ dit : le lieu', () => {
    render(<CompasScreen data={withSaid()} initialStep="ou" />);
    expect(cardRow().textContent).toContain('Lyon');
  });

  it('domicile du profil : « depuis ton domicile »', () => {
    render(<CompasScreen data={dataWith({ source: 'domicile' })} initialStep="ou" />);
    expect(cardRow().textContent).toContain(DEPARTURE_HOME);
    expect(DEPARTURE_HOME).toBe('depuis ton domicile');
  });

  it('position : « depuis ta position (arrondie à ~1 km) »', () => {
    render(<CompasScreen data={dataWith({ source: 'gps' })} initialStep="ou" />);
    expect(cardRow().textContent).toContain('depuis ta position (arrondie à ~1 km)');
  });

  it('aucun départ : « Non renseigné »', () => {
    render(<CompasScreen data={dataWith({ source: 'aucun' })} initialStep="ou" />);
    expect(cardRow().textContent).toContain('Non renseigné');
  });

  it('départ d’une autre personne : rien de son domicile ni de sa position', () => {
    render(<CompasScreen data={dataWith({ source: 'autre' })} initialStep="ou" />);
    expect(cardRow().textContent).toContain('Non montré');
  });

  it('un écran plus ancien (sans « departure ») : « Non renseigné », rien ne casse', () => {
    render(<CompasScreen data={dataWith(undefined)} initialStep="ou" />);
    expect(cardRow().textContent).toContain('Non renseigné');
  });

  it('toucher la ligne ouvre Préférences, où le départ se règle', async () => {
    render(<CompasScreen data={withSaid()} initialStep="ou" />);
    fireEvent.click(cardRow());
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    expect(within(block(sheet)).getByTestId('departure-value').textContent).toBe('Lyon');
  });

  it('sortie de quelques heures (pas de trajet d’approche) : ni ligne ni bloc', async () => {
    const context = resolveProjectContext({
      activity: 'hiking',
      days: 1,
      hours: 3,
      partySize: 2,
      month: 10,
      project: null,
      profile: null,
    });
    expect(context.modules.transport).toBe(false);
    const data = dataWith({ source: 'aucun' }, { context });
    render(<CompasScreen data={data} initialStep="ou" />);
    expect(screen.queryByText('Départ')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
    const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Préférences/ }));
    expect(within(sheet).queryByTestId('departure')).toBeNull();
  });
});

describe('Où · Préférences · Départ : ce que dit chaque source', () => {
  it('départ dit : le lieu, sa source, ce que ça change', async () => {
    const sheet = await openDeparture(withSaid());
    const b = block(sheet);
    expect(within(b).getByTestId('departure-value').textContent).toBe('Lyon');
    expect(b.textContent).toContain('départ dit');
    expect(b.textContent).toContain('Le trajet d’approche est chiffré depuis là.');
    expect(b.getAttribute('data-source')).toBe('dit');
  });

  it('domicile : « depuis ton domicile », profil voyageur, aucun nom', async () => {
    const sheet = await openDeparture(dataWith({ source: 'domicile' }));
    const b = block(sheet);
    expect(within(b).getByTestId('departure-value').textContent).toBe('depuis ton domicile');
    expect(b.textContent).toContain('ton profil voyageur');
    expect(b.textContent).toContain(
      'Le nom de ton domicile n’est jamais affiché ni rangé sur le voyage.'
    );
  });

  it('position : « depuis ta position (arrondie à ~1 km) », aucune coordonnée', async () => {
    const sheet = await openDeparture(dataWith({ source: 'gps' }));
    const b = block(sheet);
    expect(within(b).getByTestId('departure-value').textContent).toBe(DEPARTURE_GPS);
    expect(b.textContent).toContain('position de ton appareil');
    expect(b.textContent).not.toMatch(/\d+[.,]\d{2,}/);
  });

  it('départ d’une autre personne : dit qu’il n’est pas montré', async () => {
    const sheet = await openDeparture(dataWith({ source: 'autre' }));
    const b = block(sheet);
    expect(within(b).getByTestId('departure-value').textContent).toBe(
      'Départ de la personne qui a lancé la préparation'
    );
    expect(b.textContent).toContain('non montré');
  });

  it('aucun départ : « Trajet non chiffré : point de départ inconnu » et le champ « Ville de départ »', async () => {
    const sheet = await openDeparture(dataWith({ source: 'aucun' }));
    expect(within(block(sheet)).getByTestId('departure-value').textContent).toBe(
      UNKNOWN_ORIGIN_LINE
    );
    expect(UNKNOWN_ORIGIN_LINE).toBe('Trajet non chiffré : point de départ inconnu');
    expect(field(sheet).placeholder).toBe('Ville de départ');
    expect(within(sheet).queryByRole('button', { name: 'Effacer le départ' })).toBeNull();
  });
});

describe('vie privée : le domicile n’est jamais nommé', () => {
  // Défense en profondeur : même si un nom de domicile arrivait jusqu'à l'écran, aucune source sauf « dit » ne l'affiche.
  const LEAKY = {
    source: 'domicile',
    name: 'Villeurbanne',
    lat: 45.77,
    lon: 4.88,
  } as unknown as Departure;

  it('le texte et la ligne de carte ignorent tout nom hors départ dit', () => {
    for (const source of ['domicile', 'gps', 'autre', 'aucun'] as const) {
      const d = { source, name: 'Villeurbanne' } as Departure;
      expect(JSON.stringify(departureText(d))).not.toContain('Villeurbanne');
      expect(departureRowValue(d)).not.toContain('Villeurbanne');
    }
    expect(departureText(LEAKY).value).toBe('depuis ton domicile');
  });

  it('à l’écran, ni dans la carte, ni dans Préférences, ni dans une annonce', async () => {
    const data = dataWith(LEAKY);
    const sheet = await openDeparture(data);
    expect(document.body.textContent).not.toContain('Villeurbanne');
    expect(document.body.innerHTML).not.toContain('Villeurbanne');
    expect(document.body.innerHTML).not.toContain('45.77');
    expect(block(sheet).textContent).toContain('depuis ton domicile');
    fireEvent.change(field(sheet), { target: { value: 'Grenoble' } });
    fireEvent.submit(field(sheet).closest('form') as HTMLFormElement);
    await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(1));
    expect(document.body.textContent).not.toContain('Villeurbanne');
  });

  it('le départ dit, lui, est un fait du voyage : il est nommé', async () => {
    const sheet = await openDeparture(withSaid());
    expect(block(sheet).textContent).toContain('Lyon');
  });
});

describe('poser un départ : le champ « Ville de départ »', () => {
  it('enregistre par la même écriture que « Dis-le » (compasSetOriginAction), puis vide le champ', async () => {
    const sheet = await openDeparture(dataWith({ source: 'aucun' }));
    fireEvent.change(field(sheet), { target: { value: '  Lyon ' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Partir de cette ville' }));
    await waitFor(() =>
      expect(compas.compasSetOriginAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: SLUG,
        place: 'Lyon',
      })
    );
    expect(await screen.findByText('Départ enregistré')).toBeTruthy();
    await waitFor(() => expect(field(sheet).value).toBe(''));
  });

  it('Entrée dans le champ suffit', async () => {
    const sheet = await openDeparture(dataWith({ source: 'aucun' }));
    fireEvent.change(field(sheet), { target: { value: 'Grenoble' } });
    fireEvent.submit(field(sheet).closest('form') as HTMLFormElement);
    await waitFor(() =>
      expect(compas.compasSetOriginAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: SLUG,
        place: 'Grenoble',
      })
    );
  });

  it('aucun départ avant : « Annuler » l’efface, sans rien chercher', async () => {
    const sheet = await openDeparture(dataWith({ source: 'aucun' }));
    fireEvent.change(field(sheet), { target: { value: 'Lyon' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Partir de cette ville' }));
    await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(2));
    expect(compas.compasSetOriginAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: SLUG,
      place: null,
    });
  });

  it('lieu introuvable : l’erreur est dite, rien n’est annoncé enregistré, le texte reste', async () => {
    compas.compasSetOriginAction.mockResolvedValueOnce({
      success: false,
      error: '« Atlantide » introuvable sur la carte.',
    });
    const sheet = await openDeparture(dataWith({ source: 'aucun' }));
    fireEvent.change(field(sheet), { target: { value: 'Atlantide' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Partir de cette ville' }));
    expect(await screen.findByText('« Atlantide » introuvable sur la carte.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    expect(field(sheet).value).toBe('Atlantide');
  });

  it('un seul caractère ne s’envoie pas', async () => {
    const sheet = await openDeparture(dataWith({ source: 'aucun' }));
    fireEvent.change(field(sheet), { target: { value: 'L' } });
    expect(
      (within(sheet).getByRole('button', { name: 'Partir de cette ville' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.submit(field(sheet).closest('form') as HTMLFormElement);
    expect(compas.compasSetOriginAction).not.toHaveBeenCalled();
  });

  it('depuis le domicile ou la position, on peut partir d’ailleurs', async () => {
    for (const source of ['domicile', 'gps'] as const) {
      const sheet = await openDeparture(dataWith({ source }));
      expect(field(sheet).placeholder).toBe('Ville de départ');
      expect(within(sheet).queryByRole('button', { name: 'Effacer le départ' })).toBeNull();
      cleanup();
    }
  });
});

describe('remplacer ou effacer un départ dit', () => {
  it('remplacer : le nouveau lieu est écrit, « Annuler » rétablit l’ancien tel que rangé', async () => {
    const sheet = await openDeparture(withSaid());
    expect(field(sheet).placeholder).toBe('Partir d’une autre ville');
    fireEvent.change(field(sheet), { target: { value: 'Grenoble' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remplacer le départ' }));
    await waitFor(() =>
      expect(compas.compasSetOriginAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: SLUG,
        place: 'Grenoble',
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(2));
    expect(compas.compasSetOriginAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: SLUG,
      place: 'Lyon',
      restore: LYON,
    });
  });

  it('effacer : le départ est retiré sans rien chercher, « Annuler » le rétablit', async () => {
    const sheet = await openDeparture(withSaid());
    fireEvent.click(within(sheet).getByRole('button', { name: 'Effacer le départ' }));
    await waitFor(() =>
      expect(compas.compasSetOriginAction).toHaveBeenCalledWith({
        tripId: TRIP,
        tripSlug: SLUG,
        place: null,
      })
    );
    expect(await screen.findByText('Départ effacé')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(compas.compasSetOriginAction).toHaveBeenCalledTimes(2));
    expect(compas.compasSetOriginAction).toHaveBeenLastCalledWith({
      tripId: TRIP,
      tripSlug: SLUG,
      place: 'Lyon',
      restore: LYON,
    });
  });

  it('effacer refusé par le serveur : l’erreur est dite', async () => {
    compas.compasSetOriginAction.mockResolvedValueOnce({
      success: false,
      error: 'Impossible d’enregistrer le lieu de départ.',
    });
    const sheet = await openDeparture(withSaid());
    fireEvent.click(within(sheet).getByRole('button', { name: 'Effacer le départ' }));
    expect(await screen.findByText('Impossible d’enregistrer le lieu de départ.')).toBeTruthy();
  });
});

describe('lecture seule', () => {
  it('un lecteur voit le départ, sans champ ni bouton pour le changer', async () => {
    const sheet = await openDeparture(withSaid({ canEdit: false }));
    expect(within(block(sheet)).getByTestId('departure-value').textContent).toBe('Lyon');
    expect(within(sheet).queryByLabelText('Ville de départ')).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Effacer le départ' })).toBeNull();
    expect(compas.compasSetOriginAction).not.toHaveBeenCalled();
  });
});

describe('accessibilité du bloc Départ', () => {
  it.each([
    ['dit', { source: 'dit', name: 'Lyon' } as Departure],
    ['domicile', { source: 'domicile' } as Departure],
    ['aucun', { source: 'aucun' } as Departure],
  ])('%s : aucune violation WCAG 2.2 AA relevable par axe', async (_name, departure) => {
    const sheet = await openDeparture(dataWith(departure));
    expect(await scan(block(sheet))).toEqual([]);
  });
});
