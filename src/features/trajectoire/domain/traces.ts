/**
 * Le marche des traces (V4) - le carburant du plan.
 *
 * Regle d'or : le plan ne demarre JAMAIS d'une invention. Il demarre de
 * traces reellement vecues. Cette fonction ne fait qu'evaluer à quelle
 * echelle une trace dejavecue colle au curseur - elle n'en fabrique aucune.
 */

import { H_MAX, H_MIN, getZone, tFromHours, type TrajectoireZone } from './scaleAxis';
import type { TraceMatch } from './types';

export interface TraceSeed {
  id: string;
  author: string;
  /** Contexte lisible, ex: "Dolomites - 5 j - refuges". */
  context: string;
  /** Duree du trace, en heures. */
  hours: number;
  distanceM: number | null;
  source: 'trace_tribu' | 'randonnee_perso';
  /** Zone de la trace, pour l'affichage "a ton echelle". */
  zone: TrajectoireZone;
}

export interface MatchInput {
  hours: number;
  zone: TrajectoireZone;
}

/** Traces de demonstration. En production : tables `traces` + carnets. */
export const DEMO_TRACES: readonly TraceSeed[] = [
  {
    id: 'trc-marco-d',
    author: 'Marco D.',
    context: 'Dolomites - 5 j - refuges',
    hours: 120,
    distanceM: null,
    source: 'trace_tribu',
    zone: 'expedition',
  },
  {
    id: 'trc-sarah-l',
    author: 'Sarah L.',
    context: 'Run urbain - 1 h - 8 km',
    hours: 1,
    distanceM: 8000,
    source: 'randonnee_perso',
    zone: 'run',
  },
  {
    id: 'trc-camille-m',
    author: 'Camille M.',
    context: 'Dolomites - 8 h - boucle des lacs',
    hours: 8,
    distanceM: 18400,
    source: 'randonnee_perso',
    zone: 'journee',
  },
  {
    id: 'trc-andes',
    author: 'La tribu Andes',
    context: 'Salkantay - 6 j - 4 630 m',
    hours: 144,
    distanceM: null,
    source: 'trace_tribu',
    zone: 'expedition',
  },
  {
    id: 'trc-youssef-b',
    author: 'Youssef B.',
    context: 'Raid Vercors - 1,5 j - bivouac',
    // 36 h, et non 72 : la bande raid du dossier s arrete a 48 h. A 72 h la
    // graine etait une expedition etiquettee "raid", et comme le badge compare
    // les zones, l'etiquetteailable l'emportait sur ses propres heures.
    hours: 36,
    distanceM: null,
    source: 'trace_tribu',
    zone: 'raid',
  },
  {
    id: 'trc-elin-s',
    author: 'Elin S.',
    context: 'Lofoten - 12 j - sans voiture',
    hours: 288,
    distanceM: null,
    source: 'randonnee_perso',
    zone: 'monde',
  },
  {
    id: 'trc-kenji-t',
    author: 'Kenji T.',
    context: 'Tour du monde - 28 j - 9 pays',
    hours: 672,
    distanceM: null,
    source: 'trace_tribu',
    zone: 'monde',
  },
] as const;

/** Seuil au-dela duquel on affiche le badge "a ton echelle". */
export const AT_SCALE_THRESHOLD = 0.82;

function initials(author: string): string {
  return author
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * Adaquation d'echelle : log-distance entre la duree de la trace et la duree
 * courante. 1 = identique, 0 = aux extremes de l'axe.
 */
export function scaleMatchScore(traceHours: number, currentHours: number): number {
  const a = Math.log(clampHours(traceHours));
  const b = Math.log(clampHours(currentHours));
  const span = Math.log(H_MAX) - Math.log(H_MIN);
  return clamp01(1 - Math.abs(a - b) / span);
}

function clampHours(hours: number): number {
  return Math.min(H_MAX, Math.max(H_MIN, hours));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Classe les traces par adequation d'echelle et marque celles qui sont
 * "a ton echelle" (meme zone ET score au-dessus du seuil).
 */
export function matchTraces(traces: readonly TraceSeed[], input: MatchInput): TraceMatch[] {
  const zone = getZone(input.zone);
  return traces
    .map((trace) => {
      const score = scaleMatchScore(trace.hours, input.hours);
      const sameZone = trace.zone === zone.id;
      return {
        id: trace.id,
        author: trace.author,
        initials: initials(trace.author),
        context: trace.context,
        hours: trace.hours,
        distanceM: trace.distanceM,
        source: trace.source,
        scaleMatch: Math.round(score * 1000) / 1000,
        atYourScale: sameZone && score >= AT_SCALE_THRESHOLD,
      } satisfies TraceMatch;
    })
    .sort((left, right) => {
      if (left.atYourScale !== right.atYourScale) return left.atYourScale ? -1 : 1;
      return right.scaleMatch - left.scaleMatch;
    });
}

/** Combien de traces sont "a ton echelle" - cible du chantier : >= 1. */
export function countAtYourScale(matches: readonly TraceMatch[]): number {
  return matches.filter((match) => match.atYourScale).length;
}

/** Position du curseur correspondant au milieu d'une trace, pour la navigation. */
export function tForTrace(trace: TraceSeed): number {
  return tFromHours(trace.hours);
}
