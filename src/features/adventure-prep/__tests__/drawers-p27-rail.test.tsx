// @vitest-environment jsdom

/**
 * P2.7 - « Ajouter » est un rail de lieux REELS, au defilement infini.
 *
 * Le composant existant demandait un intitule libre : on ecrivait donc le nom
 * d une etape a la main. C etait la seule endroit du preparateur ou un lieu
 * pouvait etre invente.
 *
 * Ce test prouve les trois morceaux qui font un « defilement infini
 * geolocalise », pas une liste longue :
 *
 *   1. L'ALIMENTATION vient de la source reelle, interrogee autour du trace du
 *      jour choisi. Le trace se mesure, donc la requete aussi.
 *   2. L'ELARGISSEMENT est reel : la page suivante agrandit la zone
 *      interrogeee (le rayon croit), et n'ajoute que des lieux inconnus.
 *   3. L'ARRET est dit. Au-dela du rayon maximal, le rail ne recommence pas a
 *      elargir : il l annonce.
 *
 * Regle de preuve : deux morsants.
 *   1. On retire le tri -> le test 04 tombe : sans tri mesure, l'ordre du rail
 *      n'est plus une donnee.
 *   2. On retire la sentinelle d'IntersectionObserver -> le test 07 tombe : le
 *      rail ne defile plus, il affiche une page et c'est tout.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { AddStepRail, RAIL_KINDS } from '../components/PrepAddStepRail';
import { RAIL_MAX_REACH_KM, reachForPage } from '../engine/stepAlternatives';
import { buildItinerary } from '../engine/itinerary';
import { haversineKm } from '../engine/routing';
import { A_VERIFIER } from '../engine/trust';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';
import type { PlaceCandidate } from '../engine/places';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/* --- Un IntersectionObserver pilotable : le rail doit vraiment defiler --- */
type Entree = { isIntersecting: boolean };
let observateurs: ((entrees: Entree[]) => void)[] = [];

class ObserverShim {
  constructor(private readonly rappel: (entrees: Entree[]) => void) {
    observateurs = [rappel];
  }
  observe() {}
  unobserve() {}
  disconnect() {
    // Un observateur reel NE rappelle plus apres un disconnect. Un shim qui
    // garderait le rappel pretenterait que le rail defile encore alors que le
    // composant a arre de l'ecouter : le test 08 ne verrait plus rien.
    observateurs = observateurs.filter((autre) => autre !== this.rappel);
  }
}
/**
 * Le rail n'observe sa sentinelle qu'une fois le contenu rendu ET le
 * chargement termine. Defiler avant cela declencherait dans le vide : on
 * attend donc l'observateur, puis on fait réellement entrer la sentinelle.
 */
async function defiler() {
  await waitFor(() => expect(observateurs.length).toBeGreaterThan(0), { timeout: 2000 });
  act(() => {
    observateurs.forEach((rappel) => rappel([{ isIntersecting: true }]));
  });
}

beforeAll(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ObserverShim;
});

afterEach(() => {
  cleanup();
  observateurs = [];
});

/** Le programme LOCALISE : sans coordonnees, le rail n'a rien a proposer. */
const LOCALISE: ItineraryModel = (() => {
  const model = buildItinerary(fullDraft());
  // Le repli regles DOIT produire un programme : ces tests instrumentent le
  // moteur, ils ne le sapent pas. Sans ce tri, tout le reste reste nullable.
  if (model === null) throw new Error('buildItinerary a rendu null : le repli regles est casse');
  const jour1 = model.steps.filter((s) => s.day === 1);
  return {
    ...model,
    steps: model.steps.map((step) => {
      if (step.day !== 1) return { ...step, lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };
      if (step.kind === 'nuit') {
        return { ...step, placeId: ARGENTIERE.id, placeName: ARGENTIERE.name, lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };
      }
      const index = jour1.findIndex((s) => s.id === step.id);
      const ratio = jour1.length <= 1 ? 0 : index / (jour1.length - 1);
      return {
        ...step,
        lat: CHAMONIX.lat + (ARGENTIERE.lat - CHAMONIX.lat) * ratio,
        lon: CHAMONIX.lon + (ARGENTIERE.lon - CHAMONIX.lon) * ratio,
      };
    }),
  };
})();

