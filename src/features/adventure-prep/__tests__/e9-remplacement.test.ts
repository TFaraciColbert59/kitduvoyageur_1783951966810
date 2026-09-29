/**
 * E9 - « Remplacer » doit REMPLACER un lieu, pas perdre le lieu.
 *
 * Le tiroir de remplacement existait, le moteur classait des alternatives
 * REELLES autour d un point mesure, et le clic faisait quelque chose : il
 * ajoutait l alternative, puis supprimait l etape d origine. Deux defauts, dont
 * un invisible.
 *
 * 1. INVISIBLE, et c est le grave : `addStep` passe par `createStep`, qui ecrit
 *    `lat: null, lon: null` en dur, et rien ne repasse par `assignPlaces`
 *    ensuite. Or l alternative vient d etre choisie POUR SA POSITION -- c est
 *    la distance reelle qui l a classee. Cette position est donc jetee la ligne
 *    d apres : l etape sort de la carte, le trace de la journee se referme par
 *    dessus elle, et la remesure qui suit re-route un parcours qui ne passe
 *    plus la. La personne voit un remplacement reussi ; la mesure qui l avait
 *    justifie a disparu.
 *
 * 2. Visible : l identite change. L etape d origine disparait, une nouvelle
 *    apparait sous un id neuf. Ce n est pas un remplacement, c est une
 *    suppression suivie d un ajout.
 *
 * Ces tests verrouillent le contrat honnete : meme etape, meme jour, meme rang,
 * et la position REELLE du lieu choisi.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { addStep, buildItinerary, removeStep, replaceStep } from '../engine/itinerary';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { PRICE_TO_CHECK, type ItineraryModel, type ItineraryStep } from '../types';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

function candidate(
  id: string,
  name: string,
  category: string,
  lat: number,
  lon: number,
  pricePerNight: number | null = null,
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
    pricePerNight,
    phone: null,
    website: null,
    isVerifiable: true,
  };
}

/* Meme base de lieux que `e9-alternatives-moteur.test.ts`, volontairement :
 * les deux items doivent raisonner sur les memes etablissements, sinon ils se
 * contredisent sur le meme programme. */
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

/**
 * Le programme REELLEMENT localise. C'est indispensable : `buildItinerary`
 * ne pose AUCUNE coordonnee -- c'est voulu, c'est `assignPlaces` qui decide de
 * ce qui peut etre positionne. Un test qui construirait le modele nu et
 * s'attendrait a des lat/lon testerait une geometrie qui n'existe pas.
 */
function programme(): ItineraryModel {
  const model = buildItinerary(fullDraft());
  if (model === null) throw new Error('fixture : le brouillon de base doit etre construisible');
  return assignPlaces(model, CANDIDATS, CHAMONIX, ARGENTIERE);
}

/** La nuit du jour 1 : localisee, donc mesurable, donc proprietaire de son point. */
const NUIT_1 = 'd1-nuit-5';

function etape(model: ItineraryModel, id: string): ItineraryStep {
  const trouvee = model.steps.find((step) => step.id === id);
  if (trouvee === undefined) throw new Error(`fixture : l etape ${id} doit exister`);
  return trouvee;
}

/**
 * L etablissement de remplacement, avec SES coordonnees. Elles ne sont pas
 * une donnee de test : ce sont celles que la source a rendues, et le moteur
 * doit les poser telles quelles.
 */
const ALTERNATIVE = {
  title: 'Refuge du Brenta',
  placeName: 'Refuge du Brenta',
  placeId: 'o-brenta',
  lat: 45.9602,
  lon: 6.7038,
} as const;

