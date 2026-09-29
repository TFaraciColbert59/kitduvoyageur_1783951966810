'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { fetchItineraryProposal } from '@/app/prepare/actions';
import { activityById } from '../catalog';
import { activeDayOrNull, metricsFor, type PrepMetric } from '../engine/metrics';
import { daySteps } from '../engine/itinerary';
import type { DayWeather } from '../engine/weather';
import { weatherParts } from '../engine/weather';
import { rejectionMessage, runItineraryGeneration } from '../engine/itineraryPhases';
import {
  metricDataSource,
  routeDataSource,
  type DataSourceEntry,
  type DataSourceId,
  type MeasureProviderId,
  type RouteProvider,
} from '../engine/provenance';
import { browserMeasurementRunners } from '../browserMeasurements';
import type { MeasurementRunners } from '../engine/measurements';
import {
  anchorsOf,
  loadPlaceInventoryFor,
  resolvePlacesFor,
  warmAmenitiesFor,
} from '../placeSource';
import { shouldLaunchGeneration } from '../engine/stepTransition';
import { minutesLabel, programTitle } from '../engine/labels';
import { A_VERIFIER, moneyLabel } from '../engine/trust';
import { useDaySwipe } from '../hooks/useDaySwipe';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  AdventurePrepDraft,
  ItineraryModel,
  ItineraryStep as ItineraryStepModel,
  ItineraryStepKind,
  PlaceRef,
} from '../types';
import { StepPhoto } from './StepPhoto';
import { PrepMap, PREP_POINT_COLORS, type PrepMapPoint } from './PrepMap';
import { PrepDataSource } from './PrepDataSource';
import type { PrepSheetId } from './PrepSheets';
import { failedGenerationPhase } from '../types';

export interface ItineraryStepScreenProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

/**
 * Rien a construire : la generation s'arrete sur cette phrase plutot que de
 * laisser un rail a moitie coche. Le besoin est nomme, pas suppose.
 */
const BLOCKED_MESSAGE =
  'Il manque une activité ou une durée pour construire le parcours. Tu peux arrêter ici, ou revenir à l’étape précédente.';

const STEP_ICONS: Readonly<Record<ItineraryStepKind, string>> = {
  trajet: 'route',
  arret: 'map-pin',
  repos: 'footprints',
  nuit: 'bed-double',
  ravitaillement: 'backpack',
};

/** Familles affichees par la carte : tout le parcours, sans exception. */
const MAP_CATEGORIES: readonly string[] = ['trajet', 'arret', 'repos', 'nuit', 'ravitaillement'];

/** Les classes de `.prep-step` visent du texte de bloc : on leve le inline. */
const AS_BLOCK: React.CSSProperties = { display: 'block' };

/* ------------------------------------------------------------------ */
/* Donnees derivees                                                    */
/* ------------------------------------------------------------------ */

/** Coordonnee exploitable : jamais de point invente sur la carte. */
function isLocatable(place: PlaceRef): boolean {
  return (
    Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.lat !== 0 && place.lon !== 0
  );
}

/** Trace : le depart, puis l'arrivee si elle est bien differente. */
function routeCoords(draft: AdventurePrepDraft): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const push = (place: PlaceRef | null) => {
    if (!place || !isLocatable(place)) return;
    const last = coords[coords.length - 1];
    if (last && last[0] === place.lat && last[1] === place.lon) return;
    coords.push([place.lat, place.lon]);
  };
  push(draft.route.origin);
  push(draft.route.destination);
  return coords;
}

/** Points du programme : une entree par etape reellement localisee. */
function mapPoints(steps: readonly ItineraryStepModel[]): PrepMapPoint[] {
  return steps.flatMap((step) => {
    if (step.lat === null || step.lon === null) return [];
    if (!Number.isFinite(step.lat) || !Number.isFinite(step.lon)) return [];
    return [
      {
        id: step.id,
        lat: step.lat,
        lon: step.lon,
        label: step.title,
        color: PREP_POINT_COLORS[step.kind],
        category: step.kind,
        stepId: step.id,
      },
    ];
  });
}

/**
 * Trace d'une seule journee.
 *
 * Le focus jour doit repeindre la carte avec LE JOUR et rien d'autre : garder
 * le voyage entier donnerait l'impression qu'il faut refaire tout le trajet
 * alors qu'on ne regarde qu'une partie du programme. On ne conserve que les
 * etapes localisees de ce jour, dans l'ordre.
 */
