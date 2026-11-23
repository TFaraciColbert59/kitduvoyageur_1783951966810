import { summarizeRevisionChanges } from '../../../insights';
import type { RouteRevisionSnapshot } from '../../../types';

/**
 * Une alerte par publication (3.10) : « Version 2 publiée par Alice · ce qui change pour toi ».
 * Plusieurs versions publiées par d'autres depuis la dernière lecture sont REGROUPÉES en une seule alerte ;
 * ses propres publications ne déclenchent rien (l'auteur le sait déjà). Module pur : rien n'est envoyé.
 */
export interface PublicationAlert {
  /** Dernier numéro de version couvert : clé de l'alerte (jamais deux fois la même). */
  readonly revisionNo: number;
  readonly title: string;
  readonly sub: string;
  /** Nombre de versions regroupées. */
  readonly count: number;
}

export interface PublicationScan {
  readonly alert: PublicationAlert | null;
  /** À mémoriser : plus grand numéro de version publiée vu jusqu'ici. */
  readonly seenNo: number;
}

export function latestPublishedNo(revisions: readonly RouteRevisionSnapshot[]): number {
  return revisions.reduce((max, r) => (r.kind === 'published' ? Math.max(max, r.revisionNo) : max), 0);
}

function authorsLabel(names: readonly string[]): string {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (unique.length === 0) return 'un membre';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} et ${unique[1]}`;
  return `${unique[0]}, ${unique[1]} et ${unique.length - 2} ${unique.length - 2 > 1 ? 'autres' : 'autre'}`;
}

export function scanPublications(input: {
  readonly seenNo: number;
  readonly revisions: readonly RouteRevisionSnapshot[];
  readonly currentUserId: string;
}): PublicationScan {
  const published = input.revisions
    .filter((r) => r.kind === 'published')
    .slice()
    .sort((a, b) => a.revisionNo - b.revisionNo);
  const seenNo = Math.max(input.seenNo, published.length > 0 ? published[published.length - 1].revisionNo : 0);
  const fresh = published.filter((r) => r.revisionNo > input.seenNo);
  const byOthers = fresh.filter((r) => r.createdBy !== input.currentUserId);
  if (byOthers.length === 0) return { alert: null, seenNo };

  const first = byOthers[0];
  const last = byOthers[byOthers.length - 1];
  const previous = published.filter((r) => r.revisionNo <= input.seenNo).pop() ?? null;
  const authors = authorsLabel(byOthers.map((r) => r.createdByName));
  const title =
    byOthers.length === 1
      ? `Version ${last.revisionNo} publiée par ${authors}`
      : `Versions ${first.revisionNo} à ${last.revisionNo} publiées par ${authors}`;

  let sentence: string;
  let mine = 0;
  if (previous) {
    sentence = summarizeRevisionChanges(previous, last).sentence;
    const before = new Map(previous.kitSnapshot.map((i) => [i.id, i.status]));
    mine = last.kitSnapshot.filter(
      (i) => i.assigneeUserId === input.currentUserId && i.status === 'needs_revalidation' && before.get(i.id) !== 'needs_revalidation'
    ).length;
  } else {
    sentence = 'Premier plan publié du groupe';
  }
  const personal = mine > 0 ? ` · dans ton sac, à revérifier : ${mine}` : '';
  const sub = `Ce qui change pour toi : ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}${personal}`;
  return { alert: { revisionNo: last.revisionNo, title, sub, count: byOthers.length }, seenNo };
}
