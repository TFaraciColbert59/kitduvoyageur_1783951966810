// Le proposeur ne connaissait QUE les lieux choisis par la personne. Il
// inventait donc des etapes («pause», «diner», «apercu du massif») que
// `assignPlaces` ne pouvait ensuite rattacher : le corridor Chamonix ne
// contient que dix lieux reels dedupliques (mesure sur `/api/pois` le
// 28 septembre 2026). Des que la categorie compatible est epuisee, l etape
// devient une note, la journee n est plus prouvee, et distance, denivele ET
// duree retombent a « a verifier » — sur des donnees que la base possede.
//
// Le correctif n est pas d assouplir la mesure : c est de dire au proposeur
// CE QUI EXISTE, pour qu il construise un parcours dans l inventaire reel au
// lieu de le deviner. Ces tests verrouillent que l inventaire voyage jusqu au
// prompt, et que le prompt interdit d en sortir.
import { describe, expect, it } from 'vitest';
import { buildItineraryPrompt } from '@/lib/ai/features/itinerary';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import type { PlaceInventory } from '../engine/places';
import { fullDraft } from './fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screenPath = join(__dirname, '..', 'components', 'ItineraryStep.tsx');
const screen = readFileSync(screenPath, 'utf8');

const INVENTORY = [
  { name: 'Refuge du Gouter', category: 'refuge' },
  { name: 'Lac Blanc', category: 'water' },
  { name: 'Aiguille du Midi', category: 'viewpoint' },
];

function prompt(availablePlaces: readonly { name: string; category: string }[] | undefined) {
  return buildItineraryPrompt({
    activityLabel: 'randonnee',
    originLabel: 'Chamonix-Mont-Blanc',
    destinationLabel: 'Argentiere',
    startDateLabel: '11/07/2026',
    durationDays: 3,
    partySize: 2,
    pace: 'tranquille',
    loop: false,
    preferences: ['budget : confort'],
    knownPlaces: [],
    brief: null,
    availablePlaces,
  }).prompt;
}

describe('l inventaire reel de lieux atteint le proposeur', () => {
  it('le prompt nomme chaque lieu disponible', () => {
    const text = prompt(INVENTORY);
    for (const place of INVENTORY) {
      expect(text).toContain(place.name);
    }
  });

  it('le prompt rattache chaque lieu a sa categorie', () => {
    // Sans la categorie, le proposeur ne peut pas savoir que Lac Blanc est de
    // l eau et Refuge du Gouter un refuge : il les interchangeable et proposer
    // une nuit sur un lac.
    const text = prompt(INVENTORY);
    expect(text).toContain('refuge');
    expect(text).toContain('water');
  });

  it('le prompt interdit de nommer un lieu hors inventaire', () => {
    expect(prompt(INVENTORY)).toMatch(/uniquement/i);
  });

  it('sans inventaire, le prompt reste valide et ne pretend pas avoir de lieux', () => {
    const text = prompt(undefined);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('aucun lieu connu');
  });
});

// L inventaire ne sert a rien s il reste dans un prompt theorique : il faut
// que le chef d orchestre le charge AVANT la redaction et le passe au
// proposeur. C est ce test qui prouve le branchement, pas l intention.
describe('l inventaire est charge par la generation, pas par le prompt seul', () => {
  function run(
    loadInventory: () => Promise<PlaceInventory[]>,
    seen: { inventory?: readonly PlaceInventory[]; order: string[] },
  ) {
    return runItineraryGeneration(
      fullDraft(),
      new AbortController().signal,
      async (_draft, _signal, availablePlaces) => {
        seen.order.push('proposition');
        seen.inventory = availablePlaces;
        return { drafted: null, failure: 'provider_indisponible' as const };
      },
      () => seen.order.push('phase'),
      undefined,
      {},
      undefined,
      async () => {
        seen.order.push('inventaire');
        return loadInventory();
      },
    );
  }

  it('l inventaire reel atteint le proposeur', async () => {
    const seen: { inventory?: readonly PlaceInventory[]; order: string[] } = { order: [] };
    const stock: PlaceInventory[] = [
      { name: 'Refuge du Gouter', category: 'refuge' },
      { name: 'Lac Blanc', category: 'water' },
    ];
    await run(async () => stock, seen);
    expect(seen.inventory).toEqual(stock);
  });

  it('l inventaire est charge AVANT la redaction, jamais apres', async () => {
    const seen: { inventory?: readonly PlaceInventory[]; order: string[] } = { order: [] };
    await run(async () => [], seen);
    expect(seen.order.indexOf('inventaire')).toBe(0);
    expect(seen.order.indexOf('inventaire')).toBeLessThan(seen.order.indexOf('proposition'));
  });

  it('un inventaire indisponible ne fait pas tomber la generation', async () => {
    const seen: { inventory?: readonly PlaceInventory[]; order: string[] } = { order: [] };
    const outcome = await run(async () => {
      throw new Error('reseau muet');
    }, seen);
    // Le repli regles produit un modele : un depot de POIS muet ne doit pas etre
    // pire que de n avoir aucun inventaire.
    expect(outcome.model).not.toBeNull();
    expect(seen.inventory).toEqual([]);
  });

  it('l ecran branche le chargeur ET le transmet a la Server Action', () => {
    // Un argument manquant ne casse aucune compilation : il casse l ecran. Le
    // proposeur reverrait alors un prompt sans aucun lieu, et le corridor
    // repasserait par les etapes orphelines que l inventaire supprime.
    expect(screen).toContain('loadPlaceInventoryFor(');
    const call = screen.slice(screen.indexOf('runItineraryGeneration('));
    const invocation = call.slice(0, call.indexOf(');'));
    expect(invocation).toContain('loadPlaceInventoryFor');
    expect(invocation).toContain('availablePlaces');
  });
});