/**
 * H5 : la provenance de chaque mesure, une ligne par mesure affichee et
 * reellement relevee.
 *
 * Fonction PURE et exportee : c est elle qui dit d ou vient chaque chiffre.
 * Elle ne separe que deux mesures, pour une raison de contracts — la distance
 * et la duree sortent du ROUTEUR qui a repondu, le denivele sort de la grille
 * d altitudes, et ces trois reponses ne nomment pas leur source de la meme
 * facon (voir `engine/provenance.ts`).
 *
 * `routeProvider` est la valeur lue dans la REPONSE de `/api/route`. Un
 * refus ne nomme personne : le parametre reste alors `null` et la ligne dit
 * « source inconnue ». Nommer le routeur PAR DEFAUT — parce que c est celui
 * qu on a demande — serait exactement le mensonge que ce module refuse.
 *
 * `series` porte le credit de chaque famille de mesure, et lui seule.
 * `/api/elevation` et `/api/weather` passent par le meme canal de
 * `browserMeasurementRunners` — meme service, donc meme identifiant — mais ce
 * canal ne dit pas QUELLE route a parle : un `MeasureProviderId` unique ne
 * pourrait pas empecher `/api/weather` de crediter le denivele, puisque les
 * deux repondent `open-meteo`. L ecran range donc chaque annonce dans la
 * serie qui l a produite, et cette fonction ne lit plus qu un enregistrement
 * par serie. `metricDataSource` refuse par ailleurs tout credit sur la
 * distance, dont la source sort du routeur.
 *
 * Une reponse qui ne se nomme pas laisse son enregistrement a `null`, et la
 * ligne affiche « source inconnue » — jamais un fournisseur deduit du fait
 * qu on ait appele la route.
 */
export interface MeasureSeries {
  /** Ce que `/api/elevation` a nomme pour le denivele, ou `null`. */
  readonly denivele: MeasureProviderId | null;
  /** Ce que `/api/weather` a nomme pour les previsions, ou `null`. */
  readonly meteo: MeasureProviderId | null;
}

export function buildProvenance(
  metrics: readonly PrepMetric[],
  routeProvider: RouteProvider | null,
  series: MeasureSeries,
): DataSourceEntry[] {
  const route = routeProvider === null ? null : routeDataSource(routeProvider);
  return metrics.flatMap((metric): DataSourceEntry[] => {
    // La meteo n a pas sa place ici : elle affiche par journee, dans le
    // programme, et son rendu n est pas celui d une tuile de mesure.
    if (metric.id !== 'distance' && metric.id !== 'denivele') return [];
    // Une mesure sans valeur n a pas de chiffre a attribuer. La recopier
    // afficherait deux fois « À vérifier » pour la meme absence.
    if (metric.value === null) return [];
    return [
      {
        metric: metric.id,
        value: metric.value,
        unit: metric.unit,
        // Trois credits, trois familles, jamais melangees : le routeur pour
        // la distance, la grille d altitudes pour le denivele. `series[metric.id]`
        // lit la SEULE serie concernee, donc un credit de prevision ne peut pas
        // se poser sur un denivele. Et `metricDataSource` renvoie `null` sur
        // `distance` par construction : meme le jour ou la branche distance
        // disparaitrait, aucun credit Open-Meteo n y poserait par accident.
        source:
          metric.id === 'distance' ? route : metricDataSource(metric.id, series[metric.id]),
      },
    ];
  });
}

export function dayRouteCoords(steps: readonly ItineraryStepModel[]): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (const step of steps) {
    if (step.lat === null || step.lon === null) continue;
    if (!Number.isFinite(step.lat) || !Number.isFinite(step.lon)) continue;
    const last = coords[coords.length - 1];
    if (last && last[0] === step.lat && last[1] === step.lon) continue;
    coords.push([step.lat, step.lon]);
  }
  return coords;
}

/** Programme de l'ensemble : jour, puis ordre dans la journee. */
/**
 * La meteo d'un jour, ecrite telle qu'elle a ete mesuree.
 *
 * Un libelle manquant ne devient jamais un nombre : sans temperature, on rend
 * le libelle SEUL. Ecrire « 0 ° » ou reuse la valeur d'un autre jour produirait
 * une meteo fausse mais bien formatee, ce qui est le piege le plus tentant.
 */
function allSteps(model: ItineraryModel): ItineraryStepModel[] {
  return [...model.steps].sort((a, b) => a.day - b.day || a.order - b.order);
}

/* L3.4 — UN seul « À vérifier » par ligne.
 *
 * La ligne d'un etape est un couple : l'heure de depart, puis la duree. Le
 * joint `·` rendait les deux MOIS meme quand aucun des deux n etait connu,
 * et l ecran lisait « À vérifier · À vérifier » : la meme absence repetee
 * deux fois se lit comme deux informations, alors qu il n'y en a qu une.
 *
 * On ne decide pas QUELLE des deux absences montrer : la ligne conserve son
 * contrat (heure, puis duree) et n'affiche que ce qui existe. Une seule
 * absence donne un seul « À vérifier » ; deux absences donnent le meme
 * « À vérifier » qu une, ce qui est exact : on ignore toujours deux choses. */
function whenLabel(step: ItineraryStepModel): string {
  const parts: string[] = [];
  if (step.startTime) parts.push(step.startTime);
  if (step.durationMin !== null && Number.isFinite(step.durationMin)) {
    parts.push(minutesLabel(step.durationMin));
  }
  return parts.length > 0 ? parts.join(' · ') : A_VERIFIER;
}

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Ecran                                                               */
/* ------------------------------------------------------------------ */

