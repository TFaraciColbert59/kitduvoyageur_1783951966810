/**
 * P3.3 - LE MODELE PORTE L IDENTITE.
 *
 * Jusqu ici `placeId` existait au RUNTIME mais seulement apres `assignPlaces`,
 * et seulement parce que `places.ts` declara une intersection locale
 * (`BoundItineraryStep`) pour contourner un modele qui refusait le champ.
 *
 * Deux consequences reelles, et ce sont elles que ces tests mordent :
 *
 *  1. Une etape produite par le moteur, donc AVANT toute resolution de lieu,
 *     n avait aucun `placeId` : impossible d'y rattacher un lieu choisi plus
 *     tard par l utilisateur (c est ce que fait la liste geolocalisee, P2.7).
 *  2. L inventaire passe dans `loadPlaceInventoryFor` PERDAIT `catalogId` :
 *     le proposeur recevait un nom, et l identifiant de catalogue etait jete
 *     a la porte. Rattacher un lieu devenait alors un nom de plus.
 *
 * Regle de fer : `placeId` est toujours present, `null` quand la source n en
 * donne pas. Jamais de chaine fabriquee, jamais de champ absent.
 */
import { describe, expect, it } from 'vitest';
import { assignPlaces, toCandidate, type PlaceCandidate } from '../engine/places';
import { buildItinerary } from '../engine/itinerary';
import { loadPlaceInventoryFor } from '../placeSource';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';

function model() {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

/** Point d'interet de catalogue : `/api/pois` est la seule source d'identifiants. */
const REFUGE = {
  id: 'outdoor-1',
  name: 'Refuge du Gouter',
  category: 'refuge',
  lat: 45.8447,
  lng: 6.8427,
  is_verified: true,
};

/** Source OSM : un nom et des coordonnees, AUCUN identifiant. */
const COMMERCE = { name: 'Boutique de randonnee', category: 'shop', lat: 45.9312, lon: 6.8701 };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('P3.3 - le modele, et non un pansement, porte l identite', () => {
  it('P3M-01 : chaque etape du moteur porte placeId en propre, jamais absent', () => {
    // LE DEFAUT : le moteur ne declarait rien du tout. L absence du champ se
    // lisait ensuite comme « identifiant inconnu » au lieu de « aucun lieu
    // rattache ».
    //
    // La valeur n est PAS toujours null : le depart et le retour sont des
    // `PlaceRef`, ils ont un identifiant reel, et le mettre a null serait
    // perdre une information qu on a. Ce qui est exige, c est un champ
    // toujours present, et jamais une chaine vide ou fabriquee.
    const built = model();
    expect(built.steps.length).toBeGreaterThan(0);
    for (const step of built.steps) {
      expect(Object.hasOwn(step, 'placeId'), 'champ placeId absent de la etape').toBe(true);
      if (step.placeId !== null) {
        expect(typeof step.placeId).toBe('string');
        expect(step.placeId.trim().length).toBeGreaterThan(0);
        // Une cle synthetique « nom:lat:lon » se lit comme une reference de
        // catalogue cliquable qui ne mene nulle part.
        expect(step.placeId).not.toContain(':');
      }
    }
  });

  it('P3M-05 : le depart porte le VRAI identifiant du depart, pas un null', () => {
    // Le draft donne un `PlaceRef` avec un id. Le jeter serait un mensonge
    // par omission : on ferait croire qu aucun depart n est rattache.
    const built = model();
    const depart = built.steps.find((step) => step.day === 1 && step.kind === 'trajet');
    expect(depart, 'aucune etape de depart au jour 1').toBeDefined();
    expect(depart?.placeId).toBe(CHAMONIX.id);
  });

  it('P3M-02 : apres resolution, l identifiant de catalogue est sur le modele', () => {
    const candidat = toCandidate(REFUGE);
    if (!candidat) throw new Error('candidat attendu');
    const out = assignPlaces(model(), [candidat], CHAMONIX, ARGENTIERE);
    // Lecture typee : si `ItineraryStep` ne declare pas le champ, cette ligne
    // ne compile pas. C est la moitié du travail que le runtime ne prouve pas.
    const identifiants: readonly (string | null)[] = out.steps.map((step) => step.placeId);
    expect(identifiants).toContain('outdoor-1');
  });

  it('P3M-06 : une resolution qui ne trouve pas le depart ne lui efface pas son identite', () => {
    // `unlocated()` force `placeId: null`. Le depart est pourtant un
    // `PlaceRef` du draft : il a un identifiant REEL, independamment de ce
    // que la liste de candidats contient. L effacer sous pretexte que la
    // resolution a echoue, c est perdre une information qu on possedait.
    const out = assignPlaces(model(), [], CHAMONIX, ARGENTIERE);
    const depart = out.steps.find((step) => step.day === 1 && step.kind === 'trajet');
    expect(depart, 'aucune etape de depart').toBeDefined();
    expect(depart?.placeId, 'l identifiant du depart a ete efface').toBe(CHAMONIX.id);
  });

  it('P3M-03 : l inventaire transporte l identifiant quand la source en fournit un', async () => {
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) return jsonResponse({ amenities: [] });
      return jsonResponse([REFUGE]);
    }) as unknown as typeof fetch;

    const draft = { route: { origin: CHAMONIX, destination: ARGENTIERE } } as never;
    const inventory = await loadPlaceInventoryFor(fake)(draft, new AbortController().signal);

    const refuge = inventory.find((lieu) => lieu.name === 'Refuge du Gouter');
    expect(refuge, 'le refugeCatalogue a disparu de l inventaire').toBeDefined();
    // LE DEFAUT : `loadPlaceInventoryFor` reconstruisait l objet sans
    // `catalogId`. L identifiant etait lu puis jete.
    expect(refuge?.catalogId).toBe('outdoor-1');
  });

  it('P3M-04 : sans identifiant en amont, l inventaire n en fabrique aucun', async () => {
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) return jsonResponse({ amenities: [COMMERCE] });
      return jsonResponse([COMMERCE]);
    }) as unknown as typeof fetch;

    const draft = { route: { origin: CHAMONIX, destination: ARGENTIERE } } as never;
    const inventory = await loadPlaceInventoryFor(fake)(draft, new AbortController().signal);

    const boutique = inventory.find((lieu) => lieu.name === 'Boutique de randonnee');
    expect(boutique).toBeDefined();
    // Une valeur synthetisee se lirait comme une reference de catalogue
    // cliquable qui ne mene nulle part.
    expect(boutique?.catalogId ?? null).toBeNull();
    const candidats: PlaceCandidate[] = inventory
      .map((lieu) => toCandidate({ ...lieu, id: lieu.catalogId }))
      .filter((c): c is PlaceCandidate => c !== null);
    for (const candidat of candidats) expect(String(candidat.catalogId)).not.toContain(':');
  });
});