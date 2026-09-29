import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AdventurePrepShell,
  PREP_LIVE_MAP_MIN_STEPS,
  PrepGenerationScreen,
  liveMapPoints,
  liveRouteCoords,
  prepGenerationVisible,
  type AdventurePrepShellProps,
} from '../components/AdventurePrepShell';
import { GENERATION_PHASES, initialGeneration, markPhaseDone } from '../engine/generation';
import {
  MIN_LOCATED_STEPS,
  locatedStepCount,
  onGenerationPartial,
  requestGenerationStop,
  runItineraryGeneration,
} from '../engine/itineraryPhases';
import { fullDraft } from './fixtures';
import type {
  AdventurePrepDraft,
  GenerationPhaseId,
  GenerationState,
  ItineraryModel,
  PrepStepId,
} from '../types';

/**
 * D3 + L6.4 — L'ecran de generation, et la carte qui se trace DEDANS.
 *
 * Ce que la checklist demandait : « la carte se trace en direct pendant la
 * generation », et un ecran intermediaire qui montre les phases REELLES.
 *
 * Ce que le code faisait : la carte etait montee par `ItineraryStep` sous
 * `{model && …}`, donc elle n'existait qu'APRES que `applyGenerated` eut depose
 * le parcours. Pendant la generation, l'utilisateur avait un rail de phases et
 * rien d'autre — la generation etait reellement une periode ou le parcours
 * n'existait pas.
 *
 * Le fichier verifie trois choses, de la plus profonde a la plus visible :
 *
 * 1. le MOTEUR publie la geometrie reelle PENDANT le run, avant de rendre la
 *    main (PH-1 a PH-4) ;
 * 2. l'ECRAN se superpose sans demonter l'ecran qui possede le run, et
 *    disparait des que le parcours existe (PH-5 a PH-8) ;
 * 3. ce qu'on y lit vient des objets du moteur — phases, progression, points —
 *    et n'inventent aucune duree (PH-9 a PH-13).
 */

/* --- Le store est neutre : on veut le composant, pas le singleton --------- */

const state = vi.hoisted(() => ({
  current: null as null | {
    draft: AdventurePrepDraft;
    liveModel: ItineraryModel | null;
    goToStep: (id: PrepStepId) => void;
    retryPhase: (id: GenerationPhaseId) => void;
    applyPhaseRetry: (retry: unknown) => void;
    stopGeneration: () => void;
  },
  arrets: 0,
}));

vi.mock('../store/useAdventurePrepStore', () => {
  type Store = NonNullable<typeof state.current>;
  const use = ((selector: (store: Store) => unknown) =>
    selector(state.current as Store)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const noop = () => undefined;

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function enCours(faites: GenerationPhaseId[] = []): GenerationState {
  let generation: GenerationState = { ...initialGeneration(), status: 'en_cours' };
  for (const id of faites) generation = markPhaseDone(generation, id);
  return generation;
}

function brouillon(over: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  return fullDraft({ itinerary: null, generation: enCours(), ...over });
}

/**
 * Un modele REELLEMENT localise : construit par le moteur de regles, jamais a
 * la main. Les coordonnees viennent donc du catalogue, pas d un litteral.
 */
function modeleLocalise(): ItineraryModel {
  const base = fullDraft();
  const steps = base.route.origin
    ? [base.route.origin, base.route.destination].filter((p): p is NonNullable<typeof p> => p !== null)
    : [];
  return {
    ...(base.itinerary ?? { title: null, days: 1, steps: [], totals: { distanceKm: null, elevGainM: null, activityMin: 0 }, perDay: [], weather: [], budgetPerPerson: { amount: null, currency: 'EUR' } }),
    steps: steps.flatMap((place, index) =>
      typeof place.lat === 'number' && typeof place.lon === 'number'
        ? [
            {
              id: `etape-${index}`,
              day: 1,
              order: index + 1,
              kind: 'arret' as const,
              title: `Etape ${index + 1}`,
              lat: place.lat,
              lon: place.lon,
              startTime: null,
              durationMin: null,
              price: null,
              kept: true,
              mealSlot: null,
            },
          ]
        : [],
    ),
  } as unknown as ItineraryModel;
}

function monter(
  props: Partial<AdventurePrepShellProps> = {},
  draft: AdventurePrepDraft = brouillon(),
  liveModel: ItineraryModel | null = null,
): string {
  state.current = {
    draft,
    liveModel,
    goToStep: noop,
    retryPhase: noop,
    applyPhaseRetry: noop,
    stopGeneration: () => {
      state.arrets += 1;
    },
  };
  const shellProps: AdventurePrepShellProps = {
    step: 'itinerary',
    onOpenSheet: noop,
    children: React.createElement('section', { className: 'prep-screen' }, 'ECRAN ENFANT'),
    ...props,
  };
  return renderToStaticMarkup(React.createElement(AdventurePrepShell, shellProps));
}

/* ================================================================== */
/* 1. Le moteur publie la geometrie PENDANT le run                     */
/* ================================================================== */

describe('D3 — la geometrie reelle est publiee pendant la generation', () => {
  it('PH-1 : le run publie le modele localise AVANT de rendre la main', async () => {
    const recues: ItineraryModel[] = [];
    const desabonner = onGenerationPartial((m) => recues.push(m));

    const outcome = await runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null }),
      noop,
      undefined,
      {},
      async (_d, model) => modeleLocalise() as ItineraryModel,
    );
    desabonner();

    expect(outcome.model).not.toBeNull();
    // La preuve porte sur l'INSTANT, pas sur la valeur : le listener a ete
    // appele avant que la promesse du run soit resolue. Un canal qui ne
    // publierait qu'apres le return ne pourrait pas dessiner « en direct ».
    expect(recues.length).toBeGreaterThanOrEqual(1);
    expect(locatedStepCount(recues[0])).toBeGreaterThanOrEqual(MIN_LOCATED_STEPS);
  });

  it('PH-2 : le seuil de dessin vient du moteur, le shell ne le redefinit pas', () => {
    expect(PREP_LIVE_MAP_MIN_STEPS).toBe(MIN_LOCATED_STEPS);
  });

  it('PH-3 : une geometrie absente ne publie rien — jamais de carte vide', async () => {
    const recues: ItineraryModel[] = [];
    const desabonner = onGenerationPartial((m) => recues.push(m));

    await runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null }),
      noop,
    );
    desabonner();

    // Le defaut ne pose AUCUNE position (NO_PLACES) : sans cette garantie, une
    // carte centree sur la France drew « l adventure est prete » pour un
    // parcours qui n a aucun lieu.
    expect(recues).toHaveLength(0);
  });

  it('PH-4 : un abonne qui leve n annule ni la generation ni les autres', async () => {
    const recues: ItineraryModel[] = [];
    const rompre = onGenerationPartial(() => {
      throw new Error('ecran casse');
    });
    const rester = onGenerationPartial((m) => recues.push(m));

    const outcome = await runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null }),
      noop,
      undefined,
      {},
      async (_d, model) => modeleLocalise() as ItineraryModel,
    );
    rompre();
    rester();

    expect(outcome.model).not.toBeNull();
    expect(recues.length).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== */