const BROUILLON: AdventurePrepDraft = { ...fullDraft(), itinerary: LOCALISE };
const ANCRES = LOCALISE.steps.filter((s) => s.day === 1).map((s) => ({ lat: s.lat!, lon: s.lon! }));

/**
 * Le trace du jour 1 est la droite Chamonix -> Argentiere. Un lieu decale le
 * LONG de cette droite ne s'eloignerait pas du parcours : c'est un decalage
 * PERPENDICULAIRE, en kilometres reels, qui produit des distances reellement
 * distinctes les unes des autres.
 */
const AXE = (() => {
  const ux = (ARGENTIERE.lon - CHAMONIX.lon) * 111 * Math.cos((CHAMONIX.lat * Math.PI) / 180);
  const uy = (ARGENTIERE.lat - CHAMONIX.lat) * 111;
  const norme = Math.hypot(ux, uy);
  return { lat: uy / norme, lon: ux / norme };
})();

/** Un decalage de `km` kilometres REELS a la droite du trace. */
function decalage(km: number): { dLat: number; dLon: number } {
  return {
    dLat: (-AXE.lon * km) / 111,
    dLon: (AXE.lat * km) / (111 * Math.cos((ANCRES[0].lat * Math.PI) / 180)),
  };
}

function lieu(id: string, name: string, category: string, km: number, price: number | null = 42) {
  const { dLat, dLon } = decalage(km);
  return {
    id,
    name,
    category,
    lat: ANCRES[0].lat + dLat,
    lon: ANCRES[0].lon + dLon,
    pricePerNight: price,
  } as PlaceCandidate;
}

/**
 * Des lieux REELS : points de vue, un hebergement, un magasin, un deja pose.
 *
 * L'ordre de cette liste est celui d'une requete qui n'a pas d'ORDRE BY : le
 * plus loin d'abord, le magasin au milieu. Il ne coincide NI avec la distance
 * NI avec l'alphabet. Un rail qui n' trierait pas afficherait donc exactement
 * cette suite, et les tests 04 et 06 le verraient.
 */
const CATALOGUE: PlaceCandidate[] = [
  lieu('v-loin', 'Col de la Vallee', 'col', 20),
  lieu('b-magasin', 'Boutique du village', 'shop', 3),
  lieu('v-proche', 'Belvedere du Col', 'viewpoint', 2),
  // Deja porte par le programme du jour 1 : reproposer n'est pas un ajout.
  // La source le connait par son identifiant de CATALOGUE, comme le fait
  // l'analyseur de lieux ; c'est sur cet identifiant que le doublon se voit.
  {
    ...lieu('v-deja', ARGENTIERE.name, 'viewpoint', 0),
    lat: ARGENTIERE.lat,
    lon: ARGENTIERE.lon,
    catalogId: ARGENTIERE.id,
  } as PlaceCandidate,
  lieu('h-refuge', 'Refuge de l Arve', 'refuge', 5),
  lieu('v-moyen', 'Belvedere des Aiguilles', 'viewpoint', 9),
];

function monter(draft: AdventurePrepDraft = BROUILLON, loadPlaces = () => Promise.resolve(CATALOGUE)) {
  const actions = { addStepToDay: vi.fn().mockResolvedValue(undefined) };
  const onClose = vi.fn();
  render(
    <AddStepRail
      draft={draft}
      actions={actions as never}
      onClose={onClose}
      day={1}
      loadPlaces={loadPlaces}
    />,
  );
  return { actions, onClose };
}

function nomsRail(): string[] {
  return Array.from(document.querySelectorAll('ul.prep-sheet-rail li .t1')).map(
    (n) => n.textContent ?? '',
  );
}

