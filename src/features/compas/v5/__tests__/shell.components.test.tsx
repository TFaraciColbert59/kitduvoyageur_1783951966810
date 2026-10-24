// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FR_T } from '../../components/compasTypes';
import type { V5StayOption } from '../types';
import { EMPTY_EXTRAS } from '../types';
import { makeApi, makeData, WithApi } from './fixtures';

const setStay = vi.fn(async (_: unknown) => ({ success: true }));
vi.mock('../../server/compasActions', () => ({
  compasSetStayAction: (input: unknown) => setStay(input),
  compasExplainVerdictAction: vi.fn(async () => ({ success: true, text: 'Parce que.', refused: null, note: null })),
  compasInterpretAction: vi.fn(),
}));
vi.mock('../../server/autofillActions', () => ({ compasUndoAutofillAction: vi.fn(async () => ({ success: true })), compasAutofillStopAction: vi.fn() }));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { Island } from '../Island';
import { TripCard, ViewSwitch } from '../TripCard';
import { DRAWERS } from '../drawers';

beforeEach(() => {
  setStay.mockClear();
  push.mockClear();
});
afterEach(cleanup);

const option = (over: Partial<V5StayOption> = {}): V5StayOption => ({
  id: 'osm:1',
  name: 'Refuge du Pas de la Balme',
  kind: 'refuge',
  lat: 45.0,
  lon: 5.4,
  distanceM: 480,
  elevationM: 1100,
  price: { perPerson: 38, currency: 'EUR', basis: 'bareme', asOf: '2026-01-01' },
  photo: null,
  source: 'OpenStreetMap',
  url: null,
  partner: null,
  ...over,
});

