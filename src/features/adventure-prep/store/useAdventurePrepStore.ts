'use client';

import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyDraft } from '../engine/emptyDraft';
import { insertWaypoint, type MapCoord } from '../engine/dayNavigation';
import { measureWithRunners } from '../engine/measurements';
import { browserMeasurementRunners } from '../browserMeasurements';
import {
  buildItinerary,
  stepById,
  withStepImage,
  type StepDraft,
  type StepReplacement,
} from '../engine/itinerary';
import { fetchStepImage, type StepImage } from '../engine/stepImages';
import {
  alternativesFor as rankAlternatives,
  referenceFor,
  ringFor,
  type AlternativesGap,
} from '../engine/stepAlternatives';
import type { PlaceCandidate, ScoredPlace } from '../engine/places';
import { loadBasePlacesNear } from '../placeSource';
import {
  failGeneration,
  finishGeneration,
  interruptGeneration,
  markPhaseDone,
  resumeGeneration,
  setPartial,
  startGeneration,
} from '../engine/generation';
import { PREP_DRAFT_VERSION } from '../engine/emptyDraft';
import { draftActions } from './reducer';
import {
  onGenerationPartial,
  requestGenerationStop,
  type GenerationOutcome,
  type PhaseRetry,
} from '../engine/itineraryPhases';
import type { AIFailureReason } from '@/lib/ai/providers/types';
import type {
  ActivitySelection,
  AdventurePrepDraft,
  AdjustmentId,
  CalendarBlock,
  GenerationPhaseId,
  GroupBlock,
  ItineraryStepKind,
  ItineraryModel,
  MealSlot,
  PreferencesBlock,
  PrepStepId,
  RouteBlock,
} from '../types';
// `normalizeClockTime` est une FONCTION : elle vit hors du bloc `import type`,
// sinon le store l'utiliserait sans l'avoir reellement chargee.
import { normalizeClockTime } from '../types';

/* ------------------------------------------------------------------ */
/* E9 — les alternatives REELLES d une etape                          */
/* ------------------------------------------------------------------ */

/**
 * La source des alternatives. Par defaut la vraie : `/api/pois`, par boite,
 * avec le filtrage de joignabilite. Injectable pour un test, jamais pour une
 * donnee de production — c'est la regle de `PrepStepReplaceSheet` aussi.
 */
export type AlternativesLoader = (
  points: readonly { lat: number; lon: number }[],
  signal?: AbortSignal,
) => Promise<readonly PlaceCandidate[]>;

const SOURCE_REELLE: AlternativesLoader = (points, signal) =>
  loadBasePlacesNear(points, fetch, signal);

let SOURCE: AlternativesLoader = SOURCE_REELLE;

/**
 * Rend sa source a la VRAIE. Meme convention que `__resetAmenityMemo` et
 * `__resetWalkabilityMemo` de `placeSource` : un test qui substitue la source
 * la remet ensuite, sinon le test suivant heriterait d'un catalogue de poche
 * et passerait sans jamais avoir parle a la base.
 */
export function __setAlternativesLoader(loader: AlternativesLoader): void {
  SOURCE = loader;
}

export function __resetAlternativesLoader(): void {
  SOURCE = SOURCE_REELLE;
}

/* ------------------------------------------------------------------ */
/* E8 - la photo REELLE d une etape                                   */
/* ------------------------------------------------------------------ */

/**
 * La source des photos. Par defaut la vraie : Wikimedia Commons, qui exige un
 * auteur et une licence par fichier. Injectable pour un test, jamais pour une
 * donnee de production, exactement comme `AlternativesLoader` au-dessus.
 */
export type StepImageLoader = (
  nom: string,
  options?: { readonly signal?: AbortSignal },
) => Promise<StepImage | null>;

const IMAGE_REELLE: StepImageLoader = (nom, options) => fetchStepImage(nom, options);

let IMAGE_SOURCE: StepImageLoader = IMAGE_REELLE;

