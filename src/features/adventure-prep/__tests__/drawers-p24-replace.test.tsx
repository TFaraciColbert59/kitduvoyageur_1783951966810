// @vitest-environment jsdom

/**
 * P2.4 - « Remplacer » propose des alternatives REELLES, ou un silence motive.
 *
 * Le bouton avait ete retire, l alternative jamais ajoutee : l'action promettait
 * sans rien derriere. Ce qui est ferme ici, c est le CONTENU.
 *
 * Ce test ne verifie pas « qu'une liste s'affiche ». Il verifie que la liste
 * vient d'une VRAIE source, qu'elle est classee par une distance REELLE, et
 * surtout qu'elle ne peut pas contenir le lieu qu on est en train de remplacer.
 *
 * Regle de preuve : deux morsants.
 *   1. On retire l'exclusion du lieu lui-meme -> le test 03 tombe.
 *   2. On remplace le message d'absence par un exemple de lieu -> le test 04
 *      tombe : c'est l'interdit central de la checklist, un nom invente.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ReplaceSheet } from '../components/PrepStepReplaceSheet';
import { GAP_LABELS } from '../engine/stepAlternatives';
import { buildItinerary } from '../engine/itinerary';
import { haversineKm } from '../engine/routing';
import { A_VERIFIER } from '../engine/trust';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';
import type { PlaceCandidate } from '../engine/places';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

afterEach(() => cleanup());

/**
 * Le programme LOCALISE, tel qu'un vrai parcours se presente.
 *
 * Le programme de repli ne porte ni coordonnees ni noms de lieux : on ne peut
 * donc pas y exercer l'exclusion, qui porte justement sur le lieu de l'etape.
 * Ici la nuit du jour 1 dort reellement a ARGENTIERE, l'arrivee du trajet, avec
 * les coordonnees reelles du lieu. Toutes les autres etapes sont posees sur le
 * segment Chamonix-Argentiere, par interpolation, ce qui redonne au parcours
 * les points de reference dont `referenceFor` a besoin.
 */