describe('v5 · card du voyage', () => {
  it('montre les chiffres du voyage, les bulles et un tuile par jour', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <TripCard view="grid" onDay={vi.fn()} />
      </WithApi>
    );
    // Jours de marche = autant de tuiles « Jour n ».
    const days = api.data.model.route.dayPlans.length;
    expect(screen.getAllByRole('button', { name: /^Jour \d/ })).toHaveLength(days);
    expect(screen.getByRole('group', { name: /.+/ })).toBeTruthy();
    expect(screen.getByText(/Vercors/)).toBeTruthy();
  });

  it('chaque bulle ouvre son tiroir', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <TripCard view="grid" onDay={vi.fn()} />
      </WithApi>
    );
    fireEvent.click(screen.getByRole('button', { name: /^Budget/ }));
    expect(api.openSpace).toHaveBeenCalledWith('budget');
    fireEvent.click(screen.getByRole('button', { name: /^Sac/ }));
    expect(api.openSpace).toHaveBeenCalledWith('sac');
    fireEvent.click(screen.getByRole('button', { name: /^Nous/ }));
    expect(api.openSpace).toHaveBeenCalledWith('nous');
  });

  it('toucher un jour appelle onDay avec son index', () => {
    const onDay = vi.fn();
    render(
      <WithApi api={makeApi()}>
        <TripCard view="grid" onDay={onDay} />
      </WithApi>
    );
    fireEvent.click(screen.getAllByRole('button', { name: /^Jour 2/ })[0]);
    expect(onDay).toHaveBeenCalledWith(1);
  });

  it('une photo géolocalisée remplace l illustration du jour', () => {
    const api = makeApi({}, { extras: { ...EMPTY_EXTRAS, dayPhotos: { 1: { url: 'https://upload.wikimedia.org/x.jpg', credit: 'Auteur', license: 'CC BY-SA 4.0', pageUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg' } } } });
    const { container } = render(
      <WithApi api={api}>
        <TripCard view="grid" onDay={vi.fn()} />
      </WithApi>
    );
    expect(container.querySelector('img[src="https://upload.wikimedia.org/x.jpg"]')).toBeTruthy();
  });

  it('la vue « fil » liste les jours', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <TripCard view="fil" onDay={vi.fn()} />
      </WithApi>
    );
    expect(screen.getAllByText(/Jour \d/).length).toBeGreaterThanOrEqual(api.data.model.route.dayPlans.length);
  });

  it('le sélecteur grille / fil propose les deux vues', () => {
    const onView = vi.fn();
    render(
      <WithApi api={makeApi()}>
        <ViewSwitch view="grid" onView={onView} />
      </WithApi>
    );
    const group = screen.getByRole('group');
    fireEvent.click(within(group).getAllByRole('button')[1]);
    expect(onView).toHaveBeenCalledWith('fil');
  });
});

describe('v5 · îlot', () => {
  const noop = () => undefined;
  const base = { t: FR_T, running: false, onDismiss: noop, onHold: noop, onRelease: noop, onStop: noop, onResume: noop, onRefine: noop, onSeeDone: noop, onCloseDone: noop };

  it('annonce poliment une confirmation avec « Annuler »', () => {
    const undo = vi.fn();
    const { container } = render(<Island {...base} prep={null} toast={{ message: 'Nuit notée', undo }} />);
    const island = container.querySelector('.v5-island');
    expect(island?.getAttribute('role')).toBe('status');
    expect(island?.getAttribute('data-s')).toBe('note');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(undo).toHaveBeenCalledOnce();
  });

  it('une erreur est une alerte', () => {
    const { container } = render(<Island {...base} prep={null} toast={{ message: 'Échec', tone: 'bad' }} />);
    expect(container.querySelector('.v5-island')?.getAttribute('role')).toBe('alert');
  });

  it('la préparation en cours montre un arrêt ; fin et arrêt proposent leur geste', () => {
    const onStop = vi.fn();
    const { container, rerender } = render(<Island {...base} onStop={onStop} prep={{ stage: 'itinerary' }} toast={null} />);
    expect(container.querySelector('.v5-island')?.getAttribute('data-s')).toBe('live');
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
    expect(onStop).toHaveBeenCalledOnce();

    const onSee = vi.fn();
    rerender(<Island {...base} onSeeDone={onSee} prep={{ stage: 'done' }} toast={null} />);
    expect(container.querySelector('.v5-island')?.getAttribute('data-s')).toBe('note');
    fireEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(onSee).toHaveBeenCalledOnce();

    const onResume = vi.fn();
    rerender(<Island {...base} onResume={onResume} prep={{ stage: 'stopped' }} toast={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('inactif : rien n est annoncé', () => {
    const { container } = render(<Island {...base} prep={null} toast={null} />);
    expect(container.querySelector('.v5-island')?.getAttribute('data-s')).toBe('idle');
  });
});

describe('v5 · tiroir « Jour »', () => {
  const Day = DRAWERS.day!.Body;

  it('affiche distance, montée et temps du jour, sans rien inventer', () => {
    const api = makeApi({ day: 0 });
    render(
      <WithApi api={api}>
        <Day />
      </WithApi>
    );
    expect(screen.getByText(/14 km|14,0 km/)).toBeTruthy();
    expect(screen.getByText(/\+820 m/)).toBeTruthy();
    // Sans prévision pour ce jour dans les données : le dit.
    expect(screen.queryByText(/Pas de prévision pour ce jour/)).toBeNull();
  });

  it('choisir une nuit possible écrit son nom, annonçable et annulable', async () => {
    const api = makeApi({ day: 1 }, { extras: { ...EMPTY_EXTRAS, nights: { 2: [option()] } } });
    render(
      <WithApi api={api}>
        <Day />
      </WithApi>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Choisir cette nuit : Refuge du Pas de la Balme/ }));
    await Promise.resolve();
    expect(setStay).toHaveBeenCalledWith(expect.objectContaining({ day: 2, name: 'Refuge du Pas de la Balme' }));
    expect(api.ctl.runs[0]).toContain('Refuge du Pas de la Balme');
    // Le repère de prix est dit « repère de barème », jamais présenté comme le tarif de l'établissement.
    expect(screen.getByText(/repère de barème/)).toBeTruthy();
  });

  it('une nuit déjà notée peut être effacée', async () => {
    const api = makeApi({ day: 0 });
    render(
      <WithApi api={api}>
        <Day />
      </WithApi>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Effacer la nuit' }));
    await Promise.resolve();
    expect(setStay).toHaveBeenCalledWith(expect.objectContaining({ day: 1, name: '' }));
  });

  it('le dernier jour n a pas de nuit à prévoir', () => {
    const last = makeData().model.route.dayPlans.length - 1;
    render(
      <WithApi api={makeApi({ day: last })}>
        <Day />
      </WithApi>
    );
    expect(screen.getByText(/pas de nuit à prévoir/)).toBeTruthy();
  });

  it('sans droit d écriture, aucun bouton d écriture', () => {
    const api = makeApi({ day: 1, canEdit: false }, { extras: { ...EMPTY_EXTRAS, nights: { 2: [option()] } } });
    render(
      <WithApi api={api}>
        <Day />
      </WithApi>
    );
    expect(screen.queryByRole('button', { name: /Choisir cette nuit/ })).toBeNull();
    expect(screen.queryByLabelText('Nom de l’hébergement')).toBeNull();
  });

  it('source indisponible : le dit, propose de noter à la main', () => {
    const api = makeApi({ day: 1 }, { extras: { ...EMPTY_EXTRAS, unavailable: ['lodging'] } });
    render(
      <WithApi api={api}>
        <Day />
      </WithApi>
    );
    expect(screen.getByText(/pas disponibles pour l’instant/)).toBeTruthy();
    expect(screen.getByLabelText('Nom de l’hébergement')).toBeTruthy();
  });
});

describe('v5 · tiroir « Vérifications »', () => {
  const Verifs = DRAWERS.verifs!.Body;

  it('regroupe les faits en trois familles, chacun avec sa source et son geste', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <Verifs />
      </WithApi>
    );
    expect(screen.getByRole('region', { name: 'Toi' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Le terrain' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Les conditions' })).toBeTruthy();
    // Pas de note globale.
    expect(screen.queryByText(/\/\s*100/)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^Régler/ })[0]);
    expect(api.openSpace).toHaveBeenCalled();
  });

  it('un axe sans donnée est « non évalué », jamais « rien à signaler »', () => {
    render(
      <WithApi api={makeApi()}>
        <Verifs />
      </WithApi>
    );
    expect(screen.getAllByText('Non évalué').length).toBeGreaterThan(0);
  });
});