/** Meme convention que le reste du fichier : un test substitue, puis remet. */
export function __setStepImageLoader(loader: StepImageLoader): void {
  IMAGE_SOURCE = loader;
}

export function __resetStepImageLoader(): void {
  IMAGE_SOURCE = IMAGE_REELLE;
}

/**
 * Ce que « remplacer » peut honnument rapporter.
 *
 * Une union discriminée, et non deux booleens : « pas d'alternative » et
 * « source muette » se ressembleraient si on les melangeait, alors que la
 * premiere est une MESURE — la base a repondu, et personne autour — et la
 * seconde une INCERTITUDE. Afficher « la base n'a rien » apres un echec
 * reseau serait un mensonge de plus.
 */
export type StepAlternatives =
  | {
      readonly etat: 'pret';
      readonly stepId: string;
      readonly stepTitle: string;
      readonly places: readonly ScoredPlace[];
      readonly reference: { lat: number; lon: number } | null;
    }
  | {
      readonly etat: 'sans-alternative';
      readonly stepId: string;
      readonly stepTitle: string;
      readonly places: readonly [];
      readonly raison: AlternativesGap;
      readonly reference: { lat: number; lon: number } | null;
    }
  | {
      readonly etat: 'source-muette';
      readonly stepId: string;
      readonly stepTitle: string;
      readonly places: readonly [];
      readonly reference: { lat: number; lon: number } | null;
    };

/**
 * Ce qui vient de changer de geometrie, et qui impose donc de remesurer.
 *
 * La raison n'est pas decorative : c'est elle que l'ecran annonce pendant le
 * mesurage. Un indicateur sans cause serait un indicateur muet.
 */
export type RemeasureReason =
  | 'manuel'
  | 'point-de-passage'
  | 'ajout-etape'
  | 'suppression-etape'
  | 'remplacement-etape'
  | 'ajustement';

export interface AdventurePrepState {
  adventureId: string;
  draft: AdventurePrepDraft;
  /** `true` une fois la reprise du brouillon terminee : evite tout ecart de rendu. */
  hydrated: boolean;
  /**
   * Mesurage en cours, et ce qui l'a declenche. `null` quand rien ne mesure.
   *
   * Un parcours edite porte, le temps de la remesure, des mesures qui
   * decrivent un trace qui n'existe plus. L'ecran doit le dire plutot que
   * d'afficher un chiffre qui n'a plus de trace derriere lui.
   */
  remeasuring: RemeasureReason | null;
  /**
   * Le parcours tel qu'il EXISTE pendant la generation, avant d'etre depose.
   *
   * `draft.itinerary` ne se remplit qu'a la FIN : tant qu'il est `null`, la
   * carte de l'ecran n'a rien a montrer. Ce champ porte la meme geometrie, reelle
   * et deja localisee, des que le moteur l'a publiee — il permet donc de tracer
   * le parcours pendant la generation plutot qu'apres. `null` designe
   * l'absence de fait, jamais un parcours vide : tant que rien n'est localise,
   * aucune carte n'est tracee plutot qu'une carte muette.
   */
  liveModel: ItineraryModel | null;
}

