/**
 * E9 — « Remplacer » devient possible, et ce qu'il propose est VRAI.
 *
 * Le constat qui a ouvert l'item : l'action n'existait que comme bouton. Le
 * moteur ne savait pas proposer une alternative a UNE etape — `nearestCompatible`
 * est prive de `places.ts` et son jeu `used` est local a un seul `assignPlaces`.
 * Rejouer l'affectation aurait rendu le MEME parcours : un tirage au sort, pas
 * une alternative.
 *
 * Ce que ces tests verrouillent, c'est la difference entre les deux exclusions,
 * parce qu'elles ne se valent pas :
 *
 *   - l'etape elle-meme : la remplacer par son propre lieu ne remplace rien ;
 *   - TOUT le reste du programme : proposer un lieu deja pose une autre journee
 *     n'est pas une alternative, c'est un doublon qui ferait REMARCHER la
 *     journee. C'est celle-ci qui manquait, et c'est elle que l'ecran aurait
 *     presentee comme une decouverte.
 *
 * Chaque exclusion porte son CONTRE-TEMOIN : le meme lieu doit REVENIR quand on
 * efface le programme. Sans ca, le test passerait aussi bien si le catalogue
 * etait vide, ou si le filtre de categorie etait faux.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import { alternativesFor } from '../engine/stepAlternatives';
import { haversineKm } from '../engine/routing';
import {
  __resetAlternativesLoader,
  __setAlternativesLoader,
  useAdventurePrepStore,
  type StepAlternatives,
} from '../store/useAdventurePrepStore';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { ItineraryModel, ItineraryStep } from '../types';

function candidate(
  id: string,
  name: string,
  category: string,
  lat: number,
  lon: number,
): PlaceCandidate {
  return {
    id,
    catalogId: id,
    name,
    category,
    lat,
    lon,
    description: null,
    region: null,
    country: 'France',
    pricePerNight: null,
    phone: null,
    website: null,
    isVerifiable: true,
  };
}

/* Les lieux REELS du corridor Chamonix - Argentiere, lus dans `/api/pois` le
 * 28 septembre 2026, deduplicates — le meme jeu que `generation-places` et
 * `d3-publication-incriementale`, pour que les deux items ne se contredisent
 * pas sur la meme base. `o-brenta` s'y ajoute : c'est lui qui donne a l'etape
 * testee une CINQUIEME alternative, donc un classement dont l'ordre est
 * verifiable. */
const CANDIDATS: PlaceCandidate[] = [
  candidate('o-mont-blanc', 'Mont Blanc', 'summit', 45.8326, 6.8652),
  candidate('o-gouter', 'Refuge du Gouter', 'refuge', 45.8447, 6.8427),
  candidate('o-torino', 'Rifugio Torino', 'refuge', 45.8634, 6.9876),
  candidate('o-merlet', 'Source du Merlet', 'water', 45.8756, 6.8234),
  candidate('o-midi', 'Aiguille du Midi', 'viewpoint', 45.879, 6.8873),
  candidate('o-plan', 'Refuge du Plan de l Aiguille', 'refuge', 45.8934, 6.8756),
  candidate('o-bivouac', 'Bivouac Lac Blanc', 'camping', 45.91, 6.9),
  candidate('o-lac-blanc', 'Lac Blanc', 'water', 45.9123, 6.9012),
  candidate('o-charpoua', 'Refuge de la Charpoua', 'refuge', 45.9012, 6.9234),
  candidate('o-bossons', 'Torrent des Bossons', 'water', 45.8567, 6.8456),
  candidate('o-brenta', 'Refuge du Brenta', 'refuge', 45.9602, 6.7038),
];

/** Le programme REELLEMENT localise : c'est lui qui porte les lieux occupes. */
function programmeAssigne(): ItineraryModel {
  const model = buildItinerary(fullDraft());
  if (model === null) throw new Error('fixture : le brouillon de base doit etre construisible');
  return assignPlaces(model, CANDIDATS, CHAMONIX, ARGENTIERE);
}

function etape(model: ItineraryModel, id: string): ItineraryStep {
  const trouvee = model.steps.find((step) => step.id === id);
  if (trouvee === undefined) throw new Error(`fixture : l etape ${id} doit exister`);
  return trouvee;
}

/* L'etape sur laquelle porte tout l'item : la nuit du jour 1. Elle est
 * localisee, donc son point de reference est elle-meme — ce qui permet de
 * mesurer une distance a vol d'oiseau contre elle, sans reference exterieure. */
const NUIT_1 = 'd1-nuit-5';
/** Un refuge que le jour 2 porte DEJA : le doublon a interdire. */
const DEJA_PORTE = 'Refuge du Plan de l Aiguille';