describe('E9 - le remplacement pose le lieu REELLEMENT choisi', () => {
  /* ---------------------------------------------------------------- */
  /* Temoin : sans lui, on ignore si les assertions d dessous mordent.  */
  /* Un `return model`Degoutant passerait certaines d entre elles.     */
  /* ---------------------------------------------------------------- */

  it('E9-R00 TEMOIN : une mutation qui ne fait rien serait vue', () => {
    const m = programme();
    // Un identifiant inconnu ne touche a rien : meme objet, meme reference.
    expect(replaceStep(m, 'etape-qui-nexiste-pas', ALTERNATIVE)).toBe(m);

    // Un identifiant connu, si : objet NEUF. Une implementation qui
    // retournerait `model` paresseusement echouerait ici.
    const change = replaceStep(m, NUIT_1, ALTERNATIVE);
    expect(change).not.toBe(m);
    expect(change.steps).not.toBe(m.steps);
    // Et l origine est intacte : l immuabilite n est pas une negociation,
    // c est ce qui permet a l annulation de fonctionner.
    expect(etape(m, NUIT_1)).toEqual(etape(programme(), NUIT_1));
  });

  it('E9-R01 : la position REELLE de l alternative est posee, pas perdue', () => {
    const m = programme();
    const cible = etape(m, NUIT_1);
    // Temoin de depart : sans elle, R01 ne prouverait rien -- une etape non
    // localisee ne pourrait pas « perdre » sa position.
    expect(cible.lat).not.toBeNull();
    expect(cible.lon).not.toBeNull();

    const apres = replaceStep(m, NUIT_1, ALTERNATIVE);
    const etapeApres = etape(apres, NUIT_1);
    // Sans ces deux assertions, la carte perd l etape et rien ne le dit.
    expect(etapeApres.lat).toBe(ALTERNATIVE.lat);
    expect(etapeApres.lon).toBe(ALTERNATIVE.lon);
    // Le lieu nomme est celui du remplacement, plus celui qu on a quitte.
    expect(etapeApres.placeName).toBe(ALTERNATIVE.placeName);
    expect(etapeApres.placeId).toBe(ALTERNATIVE.placeId);
    expect(etapeApres.title).toBe(ALTERNATIVE.title);
  });

  it('E9-R02 : l etape reste l ETAPE -- identite, jour, rang, nature', () => {
    const m = programme();
    const cible = etape(m, NUIT_1);
    const apres = etape(replaceStep(m, NUIT_1, ALTERNATIVE), NUIT_1);

    // Changer de lieu ne change pas ce que l etape EST dans la journee. Un
    // identifiant neuf, ce serait une suppression suivie d un ajout.
    expect(apres.id).toBe(cible.id);
    expect(apres.day).toBe(cible.day);
    expect(apres.order).toBe(cible.order);
    expect(apres.kind).toBe(cible.kind);
    // Le lien de ravitaillement a un repas est une structure de journee, pas
    // une propriete du lieu : il survit.
    expect(apres.mealSlot ?? null).toBe(cible.mealSlot ?? null);
    // Le programme garde le meme nombre d etapes : on a remplace, pas ajoute.
    expect(replaceStep(m, NUIT_1, ALTERNATIVE).steps).toHaveLength(m.steps.length);
  });

  it('E9-R03 : ce qui decrivait l ANCIEN lieu repart de zero', () => {
    const m = programme();
    const apres = etape(replaceStep(m, NUIT_1, ALTERNATIVE), NUIT_1);

    // La duree etait celle de l etablissement qu on vient de quitter. La
    // reconduire, ce serait mesurer autre chose et l afficher quand meme.
    expect(apres.durationMin).toBeNull();
    // L etat de reservation decrivait l ancien lieu : le garder qualifierait
    // un etablissement que personne n a reserve.
    expect(apres.state).toBe('propose');
    // « A conserver » validait un lieu precis. Le reconduire serait une
    // approbation que personne n a donnee pour l autre.
    expect(apres.kept).toBe(false);
    // La raison expliquait le choix de l ANCIEN lieu (« pres du gite »). La
    // reconduire sur un autre etablissement serait une fausse justification.
    expect(apres.reason).toBeNull();
  });

  it('E9-R04 : le prix n est JAMAIS celui du lieu qu on a quitte', () => {
    const m = programme();
    // Un prix exige ne vaut que pour CE lieu, et seulement si la source rend.
    const avecPrix = etape(
      replaceStep(m, NUIT_1, {
        ...ALTERNATIVE,
        price: { amount: 62, currency: 'EUR', state: 'confirme' },
      }),
      NUIT_1,
    );
    expect(avecPrix.price).toEqual({ amount: 62, currency: 'EUR', state: 'confirme' });

    // Sans prix rendu, l etape doit le dire. Afficher celui d avant, ce serait
    // le tarif d un autre etablissement.
    const sansPrix = etape(replaceStep(m, NUIT_1, ALTERNATIVE), NUIT_1);
    expect(sansPrix.price).toEqual(PRICE_TO_CHECK);
  });

  it('E9-R05 : un identifiant inconnu ne detruit rien', () => {
    const m = programme();
    // Le rotor peut pointer une etape retiree entre-temps : ni exception, ni
    // etape fantome, ni programme reecrit.
    const apres = replaceStep(m, 'etape-qui-nexiste-pas', ALTERNATIVE);
    expect(apres.steps).toHaveLength(m.steps.length);
    expect(apres.steps).toEqual(m.steps);
  });

  /**
   * CARACTERISATION du chemin qui precedait. Elle ne doit pas disparaitre en
   * silence : elle dit pourquoi `replaceStep` existe. Le jour ou `addStep`
   * portera une position, ce test devient faux -- supprime le ALORS, et regarde
   * ce que `replaceStep` apporte de plus.
   */
  it('E9-R06 CARACTERISATION : ajouter puis supprimer PERD la position', () => {
    const m = programme();
    const cible = etape(m, NUIT_1);
    const ajout = addStep(m, cible.day, cible.kind, {
      title: ALTERNATIVE.title,
      placeName: ALTERNATIVE.placeName,
      placeId: ALTERNATIVE.placeId,
    });
    const retiree = removeStep(ajout, cible.id);
    const nouveau = etape(
      retiree,
      ajout.steps.find((s) => s.title === ALTERNATIVE.title)?.id ?? '',
    );

    // Le lieu est la, avec son nom et son identifiant. Il n est pas la ou il
    // est : c est tout le defaut, en deux assertions.
    expect(nouveau.placeName).toBe(ALTERNATIVE.placeName);
    expect(nouveau.placeId).toBe(ALTERNATIVE.placeId);
    expect(nouveau.lat).toBeNull();
    expect(nouveau.lon).toBeNull();
  });
});