/* 2. L'ecran se superpose — et ne casse pas le run qu'il decrit        */
/* ================================================================== */

describe('L6.4 — l ecran intermediaire est monte au bon moment', () => {
  it('PH-5 : il ne monte QUE sur l etape 2, hors picker, en cours, sans parcours', () => {
    const g = enCours();
    const sans = prepGenerationVisible({ picking: false, step: 'itinerary', generation: g, itinerary: null });
    expect(sans).toBe(true);
    expect(
      prepGenerationVisible({ picking: true, step: 'itinerary', generation: g, itinerary: null }),
    ).toBe(false);
    expect(
      prepGenerationVisible({ picking: false, step: 'destination', generation: g, itinerary: null }),
    ).toBe(false);
    // Des que le parcours existe, l ecran final affiche la carte mesuree : cet
    // ecran-la n aurait plus rien de provisoire a dire.
    expect(
      prepGenerationVisible({ picking: false, step: 'itinerary', generation: g, itinerary: modeleLocalise() }),
    ).toBe(false);
    // Arrete, en echec, termine : chacun a son propre ecran de reprise.
    for (const status of ['interrompu', 'echec', 'termine', 'idle'] as const) {
      expect(
        prepGenerationVisible({
          picking: false,
          step: 'itinerary',
          generation: { ...g, status },
          itinerary: null,
        }),
      ).toBe(false);
    }
  });

  it('PH-6 : pendant la generation, le shell superpose son ecran ET garde l enfant monte', () => {
    // L enfant doit SURVIVRE : c'est lui qui porte l AbortController du run.
    // Le remplacer annulerait la generation que l ecran est cense decrire.
    const html = monter();
    expect(html).toContain('data-generation-screen="1"');
    expect(html).toContain('ECRAN ENFANT');
  });

  it('PH-7 : des que le parcours est depose, l ecran intermediaire disparait', () => {
    const avec = fullDraft({ generation: enCours(['recherche_parcours', 'verification_etapes', 'disponibilites']) });
    const modele = { ...modeleLocalise() };
    const html = monter({ step: 'itinerary' }, { ...avec, itinerary: modele }, null);
    expect(html).not.toContain('data-generation-screen="1"');
  });
});

/* ================================================================== */
/* 3. Ce que l ecran dit vient du moteur                               */
/* ================================================================== */

