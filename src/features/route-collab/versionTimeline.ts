/**
 * Frise des versions (5.10) : fonctions pures.
 *
 * Les versions sont les révisions publiées, figées ; la plus récente ligne est le brouillon courant. « Revenir
 * à cette version » n'efface rien : le moteur restaure son contenu dans une NOUVELLE séquence du brouillon
 * (`revert_to_seq` + `revisionId`), l'historique et le journal restent entiers. Seule une personne qui peut
 * publier peut revenir en arrière (`route.publish`) : le brouillon est celui de tout le monde.
 */
import { activePoints, stableHash } from './engine';
import type { RouteOperationInput, RouteRevisionSnapshot, RouteWorkspaceState } from './types';

export interface VersionEntry {
  readonly id: string;
  readonly kind: 'draft' | 'published';
  readonly revisionNo: number | null;
  readonly title: string;
  readonly summary: string;
  readonly authorName: string | null;
  readonly at: string;
  readonly distanceKm: number;
  readonly pointCount: number;
  readonly dayCount: number;
  /** Version publiée en vigueur (celle que les participants téléchargent). */
  readonly isPublished: boolean;
  /** Le brouillon a exactement le contenu de cette version. */
  readonly matchesDraft: boolean;
  readonly revertible: boolean;
}

const km = (rev: Pick<RouteRevisionSnapshot, 'sections'>) =>
  Math.round(rev.sections.reduce((acc, s) => acc + s.distanceKm, 0) * 10) / 10;

/** Contenu qui définit une version : ce que le retour restaure. */
export function contentHash(input: Pick<RouteRevisionSnapshot, 'points' | 'sections' | 'stages'>): string {
  const points = input.points
    .filter((p) => !p.deletedAt)
    .slice()
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.id.localeCompare(b.id)))
    .map((p) => [p.id, p.lat, p.lon, p.name ?? null]);
  const sections = input.sections.map((s) => [s.id, s.fromPointId, s.toPointId, s.geometry.coordinates.length, s.distanceKm, s.mode]);
  const stages = input.stages.map((s) => [s.id, s.startPointId, s.endPointId, s.overnightPlace?.id ?? null]);
  return stableHash({ points, sections, stages });
}

/** Du plus récent au plus ancien : brouillon courant, puis chaque version publiée. */
export function buildVersionTimeline(workspace: RouteWorkspaceState, canRevert: boolean): VersionEntry[] {
  const draftHash = contentHash(workspace);
  const published = workspace.revisions
    .filter((r) => r.kind === 'published')
    .slice()
    .sort((a, b) => b.revisionNo - a.revisionNo);
  const entries: VersionEntry[] = [
    {
      id: 'draft',
      kind: 'draft',
      revisionNo: null,
      title: 'Brouillon en cours',
      summary: `Séquence ${workspace.headSeq}`,
      authorName: null,
      at: workspace.updatedAt,
      distanceKm: km(workspace),
      pointCount: activePoints(workspace).length,
      dayCount: workspace.stages.length,
      isPublished: false,
      matchesDraft: false,
      revertible: false,
    },
  ];
  for (const rev of published) {
    const same = contentHash(rev) === draftHash;
    entries.push({
      id: rev.id,
      kind: 'published',
      revisionNo: rev.revisionNo,
      title: `Version ${rev.revisionNo}`,
      summary: rev.summary,
      authorName: rev.createdByName,
      at: rev.createdAt,
      distanceKm: km(rev),
      pointCount: rev.points.filter((p) => !p.deletedAt).length,
      dayCount: rev.stages.length,
      isPublished: rev.id === workspace.publishedRevisionId,
      matchesDraft: same,
      revertible: canRevert && !same,
    });
  }
  return entries;
}

/** Une phrase qui dit ce que le retour change, avant de l'appliquer. */
export function describeRevertEffect(workspace: RouteWorkspaceState, revision: RouteRevisionSnapshot): string {
  const dKm = Math.round((km(revision) - km(workspace)) * 10) / 10;
  const dPts = revision.points.filter((p) => !p.deletedAt).length - activePoints(workspace).length;
  const dDays = revision.stages.length - workspace.stages.length;
  const parts: string[] = [];
  const signed = (n: number, unit: string, plural = true) => `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-FR')} ${unit}${plural && Math.abs(n) > 1 ? 's' : ''}`;
  if (dKm !== 0) parts.push(`${dKm > 0 ? '+' : '−'}${Math.abs(dKm).toLocaleString('fr-FR')} km`);
  if (dPts !== 0) parts.push(signed(dPts, 'point'));
  if (dDays !== 0) parts.push(signed(dDays, 'jour'));
  return parts.length > 0 ? `Par rapport au brouillon : ${parts.join(', ')}.` : 'Même longueur, mêmes points et mêmes journées que le brouillon.';
}

export function revertOperation(revision: RouteRevisionSnapshot): Extract<RouteOperationInput, { type: 'revert_to_seq' }> {
  return {
    type: 'revert_to_seq',
    targetSeq: revision.basedOnSeq,
    revisionId: revision.id,
    reason: `Retour à la version ${revision.revisionNo}`,
  };
}