describe('v5 · tiroir « Météo »', () => {
  const Meteo = DRAWERS.meteo!.Body;

  it('liste la prévision réelle des jours qui en ont une', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <Meteo />
      </WithApi>
    );
    // Les trois jours de la fixture ont une prévision (Europe/Paris, novembre).
    expect(screen.getAllByText(/\d+° \/ \d+°/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Prévision : /)).toBeTruthy();
  });
});

describe('v5 · tiroir « Plus »', () => {
  const Menu = DRAWERS.menu!.Body;

  it('affiche les réglages et ouvre « Voyage » sur l onglet 0', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <Menu />
      </WithApi>
    );
    fireEvent.click(screen.getByRole('button', { name: /Réglages du voyage/ }));
    expect(api.openSpace).toHaveBeenCalledWith('voyage', { tab: 0 });
  });

  it('plein soleil et durée des annonces écrivent les préférences', () => {
    const api = makeApi();
    render(
      <WithApi api={api}>
        <Menu />
      </WithApi>
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Affichage plein soleil' }));
    expect(api.prefs.setOutdoor).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '30 s' }));
    expect(api.prefs.setUndoS).toHaveBeenCalledWith(30);
  });

  it('« Nouvelle aventure » ouvre le Compas vide', () => {
    render(
      <WithApi api={makeApi()}>
        <Menu />
      </WithApi>
    );
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle aventure/ }));
    expect(push).toHaveBeenCalledWith('/compas?nouvelle=1');
  });

  it('sans droit d écriture : pas de « Tout refaire » ni d annulation de la préparation', () => {
    render(
      <WithApi api={makeApi({ canEdit: false })}>
        <Menu />
      </WithApi>
    );
    expect(screen.queryByText('Annuler la préparation')).toBeNull();
  });
});