const LOCALISE: ItineraryModel = (() => {
  const model = buildItinerary(fullDraft());
  // Le repli regles DOIT produire un programme : ces tests instrumentent le
  // moteur, ils ne le sapent pas. Sans ce tri, tout le reste reste nullable.
  if (model === null) throw new Error('buildItinerary a rendu null : le repli regles est casse');
  const jour1 = model.steps.filter((s) => s.day === 1);
  return {
    ...model,
    steps: model.steps.map((step) => {
      if (step.day !== 1) {
        // Les journees 2 et 3 partagent l'arrivee : c'est le seul point reel
        // que le programme de repliconnait.
        return { ...step, lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };
      }
      if (step.kind === 'nuit') {
        return {
          ...step,
          placeId: ARGENTIERE.id,
          placeName: ARGENTIERE.name,
          lat: ARGENTIERE.lat,
          lon: ARGENTIERE.lon,
        };
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

const NUIT = LOCALISE.steps.find((s) => s.kind === 'nuit' && s.day === 1)!;
const TRAJET = LOCALISE.steps.find((s) => s.kind === 'trajet' && s.day === 1)!;
const ANCRE = { lat: NUIT.lat!, lon: NUIT.lon! };

function hebergement(id: string, name: string, lat: number, lon: number, catalogId?: string) {
  return { id, name, category: 'refuge', lat, lon, pricePerNight: 42, catalogId } as PlaceCandidate;
}

/**
 * Des points reels, a des distances reellement differentes de l'ancre.
 * Les ecarts sont en degres : 0,03 deg de latitude fait environ 3,3 km, donc
 * les trois refuges sont a moins de 4 km les uns des autres — le meme ordre
 * de grandeur qu'un choix de gite autour d'un village.
 */
const P_PROCHE = { lat: ANCRE.lat + 0.004, lon: ANCRE.lon + 0.005 };
const P_MOYEN = { lat: ANCRE.lat + 0.014, lon: ANCRE.lon + 0.016 };
const P_LOIN = { lat: ANCRE.lat + 0.030, lon: ANCRE.lon + 0.034 };
const P_LUI = { lat: ANCRE.lat + 0.001, lon: ANCRE.lon + 0.001 };

const CATALOGUE: PlaceCandidate[] = [
  hebergement('r-proche', 'Refuge du Col', P_PROCHE.lat, P_PROCHE.lon),
  hebergement('r-moyen', 'Refuge de l Arve', P_MOYEN.lat, P_MOYEN.lon),
  hebergement('r-loin', 'Refuge des Aiguilles', P_LOIN.lat, P_LOIN.lon),
  // Le lieu qu on remplace, par les DEUX chemins d'exclusion du moteur :
  // d'abord par son identifiant de catalogue, puis par son nom normalise —
  // une source peut nommer le lieu sans jamais donner d'identifiant.
  hebergement('r-lui-id', 'Refuge de l Etape', P_LUI.lat, P_LUI.lon, NUIT.placeId!),
  hebergement('r-lui-nom', NUIT.placeName!, P_PROCHE.lat, P_PROCHE.lon),
  // Une categorie incompatible : un magasin n'est pas un hebergement.
  { ...hebergement('b-magasin', 'Boutique du village', P_LUI.lat, P_LUI.lon), category: 'shop' } as PlaceCandidate,
];

const SOURCE = () => Promise.resolve(CATALOGUE);

/** Les noms d'alternatives effectivement rendues, dans l'ordre du tiroir. */
function nomsAlternatives(): string[] {
  return Array.from(document.querySelectorAll('button.li[aria-pressed] .t1')).map(
    (n) => n.textContent ?? '',
  );
}

function monter(stepId: string, loadPlaces: () => Promise<PlaceCandidate[]> = SOURCE) {
  const actions = {
    addStepToDay: vi.fn().mockResolvedValue(undefined),
    dropStep: vi.fn().mockResolvedValue(undefined),
  };
  const onClose = vi.fn();
  render(
    <ReplaceSheet
      draft={BROUILLON}
      actions={actions as never}
      stepId={stepId}
      onClose={onClose}
      loadPlaces={loadPlaces}
    />,
  );
  return { actions, onClose };
}

describe('P2.4 - Remplacer par une alternative reelle', () => {
  it('01 - la VRAIE source est interrogee, autour du point de l etape', async () => {
    const loadPlaces = vi.fn(SOURCE);
    monter(NUIT.id, loadPlaces);
    await waitFor(() => expect(loadPlaces).toHaveBeenCalled());
    const [points, signal] = loadPlaces.mock.calls[0] as unknown as [
      { lat: number; lon: number }[],
      AbortSignal,
    ];
    // Le point demande est celui de l'etape, plus la marge de recherche.
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toEqual(ANCRE);
    expect(signal.aborted).toBe(false);
  });

  it('02 - les alternatives sont classees par la distance REELLE', async () => {
    monter(NUIT.id);
    await waitFor(() => expect(nomsAlternatives().length).toBeGreaterThan(0));
    const noms = nomsAlternatives();
    // Seuls les refuges, tries du plus proche au plus loin.
    expect(noms).toEqual(['Refuge du Col', 'Refuge de l Arve', 'Refuge des Aiguilles']);
    // Et l'ordre est bien celui de la distance, recalculee ici independamment.
    const distances = noms.map((nom) => {
      const candidat = CATALOGUE.find((c) => c.name === nom)!;
      return haversineKm(ANCRE, { lat: candidat.lat, lon: candidat.lon });
    });
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
    }
    // La distance affichee est une mesure, pas un adornement.
    const details = Array.from(document.querySelectorAll('button.li[aria-pressed] .t2')).map(
      (n) => n.textContent ?? '',
    );
    expect(details[0]).toMatch(/\d+([.,]\d+)?\s*km/);
    expect(details[0]).toContain('42');
  });

  it('03 - le lieu qu on remplace n est JAMAIS propose', async () => {
    monter(NUIT.id);
    await waitFor(() => expect(nomsAlternatives().length).toBeGreaterThan(0));
    const corps = document.body.textContent ?? '';
    // Ni par identifiant de catalogue, ni par nom normalise.
    expect(corps).not.toContain('Refuge de l Etape');
    expect(corps).not.toContain('r-lui');
    // Le nom REEL du lieu de l'etape ne doit pas non plus apparaitre comme
    // alternative : c'est l'etape qu on remplace.
    expect(nomsAlternatives()).not.toContain(NUIT.placeName);
    // Et la categorie incompatible non plus : un magasin n'est pas un refuge.
    expect(corps).not.toContain('Boutique du village');
  });

  it('04 - stock vide : le tiroir DIT ce qui manque, il n invente pas de lieu', async () => {
    monter(NUIT.id, () => Promise.resolve([]));
    await waitFor(() => expect(document.body.textContent).toContain(GAP_LABELS['stock-vide']));
    const corps = document.body.textContent ?? '';
    // Aucun bouton d'alternative...
    expect(nomsAlternatives()).toHaveLength(0);
    // ...et aucun nom de lieu offert en exemple.
    expect(corps).not.toMatch(/par exemple/i);
    expect(corps).not.toContain('Refuge');
  });

  it('05 - source muette : le tiroir le dit, il ne remplit rien', async () => {
    monter(NUIT.id, () => Promise.reject(new Error('reseau')));
    await waitFor(() => expect(document.body.textContent).toContain("n'a pas repondu"));
    expect(nomsAlternatives()).toHaveLength(0);
  });

  it('06 - un trajet ne se remplace pas par un lieu : le moteur refuse', () => {
    // Le gap est decide par le moteur, pas par un cas particulier du tiroir.
    expect(GAP_LABELS['type-sans-lieu-compatible']).toMatch(/trajet/i);
    monter(TRAJET.id);
    // Meme avec un catalogue plein, aucune alternative n'est proposee.
    expect(nomsAlternatives()).toHaveLength(0);
    expect(document.body.textContent ?? '').not.toContain('Refuge du Col');
  });

  it('07 - choisir une alternative AJOUTE puis RETIRE, et ferme', async () => {
    const { actions, onClose } = monter(NUIT.id);
    await waitFor(() => expect(nomsAlternatives().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByLabelText(/Remplacer par Refuge du Col/));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // L ajout porte le VRAI lieu de l'alternative, sur le MEME jour et le
    // MEME type que l'etape qu elle remplace.
    expect(actions.addStepToDay).toHaveBeenCalledWith(
      NUIT.day,
      NUIT.kind,
      expect.objectContaining({ title: 'Refuge du Col', placeName: 'Refuge du Col' }),
    );
    // L ajout passe AVANT le retrait : si l'ajout echoue, l'etape d'origine
    // est encore la. L'inverse perdrait le parcours.
    expect(actions.addStepToDay.mock.invocationCallOrder[0]).toBeLessThan(
      actions.dropStep.mock.invocationCallOrder[0],
    );
    expect(actions.dropStep).toHaveBeenCalledWith(NUIT.id);
  });

  it('08 - un prix inconnu reste « a verifier », jamais un chiffre', async () => {
    const sansPrix = CATALOGUE.map((c) => ({ ...c, pricePerNight: null }));
    monter(NUIT.id, () => Promise.resolve(sansPrix));
    await waitFor(() => expect(nomsAlternatives().length).toBeGreaterThan(0));
    const corps = document.body.textContent ?? '';
    expect(corps).toContain(A_VERIFIER);
    // Aucun montant fabrique la ou la source n'en a pas donne.
    expect(corps).not.toMatch(/\d+\s*€/);
  });

  it('09 - une etape absente du parcours : le tiroir le dit et n invente rien', () => {
    monter('d1-trajet-999');
    const corps = document.body.textContent ?? '';
    expect(corps).toMatch(/plus dans le parcours/i);
    expect(nomsAlternatives()).toHaveLength(0);
  });
});