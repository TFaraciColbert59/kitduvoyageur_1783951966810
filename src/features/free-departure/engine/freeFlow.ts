/**
 * « Partir librement » — modele de vue des trois etats.
 *
 * Les ecrans 61 et 62 ne sont JAMAIS des composants qui lisent le traceur ou le
 * store tout seuls. Ce module fait le pont : il transforme des mesures brutes en
 * libelles affichables, et l'etat de la session en props d'ecran.
 *
 * Ce decoupage a une raison de fond : ce qui est affichable se teste sans DOM,
 * sans carte et sans GPS. Une regle de presentation — « une mesure absente
 * s'affiche `—` » — ne doit pas dependre du fait qu'un traceur a repondu.
 */

import { activityById } from '@/features/adventure-prep/catalog';
import { shortActivityLabel, type ActivityGuessConfidence } from '../engine/activityGuess';
import { privacyRows, type FreePrivacyRow } from '../engine/privacy';
import {
  buildTrace,
  formatClock,
  formatDistanceKm,
  formatElevation,
  formatPace,
  guessFromSummary,
  guessHeadline,
  guessJustification,
  paceFromSpeed,
  unknownGuessReason,
  NO_VALUE,
  type FreeSessionSummary,
  type TracePoint,
} from '../engine/freeSession';
import type { FreeDepartureState } from '../store/useFreeDepartureStore';

/** Libelle affiche quand aucune activite n'a ete retenue : jamais un defaut plausible. */
export const UNKNOWN_ACTIVITY = 'Suivi libre';

/* ------------------------------------------------------------------ */
/* Ecran 61 — le suivi en cours                                        */
/* ------------------------------------------------------------------ */

export interface LiveViewInput {
  distanceKm: number;
  durationSeconds: number;
  averageSpeedKmH: number;
  elevationGainM: number | null;
  positions: readonly TracePoint[];
  paused: boolean;
  /** Activite choisie avant le depart, ou `null` = detection automatique. */
  activityId: string | null;
  /** La localisation a-t-elle ete accordee ? */
  canTrack: boolean;
  /**
   * Message a afficher quand le suivi n'enregistre pas.
   *
   * Surchargeable, et c'est le but : « le GPS ne repond plus » et « tu as
   * refuse la localisation » demandent deux reactions opposees — reessayer,
   * ou accepter de partir sans trace. Un message unique pour deux pannes
   * differentes en condamne une des deux.
   */
  trackingNote?: string | null;
}

export interface LiveView {
  activityLabel: string;
  activityIcon: string;
  clock: string;
  distance: string;
  pace: string;
  elevation: string;
  trace: TracePoint[];
  paused: boolean;
  /**
   * Phrase a afficher quand le suivi n'enregistre pas. `null` quand tout va
   * bien : une ligne d'alerte permanente apprend a etre ignoree.
   */
  trackingNote: string | null;
}

/**
 * Phrase du suivi interrompu.
 *
 * Distincte du refus de localisation : refuser, c'est un choix ; perdre le
 * signal en cours de route, c'est une panne. L'ecran doit distinguer les deux,
 * parce que seul le premier se resout en changeant d'avis.
 */
const NOTE_GPS =
  'Le GPS ne répond plus : le chrono continue, la trace est interrompue. Le départ et l’arrivée seront perdus.';

/** Vue 61 derivee des mesures vivantes. Aucune mesure n'est inventee. */
export function resolveLiveView(input: LiveViewInput): LiveView {
  const def = input.activityId === null ? null : activityById(input.activityId);
  return {
    // Un identifiant inconnu ne doit pas faire disparaitre l'ecran : on
    // retombe sur l'honnetete (« Suivi libre ») plutot que de lever.
    activityLabel: def === null ? UNKNOWN_ACTIVITY : shortActivityLabel(def.label),
    activityIcon: def?.icon ?? 'route',
    clock: formatClock(input.durationSeconds),
    distance: formatDistanceKm(input.distanceKm),
    pace: formatPace(paceFromSpeed(input.averageSpeedKmH)),
    elevation: formatElevation(input.elevationGainM),
    trace: buildTrace(input.positions),
    paused: input.paused,
    trackingNote: input.canTrack ? null : (input.trackingNote ?? NOTE_GPS),
  };
}

/* ------------------------------------------------------------------ */
/* Ecran 62 — la session terminee                                      */
/* ------------------------------------------------------------------ */

export interface SummaryView {
  /** Activite retenue, ou `null` si rien n'est defendable. */
  label: string | null;
  activityIcon: string;
  /** `true` = deduction moteur, affichée comme une question. */
  isGuess: boolean;
  /** Justification composee de mesures. `null` quand l'utilisateur a choisi. */
  justification: string | null;
  guessConfidence: ActivityGuessConfidence | null;
  /** Pourquoi aucune proposition n'est faite. `null` quand il y en a une. */
  unknownReason: string | null;
  duration: string;
  distance: string;
  elevation: string;
  trace: TracePoint[];
  privacy: FreePrivacyRow[];
}

/**
 * Vue 62 derivee du resume fige et des choix de l'utilisateur.
 *
 * Ordre de precedence, non negociable : **un choix affirmatif l'emporte
 * toujours**. Si l'utilisateur a dit « c'etait un velo » avant le depart puis
 * que le moteur propose « randonnee » sur son allure, c'est l'utilisateur qui a
 * raison : il etait sur place, le moteur non.
 */
export function buildSummaryView(state: FreeDepartureState): SummaryView {
  const summary: FreeSessionSummary | null = state.summary;

  const manual = state.activityId === null ? null : activityById(state.activityId);
  const guess = summary === null ? null : guessFromSummary(summary);

  const isGuess = manual === null && guess !== null;
  const label = manual !== null ? shortActivityLabel(manual.label) : (guess?.label ?? null);

  const justification =
    isGuess && summary !== null
      ? guessJustification(
          {
            distanceKm: summary.distanceKm,
            durationSeconds: summary.durationSeconds,
            averageSpeedKmH: summary.averageSpeedKmH,
            elevationGainM: summary.elevationGainM,
          },
          guess
        )
      : null;

  const unknownReason =
    isGuess || manual !== null
      ? null
      : summary === null
        ? 'Aucune session n’a été enregistrée sur cet appareil : il n’y a rien à déduire.'
        : unknownGuessReason({
            distanceKm: summary.distanceKm,
            durationSeconds: summary.durationSeconds,
            averageSpeedKmH: summary.averageSpeedKmH,
            elevationGainM: summary.elevationGainM,
          });

  return {
    label,
    activityIcon: manual?.icon ?? guess?.icon ?? 'route',
    isGuess,
    justification,
    guessConfidence: isGuess ? (guess?.confidence ?? null) : null,
    unknownReason,
    duration: formatClock(summary?.durationSeconds ?? null),
    distance: formatDistanceKm(summary?.distanceKm ?? null),
    elevation: formatElevation(summary?.elevationGainM ?? null),
    trace: summary?.trace ?? [],
    privacy: privacyRows({
      keepTrace: state.keepTrace,
      shareWithGroup: state.shareWithGroup,
      groupSize: state.groupSize,
    }),
  };
}

/** Titre de l'ecran 62 : question si proposition, affirmation si choix. */
export function summaryHeadline(view: SummaryView): string {
  if (view.label === null) return 'Activité à confirmer';
  return guessHeadline(view.label, view.isGuess);
}

/** Placeholder partage par 61 et 62 quand aucune mesure n'existe. */
export { NO_VALUE };