describe('E9 — une alternative n est pas un doublon du programme', () => {
  it('E9-10: CONTRE-TEMOIN — sans programme, le refuge du jour 2 EST propose', () => {
    // Si ce lieu n'apparait meme pas ici, E9-11 ne prouverait rien : il pourrait
    // etre absent du catalogue, du rayon, ou de la categorie — pas du programme.
    const model = programmeAssigne();
    const isole = alternativesFor(etape(model, NUIT_1), CANDIDATS, null);
    expect(isole.ranked.map((scored) => scored.candidate.name)).toContain(DEJA_PORTE);
  });

  it('E9-11: des que le programme existe, ce meme refuge disparait', () => {
    const model = programmeAssigne();
    // Le programme porte deja ce refuge le jour 2 : le proposer pour la nuit du
    // jour 1 ferait revenir la personne deux fois au meme endroit.
    expect(model.steps.some((step) => step.placeName === DEJA_PORTE)).toBe(true);
    const avecProgramme = alternativesFor(etape(model, NUIT_1), CANDIDATS, model);
    const noms = avecProgramme.ranked.map((scored) => scored.candidate.name);
    expect(noms).not.toContain(DEJA_PORTE);
    // ... et le lieu de l'etape elle-meme reste exclu, lui aussi.
    expect(noms).not.toContain('Refuge du Gouter');
  });

  it('E9-12: les alternatives restantes sont de vrais lieux, ranges par distance REELLE', () => {
    const model = programmeAssigne();
    const { ranked, reference } = alternativesFor(etape(model, NUIT_1), CANDIDATS, model);
    expect(reference).not.toBeNull();
    // Les quatre lieux encore libres autour du Gouter, le plus proche d'abord.
    // L'ordre n'est pas pose : il est mesure, et il a deja corrige une estimation
    // a la main — le bivouac est plus pres de la Charpoua, de quelques
    // centaines de metres. C'est le havresine qui tranche, pas l'oeil.
    expect(ranked.map((scored) => scored.candidate.name)).toEqual([
      'Bivouac Lac Blanc',
      'Refuge de la Charpoua',
      'Rifugio Torino',
      'Refuge du Brenta',
    ]);
    // La distance est une MESURE : on la recalcule ici, a part.
    for (const scored of ranked) {
      const mesure = haversineKm(reference as { lat: number; lon: number }, {
        lat: scored.candidate.lat,
        lon: scored.candidate.lon,
      });
      expect(scored.distanceKm).toBeCloseTo(mesure, 6);
    }
  });

  it('E9-13: aucun lieu propose n est deja porte par le programme', () => {
    const model = programmeAssigne();
    for (const step of model.steps) {
      if (step.kind === 'trajet') continue;
      const { ranked } = alternativesFor(step, CANDIDATS, model);
      for (const scored of ranked) {
        const occupes = model.steps.some(
          (autre) =>
            autre.placeId === scored.candidate.catalogId ||
            autre.placeName === scored.candidate.name,
        );
        expect(occupes, `${step.title} -> ${scored.candidate.name}`).toBe(false);
      }
    }
  });
});

describe('E9 — l API du store remonte des alternatives, ou dit pourquoi elle ne peut pas', () => {
  const store = () => useAdventurePrepStore.getState();

  beforeEach(() => {
    useAdventurePrepStore.setState({ draft: { ...fullDraft(), itinerary: programmeAssigne() } });
  });

  afterEach(() => {
    __resetAlternativesLoader();
  });

  it('E9-14: le store rend des lieux REELS, et il respecte la demande', async () => {
    __setAlternativesLoader(async () => CANDIDATS);
    const tout = (await store().alternativesForStep(NUIT_1, 10)) as Extract<
      StepAlternatives,
      { etat: 'pret' }
    >;
    expect(tout.etat).toBe('pret');
    expect(tout.stepId).toBe(NUIT_1);
    expect(tout.stepTitle).toBe('Refuge du Gouter');
    expect(tout.places.length).toBe(4);
    // La demande borne, elle ne trie pas : le plus proche reste le premier.
    const deux = await store().alternativesForStep(NUIT_1, 2);
    expect(deux.etat).toBe('pret');
    if (deux.etat !== 'pret' || tout.etat !== 'pret') throw new Error('etat inattendu');
    expect(deux.places.length).toBe(2);
    expect(deux.places.map((scored) => scored.candidate.name)).toEqual(
      tout.places.slice(0, 2).map((scored) => scored.candidate.name),
    );
  });

  it('E9-15: une source muette ne se confond jamais avec une base vide', async () => {
    // Le piege : repondre « la base n'a rien » apres un echec reseau. Ce serait
    // une affirmation FAUSSE sur le catalogue, et l'utilisateur en deduirait a
    // tort qu'il n'y a rien autour de lui.
    __setAlternativesLoader(async () => {
      throw new Error('reseau muet');
    });
    const resultat = await store().alternativesForStep(NUIT_1, 5);
    expect(resultat.etat).toBe('source-muette');
    expect(resultat.places).toEqual([]);
    // La reference, elle, a ete MESUREE avant l'appel : elle reste vraie.
    expect(resultat.reference).not.toBeNull();
  });

  it('E9-16: une source qui repond VIDE, elle, dit que le stock est vide', async () => {
    // Le contre-temoin de E9-15 : meme depart, reponse differente, donc verdict
    // different. Sans lui, « source-muette » pourrait etre la valeur par defaut
    // de n'importe quel echec.
    __setAlternativesLoader(async () => []);
    const resultat = await store().alternativesForStep(NUIT_1, 5);
    expect(resultat.etat).toBe('sans-alternative');
    if (resultat.etat === 'sans-alternative') expect(resultat.raison).toBe('stock-vide');
  });

  it('E9-17: une etape absente du parcours ne remonte aucune alternative', async () => {
    __setAlternativesLoader(async () => CANDIDATS);
    const resultat = await store().alternativesForStep('d9-pas-une-etape', 5);
    expect(resultat.etat).toBe('sans-alternative');
    expect(resultat.places).toEqual([]);
  });

  it('E9-18: une demande absurde ne vide pas une liste mesuree', async () => {
    // `0` veut dire « je n'ai rien demande », pas « il n'y a rien ». Inverser les
    // deux ferait disparaitre le catalogue sous un parametre d'interface.
    __setAlternativesLoader(async () => CANDIDATS);
    for (const demande of [0, -3, Number.NaN]) {
      const resultat = await store().alternativesForStep(NUIT_1, demande);
      expect(resultat.etat).toBe('pret');
      if (resultat.etat === 'pret') expect(resultat.places.length).toBe(4);
    }
  });
});