describe('P2.7 - Ajouter : un rail de lieux reels', () => {
  it('01 - sans programme, le tiroir dit ce qui manque', () => {
    monter({ ...BROUILLON, itinerary: null });
    expect(document.body.textContent ?? '').toMatch(/Il faut d.abord un programme/);
    expect(document.querySelector('ul.prep-sheet-rail')).toBeNull();
  });

  it('02 - un jour sans point localise : aucune position, donc aucune proposition', () => {
    // Meme programme, mais aucune coordonnee : proposer un lieu autour
    // reviendrait a choisir ou il est.
    const sansPointes: ItineraryModel = {
      ...LOCALISE,
      steps: LOCALISE.steps.map((step) => ({ ...step, lat: null, lon: null })),
    };
    monter({ ...BROUILLON, itinerary: sansPointes });
    const corps = document.body.textContent ?? '';
    expect(corps).toMatch(/aucun point réellement localisé/i);
    expect(nomsRail()).toHaveLength(0);
  });

  it('03 - la vraie source est interrogee autour du TRACE du jour', async () => {
    const loadPlaces = vi.fn(() => Promise.resolve(CATALOGUE));
    monter(BROUILLON, loadPlaces);
    await waitFor(() => expect(loadPlaces).toHaveBeenCalled());
    const [points] = loadPlaces.mock.calls[0] as unknown as [{ lat: number; lon: number }[]];
    // La zone demandee est le trace du jour, plus un anneau d'elargissement
    // centre sur le parcours. On mesure donc depuis le CENTROIDE du trace,
    // qui est le point de reference reel de l'anneau.
    const centre = {
      lat: ANCRES.reduce((t, a) => t + a.lat, 0) / ANCRES.length,
      lon: ANCRES.reduce((t, a) => t + a.lon, 0) / ANCRES.length,
    };
    // Le trace entier est demande, point par point : rien du parcours n'est
    // sous-represente, meme s'il est etire.
    for (const ancre of ANCRES) expect(points).toContainEqual(ancre);
    // Un point qui n'est pas sur le trace vient de l'anneau : il ne peut pas
    // etre plus eloigne du trace que le rayon de la page, plus la demi-etendue
    // du parcours lui-meme (l'anneau est centre sur le parcours, pas sur une
    // ancre).
    const etendue = Math.max(...ANCRES.map((a) => haversineKm(centre, a)));
    for (const point of points) {
      const surLeTrace = ANCRES.some(
        (a) => Math.abs(a.lat - point.lat) < 1e-9 && Math.abs(a.lon - point.lon) < 1e-9,
      );
      const auPlusPres = Math.min(...ANCRES.map((a) => haversineKm(a, point)));
      expect(surLeTrace || auPlusPres <= reachForPage(0) + etendue + 0.5).toBe(true);
      // Et jamais au-dela du rayon maximal : l'elargissement est borne.
      expect(haversineKm(centre, point)).toBeLessThanOrEqual(RAIL_MAX_REACH_KM);
    }
  });

  it('04 - les lieux sont classes par la distance reelle au trace', async () => {
    monter(BROUILLON);
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    const noms = nomsRail();
    // Un magasin n'est pas un point de vue, et un deja pose n'est pas un ajout.
    expect(noms).not.toContain('Boutique du village');
    expect(noms).not.toContain(ARGENTIERE.name);
    // L'ordre est bien la distance au point du parcours le plus proche.
    const distances = noms.map((nom) => {
      const candidat = CATALOGUE.find((c) => c.name === nom)!;
      return Math.min(...ANCRES.map((a) => haversineKm(a, { lat: candidat.lat, lon: candidat.lon })));
    });
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
    }
  });

  it('05 - changer de nature ne montre que les vraies categories', async () => {
    monter(BROUILLON);
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    // « Hébergement » : le refuge, et rien des points de vue.
    fireEvent.click(screenBouton('Hébergement'));
    await waitFor(() => expect(nomsRail()).toEqual(['Refuge de l Arve']));
    // « Pause » et « Lieu » partagent des categories : le filtre est le meme.
    fireEvent.click(screenBouton('Lieu'));
    await waitFor(() => expect(nomsRail()).toContain('Belvedere du Col'));
  });

  it('06 - le tri par nom est un TRI, mesure sur le nom', async () => {
    monter(BROUILLON);
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    const parDistance = nomsRail();
    fireEvent.click(screenBouton('Par nom'));
    await waitFor(() => expect(nomsRail()).not.toEqual(parDistance));
    const parNom = nomsRail();
    expect(parNom).toEqual([...parNom].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('07 - le defilement infini elargit REELLEMENT la zone interrogee', async () => {
    const loadPlaces = vi.fn(() => Promise.resolve(CATALOGUE));
    monter(BROUILLON, loadPlaces);
    await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(1));
    const page0 = (loadPlaces.mock.calls[0] as unknown as [{ lat: number }[]])[0];

    await defiler();
    await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(2));
    const page1 = (loadPlaces.mock.calls[1] as unknown as [{ lat: number }[]])[0];

    // La page 1 interroge une zone reellement plus grande.
    expect(Math.max(...page1.map((p) => p.lat))).toBeGreaterThan(Math.max(...page0.map((p) => p.lat)));
    expect(reachForPage(1)).toBeGreaterThan(reachForPage(0));
    // Le rail ne perd rien et ne repete rien.
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    const noms = nomsRail();
    expect(new Set(noms).size).toBe(noms.length);
  });

  it('08 - au-dela du rayon maximal, le rail S ARRETE et le dit', async () => {
    // Une source qui rend de quoi remplir jusqu'au bout : le rail doit le dire
    // plutot que de continuer a elargir indefiniment.
    const plein = Array.from({ length: 40 }, (_, i) =>
      lieu('p-' + i, 'Point ' + String(i).padStart(2, '0'), 'viewpoint', 4 + i * 6),
    );
    const loadPlaces = vi.fn(() => Promise.resolve(plein));
    monter(BROUILLON, loadPlaces);
    await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(1));
    // Le nombre de defilements avant la bute n'est PAS invente ici : il se
    // deduit des constantes du moteur. Au-dela, le rayon ne croit plus.
    const pagesAvantButee = Array.from({ length: 64 }, (_, i) => i).filter(
      (page) => reachForPage(page) < RAIL_MAX_REACH_KM,
    ).length;
    for (let i = 0; i < pagesAvantButee; i += 1) {
      await defiler();
      await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(i + 2), { timeout: 2000 });
    }
    expect(document.body.textContent ?? '').toContain('Rayon maximal atteint');
    // Vraiment arrete : le composant a retire sa sentinelle, donc defiler
    // n'appelle plus personne. Sans cela, le rail.elargirait a l'infini.
    await new Promise((r) => setTimeout(r, 50));
    expect(observateurs).toHaveLength(0);
    // Le rayonButee est une borne, pas un nombre de pages a boucler.
    expect(reachForPage(999)).toBe(RAIL_MAX_REACH_KM);
    // Et l'elargissement s'est reellement arrete la : chaque page a demande
    // une zone plus grande, et la derniere a touche la borne.
    expect(reachForPage(pagesAvantButee)).toBe(RAIL_MAX_REACH_KM);
  });

  it('09 - choisir un lieu AJOUTE au bon jour, avec le bon type', async () => {
    const { actions, onClose } = monter(BROUILLON);
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    fireEvent.click(document.querySelector('ul.prep-sheet-rail button.li') as HTMLButtonElement);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.addStepToDay).toHaveBeenCalledWith(
      1,
      'arret',
      expect.objectContaining({ placeName: nomsRail()[0] }),
    );
  });

  it('10 - un prix inconnu reste « a verifier », jamais un chiffre', async () => {
    const sansPrix = CATALOGUE.map((c) => ({ ...c, pricePerNight: null }));
    monter(BROUILLON, () => Promise.resolve(sansPrix));
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    const corps = document.body.textContent ?? '';
    expect(corps).toContain(A_VERIFIER);
    expect(corps).not.toMatch(/\d+\s*€/);
  });

  it('11 - le rail est un RAIL : une rangee qui defile, pas une liste', async () => {
    monter(BROUILLON);
    await waitFor(() => expect(nomsRail().length).toBeGreaterThan(0));
    const rail = document.querySelector('ul.prep-sheet-rail');
    expect(rail).not.toBeNull();
    // Toutes les lignes sont DANS le rail, pas a cote.
    expect(rail?.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(rail?.querySelector('.prep-sheet-rail__sentinel')).not.toBeNull();
    // La nature est choisie par des puces, et les quatre natures existent.
    const puces = Array.from(document.querySelectorAll('.prep-sheet-rail__chip')).map((c) => c.textContent);
    for (const { label } of RAIL_KINDS) expect(puces).toContain(label);
  });
});

function screenBouton(nom: string): HTMLButtonElement {
  const bouton = Array.from(document.querySelectorAll('button.prep-sheet-rail__chip')).find(
    (b) => b.textContent === nom,
  );
  if (!bouton) throw new Error('puce introuvable: ' + nom);
  return bouton as HTMLButtonElement;
}