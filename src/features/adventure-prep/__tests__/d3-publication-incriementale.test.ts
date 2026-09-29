/**
 * D3 — la carte se trace PENDANT l'affectation des lieux, pas apres.
 *
 * Le constat qui a ouvert cet item : `publishPartial` existait, le store
 * s'y abonnait, et le canal ne publishait qu'APRES la phase `lieux` rendue —
 * donc apres une passe unique qui assignait toutes les etapes d'un coup. Entre
 * le debut et la fin de cette passe, l'ecran n'avait rien de nouveau a
 * dessiner. `setPartial`, lui, n'avait AUCUN site d'appel en production.
 *
 * Ce que ces tests verrouillent, c'est l'instant et l'honnetete du trace :
 *
 *   - il GRANDIT etape par etape, pas en un seul jet a la fin ;
 *   - il ne porte QUE des etapes reellement localisees — une intention non
 *     rattachee n'est pas un point, et la publier dessinerait un trajet que
 *     personne n'a ;
 *   - il ne se dessine pas non plus a partir d'un point unique, qui serait un
 *     point et non un trace ;
 *   - sans origine, RIEN n'est publie : le moteur n'invente pas de depart,
 *     donc il ne peut pas dessiner de depart.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import {
  locatedStepCount,
  MIN_LOCATED_STEPS,
  onGenerationPartial,
} from '../engine/partialBus';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

function candidate(
  id: string,
  name: string,
  category: string,
  lat: number,
  lon: number,
): PlaceCandidate {
  return {
    id,
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
 * 28 septembre 2026, deduplicates. Meme source que `generation-places` : on ne
 * choisit pas un jeu de donnees plus commode pour faire passer le test. */
const CANDIDATES: PlaceCandidate[] = [
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
];

function programme(): ItineraryModel {
  const draft: AdventurePrepDraft = fullDraft();
  const model = buildItinerary(draft);
  if (model === null) throw new Error('fixture : le brouillon de base doit etre construisible');
  return model;
}

/** La totalite des publications d'un `assignPlaces`, dans l'ordre d'arrivee. */
function enCapturant(run: () => void): ItineraryModel[] {
  const recues: ItineraryModel[] = [];
  const desabonner = onGenerationPartial((model) => recues.push(model));
  try {
    run();
  } finally {
    desabonner();
  }
  return recues;
}

describe('D3 — le moteur publie l etape qu il vient de localiser', () => {
  it('D3-01: une affectation publie, et elle publie PLUSIEURS fois', () => {
    const model = programme();
    const recues = enCapturant(() => {
      assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    });
    expect(recues.length).toBeGreaterThan(1);
  });

  it('D3-02: le trace GRANDIT etape par etape, il ne tombe pas d un coup', () => {
    const model = programme();
    const recues = enCapturant(() => {
      assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    });
    // Un jet unique en fin de passe aurait un seul modele, de taille finale.
    // Ici la premiere publication est strictement plus petite que la derniere :
    // la carte a donc grandi PENDANT le travail, et non apres.
    expect(locatedStepCount(recues[0])).toBeLessThan(
      locatedStepCount(recues[recues.length - 1]),
    );
    // Et jamais a rebours : une carte qui se retrace en arriere serait une
    // geometrie qui recule, pas une geometrie qui se construit.
    for (let i = 1; i < recues.length; i += 1) {
      expect(locatedStepCount(recues[i])).toBeGreaterThanOrEqual(
        locatedStepCount(recues[i - 1]),
      );
    }
  });

  it('D3-03: chaque etape publiee porte une position REELLE', () => {
    const model = programme();
    const recues = enCapturant(() => {
      assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    });
    for (const publie of recues) {
      for (const step of publie.steps) {
        expect(step.lat, step.title).not.toBeNull();
        expect(step.lon, step.title).not.toBeNull();
        expect(Number.isFinite(step.lat)).toBe(true);
        expect(Number.isFinite(step.lon)).toBe(true);
      }
    }
  });

  it('D3-04: la derniere publication est le programme localise', () => {
    const model = programme();
    let final: ItineraryModel | null = null;
    const recues = enCapturant(() => {
      final = assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    });
    expect(recues.length).toBeGreaterThan(0);
    // Le trace montre la meme chose que le modele rendu : ni etape en trop
    // (une intention sans position), ni etape en moins.
    const rendu = final as ItineraryModel | null;
    expect(rendu).not.toBeNull();
    expect(recues[recues.length - 1].steps.map((s) => s.id)).toEqual(
      (rendu as ItineraryModel).steps.map((s) => s.id),
    );
  });

  it('D3-05: un point unique ne se dessine pas', () => {
    // Un point isole dessine un point, pas un trajet. Le seuil appartient au
    // moteur : l'ecran ne peut pas en inventer un plus permissif.
    expect(MIN_LOCATED_STEPS).toBe(2);
  });

  it('D3-06: sans origine, rien n est publie — le moteur n invente pas', () => {
    // B4 : le parcours part d'un « depart non precise ». Le bus ne peut donc
    // publier AUCUNE geometrie, sous peine de dessiner un depart que personne
    // n'a choisi et que rien n'a mesure.
    const model = programme();
    const recues = enCapturant(() => {
      assignPlaces(model, CANDIDATES, null, ARGENTIERE);
    });
    expect(recues).toEqual([]);
  });
});