export interface AdventurePrepActions {
  markHydrated: () => void;
  startNewAdventure: () => void;
  setActivities: (value: ActivitySelection) => void;
  /** Partir sans activite du catalogue : l invite libre suffit. */
  dismissPicker: () => void;
  setRoute: (value: RouteBlock) => void;
  /** Invite libre de l'etape 1 : ce que l'utilisateur veut, en toutes lettres. */
  setBrief: (value: string | null) => void;
  setCalendar: (value: CalendarBlock) => void;
  /**
   * Heure de depart saisie — seule elle. `null` efface la saisie.
   *
   * Passe par `setCalendar`, jamais par une ecriture directe : c est le seul
   * passage qui invalide l itineraire (il repart de zero). Un ecran qui poserait
   * le champ dans le draft sans passer par ici garderait un parcours trace
   * pour une heure qui a change.
   */
  setCalendarStartTime: (value: string | null) => void;
  setGroup: (value: GroupBlock) => void;
  setPreferences: (value: PreferencesBlock) => void;
  setCoverName: (value: string | null) => void;
  resetDraft: () => void;
  goToStep: (step: PrepStepId) => void;
  completeStep: (step: PrepStepId) => void;
  proposeItinerary: () => void;
  startGenerationRun: () => void;
  continueGeneration: () => void;
  markPhase: (id: GenerationPhaseId) => void;
  pushGenerated: (days: number) => void;
  /**
   * Les alternatives REELLES d une etape du parcours.
   *
   * `count` borne le nombre de lieux proposes ; il vient de l'ecran et n'est
   * jamais fabrique. La liste exclut ce que le programme porte DEJA,
   * ailleurs : proposer un lieu deja pose ailleurs n'est pas une alternative,
   * c'est un doublon qui ferait remarcher la journee.
   */
  alternativesForStep: (stepId: string, count: number) => Promise<StepAlternatives>;
  /**
   * Cherche la photo REELLE de chaque etape, sans bloquer le parcours.
   *
   * Renvoie `null` quand il n y a rien a poser. Elle n announce jamais
   * l echec : une source muette et un lieu sans photo se ressemblent depuis
   * l ecran, et les traiter differemment obligerait l interface a inventer un
   * etat qu elle ne sait pas mesurer.
   */
  enrichStepImages: () => Promise<void>;
  /** Depose la geometrie reelle publiee par le moteur, telle quelle. */
  publishLiveModel: (model: ItineraryModel) => void;
  stopGeneration: () => void;
  failGenerationRun: (message: string) => void;
  endGeneration: () => void;
  /**
   * Re-arme UNE phase de generation, et une seule.
   *
   * Refuse toute phase qui n est pas celle que l etat designe comme tombee,
   * et ne coche rien : elle rend la phase « en attente », pas « reussie ».
   */
  retryPhase: (id: GenerationPhaseId) => void;
  /**
   * Depose le resultat reel d une reprise. Succes : phase cochee + modele depose.
   * Echec : rien de coche, parcours d origine conserve, raison ecrite dans
   * generation.error pour que le bandeau puisse la nommer.
   */
  applyPhaseRetry: (retry: PhaseRetry) => void;
  /**
   * Depose le parcours reellement produit, quel que soit le moteur qui l'a
   * construit, la phrase qui dit si l'enrichissement a eu lieu, ET les verdicts
   * de phase. Les regles et l'IA passent donc par le meme point d'entree :
   * l'ecran ne connait pas le moteur, il affiche ce qu'il a recu.
   *
   * Les verdicts ne sont pas optionnels : sans eux, une phase tombee devient
   * invisible et l'utilisateur lit des « A verifier » sans cause ni reessai.
   */
  applyGenerated: (outcome: GenerationOutcome) => void;
  addStepToDay: (day: number, kind: ItineraryStepKind, step: StepDraft) => Promise<void>;
  /**
   * Remplace le LIEU d une etape par un etablissement reel, puis remesure.
   *
   * Le remesure n est pas optionnel : changer de lieu deplace le parcours, et
   * un trace qui garde l ancien itinerire afficherait une geometrie qui n est
   * plus celle du programme.
   */
  replaceStep: (stepId: string, replacement: StepReplacement) => Promise<void>;
  /**
   * Remesure le parcours courant sur le reseau reel.
   *
   * Renvoie la promesse du run : un appelant peut attendre la mesure, l'ecran
   * ne le fait pas. Un nouvel appel ANNULE le precedent et n'ecrit jamais a sa
   * place — un resultat perime ne peut pas ecraser une mesure plus fraiche.
   */
  remeasure: (reason: RemeasureReason) => Promise<void>;
  /**
   * Pose un point de passage a la position indiquee sur la carte.
   *
   * Passe par `insertWaypoint` et non par `applyGenerated` : un point pose par
   * l'utilisateur n est pas une production de l IA, et la notice qui dit ce que
   * l IA a propose doit survivre a cette edition. La remesure, elle, ne
   * demande pas la permission : le trace vient de changer.
   */
  addWaypoint: (coord: MapCoord, day: number) => Promise<void>;

