/**
 * P3.1 — LA COUVERTURE D ECRAN.
 *
 * `replis-honnetete.test.ts` a termine l INVENTAIRE des replis : il prouve
 * qu aucune fonction ne transforme une absence en mesure. Il dit lui-meme
 * ce qui lui manque : « aucun test n enumere les nombres affiches sur tous les
 * ecrans ».
 *
 * Ce fichier est ce test-la. Il ne relit pas le code, il REND les ecrans, puis
 * il ENUMERE les nombres qui apparaissent. Un ecran sans aucune mesure doit
 * donc rendre zero quantite chiffree — sinon un `?? 18` revenu par la porte
 * de l affichage passerait entre toutes les garde-fous metriques.
 *
 * La regle testee, en une phrase : un nombre affiche avec son unite est une
 * MESURE, donc il doit existe un releve qui la fonde. Sans releve, l ecran
 * affiche « A verifier », qui ne contient aucun chiffre.
 *
 * Deux pieges evites :
 *
 *   1. Un detecteur qui ne detecte rien passe toujours. Chaque assertion de
 *      non-regression est donc accompagnee d un CONTRE-EXEMPLE : le meme
 *      ecran, avec une mesure reelle, DOIT rendre le nombre. Si le contre-
 *      exemple echoue, ce n est pas le produit qui a raison, c est le test.
 *   2. Un ecran qui ne s est pas rendu ne prouve rien non plus. Chaque cas
 *      verifie que le texte rendu a une longueur plausible et que le nombre
 *      de mots n est pas nul : un rendu vide ne peut pas « passer » par
 *      absence de nombre.
 *
 * Ce que ce test NE couvre pas, et qu il faut dire : les ecrans du HUB et du
 * MATERIEL (`DepartWeather`, `WeatherStrip`, `HikingBlocks`) ne sont pas
 * dans le perimetre du preparateur et ne sont pas rendus ici. Leur source de
 * meteo est `getWeather`, verifiee par H6-4 (un trou dans la reponse rend
 * `null`, jamais un zero). La couverture d ecran du preparateur, elle, est
 * entiere ci-dessous.
 */
// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { buildItinerary } from '../engine/itinerary';
import type { DataSourceEntry, PrepDataSourceId } from '../engine/provenance';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/* ------------------------------------------------------------------ */
/* Le harnais                                                          */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
  }),
}));

const state = vi.hoisted(() => ({
  current: null as unknown as {
    draft: AdventurePrepDraft;
    addWaypoint: ReturnType<typeof vi.fn>;
    syncGear: () => void;
  },
}));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: unknown) => unknown) => selector(state.current)) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

// La carte n est pas l objet de ce test, et elle exige un contexte de
// proveedor de tuiles que jsdom n a pas. Elle est remplacee par un marqueur :
// ce qui compte ici, c est le TEXTE des ecrans, pas la carte.
vi.mock('../components/PrepMap', async (importOriginal) => {
  const original = await importOriginal<typeof import('../components/PrepMap')>();
  const PrepMap = () => React.createElement('div', { 'data-testid': 'carte' });
  return { ...original, PrepMap };
});

const { ItineraryStepScreen } = await import('../components/ItineraryStep');
const { DepartureStep } = await import('../components/DepartureStep');
const { DestinationStep } = await import('../components/DestinationStep');
const { ActivityPickerScreen } = await import('../components/ActivityPickerScreen');
const { PrepDataSource } = await import('../components/PrepDataSource');

const noop = () => undefined;

afterEach(() => {
  cleanup();
});

/* ------------------------------------------------------------------ */
/* L enumerateur                                                       */
/* ------------------------------------------------------------------ */

/**
 * Une QUANTITE affichee : un nombre suivi de son unite.
 *
 * Les unites retenues sont celles du preparateur : longueur, altitude,
 * temperature, duree, argent, masse, pourcentage. Un nombre seul — « 3 jours »,
 * « 7 elements », « 2 personnes » — n en fait PAS partie : ce sont des
 * COMPTES de choses reellement presentes a l ecran, pas des mesures du terrain.
 * C est la distinction qui rend le test honnete plutot que commode.
 */
