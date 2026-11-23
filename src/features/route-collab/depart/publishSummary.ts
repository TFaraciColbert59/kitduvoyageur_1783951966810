/**
 * Publier avec un résumé des changements (9.4) : « +4 km le jour 2, nuit déplacée, 2 objets à revérifier »,
 * calculé entre la dernière version publiée et l'état qui va être publié (la séquence relue). Le serveur reçoit
 * ce résumé (240 caractères au plus) et le garde sur la version.
 */
import { orderedLegs, legsStats } from '../insights/shared';
import { summarizeRevisionChanges, type ChangeFact } from '../insights/changeSummary';
import { publishedRevisionOf } from '../integrations';
import { fmtKm } from '../fmt';
import type { RouteWorkspaceState } from '../types';

export const MAX_SUMMARY_CHARS = 240;

export interface PublishPreview {
  readonly nextNo: number;
  /** Séquence de l'atelier sur laquelle le résumé est calculé : celle qui sera publiée. */
  readonly basedOnSeq: number;
  readonly first: boolean;
  readonly sentence: string;
  readonly facts: readonly ChangeFact[];
  /** Phrase écrite sur la version (bornée). */
  readonly summary: string;
}

export function publishPreview(ws: RouteWorkspaceState): PublishPreview {
  const prev = publishedRevisionOf(ws);
  const nextNo = (ws.publishedRevisionNo ?? 0) + 1;
  let sentence: string;
  let facts: readonly ChangeFact[] = [];
  if (!prev) {
    const legs = orderedLegs(ws);
    const km = legsStats(legs).distanceKm;
    const known = ws.sections.length > 0;
    const days = ws.stages.length;
    const items = ws.kitItems.length;
    sentence = `Première version : ${known ? fmtKm(km) : 'distance inconnue'}, ${days} étape${days > 1 ? 's' : ''}, ${items} objet${items > 1 ? 's' : ''} au sac`;
  } else {
    const r = summarizeRevisionChanges(
      { points: prev.points, sections: prev.sections, stages: prev.stages, kitSnapshot: prev.kitSnapshot },
      { points: ws.points, sections: ws.sections, stages: ws.stages, kitItems: ws.kitItems },
    );
    sentence = r.sentence;
    facts = r.facts;
  }
  const summary = sentence.length > MAX_SUMMARY_CHARS ? `${sentence.slice(0, MAX_SUMMARY_CHARS - 1)}…` : sentence;
  return { nextNo, basedOnSeq: ws.headSeq, first: !prev, sentence, facts, summary };
}