  keepStep: (stepId: string, kept: boolean) => void;
  linkMeal: (stepId: string, slot: MealSlot | null) => void;
  dropStep: (stepId: string) => Promise<void>;
  adjust: (id: AdjustmentId) => Promise<void>;
  setPacked: (gearId: string, packed: boolean) => void;
  setGearWeight: (gearId: string, grams: number | null) => void;
  assignGear: (gearId: string, ownerId: string | null) => void;
  syncGear: () => void;
}

export type AdventurePrepStore = AdventurePrepState & AdventurePrepActions;

const newAdventureId = (): string =>
  `av-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useAdventurePrepStore = create<AdventurePrepStore>()(
  persist(
    (set, get) => {
      const patch = (next: (draft: AdventurePrepDraft) => AdventurePrepDraft) =>
        set((state) => ({ draft: next(state.draft) }));

      // Le controleur du remesurage en vol. Il vit dans la closure du createur
      // et pas dans l'etat : il n'est ni affichable ni serialisable, et seul un
      // module peut savoir qu'un run remplace le precedent.
      let enCours: AbortController | null = null;

      // Un arret demande par la personne, pas une panne. Il vit dans la
      // closure et pas dans l'etat pour une raison precise : la fin du run
      // observe l'avortement et appelle failGenerationRun, qui sans ce
      // drapeau transformerait un « Arreter » en « Echec ». Le drapeau se
      // remet a zero au lancement suivant, donc il ne traine jamais.
      let arretDemande = false;

      /**
       * Remesure SEULEMENT si l'objet du parcours a change.
       *
       * L'egalite d'identite est le seul test possible : les moteurs du
       * preparateur renvoient le meme objet quand ils n'ont rien change, et un
       * nouveau objet des qu'ils ont change quelque chose. Sans cette question,
       * un point refuse (coordonnee malhonnete) payerait un aller-retour reseau
       * pour decrire un parcours identique.
       */
      const remesureSiChange = (
        reason: RemeasureReason,
        avant: ItineraryModel | null,
      ): Promise<void> => {
        if (get().draft.itinerary === avant) return Promise.resolve();
        return get().remeasure(reason);
      };
      return {
        adventureId: newAdventureId(),
        draft: emptyDraft(),
        hydrated: false,
        remeasuring: null,
        liveModel: null,
        markHydrated: () => set({ hydrated: true }),
        startNewAdventure: () =>
          set({
            adventureId: newAdventureId(),
            draft: { ...emptyDraft(), version: PREP_DRAFT_VERSION },
            liveModel: null,
          }),
        setActivities: (value) => patch((draft) => draftActions.setActivities(draft, value)),
        dismissPicker: () => patch((draft) => draftActions.dismissPicker(draft)),
        setRoute: (value) => patch((draft) => draftActions.setRoute(draft, value)),
        setBrief: (value) => patch((draft) => draftActions.setBrief(draft, value)),
        setCalendar: (value) =>
          patch((draft) =>
            draftActions.setCalendar(draft, {
              ...value,
              // Un calendrier pose SANS la cle (brouillon enregistre avant
              // l'arrivee de l'heure) doit se lire comme une absence
              // explicite, pas comme un `undefined` qui se glisse jusqu'a
              // l'ecran. La forme est aussi normalisee ici : un seul passage,
              // une seule regle.
              startTime: normalizeClockTime(value.startTime),
            }),
          ),
        setCalendarStartTime: (value) =>
          patch((draft) =>
            draftActions.setCalendar(draft, {
              ...draft.calendar,
              // Une heure n est « connue » que si la personne l a tapee : un
              // espace ou un texte hors forme se relit comme une absence.
              startTime: normalizeClockTime(value),
            }),
          ),
        setGroup: (value) => patch((draft) => draftActions.setGroup(draft, value)),
        setPreferences: (value) => patch((draft) => draftActions.setPreferences(draft, value)),
        setCoverName: (value) => patch((draft) => draftActions.setCoverName(draft, value)),
        resetDraft: () =>
          set((state) => ({
            adventureId: newAdventureId(),
            draft: draftActions.reset(state.draft),
            liveModel: null,
          })),
        goToStep: (step) => patch((draft) => draftActions.goToStep(draft, step)),
        completeStep: (step) => patch((draft) => draftActions.completeStep(draft, step)),
        proposeItinerary: () =>
          patch((draft) => {
            const itinerary = buildItinerary(draft);
            return itinerary
              ? draftActions.setItinerary(draft, itinerary)
              : draftActions.setItinerary(draft, null);
          }),
        startGenerationRun: () => {
          arretDemande = false;
          set({ liveModel: null });
          patch((draft) => draftActions.setGeneration(draft, startGeneration(draft.generation)));
        },
        publishLiveModel: (model) => set({ liveModel: model }),
        alternativesForStep: async (stepId, count) => {
          const model = get().draft.itinerary;
          if (model === null) {
            return { etat: 'sans-alternative', stepId, stepTitle: '', places: [], raison: 'reference-absente', reference: null } as const;
          }
          const step = stepById(model, stepId);
          if (step === undefined) {
            return { etat: 'sans-alternative', stepId, stepTitle: '', places: [], raison: 'reference-absente', reference: null } as const;
          }
          const base = { stepId, stepTitle: step.title } as const;
          // Pas de point REEL autour duquel mesurer : on le dit, on ne substitue
          // pas le centre de la carte, qui ferait une distance fausse.
          const reference = referenceFor(step, model);
          if (reference === null) {
            return { ...base, etat: 'sans-alternative', places: [], raison: 'reference-absente', reference: null } as const;
          }
          let trouves: readonly PlaceCandidate[];
          try {
            trouves = await SOURCE(ringFor([reference], 0));
          } catch {
            // Une source muette n'est PAS une base vide : la difference change
            // ce que l'ecran a le droit d'ecrire sur la vacancy du catalogue.
            return { ...base, etat: 'source-muette', places: [], reference } as const;
          }
          const tri = rankAlternatives(step, trouves, model);
          if (tri.gap !== null) {
            return { ...base, etat: 'sans-alternative', places: [], raison: tri.gap, reference: tri.reference } as const;
          }
          // Un `count` absurde ne doit pas transformer une liste mesuree en
          // liste vide : on lit au plus ce qu'on a, et la liste entiere si la
          // demande n'a pas de sens.
          const demande = Number.isFinite(count) ? Math.trunc(count) : tri.ranked.length;
          const places = demande > 0 ? tri.ranked.slice(0, demande) : tri.ranked;
          return { ...base, etat: 'pret', places, reference: tri.reference } as const;
        },
        /**
         * Cherche la photo REELLE de chaque etape, en arriere-plan.
         *
         * Pourquoi une passe a part, plutot qu une image dans le modele : la
         * photo ne vient pas du moteur, elle vient d une source exterieure qui
         * peut etre muette, lente, ou mise a jour apres coup. La melee a la
         * construction ferait dependre le ROTOR d une image, donc porterait un
         * detail d affichage dans l etat du programme. Ici elle arrive apres,
         * et le parcours reste entierement utilisable sans elle.
         *
         * Ce que cette passe s interdit, et qui compte autant que ce qu elle
         * fait :
         *
         *   - elle n attend pas. Aucun rendu ne depend d elle, et une source
         *     muette ne se traduit jamais par un ecran qui tourne ;
         *   - elle ne signale pas l absence. Une etape sans photo porte le meme
         *     texte qu avant : on ignore, on n invente pas d information a
         *     afficher la ;
         *   - elle ne pose rien sur une etape sans lieu. Un trajet n a pas
         *     d endroit a photographier, et chercher par titre de trajet
         *     reviendrait a photographier le mot « trajet ».
         */
        enrichStepImages: async () => {
          const model = get().draft.itinerary;
          if (model === null) return;

          // Une requete par LIEU, et seulement pour ceux qui en nomment un.
          const cibles = model.steps.filter((step) => step.image == null && step.placeName != null);
          if (cibles.length === 0) return;

          await Promise.all(
            cibles.map(async (step) => {
              const nom = step.placeName;
              if (nom == null) return;

              let image: StepImage | null;
              try {
                image = await IMAGE_SOURCE(nom);
              } catch {
                // Une source qui leve est une source muette. Le preparateur ne
                // remplace jamais un silence par une image de substitution, donc
                // il ne rend rien et ne le signale pas.
                return;
              }
              if (image === null) return;

              patch((draft) => {
                // Le parcours a pu changer entre la demande et la reponse.
                const courant = draft.itinerary;
                if (courant === null) return draft;
                return draftActions.setItinerary(draft, withStepImage(courant, step.id, image));
              });
            }),
          );
        },
        continueGeneration: () =>
          patch((draft) => draftActions.setGeneration(draft, resumeGeneration(draft.generation))),
        markPhase: (id) =>
          patch((draft) => draftActions.setGeneration(draft, markPhaseDone(draft.generation, id))),
        pushGenerated: (days) =>
          patch((draft) => {
            const steps = buildItinerary(draft)?.steps ?? draft.generation.steps;
            return draftActions.setGeneration(draft, setPartial(draft.generation, steps, days));
          }),
        stopGeneration: () => {
          arretDemande = true;
          // Le statut change d'abord, le run ensuite : l'ecran doit lire
          // « interrompu » avant que quoi que ce soit ne leve.
          patch((draft) =>
            draftActions.setGeneration(draft, interruptGeneration(draft.generation))
          );
          requestGenerationStop();
          set({ liveModel: null });
        },
        failGenerationRun: (message) => {
          // Un run coupe n'est pas un echec. Sans ce garde, l'arret demande
          // ci-dessus se lirait « Echec : la preparation n a pas pu aboutir »
          // alors que la personne a choisi de l arreter.
          if (arretDemande) return;
          patch((draft) =>
            draftActions.setGeneration(draft, failGeneration(draft.generation, message))
          );
        },
        endGeneration: () => {
          set({ liveModel: null });
          patch((draft) => {
            const itinerary = buildItinerary(draft);
            const generation = finishGeneration(draft.generation);
            const withGeneration = draftActions.setGeneration(draft, generation);
            return itinerary
              ? draftActions.setItinerary(withGeneration, itinerary)
              : withGeneration;
          });
        },
        retryPhase: (id) => patch((draft) => draftActions.retryPhase(draft, id)),
        applyPhaseRetry: (retry) => patch((draft) => draftActions.applyPhaseRetry(draft, retry)),
        applyGenerated: (outcome) => patch((draft) => draftActions.applyGenerated(draft, outcome)),
        remeasure: async (reason) => {
          const { draft } = get();
          const model = draft.itinerary;
          // Sans parcours, il n y a rien a mesurer : ni depart, ni chaine, ni
          // promesse a tenir devant l'utilisateur.
          if (!model) return;

          enCours?.abort();
          const controller = new AbortController();
          enCours = controller;
          set({ remeasuring: reason });

          try {
            const mesure = await measureWithRunners(
              draft,
              model,
              browserMeasurementRunners(),
              controller.signal,
            );
            // Un run coupe n'ecrit rien : il a ete remplace, ou l'ecran a disparu.
            if (controller.signal.aborted) return;
            // Le parcours mesure n'est plus celui d'ecran : une edition plus
            // recente a change la geometrie et programme deja la sienne. Ecrire
            // ici reviendrait a faire passer un trace perime pour une mesure.
            if (get().draft.itinerary !== model) return;
            set((state) => ({ draft: draftActions.updateItinerary(state.draft, mesure) }));
          } finally {
            // Le drapeau ne retombe que si c'est ENCORE notre run. Sinon le
            // suivant mesure toujours, et l'ecran doit continuer de le dire.
            if (enCours === controller) {
              enCours = null;
              set({ remeasuring: null });
            }
          }
        },
        addStepToDay: (day, kind, step) => {
          const avant = get().draft.itinerary;
          patch((draft) => draftActions.addItineraryStep(draft, day, kind, step));
          return remesureSiChange('ajout-etape', avant);
        },        replaceStep: (stepId, replacement) => {
          const avant = get().draft.itinerary;
          patch((draft) => draftActions.replaceItineraryStep(draft, stepId, replacement));
          return remesureSiChange('remplacement-etape', avant);
        },
        addWaypoint: (coord, day) => {
          const avant = get().draft.itinerary;
          patch((draft) =>
            draft.itinerary
              ? draftActions.updateItinerary(draft, insertWaypoint(draft.itinerary, coord, day))
              : draft
          );
          return remesureSiChange('point-de-passage', avant);
        },
        keepStep: (stepId, kept) =>
          patch((draft) => draftActions.setItineraryKept(draft, stepId, kept)),
        linkMeal: (stepId, slot) =>
          patch((draft) => draftActions.setItineraryMealSlot(draft, stepId, slot)),
        dropStep: (stepId) => {
          const avant = get().draft.itinerary;
          patch((draft) => draftActions.removeItineraryStep(draft, stepId));
          return remesureSiChange('suppression-etape', avant);
        },
        adjust: (id) => {
          const avant = get().draft.itinerary;
          patch((draft) => draftActions.applyAdjustment(draft, id));
          return remesureSiChange('ajustement', avant);
        },
        setPacked: (gearId, packed) =>
          patch((draft) => draftActions.setPacked(draft, gearId, packed)),
        setGearWeight: (gearId, grams) =>
          patch((draft) => draftActions.setGearWeight(draft, gearId, grams)),
        assignGear: (gearId, ownerId) =>
          patch((draft) => draftActions.assignGear(draft, gearId, ownerId)),
        syncGear: () => patch((draft) => draftActions.refreshGear(draft)),
      };
    },
    {
      name: `lkdv_adventure_prep_v${PREP_DRAFT_VERSION}`,
      version: PREP_DRAFT_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ adventureId: state.adventureId, draft: state.draft }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

/**
 * Le moteur publie la geometrie ; le store la depose.
 *
 * L'abonnement est au NIVEAU DU MODULE, pas d'un composant : c'est la seule
 * facon d'etre pret avant qu'une generation ne demarre. Le moteur n'importe
 * JAMAIS le store — ce serait un cycle — donc ce canal est le seul point de
 * rencontre. Il ne depend d'aucun ecran monte, donc un double montage ne
 * depose pas la geometrie deux fois.
 */
onGenerationPartial((model) => {
  useAdventurePrepStore.getState().publishLiveModel(model);
});

/** Selecteur de draft : la route n'abonne que l'ecran qui en a besoin. */
export const usePrepDraft = (): AdventurePrepDraft => useAdventurePrepStore((state) => state.draft);

export const usePrepAction = <T>(select: (store: AdventurePrepStore) => T): T =>
  useAdventurePrepStore(select);

/** Acces hors React (tests, gestionnaires d'evenements). */
export const prepStore = {
  get: (): AdventurePrepStore => useAdventurePrepStore.getState(),
  subscribe: (listener: () => void) => useAdventurePrepStore.subscribe(listener),
};

/**
 * Re-export de la normalisation : l'ecran n'a ainsi qu'une porte a
 * interroger, et la regle reste ecrite une seule fois, dans `types.ts`.
 */
export { normalizeClockTime };

/** Reference stable pour les gestionnaires d'evenements sans re-rendu. */
export const useStableCallback = <T extends (...args: never[]) => unknown>(fn: T): T =>
  useCallback(fn, [fn]);