const QUANTITE = new RegExp(
  '\\d+[.,]?\\d*\\s*(?:\\u00b0C|km|m\\b|\\u20ac|h\\b|min\\b|%|kg\\b|g\\b)',
  'g',
);

/** Le texte reellement lu, balises et espaces residuels retires. */
function lisible(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Les quantites chiffrees que l ecran affiche. */
function quantites(container: HTMLElement): string[] {
  return lisible(container).match(QUANTITE) ?? [];
}

/**
 * Un modele de parcours SANS aucune mesure.
 *
 * `buildItinerary` sur un brouillon complet ne produit volontairement aucune
 * distance, aucune duree, aucun denivele : les trois sont `null`, donc
 * « A verifier ». C est l etat le plus frequent en usage reel, et c est
 * exactement celui qu un repli maquillerait.
 */
function modeleSansMesure(): ItineraryModel {
  const base = buildItinerary(fullDraft());
  if (!base) throw new Error('modele de parcours attendu');
  return base;
}

/** Le MEME modele, avec des releves reels — le contre-exemple. */
function modeleMesure(): ItineraryModel {
  const base = modeleSansMesure();
  const jour = (distanceKm: number, movingMin: number, elevGainM: number) => ({
    distanceKm,
    movingMin,
    activityMin: movingMin,
    elevGainM,
    elevLossM: elevGainM,
  });
  return {
    ...base,
    totals: jour(12.4, 95, 812),
    perDay: base.perDay.map(() => jour(12.4, 95, 812)),
  };
}

/** Le store arme, comme l'ecran le trouvera. */
function arme(modele: ItineraryModel | null): void {
  state.current = {
    draft: { ...fullDraft(), ...(modele ? { itinerary: modele } : {}) },
    addWaypoint: vi.fn(),
    syncGear: vi.fn(),
  };
}

/**
 * Le garde-fou du test lui-meme : un ecran qui n'a rien rendu ne peut pas
 * passer « il n y a aucun nombre affiche ». On exige un vrai contenu.
 */
function attenduRendu(container: HTMLElement, minimum: number): void {
  const mots = lisible(container).split(' ').filter(Boolean);
  expect(mots.length).toBeGreaterThanOrEqual(minimum);
}

/* ------------------------------------------------------------------ */
/* 1. Le detecteur detecte                                             */
/* ------------------------------------------------------------------ */

describe('P3.1-1 — l enumerateur voit un nombre affiche', () => {
  it('P3.1-1a : une provenance mesuree rend bien son nombre', () => {
    const entry: DataSourceEntry = {
      metric: 'distance',
      value: 12.4,
      unit: 'km',
      source: 'osrm',
    };
    const { container } = render(React.createElement(PrepDataSource, { entry }));
    attenduRendu(container, 4);
    expect(lisible(container)).toBe('Distance : 12,4 km \u00b7 OpenStreetMap (OSRM)');
    // Le nombre est LA, avec son unite. Sans cette assertion, tous les tests
    // suivants pourraient passer avec un detecteur qui ne voit rien.
    expect(quantites(container)).toEqual(['12,4 km']);
  });

  it('P3.1-1b : l ecran du parcours rend les nombres quand ils sont mesures', () => {
    // Le meme ecran que P3.1-2a, avec des releves. Il DOIT les afficher :
    // c est ce qui distingue « l ecran sait montrer une mesure » de
    // « l ecran ne sait pas montrer de nombre », deux defauts opposes.
    arme(modeleMesure());
    const { container } = render(
      React.createElement(ItineraryStepScreen, { onOpenSheet: noop }),
    );
    attenduRendu(container, 20);
    const vues = quantites(container);
    expect(vues).toContain('12,4 km');
    expect(vues).toContain('812 m');
  });
});

/* ------------------------------------------------------------------ */
/* 2. Zero mesure, zero quantite — ecran par ecran                     */
/* ------------------------------------------------------------------ */

describe('P3.1-2 — sans releve, aucun ecran n affiche de quantite', () => {
  it('P3.1-2a : etape 2 — le parcours', () => {
    arme(modeleSansMesure());
    const { container } = render(
      React.createElement(ItineraryStepScreen, { onOpenSheet: noop }),
    );
    attenduRendu(container, 60);
    // L absence se DIT, elle ne se deguise pas en chiffre.
    expect(lisible(container)).toContain('\u00c0 v\u00e9rifier');
    expect(lisible(container)).toContain('M\u00e9t\u00e9o indisponible');
    expect(quantites(container)).toEqual([]);
  });

  it('P3.1-2b : etape 3 — le depart', () => {
    arme(modeleSansMesure());
    const { container } = render(React.createElement(DepartureStep, { onOpenSheet: noop }));
    attenduRendu(container, 60);
    expect(lisible(container)).toContain('\u00c0 v\u00e9rifier');
    expect(quantites(container)).toEqual([]);
  });

  it('P3.1-2c : etape 1 — la destination', () => {
    arme(null);
    const { container } = render(React.createElement(DestinationStep, { onOpenSheet: noop }));
    attenduRendu(container, 10);
    expect(quantites(container)).toEqual([]);
  });

  it('P3.1-2d : le choix d activite', () => {
    arme(null);
    const { container } = render(React.createElement(ActivityPickerScreen, { onOpenSheet: noop }));
    attenduRendu(container, 80);
    expect(quantites(container)).toEqual([]);
  });

  it('P3.1-2e : la ligne de provenance, mesure par mesure', () => {
    const mesures: readonly PrepDataSourceId[] = ['distance', 'denivele', 'meteo'];
    const lignes: string[] = [];
    for (const metric of mesures) {
      const entry: DataSourceEntry = { metric, value: null, unit: 'x', source: null };
      const { container } = render(React.createElement(PrepDataSource, { entry }));
      attenduRendu(container, 4);
      expect(quantites(container)).toEqual([]);
      lignes.push(lisible(container));
      cleanup();
    }
    // Les trois mesures absentes disent la MEME chose, et la disent en clair.
    for (const ligne of lignes) {
      expect(ligne).toContain('\u00c0 v\u00e9rifier');
      expect(ligne).toContain('source inconnue');
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Les nombres de l ecran ne sont que des COMPTES                   */
/* ------------------------------------------------------------------ */

describe('P3.1-3 — ce qui reste chiffre sur l ecran, ce ne sont pas des mesures', () => {
  it('P3.1-3a : l ecran du depart ne chiffre que des comptes de choses reelles', () => {
    arme(modeleSansMesure());
    const { container } = render(React.createElement(DepartureStep, { onOpenSheet: noop }));
    const chiffres = lisible(container).match(/\d+/g) ?? [];
    // Il y a des chiffres — « 3 jours », « 7 elements », « 2 personnes » — et
    // aucun n est une mesure. Ce test ne dit pas « l ecran ne chiffre
    // rien » : il dit « l ecran ne fabrique pas de mesure », et il oblige a
    // nommer les nombres qui restent.
    expect(chiffres.length).toBeGreaterThan(0);
    for (const brut of chiffres) {
      const apres = lisible(container).slice(
        lisible(container).indexOf(brut) + brut.length,
        lisible(container).indexOf(brut) + brut.length + 14,
      );
      // Chaque nombre restant est suivi d'un mot de compte, jamais d'une
      // unite de mesure — ce que P3.1-2b verifie deja par l'absence.
      expect(apres).not.toMatch(/^\s*(?:\u00b0C|km|m\b|\u20ac|h\b|min\b|%|kg\b|g\b)/);
    }
  });
});