/* ==================================================================== */
/* Le maillon qu'aucun test ne prouvait                                  */
/* ==================================================================== */

/**
 * Le bus publie, le store ecoute... et c'est tout ce qu'on pouvait affirmer.
 *
 * `onGenerationPartial(...)` est appele AU NIVEAU DU MODULE dans le store : si
 * cet abonnement etait rompu — une refonte de l'import, un store duplique, une
 * subscription supprimee — tous les tests precedents continueraient de
 * passer, parce qu'ils s'abonnent eux-memes au bus. Ils prouveraient que le
 * MOTEUR publie, jamais que l'ECRAN recoit.
 *
 * Ces tests la traversent donc pour de bon : ils instancient le vrai store,
 * publient par le vrai moteur, et regardent ce que la carte lirait reellement
 * — `AdventurePrepShell` lit `state.liveModel`.
 */
describe('D3 — le store depose la geometrie que la carte lit', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().startNewAdventure();
  });

  it('D3-07: ce que le moteur publie, le store le depose', () => {
    const model = programme();
    assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    // L'abonnement vit dans le module du store : il ne depend d'aucun ecran
    // monte, donc il doit avoir joue sans qu'on rende quoi que ce soit.
    const depose = useAdventurePrepStore.getState().liveModel;
    expect(depose).not.toBeNull();
    expect(locatedStepCount(depose)).toBeGreaterThan(0);
  });

  it('D3-08: le depot GRANDIT, la carte a donc de quoi se tracer', () => {
    const model = programme();
    const tailles: number[] = [];
    // On lit le store a CHAQUE publication : c'est le rythme auquel la carte
    // se redessine, pas le rythme auquel le moteur travaille.
    //
    // Ce test s'abonne APRÈS le store — l'abonnement du store est au niveau du
    // module, donc il est enregistre en premier. Chaque lecture se fait donc
    // sur un store deja mis a jour : la premiere valeur n'est donc PAS 0.
    // C'est justement ce qu'on veut montrer, l'ecran n'a pas a attendre un
    // tour de boucle pour voir le point.
    const desabonner = onGenerationPartial(() => {
      tailles.push(locatedStepCount(useAdventurePrepStore.getState().liveModel));
    });
    try {
      assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    } finally {
      desabonner();
    }
    // La premiere lecture vaut la premiere publication, la derniere la
    // taille finale : entre les deux, la carte a gagne des points, et jamais
    // n'en a perdu.
    expect(tailles[0]).toBeGreaterThan(0);
    expect(tailles[tailles.length - 1]).toBeGreaterThan(tailles[0]);
    expect(tailles[tailles.length - 1]).toBeGreaterThan(0);
    for (let i = 1; i < tailles.length; i += 1) {
      expect(tailles[i]).toBeGreaterThanOrEqual(tailles[i - 1]);
    }
  });

  it('D3-09: chaque coordonnee deposee appartient a un lieu REEL', () => {
    const model = programme();
    assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    const depose = useAdventurePrepStore.getState().liveModel;
    if (depose === null) throw new Error('le store doit avoir recu la geometrie');
    // Les seules positions que le code a le droit d'ecrire ici sont celles de
    // l'origine, de l'arrivee, ou d'un lieu rendu par la base. Un trace qui
    // contiendrait autre chose afficherait une mesure que personne n'a faite.
    const reels = new Set<string>();
    for (const point of [CHAMONIX, ARGENTIERE, ...CANDIDATES]) {
      reels.add(`${point.lat},${point.lon}`);
    }
    for (const step of depose.steps) {
      if (step.lat === null || step.lon === null) continue;
      expect(reels.has(`${step.lat},${step.lon}`), step.title).toBe(true);
    }
  });

  it('D3-10: un run qui repart de zero efface le trace precedent', () => {
    // Sans origine le bus se tait : le store garde alors le trace du run
    // d'avant, ce qui est correct — la carte figee vaut mieux qu'une carte
    // vide. Mais un NOUVEAU run doit l'effacer, sinon le trajet d'une
    // generation anterieure serait affiche comme s'il venait d'etre mesure.
    const model = programme();
    assignPlaces(model, CANDIDATES, CHAMONIX, ARGENTIERE);
    expect(useAdventurePrepStore.getState().liveModel).not.toBeNull();
    useAdventurePrepStore.getState().startGenerationRun();
    expect(useAdventurePrepStore.getState().liveModel).toBeNull();
  });
});
