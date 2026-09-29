/**
 * B4 — Depart OU arrivee, tous les deux optionnels.
 *
 * Le contrat annonce : les deux points sont INDEPENDANTS. On peut avoir le
 * depart seul, l'arrivee seule, les deux, ou aucun. Aucun des deux n'est
 * exige.
 *
 * Ce fichier ne pretend pas que le contrat est tenu : il MESURE ce qui l'est
 * aujourd'hui, test par test, et isole exactement ou il casse. Une suite qui
 * decrirait le comportement voulu au lieu du comportement reel ne prouverait
 * rien — elle passerait au vert sans que quoi que ce soit fonctionne.
 *
 * Etat mesure le 2026-09-29 :
 *   depart seul  -> TENUE    (CTA actif)
 *   arrivee seule -> CASSEE  (CTA mort, « Il manque : lieu de depart »)
 *   les deux     -> TENUE    (CTA actif)
 *   aucun        -> coherent avec le moteur (voir C-B4-4)
 */

import { describe, it, expect } from 'vitest';
import { canCreateStepOne, stepOneMissing } from '../components/stepOneProfile';
import { requestDraftedItinerary } from '../engine/aiItinerary';
import { hasEngineMinimum } from '../engine/steps';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft, RouteBlock } from '../types';

/** Les quatre combinaisons du contrat B4, nommees par leur contenu. */
const COMBINAISONS = {
  'depart seul': { origin: CHAMONIX, destination: null, shape: 'boucle' },
  'arrivee seule': { origin: null, destination: ARGENTIERE, shape: 'aller_simple' },
  lesDeux: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' },
  aucun: { origin: null, destination: null, shape: 'boucle' },
} as const satisfies Record<string, RouteBlock>;

function avecRoute(route: RouteBlock): AdventurePrepDraft {
  return fullDraft({ route });
}

/** Le generateur, sur un brouillon donne, sans reponse reelle du modele. */
async function proposer(draft: AdventurePrepDraft) {
  const signal = new AbortController().signal;
  const r = await requestDraftedItinerary(draft, signal, []);
  return r.drafted;
}

describe('B4 — les deux points sont traites INDEPENDAMMENT', () => {
  it('B4-1: le depart seul est accepte — la forme se deduit, elle ne bloque pas', () => {
    const d = avecRoute(COMBINAISONS['depart seul']);
    expect(d.route.origin).not.toBeNull();
    expect(d.route.destination).toBeNull();
    expect(canCreateStepOne(d)).toBe(true);
    // CONTRE-EXEMPLE : l'absence d'arrivee ne doit produire aucun blocage.
    expect(stepOneMissing(d, 'trajet').blocking).toEqual([]);
  });

  it('B4-2: les deux points ensemble sont acceptes', () => {
    const d = avecRoute(COMBINAISONS.lesDeux);
    expect(canCreateStepOne(d)).toBe(true);
    expect(stepOneMissing(d, 'trajet').blocking).toEqual([]);
  });

  it('B4-3: MESURE — l’arrivee seule est aujourd’hui IMPOSSIBLE', () => {
    const d = avecRoute(COMBINAISONS['arrivee seule']);
    // Ce que le contrat annonce...
    expect(d.route.destination).not.toBeNull();
    // ...et ce que le produit fait reellement.
    expect(canCreateStepOne(d)).toBe(false);
    expect(stepOneMissing(d, 'trajet').blocking).toEqual(['lieu de départ']);
  });

  it('B4-4: sans depart, le generateur ne produit RIEN (la cause du blocage)', async () => {
    // C'est la cause racine de B4-3, et elle est cote moteur. Sans depart,
    // `requestDraftedItinerary` court-circuite et ne pose aucune proposition :
    // un CTA actif y serait un bouton mort.
    const sansDepart = avecRoute(COMBINAISONS['arrivee seule']);
    expect(await proposer(sansDepart)).toBeNull();
    // CONTRE-EXEMPLE : avec un depart, le generateur tente vraiment le coup.
    expect(await proposer(avecRoute(COMBINAISONS['depart seul']))).not.toBeUndefined();
  });

  it('B4-5: le meme predicat gouverne le CTA et le rail — une seule verite', () => {
    // Si le CTA et le rail avaient deux definitions, l'ecran promettrait un clic
    // que le comportement refuse. B4-3 serait alors un bug d'affichage et non
    // un bloquant reel : la question merite d'etre posee AVANT de conclure.
    for (const nom of Object.keys(COMBINAISONS) as (keyof typeof COMBINAISONS)[]) {
      const d = avecRoute(COMBINAISONS[nom]);
      expect(hasEngineMinimum(d)).toBe(canCreateStepOne(d));
    }
  });

  it('B4-6: le deplacage d’un point ne touche pas l’autre', () => {
    // Le contrat parle d'INDEPENDANCE : poser l'un ne doit ni ecraser ni
    // deduire l'autre. `withDefaultOrigin` fait le premier ; il ne doit pas
    // faire le second.
    const { origin, destination } = COMBINAISONS['depart seul'];
    expect(origin).not.toBeNull();
    expect(destination).toBeNull();
    const d = avecRoute(COMBINAISONS['depart seul']);
    // Ajouter une arrivee ne doit pas faire disparaitre le depart.
    const avecArrivee = avecRoute({ ...COMBINAISONS['depart seul'], destination: ARGENTIERE });
    expect(avecArrivee.route.origin).toBe(d.route.origin);
  });
});
