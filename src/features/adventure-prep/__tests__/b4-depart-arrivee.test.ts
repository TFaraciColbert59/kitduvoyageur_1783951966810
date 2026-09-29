/**
 * B4 — Depart OU arrivee, tous les deux OPTIONNELS.
 *
 * Le contrat annonce des le depart : les deux points sont INDEPENDANTS et
 * aucun n est exige. On peut avoir le depart seul, l'arrivee seule, les deux,
 * ou aucun.
 *
 * Ce fichier epingle le comportement REEL — plus celui mesure avant, qui
 * refusait la moitie du contrat. Une suite qui decrirait le comportement voulu
 * au lieu du reel ne prouverait rien.
 *
 * Etat mesure le 2026-09-29, AVANT le moteur :
 *   depart seul  -> TENUE    | arrivee seule -> CASSEE (CTA mort)
 *   les deux     -> TENUE    | aucun         -> refuse aussi
 *
 * Etat mesure APRES le moteur (ce que ce fichier epingle) :
 *   les quatre combinaisons passent le meme predicat, qui ne lit plus que
 *   l INTENTION. Une arrivee seule, ou rien du tout, genere reellement.
 *
 * Règle d honnêtete, verifiee ici par un CONTRE-TEM0IN (B4-6) : le moteur ne
 * FABRIQUE pas de depart. Ce qui manque se NOME. Sans origine, le parcours
 * part d une etape « Depart a preciser » sans nom, sans identifiant et sans
 * coordonnees — rattacher des lieux reels ne fait pas naitre une origine.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const askAI = vi.fn();
vi.mock('@/lib/ai/askAI', () => ({ askAI: (req: unknown) => askAI(req) }));

import { canCreateStepOne, stepOneMissing } from '../components/stepOneProfile';
import {
  requestDraftedItinerary,
  DEPART_NON_PRECISE,
  ARRIVEE_NON_PRECISEE,
} from '../engine/aiItinerary';
import { buildItinerary, DEPART_A_PRECISER } from '../engine/itinerary';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { hasEngineMinimum } from '../engine/steps';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft, RouteBlock } from '../types';

/** Une reponse minimale mais valide : on observe la REQUETE, pas la reponse. */
const REPONSE = JSON.stringify({
  title: 'Escapade',
  days: [1],
  steps: [
    {
      day: 1,
      kind: 'arret',
      title: 'Balade',
      placeName: null,
      startTime: null,
      durationMin: null,
      reason: null,
    },
  ],
  hypotheses: [],
});

/** Les quatre combinaisons du contrat B4, nommees par leur contenu. */
const COMBINAISONS = {
  'depart seul': { origin: CHAMONIX, destination: null, shape: 'boucle' },
  'arrivee seule': { origin: null, destination: ARGENTIERE, shape: 'aller_simple' },
  lesDeux: { origin: CHAMONIX, destination: ARGENTIERE, shape: 'aller_simple' },
  aucun: { origin: null, destination: null, shape: 'boucle' },
} as const satisfies Record<string, RouteBlock>;

const TOUS = Object.keys(COMBINAISONS) as (keyof typeof COMBINAISONS)[];

function avecRoute(route: RouteBlock): AdventurePrepDraft {
  return fullDraft({ route });
}

/** Le prompt REELLEMENT envoye au fournisseur. */
function promptEnvoye(index = 0): string {
  const requete = askAI.mock.calls[index]?.[0] as { prompt: string } | undefined;
  if (!requete) throw new Error('aucune requete envoyee a askAI');
  return requete.prompt;
}

async function proposer(draft: AdventurePrepDraft) {
  const r = await requestDraftedItinerary(draft, new AbortController().signal, []);
  return r.drafted;
}

/**
 * Des lieux REELS, avec la forme exacte de la base : identifiant de
 * catalogue, nom, categorie, coordonnees. Ils servent de CONTRAIRE au moteur —
 * s il accrochait une origine fabriquee, elle devrait venir de ce catalogue.
 */