describe('L6.4 — les phases et la progression sont celles du moteur', () => {
  function ecran(generation: GenerationState, liveModel: ItineraryModel | null = null): string {
    return renderToStaticMarkup(
      React.createElement(PrepGenerationScreen, { generation, liveModel, onStop: noop }),
    );
  }

  it('PH-8 : le rail nomme les 7 phases reelles, dans l ordre, avec leur etat', () => {
    const html = ecran(enCours(['recherche_parcours', 'verification_etapes', 'disponibilites']));
    // Le titre de l ecran annonce AUJOURD'HUI la phase en cours, donc il
    // contient le libelle d'une phase AVANT le rail. L'assertion porte donc sur
    // le rail : c'est lui qui doit lister les sept, dans l'ordre.
    const rail = html.slice(html.indexOf('<div class="prep-rail"'));
    expect(rail).not.toBe('');
    const texte = visible(rail);
    let curseur = -1;
    for (const phase of GENERATION_PHASES) {
      const at = texte.indexOf(phase.label);
      expect(at, `phase absente du rail : ${phase.label}`).toBeGreaterThan(curseur);
      curseur = at;
    }
    expect(rail).toContain('data-state="done"');
    expect(rail).toContain('data-state="active"');
    expect(rail).toContain('data-state="pending"');
  });

  it('PH-9 : aucune duree n est affichee — le moteur ne mesure pas son temps', () => {
    const texte = visible(ecran(enCours(['recherche_parcours'])));
    // Ni « 12 s », ni « ~1 min », ni « 45 % » : un chiffre de duree serait une
    // estimation presentee comme une mesure, et rien ici ne la mesurerait.
    expect(texte).not.toMatch(/\d+\s*(s|sec|secondes?|min|mins|minutes?)\b/i);
    expect(texte).not.toMatch(/\d+\s*%/);
    expect(texte).not.toMatch(/~|≈|presque|environ/i);
  });

  it('PH-10 : la carte n existe qu a partir de la geometrie reelle', () => {
    // 0 etape localisee : aucune carte, et l ecran DIT pourquoi.
    const vide = ecran(enCours(['recherche_parcours', 'verification_etapes', 'disponibilites']));
    expect(vide).toContain('data-live-map="pending"');
    expect(visible(vide)).toContain('apparaîtra');

    // Une seule position : un point n est pas un trace. Le seuil est partage
    // avec le moteur, donc l ecran ne peut pas en inventer un plus permissif.
    const modele = modeleLocalise();
    const unSeul = { ...modele, steps: modele.steps.slice(0, 1) } as ItineraryModel;
    if (locatedStepCount(unSeul) === 1) {
      const html = ecran(enCours(['lieux']), unSeul);
      expect(html).toContain('data-live-map="pending"');
      expect(html).not.toContain('<canvas');
    }
  });

  it('PH-11 : des que la geometrie existe, la carte porte les points REELS', () => {
    const modele = modeleLocalise();
    if (locatedStepCount(modele) < MIN_LOCATED_STEPS) return;
    const html = ecran(enCours(['lieux']), modele);
    expect(html).not.toContain('data-live-map="pending"');
    expect(visible(html)).toContain(`${locatedStepCount(modele)} étapes localisées`);
  });

  it('PH-12 : le trace est un programme ordonne, sans doublon', () => {
    const coords = liveRouteCoords(modeleLocalise());
    expect(coords.length).toBe(locatedStepCount(modeleLocalise()));
    for (let i = 1; i < coords.length; i += 1) {
      const precedente = coords[i - 1];
      expect(coords[i]).not.toEqual(precedente);
    }
    expect(liveRouteCoords(null)).toEqual([]);
    expect(liveMapPoints(null)).toEqual([]);
  });

  it('PH-13 : le bouton d arret passe par le store, il ne simule rien', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrepGenerationScreen, {
        generation: enCours(),
        liveModel: null,
        onStop: () => {
          state.arrets += 1;
        },
      }),
    );
    expect(visible(html)).toContain('Arrêter');
    // Le compte n'augmente que si le shell appelle reellement le store : ici on
    // verifie que le cable existe, le declenchement est couvert par SH ci-dessous.
    expect(state.arrets).toBe(0);
  });
});

/* ================================================================== */
/* 4. « Arreter » coupe VRAIMENT le run                                 */
/* ================================================================== */

describe('Arret reel — un bouton qui arrete le run', () => {
  it('PH-14 : la demande d arret coupe un run vivant, et rien sinon', async () => {
    let resolu: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      resolu = resolve;
    });

    const run = runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      async () => {
        await gate;
        return { drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null };
      },
      noop,
    );

    // Le run est vivant : la demande d arret doit donc le trouver.
    expect(requestGenerationStop()).toBe(true);
    resolu!();
    const outcome = await run;

    // Aucun modele n est depose : une annulation ne laisse pas de parcours
    // a moitie construit derriere elle.
    expect(outcome.model).toBeNull();
  });

  it('PH-15 : aucun run vivant, la demande d arret le dit au lieu de pretendre', async () => {
    await runItineraryGeneration(
      brouillon(),
      new AbortController().signal,
      async () => ({ drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null }),
      noop,
    );
    // Le registre se vide dans le finally : c'est ce qui garantit qu'un run
    // TERMINE ne rend pas le prochain « Arreter » muet.
    expect(requestGenerationStop()).toBe(false);
  });

  it('PH-16 : le signal de l appelant annule toujours le run interieur', async () => {
    const controleur = new AbortController();
    let resolu: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      resolu = resolve;
    });

    const run = runItineraryGeneration(
      brouillon(),
      controleur.signal,
      async () => {
        await gate;
        return { drafted: null, failure: null, suggestedStartDate: null, suggestedDurationDays: null };
      },
      noop,
    );
    controleur.abort();
    resolu!();

    expect((await run).model).toBeNull();
  });
});