function FocusedStepView({
  program,
  onOpenSheet,
}: {
  program: ItineraryStepModel[];
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<{ stepId: string }>) => setFocusedId(e.detail.stepId);
    window.addEventListener('prep:focus-step', handler as any);
    return () => window.removeEventListener('prep:focus-step', handler as any);
  }, []);

  const step = program.find((s) => s.id === focusedId) || program[0];
  if (!step) return null;

  return (
    <div className="prep-step">
      <div className="prep-step__head">
        <div className="prep-step__body">
          <h3 className="prep-step__name">
            {step.title}
          </h3>
          {/* M2.3 — OÙ ?
              *
              * Mesure (etape 2, 393x852) : la carte focalisee repondait a QUOI
              * (titre), QUAND (when) et POURQUOI (reason), et ne nommait
              * JAMAIS le lieu. Une carte dont on ne sait pas OU on va n a pas
              * repondu a la question la plus simple du voyage.
              *
              * Le champ existait deja dans le modele (`placeName`) et la feuille
              * de style possedait deja `.prep-step__place` (adventure-prep.css:3321) :
              * la case etait prevue, jamais remplie.
              *
              * Comme partout ailleurs sur cet ecran, un lieu absent ne rend RIEN :
              * ni tiret, ni «Lieu a verifier », ni le nom du lieu voisin. Une ligne
              * vide-costumee serait un mensonge de moins, mais toujours un mensonge. */}
          {step.placeName ? (
            <p className="prep-step__place" style={AS_BLOCK}>
              {step.placeName}
            </p>
          ) : null}
          {/* E8 - LA PHOTO, ou rien.

              L image est une donnee comme le lieu : elle n arrive que si la
              source a rendu une URL HTTPS, un auteur et une licence. Aucune des
              trois, aucune photo. `StepPhoto` porte le credit et le retire si le
              fichier ne se charge pas, donc cette carte ne peut ni afficher un
              cadre vide, ni faire semblant d en savoir plus qu elle n en sait.

              Elle se place sous le LIEU, pas au-dessus du titre : une photo
              illustre un endroit precis, et le nom de cet endroit est
              immediatement au-dessus d elle. */}
          {step.image ? (
            <StepPhoto image={step.image} placeName={step.placeName} title={step.title} />
          ) : null}
          <div className="prep-step__when" style={AS_BLOCK}>
            {whenLabel(step)}
          </div>
          {step.reason && (
            <div
              className="prep-step__reason"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {step.reason}
            </div>
          )}
        </div>
        <div className="prep-step__price" data-state={step.price.state}>
          {moneyLabel(step.price)}
        </div>
      </div>
      <div className="prep-step__actions">
        <Button variant="secondary" size="sm" onClick={() => onOpenSheet('step', step.id)}>
          Détails
        </Button>
        {/* L3.6 - deux actions, pas trois.

            « Remplacer » a longtemps partage la carte avec « Détails » et
            « À conserver », a meme poids et sans ordre. Trois boutons de meme
            poids se lisent comme trois actions de meme importance : on ne sait
            plus laquelle est secondaire, alors que deux le sont toujours. Les
            deux qui restent disent ce qu on fait de l etape - la consulter, ou
            decider si elle garde sa place dans le parcours.

            La capacite, elle, n a pas disparu. Le moteur classe des lieux du
            meme type autour d un point de reference REEL (engine/stepAlternatives
            / alternativesFor), le store l interroge (alternativesForStep), et
            PrepSheets monte ReplaceSheet pour la vue replace. « Remplacer »
            s appelle maintenant depuis la fiche de l etape, avec la meme
            identite qu avant : le tiroir lit l etape qu on regarde, et non
            la premiere du programme par hasard. Une action qui sert une fois
            sur dix n a pas besoin d disputer la carte a une action qui sert
            a chaque consultation. */}
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={step.kept}
          onClick={() => useAdventurePrepStore.getState().keepStep(step.id, !step.kept)}
        >
          {step.kept ? (
            <>
              <Icon name="check" size={16} /> À conserver
            </>
          ) : (
            'À conserver'
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Etape 2 — Parcours : une seule decision a l'ecran (A6).
 *
 * Quatre etats mutuellement exclusifs : point de depart, generation en
 * cours, generation interrompue, itineraire pret. Jamais de pourcentage ni
 * de score : la preparation n'a pas de note (A9). Aucune donnee n'est
 * inventee — une information absente s'affiche « À vérifier ».
 */
export function ItineraryStepScreen({ onOpenSheet }: ItineraryStepScreenProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  // `?? null` : un store qui n'expose pas encore la mesure ne doit surtout pas
  // allumer un indicateur dont il ne connait pas l'etat.
  const remeasuring = useAdventurePrepStore((state) => state.remeasuring ?? null);
  // E8 - la photo REELLE, demandee une fois le parcours construit, jamais
  // pendant qu il se construit. La fonction du store est stable, donc cette
  // dependance ne peut pas relancer la passe a chaque rendu.
  const enrichStepImages = useAdventurePrepStore((state) => state.enrichStepImages);
  const itineraryCourant = draft.itinerary;

  /**
   * Demande les photos, en arriere-plan, une fois par PARCOURS.
   *
   * La cle est l IDENTITE du modele : c est le seul changement que les moteurs
   * signalent, puisqu ils rendent le MEME objet quand ils n ont rien change. Une
   * cle sur le nombre d etapes serait fausse - remplacer un lieu garde le meme
   * compte alors que la photo, elle, change de sujet.
   *
   * L effet ne bloque rien et n attend rien. Source muette, delai long ou image
   * cassee ne changent rien au parcours : la carte s affiche entiere, et la
   * photo s ajoutera apres coup, ou pas du tout.
   */
  useEffect(() => {
    if (itineraryCourant === null) return;
    // Un store qui n expose pas encore l action — un double de test, un etat en
    // cours d hydratation — ne doit pas faire tomber l ecran POUR UNE PHOTO.
    // L absence se paie en photo manquante, jamais en page blanche.
    if (typeof enrichStepImages !== 'function') return;
    void enrichStepImages();
  }, [itineraryCourant, enrichStepImages]);
  const [blocked, setBlocked] = useState(false);
  // H5 : le fournisseur de la distance et de la duree. Il n est PAS le mode
  // demande au routeur : c est la valeur que /api/route a lue dans sa
  // reponse. Un refus (`legs === null`) ne nomme personne, donc ce state
  // reste `null` et l ecran dit « source inconnue » plutot que de
  // reproposer le routeur par defaut. Voir `browserMeasurements.ts`.
  const [routeProvider, setRouteProvider] = useState<RouteProvider | null>(null);
  // H5 : le fournisseur de chaque SERIE de mesure (altitude ET meteo), lu
  // dans le corps des deux reponses. La tuile ne pouvait nommer que le routeur
  // avant ce raccordement, et le denivele restait « source inconnue » meme
  // quand `/api/elevation` avait repondu et nomme Open-Meteo. Meme regle qu au
  // routage : un refus ne nomme personne.
  //
  // DEUX etats et non un seul : les deux routes partagent un identifiant — le
  // meme service — donc un credit unique ne saurait pas dire lequel des deux a
  // repondu. Or `/api/weather` qui repond credited le denivele d un service
  // qui ne l a pas mesure : un credit vrai en apparence, faux dans sa
  // precision. Chaque annonce est donc deversee dans SA serie (voir
  // `mesureRunners`).
  const [series, setSeries] = useState<MeasureSeries>({ denivele: null, meteo: null });
  // La serie en cours de mesure, lue au moment ou le canal se declenche.
  const measuring = useRef<keyof MeasureSeries | null>(null);

  // Focus jour : source unique dans le store module, partage avec la bottom bar.
  // L'ecran n'invente donc jamais son propre « jour » : il lit ce que le rail
  // affiche, ce qui garantit que la carte, les metriques et le programme
  // parlent tous du meme perimetre.
  const focusDay = useDayFocusStore((state) => state.selectedDay);
  const selectFocusDay = useDayFocusStore((state) => state.selectDay);
  // L6.6 — cet ecran NE MONTE PLUS le publisher. `AdventurePrepShell` le
  // monte deja, une fois, avec le `focusable` reellement decide par l etape
  // courante ; le remonter ici ecrivait deux fois le meme store et pouvait
  // repasser `focusable` a `true` la ou le shell venait de dire `false`.
  // Le rail partage est donc publie depuis le cadre commun des trois
  // ecrans, ce qui est la seule maniere qu il le soit vraiment.

  const runAbort = useRef<AbortController | null>(null);

  // Au demontage, l'appel reseau en cours est coupe : aucune ecriture d'etat
  // n'arrive apres la disparition de l'ecran et le store n'est pas laisse
  // bloque en « en cours ».
  // Au demontage, l'appel reseau en cours est coupe ET la reference est
  // liberee : les deux vont ensemble. Sans la liberation, un remontage verrait
  // un controleur encore present, croirait qu une generation lui survit, et
  // refuserait de lancer celle qui manque.
  useEffect(
    () => () => {
      runAbort.current?.abort();
      runAbort.current = null;
    },
    []
  );

  /**
   * Les deux phases de mesure, chacune avec SON credit.
   *
   * `browserMeasurementRunners` ne rend qu UN canal pour les deux series,
   * parce qu il n y a qu un service derriere. Ce canal annonce « qui a
   * repondu », pas « quelle route a repondu » — et comme les deux repondent
   * `open-meteo`, un composant qui l ecouterait tout court crediterait le
   * denivele des que la meteo est disponible, meme apres un 503 de
   * `/api/elevation`.
   *
   * On encadre donc chaque phase, et on deverse l annonce dans la seule serie
   * qui la produit. Ce n est pas une hypothese : `browserMeasurements.ts`
   * interroge `/api/elevation` dans le `route` de `trace`, et `/api/weather`
   * dans `weather`. Le marquage est pose AVANT l appel et retire DANS un
   * `finally`, donc une phase qui echoue ne laisse pas son credit a la suivante.
   */
  const mesureRunners = useCallback((): MeasurementRunners => {
    const base = browserMeasurementRunners(
      fetch,
      (provider) => setRouteProvider(provider),
      (provider) => {
        const serie = measuring.current;
        // Une annonce hors phase ne se rattache a aucune serie : elle ne nomme
        // personne plutot que de nommer la mauvaise.
        if (serie === null) return;
        setSeries((avant) =>
          avant[serie] === provider ? avant : { ...avant, [serie]: provider }
        );
      }
    );
    const encadrer = (
      nom: keyof MeasureSeries,
      phase: (d: AdventurePrepDraft, m: ItineraryModel, s: AbortSignal) => Promise<ItineraryModel>
    ) => async (d: AdventurePrepDraft, m: ItineraryModel, s: AbortSignal) => {
      measuring.current = nom;
      try {
        return await phase(d, m, s);
      } finally {
        measuring.current = null;
      }
    };
    return {
      trace: encadrer('denivele', base.trace),
      weather: encadrer('meteo', base.weather),
    };
  }, []);

  /**
   * Lance la construction reelle du parcours.
   *
   * Le rail ne coche plus des phases a intervalle fixe :
   * `runItineraryGeneration` signale chaque phase APRES son propre travail
   * (appel reseau, verification, classement des reservations, assemblage).
   * Quand l'IA ne repond pas ou propose quelque chose d'incoherent, le moteur
   * replie sur les regles et l'ecran affiche pourquoi.
   */
  const startRun = useCallback(async (mode: 'start' | 'resume') => {
    runAbort.current?.abort();
    const controller = new AbortController();
    runAbort.current = controller;
    setBlocked(false);
    // Un run qui recommence n herite d aucun fournisseur : sans cette remise a
    // zero, un refus du second run afficherait encore le routeur qui avait
    // repondu au premier. La provenance suit la MESURE, pas l historique.
    setRouteProvider(null);
    setSeries({ denivele: null, meteo: null });

    const store = useAdventurePrepStore.getState();
    if (mode === 'start') store.startGenerationRun();
    else store.continueGeneration();

    try {
      const outcome = await runItineraryGeneration(
        store.draft,
        controller.signal,
        (draftToBuild, _signal, availablePlaces) =>
          fetchItineraryProposal(draftToBuild, availablePlaces),
        (phase) => useAdventurePrepStore.getState().markPhase(phase),
        mesureRunners(),
        {},
        resolvePlacesFor(),
        loadPlaceInventoryFor(),
        (draftToBuild, signal) => {
          void warmAmenitiesFor(anchorsOf(draftToBuild), fetch, signal);
        }
      );
      // Un run coupe n ecrit rien : l ecran a disparu ou un autre run l a remplace.
      if (controller.signal.aborted) return;

      const next = useAdventurePrepStore.getState();
      if (!outcome.model) {
        setBlocked(true);
        next.failGenerationRun(BLOCKED_MESSAGE);
        return;
      }
      next.applyGenerated(outcome);
      // L0 (mesure, etape 2) : `completeStep('itinerary')` venait ici. Le
      // reducer avance d office `currentStep` vers l etape suivante des que
      // l etape est satisfaite (reducer.ts:147) : le parcours venait de
      // s afficher, et la meme seconde leciait l ecran. Le pied « Vers le
      // depart » — le SEUL sortie que l etape 2 se donne — n etait donc
      // jamais atteignable, et rien de cet ecran n etait mesurable.
      // La validation reste au pied, qui appelle deja `completeStep` puis
      // `goToStep('departure')` : un seul endroit decide de la sortie.
    } catch (err) {
      // Une generation qui LEVE ne doit jamais laisser le store muet.
      //
      // Defaut mesure le 2026-09-29 : ce bloc n avait que `finally`. Le
      // `finally` liberait le controleur — l ecran se croyait donc libre — mais
      // rien n appelait `failGenerationRun`. Le statut restait `en_cours` :
      // plus aucun lancement possible, aucun echec affiche, aucune sortie. Un
      // etat terminal qui n est ni un succes ni un echec, dans lequel
      // l utilisateur pouvait rester.
      //
      // Le rejeu etait en outre `UNHANDLED` : la levee sortait de `startRun`
      // et personne ne la recevait, donc meme la console de production n aurait
      // rien dit. Le run coupe, lui, n est pas une panne : c est un choix, et il
      // laisse la main au run qui l a remplace.
      if (controller.signal.aborted) return;
      const raison = err instanceof Error ? err.message : String(err);
      setBlocked(true);
      useAdventurePrepStore.getState().failGenerationRun(
        `La preparation n a pas pu aboutir : ${raison}`
      );
    } finally {
      // La reference est liberee dans TOUS les cas : un ecran qui remonte
      // apres un run termine ne doit pas se croire encore vivant, sinon il
      // refuserait de relancer une generation orpheline.
      if (runAbort.current === controller) runAbort.current = null;
    }
  }, []);

  /**
   * L'ecran 1 ne construit rien : il passe la main. La generation demarre
   * donc ici, une fois, et seulement s'il reste quelque chose a construire — la
   * decision elle-meme est pure et vit dans le moteur.
   *
   * Le statut passe a « en cours » avant le premier await : un second montage
   * (React StrictMode, remontee apres une fermeture) relit l'etat et ne relance
   * rien. Aucun temoin local n'est necessaire, donc rien ne peut desynchroniser
   * l'ecran du store.
   */
  useEffect(() => {
    if (
      !shouldLaunchGeneration(useAdventurePrepStore.getState().draft, {
        live: runAbort.current !== null,
      })
    )
      return;
    void startRun('start');
  }, [startRun]);

  const stopRun = useCallback(() => {
    runAbort.current?.abort();
    runAbort.current = null;
    useAdventurePrepStore.getState().stopGeneration();
  }, []);

  const model = draft.itinerary;
  const generation = draft.generation;
  // La phase a rejouer, DERIVEE de l'etat — jamais supposee, jamais
  // une constante. C'est elle qui decide s'il y a un bouton.
  const retryablePhase = failedGenerationPhase(generation);
  const activity = activityById(draft.activities.primary);

  // `null` = Ensemble. Un jour hors borne retombe sur l'ensemble.
  const activeDay = model === null ? null : activeDayOrNull(model.days, focusDay);
  // E6 : le balayage de jour existe dans le moteur depuis le debut, mais rien ne
  // l'appelait. Il est pose sur le CORPS de l'ecran, donc ni sur la barre basse
  // (son frere, hors du corps), ni sur les tiroirs (portales hors du corps), ni
  // sur la carte (que le hook laisse a ses propres gestes). Le rail de jours
  // reste rendu et focusable : le geste n'est qu'un raccourci, jamais l'unique
  // chemin vers un jour.
  const daySwipe = useDaySwipe({
    current: activeDay,
    days: model?.days ?? 0, // 0 = aucun jour a balayer ; useDaySwipe sort des que days < 2.
    onSelectDay: selectFocusDay,
  });
  const metrics = useMemo(
    () =>
      model
        ? metricsFor(model, activeDay === null ? 'aventure' : 'jour', activeDay ?? undefined)
        : [],
    [model, activeDay]
  );
  // H5 : la provenance, une ligne par mesure REELLEMENT affichee et
  // REELLEMENT relevee. Une mesure sans valeur n a pas de chiffre a
  // attribuer, et la recopier afficherait deux fois « À vérifier ».
  //
  // La source vient de la reponse du reseau, jamais du mode demande :
  // `routeProvider` est rempli par le callback de
  // `browserMeasurementRunners`, que le routeur declenche apres avoir lu
  // un `provider` dans le corps de sa reponse. Un refus ne le declenche
  // pas, donc la ligne affiche « source inconnue » au lieu d inventer un
  // fournisseur.
  //
  // `series` suit la meme regle pour les SERIES de mesure : une annonce ne
  // survient qu APRES acceptation de SA serie, donc une serie refusee — ou une
  // reponse muette — ne laisse pas de credit a l ecran. C est ce qui permet
  // enfin au denivele de nommer le service qui l a releve, au lieu de porter
  // forever le `null` d avant le raccordement.
  const provenance = useMemo(
    () => buildProvenance(metrics, routeProvider, series),
    [metrics, routeProvider, series]
  );
  const program = useMemo(() => {
    if (!model) return [];
    return activeDay === null ? allSteps(model) : daySteps(model, activeDay);
  }, [model, activeDay]);

  // La carte suit le focus : trace du jour seul des qu'un jour est selectionne.
  const coords = useMemo(() => {
    if (activeDay !== null && model) return dayRouteCoords(daySteps(model, activeDay));
    return routeCoords(draft);
  }, [activeDay, draft, model]);
  const points = useMemo(() => mapPoints(program), [program]);

  const goToDeparture = useCallback(() => {
    const store = useAdventurePrepStore.getState();
    store.completeStep('itinerary');
    store.goToStep('departure');
  }, []);

  const keepWhatExists = useCallback(() => {
    const store = useAdventurePrepStore.getState();
    store.proposeItinerary();
    store.completeStep('itinerary');
    store.goToStep('departure');
  }, []);

  /**
   * Reprise bornee a la phase tombee (P4.4).
   *
   * Deux gestes, dans cet ordre. `retryPhase` re-arme la phase — elle
   * cesse d'etre verdit « non livree » et son constat s'efface du bandeau.
   * `startRun('resume')` fait le travail. Inverser l'ordre relancerait un
   * parcours dont l'etat dit encore que la phase a echoue ; n'armer que
   * laisserait un bouton qui ne lance rien.
   *
   * La cause (`rejectedReason`, `failure`, `notice`) n'est PAS effacee :
   * `retryPhase` la conserve, et `startRun` ne l'ecrit qu'a la fin, quand
   * un resultat a reellement remplace la panne. C'est exactement ce que le
   * commentaire du reducer exige, et `p4-rejection.test.ts` le verrouille.
   */
  const resumeFailedPhase = useCallback(() => {
    const fallen = failedGenerationPhase(useAdventurePrepStore.getState().draft.generation);
    if (!fallen) return;
    useAdventurePrepStore.getState().retryPhase(fallen.id);
    void startRun('resume');
  }, [startRun]);

  /* --- Rendering -------------------------------------------------------- */

  return (
    <div className="prep-screen">
      <div className="prep-body" {...daySwipe}>
        {/* Un titre, un sous-titre, deux lignes (P0.11). La notice tellingait
            sa place DANS la pastille : les deux textes se repliaient l'un
            contre l'autre sur trois ou quatre lignes, avec deux icones
            sparkles pour deux fois le meme role. Elle est donc sortie de la
            pastille sans perdre son sens : elle dit toujours honnetement ce
            qui reste a confirmer. */}
        <button type="button" className="prep-pill" onClick={() => onOpenSheet('coverage')}>
          <Icon name={activity?.icon || 'sparkles'} size={16} />
          <span className="prep-pill__label">
            {programTitle(activity?.label ?? null, draft.brief)}
          </span>
        </button>

        {/* P4.6 — la cause du REFUS de l'IA, enfin lue. Le moteur la
            produit, `applyGenerated` la conserve, et c'est ici qu'elle
            devient une phrase. Sans elle, le bandeau annonçait un repli
            sur les regles sans jamais nommer CE QUI avait ete refuse : la
            personne ne pouvait ni comprendre la panne, ni savoir si
            relancer changerait quoi que ce soit.

            P4.4 — le bouton n'apparait QUE si une phase est reellement
            rejouable. `failedGenerationPhase` ne rend une phase que si le
            moteur l'a declaree non livree ET rejouable ; sinon
            `retryPhase` rendrait le brouillon intact et le bouton serait
            un appel qui ne fait rien. Aucun CTA mort, donc aucune phase a
            designer, donc pas de bouton.

            Le clic arme la phase PUIS relance : armer seul ne rejouerait
            rien, et relancer sans armer laisserait a l'ecran un verdict de
            panne que la reprise vient justement de lever. */}
        {model && generation.notice !== null && (
          <p className="prep-notice" role="status">
            {generation.notice}
          </p>
        )}

        {/* La cause du refus est son PROPRE bloc, jamais une suite de texte
            collee a la notice : deux causes, deux boites, deux lectures. Elle
            garde `role="status""` pour etre annoncee, et le meme gabarit
            `prep-notice` pour ne pas creer une style que l agent CSS n aura
            pas ecrit. */}
        {generation.rejectedReason !== null && (
          <p className="prep-notice" role="status" data-tone="warn">
            {rejectionMessage(generation.rejectedReason)}
          </p>
        )}

        {retryablePhase !== null && (
          <span style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={resumeFailedPhase}
              icon={<Icon name="refresh-cw" size={16} />}
            >
              Relancer « {retryablePhase.label} »
            </Button>
          </span>
        )}

        {/* D1-C : ce texte ne nomme aucune distance reelle, il ne parle que
            d attendu. Pendant la generation il etait coupe par le haut et
            masque par la carte des phases (proof/D1-00, D1-10) : on ne l affiche
            que lorsqu il y a bel et bien des valeurs a verifier. */}
        {!model && generation.status !== 'en_cours' && (
          <p
            className="prep-help"
            style={{
              textAlign: 'center',
              color: 'var(--lkv-text-subtle)',
              margin: 'var(--space-2) 0',
            }}
          >
            Distances, durées et prix restent À vérifier.
          </p>
        )}

        {!model && generation.status === 'en_cours' && (
          <div className="prep-rail" aria-live="polite">
            {generation.phases.map((phase, index, arr) => {
              const active = !phase.done && (index === 0 || arr[index - 1].done);
              return (
                <div
                  key={phase.id}
                  className="prep-rail__line"
                  data-state={active ? 'active' : phase.done ? 'done' : 'pending'}
                >
                  <span className="prep-rail__dot" aria-hidden="true">
                    <Icon
                      name={phase.done ? 'check' : active ? 'refresh-cw' : 'circle'}
                      size={20}
                      className={active ? 'spin' : ''}
                    />
                  </span>
                  <span>{phase.label}</span>
                </div>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              onClick={stopRun}
              icon={<Icon name="x" size={16} />}
            >
              Arrêter
            </Button>
          </div>
        )}

        {!model && (generation.status === 'interrompu' || generation.status === 'echec') && (
          <div className="prep-block" style={{ padding: 'var(--space-4)' }}>
            <p
              className="prep-note"
              data-tone="warn"
              role="status"
              style={{ marginBottom: 'var(--space-3)' }}
            >
              {generation.error || BLOCKED_MESSAGE}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => startRun('resume')}
                icon={<Icon name="refresh-cw" size={16} />}
              >
                Reprise du parcours
              </Button>
              <Button variant="secondary" size="sm" onClick={() => startRun('resume')}>
                Continuer avec les éléments disponibles
              </Button>
            </div>
          </div>
        )}

        {model && (
          <>
            <div className="prep-metrics">
              {metrics.map((metric) => (
                <div key={metric.id} className="prep-metric">
                  <span className="prep-metric__label">{metric.label}</span>
                  <span
                    className="prep-metric__value"
                    data-unknown={metric.state === 'a_verifier' ? 'true' : undefined}
                  >
                    {metric.formatted}
                  </span>
                  {metric.note ? <span className="prep-metric__note">{metric.note}</span> : null}
                </div>
              ))}
            </div>

            {/* H5 : d ou vient chaque chiffre affiche au-dessus. La ligne
                ne propose ni bouton ni lien — une provenance n est pas une
                action — et elle ne remplace jamais la tuile : elle la
                complete. */}
            {provenance.map((entry) => (
              <PrepDataSource key={entry.metric} entry={entry} />
            ))}

            {/* Le programme EST la liste visible des etapes. Une version parallele
                « pour les tests » qui n'afficherait rien a l'ecran ne prouverait
                rien et cacherait le parcours a l'utilisateur. */}
            <div className="prep-programme">
              <div className="prep-programme__list">
                {(activeDay === null
                  ? Array.from({ length: model.days }, (_, index) => index + 1)
                  : [activeDay]
                ).map((day) => (
                  <section key={day} className="prep-programme__day">
                    <header className="prep-programme__dayhead">
                      <span className="prep-programme__daylabel">Jour {day}</span>
                      <span className="prep-programme__weather">
                        {(() => {
                          const parts = weatherParts(model.weather[day - 1] ?? null);
                          return (
                            <>
                              <span className="prep-programme__sky">{parts.condition}</span>
                              {parts.measures ? (
                                <span className="prep-programme__measures">{parts.measures}</span>
                              ) : null}
                            </>
                          );
                        })()}
                      </span>
                    </header>
                    <ul className="prep-programme__steps">
                      {daySteps(model, day).map((item) => (
                        <li key={item.id} className="prep-programme__step">
                          <Icon name={STEP_ICONS[item.kind]} size={16} aria-hidden="true" />
                          <span className="prep-programme__steptitle">{item.title}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            {program.length > 0 && <FocusedStepView program={program} onOpenSheet={onOpenSheet} />}

            <div className="prep-actionrow">
              {/* M2.2 — une priorite lisible, SANS changer le nombre de CTA.
                  *
                  * Les trois boutons etaient strictement identiques : meme
                  * variante, meme taille, meme poids. Trois actions de meme
                  * poids se lisent comme trois actions de meme importance, ce
                  * qu elles ne sont pas. « Etapes » (lire le parcours) et
                  * « Ajouter » (le completer) ne valent pas « Ajuster »
                  * (le corriger), qui est le geste attendu juste apres que le
                  * parcours vient d etre produit.
                  *
                  * On ne regroupe PAS les trois. E10-05 verrouille exactement
                  * ces trois libelles dans cet ordre, et la consigne du
                  * proprietaire impose que le tiroir « Etapes » reste
                  * fonctionnel et liste les 16 etapes : le regrouper le ferait
                  * disparaitre de l ecran, et le remede aurait supprime le
                  * symptome en cassant la garantie. */}
              <Button
                variant="primary"
                size="md"
                onClick={() => onOpenSheet('adjust')}
                icon={<Icon name="Cog6ToothIcon" size={18} />}
              >
                Ajuster
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => onOpenSheet('steps')}
                icon={<Icon name="clipboard-list" size={18} />}
              >
                Étapes
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => onOpenSheet('add')}
                icon={<Icon name="plus" size={18} />}
              >
                Ajouter
              </Button>
            </div>
          </>
        )}

        {!model && generation.status !== 'en_cours' && generation.status !== 'echec' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4) 0' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void startRun('start')}
              icon={<Icon name="sparkles" size={18} />}
            >
              Générer mon parcours
            </Button>
          </div>
        )}

        {/* D1-D : sans itineraire, la carte montrait « Ensemble / Agrandir /
            Recentrer » et promettait qu un appui long poserait un point de
            passage qui FAIT EVOLUER LE TRAJET. Il n y avait pas de trajet a
            faire evoluer. Meme carte, meme promesse, que l itineraire existe.

            D1-D bis : ces phrases ETAIENT du texte developpement rendu tel quel
            hors du commentaire, donc affichees comme du contenu devant l
            itineraire. Le comportement qu elles decrivent est celui de
            `onAddWaypoint` : un point n est accepte que sur un jour focus, et
            l ensemble n en accepte aucun. Le code le dit deja (`activeDay ===
            null` puis `onAddWaypoint` de toute maniere) ; le texte, lui, etait
            affiche. Il disparait d ici : la regle vit dans la carte. */}
        {model && (
          <>
            <PrepMap
              className="prep-map--inline"
              name="Ton parcours"
              routeCoords={coords}
              points={points}
              scopeLabel={activeDay === null ? 'Ensemble' : `Jour ${activeDay}`}
              filterCategories={MAP_CATEGORIES}
              onLongPress={
                activeDay === null
                  ? undefined
                  : (lat, lon) => useAdventurePrepStore.getState().addWaypoint({ lat, lon }, activeDay)
              }
            />
            <p className="prep-maphint">
              {activeDay === null
                ? 'Choisis un jour pour y poser un point de passage : le trajet sera retracé sur le réseau réel, puis les distances remesurées.'
                : 'Maintiens appuyé sur la carte pour poser un point de passage : le trajet est retracé sur le réseau réel, puis les distances remesurées.'
              }
            </p>
            {/* Le mesurage se DIT. Tant qu'il n'est pas revenu, les distances
                restent « à vérifier » : réafficher les anciennes dirait qu'elles
                décrivent encore un trajet qui n'existe plus. */}
            {remeasuring !== null && (
              <p className="prep-maphint" role="status" aria-live="polite">
                Mesurage en cours — les distances restent « à vérifier » jusque-là.
              </p>
            )}
          </>
        )}
      </div>

      {/* D1-A : ce pied de page rendait un bouton blanc, plein, « Vers le depart »,
          avec disabled et pointer-events none : un bouton MORT peint comme un
          bouton VIVANT (mesure : opacity 1, data-variant primary). Pendant la
          generation, « Arreter » — seul reellement actionnable — suffit : le
          pied disparait au lieu de mentir. Le footer n existe plus non plus,
          pour ne pas reserver une place vide sous le rail. */}
      {model && (
        <div className="prep-footer">
          <Button
            variant="primary"
            size="lg"
            className="prep-footer__primary"
            onClick={goToDeparture}
            iconPosition="trailing"
            icon={<Icon name="arrow-right" size={18} aria-hidden="true" />}
          >
            Vers le départ
          </Button>
        </div>
      )}
    </div>
  );
}

export default ItineraryStepScreen;