function candidat(id: string, name: string, category: string, lat: number, lon: number): PlaceCandidate {
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
    // Ces lieux viennent du catalogue, pas d'un brouillon : ils sont donc
    // verifiables. Un `false` les ferait passer pour des inventions.
    isVerifiable: true,
  };
}

const CATALOGUE_REEL: readonly PlaceCandidate[] = [
  candidat('refuge-aiguille', 'Refuge de l Aiguille', 'refuge', 45.8836, 6.8875),
  candidat('refuge-planpraz', 'Refuge du Planpraz', 'refuge', 45.9311, 6.8462),
  candidat('refuge-sud', 'Refuge du Sud', 'refuge', 45.9266, 6.8876),
];

beforeEach(() => {
  askAI.mockReset();
  askAI.mockResolvedValue({
    text: REPONSE,
    model: 'test',
    degraded: false,
    cached: false,
    provider: 'nvidia',
  });
});

describe('B4 — les deux points sont INDEPENDANTS et facultatifs', () => {
  it('B4-1: le depart seul est accepte — la forme se deduit, elle ne bloque pas', () => {
    const d = avecRoute(COMBINAISONS['depart seul']);
    expect(d.route.origin).not.toBeNull();
    expect(d.route.destination).toBeNull();
    expect(canCreateStepOne(d)).toBe(true);
    expect(stepOneMissing(d, 'trajet').blocking).toEqual([]);
  });

  it('B4-2: les deux points ensemble sont acceptes', () => {
    const d = avecRoute(COMBINAISONS.lesDeux);
    expect(canCreateStepOne(d)).toBe(true);
    expect(stepOneMissing(d, 'trajet').blocking).toEqual([]);
  });

  it('B4-3: l arrivee seule est desormais ACCEPTEE — le moteur ne l refuse plus', () => {
    // C etait le defaut mesure : l arrivee seule donnait un CTA mort et
    // « Il manque : lieu de depart ». Le predicat ne lit plus que l intention.
    const d = avecRoute(COMBINAISONS['arrivee seule']);
    expect(d.route.destination).not.toBeNull();
    expect(d.route.origin).toBeNull();
    expect(hasEngineMinimum(d)).toBe(true);
    expect(canCreateStepOne(d)).toBe(true);
  });

  it('B4-4: les quatre combinaisons declenchent une VRAIE requete au modele', async () => {
    // AVANT : sans depart, `requestDraftedItinerary` rendait { drafted: null }
    // sans jamais appeler le fournisseur — un CTA actif y promettait un clic
    // qui n appelait meme pas l API. On lit les appels reels du mock, donc la
    // preuve ne repose sur aucun retour de valeur fabrique.
    for (const nom of TOUS) {
      askAI.mockClear();
      await proposer(avecRoute(COMBINAISONS[nom]));
      expect(askAI, `une requete part pour « ${nom} »`).toHaveBeenCalledTimes(1);
    }
  });

  it('B4-5: le prompt NOMME le manque, il ne FABRIQUE aucun lieu', async () => {
    // Sans depart, le prompt ne doit nommer AUCUNE position : ni celle du
    // catalogue, ni un defaut plausible. Un trou qui se lit comme un lieu
    // deviendrait, deux phases plus loin, un kilometrage mesure.
    askAI.mockClear();
    await proposer(avecRoute(COMBINAISONS['arrivee seule']));
    const prompt = promptEnvoye();
    expect(prompt).toContain(DEPART_NON_PRECISE);
    expect(prompt).toContain(ARGENTIERE.name);
    for (const candidat of CATALOGUE_REEL) {
      expect(prompt, `${candidat.name} n est pas dans la base du prompt`).not.toContain(candidat.name);
    }
    // Et sans rien du tout, l arrivee est elle aussi nommee comme manquante.
    askAI.mockClear();
    await proposer(avecRoute(COMBINAISONS.aucun));
    const vide = promptEnvoye();
    expect(vide).toContain(DEPART_NON_PRECISE);
    expect(vide).toContain(ARRIVEE_NON_PRECISEE);
    expect(vide).not.toContain(CHAMONIX.name);
  });

  it('B4-6: CONTRE-TEM0IN — sans depart, AUCUNE origine n est inventee', () => {
    // Le piege que la regle d honnêtete interdit : completer le trou par un
    // lieu plausible. On verifie les deux moities —
    //   1. le squelette ne porte ni nom, ni identifiant, ni position ;
    //   2. rattacher un catalogue REEL complet ne fait toujours naitre aucune
    //      origine : la seule position possible reste l arrivee choisie.
    const d = avecRoute(COMBINAISONS['arrivee seule']);
    const model = buildItinerary(d);
    expect(model).not.toBeNull();
    const premier = model!.steps[0]!;
    expect(premier.title).toBe(DEPART_A_PRECISER);
    expect(premier.placeName).toBeNull();
    expect(premier.placeId).toBeNull();
    expect(premier.lat).toBeNull();
    expect(premier.lon).toBeNull();

    const rattache = assignPlaces(model!, CATALOGUE_REEL, null, ARGENTIERE);
    const positionnees = rattache.steps.filter((s) => s.lat !== null && s.lon !== null);
    // Aucun refuge du catalogue ne s est glisse en point de depart.
    for (const candidat of CATALOGUE_REEL) {
      for (const step of positionnees) {
        expect(step.placeId, `${candidat.name} n est pas devenu une origine`).not.toBe(candidat.id);
      }
    }
    // Et la seule position qui subsiste est celle que la personne a choisie.
    for (const step of positionnees) {
      expect(step.placeId).toBe(ARGENTIERE.id);
    }
    // Ce qui n a pas pu etre rattache est devenu une NOTE, pas un lieu bidon.
    expect((rattache.notes ?? []).length).toBeGreaterThan(0);
  });

  it('B4-7: le meme predicat gouverne le CTA et le rail — une seule verite', () => {
    // Si le CTA et le rail avaient deux definitions, l ecran promettrait un clic
    // que le comportement refuse. B4-3 serait alors un bug d affichage et non
    // un bloquant reel.
    for (const nom of TOUS) {
      const d = avecRoute(COMBINAISONS[nom]);
      expect(hasEngineMinimum(d), nom).toBe(canCreateStepOne(d));
    }
  });

  it('B4-8: le deplacage d un point ne touche pas l autre', () => {
    // Le contrat parle d INDEPENDANCE : poser l un ne doit ni ecraser ni
    // deduire l autre.
    const d = avecRoute(COMBINAISONS['depart seul']);
    const avecArrivee = avecRoute({ ...COMBINAISONS['depart seul'], destination: ARGENTIERE });
    expect(avecArrivee.route.origin).toBe(d.route.origin);
  });

  it('B4-UI-1: la ligne de manque ne nomme PLUS le depart — RACCORD UI REQUIS', () => {
    // CE TEST EST VOLONTAIREMENT ROUGE : il ne verifie pas le moteur (correct,
    // epingle par B4-3), mais le MENTIER d une ligne d ecran, elle, non
    // corrigee parce qu elle vit hors du perimetre de ce lot.
    //
    // RACCORD EXACT : `src/features/adventure-prep/components/stepOneProfile.ts`,
    // ligne 269 — `const ENGINE_BLOCKING: readonly StepOneFieldKey[] =
    // ['activity', 'origin'];`. Retirer `'origin'` suffit : `canCreateStepOne`
    // et `blockedByEngine` deleguent deja a `hasEngineMinimum` (lignes 333-339),
    // donc le CTA est deja actif et seul le libelle ment encore.
    const d = avecRoute(COMBINAISONS['arrivee seule']);
    const { blocking, optional } = stepOneMissing(d, 'trajet');
    expect(canCreateStepOne(d)).toBe(true);
    // Le depart n est plus un bloqueur : c est l IA, ou personne, qui le tranche.
    expect(blocking).not.toContain('lieu de départ');
    expect(blocking).toEqual([]);
    expect(optional).toContain('lieu de départ');
  });
});
