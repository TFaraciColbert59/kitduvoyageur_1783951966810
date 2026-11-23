/**
 * Variantes côte à côte (5.8) : fonctions pures. Pour chaque variante, la portée actuelle et la variante en
 * regard (km, D+, durée, surface), l'écart, puis l'état « applicable » ou « périmée ». Un chiffre inconnu
 * reste « inconnu » : jamais 0, et jamais un écart calculé sur un inconnu.
 */
import { activePoints } from './engine';
import { distanceToKm } from './engineTrack';
import { fmtDuration, fmtKm, fmtMeters, fmtSignedDuration, fmtSignedKm, fmtSignedMeters } from './fmt';
import type { CollaborativeRouteSection, RouteVariant, RouteWorkspaceState, SurfaceSegment } from './types';

export interface CompareRow {
  readonly id: 'distance' | 'ascent' | 'duration' | 'surface';
  readonly label: string;
  readonly base: string;
  readonly variant: string;
  /** « +2,1 km » ; `null` quand l'un des deux est inconnu. */
  readonly delta: string | null;
  /** `good` : plus court, moins de montée, plus rapide ; `warn` : l'inverse. */
  readonly tone: 'good' | 'warn' | null;
}

export interface VariantComparison {
  readonly variantId: string;
  readonly title: string;
  readonly rows: readonly CompareRow[];
  /** Raison pour laquelle la variante ne peut plus s'appliquer (tronçon disparu, point déplacé) ; sinon `null`. */
  readonly stale: string | null;
  readonly status: RouteVariant['status'];
}

/** Part de la longueur dont la surface est renseignée (0 à 1). */
export function surfaceKnownShare(sec: Pick<CollaborativeRouteSection, 'surfaceSegments'>): number {
  let known = 0;
  for (const s of sec.surfaceSegments as readonly SurfaceSegment[]) {
    if (s.surface !== 'unknown' && s.toRatio > s.fromRatio) known += Math.min(1, s.toRatio) - Math.max(0, s.fromRatio);
  }
  return Math.min(1, known);
}

const sumOrNull = (xs: Array<number | null>): number | null => (xs.some((x) => x == null) ? null : (xs as number[]).reduce((a, b) => a + b, 0));

function tone(delta: number | null, epsilon: number): 'good' | 'warn' | null {
  if (delta == null || Math.abs(delta) <= epsilon) return null;
  return delta < 0 ? 'good' : 'warn';
}

export function staleReason(workspace: RouteWorkspaceState, variant: RouteVariant): string | null {
  const pts = activePoints(workspace);
  for (const rep of variant.replacements) {
    const sec = workspace.sections.find((s) => s.id === rep.sectionId);
    if (!sec) return 'Un tronçon concerné n’existe plus : recréez la comparaison.';
    const first = rep.geometry.coordinates[0];
    const last = rep.geometry.coordinates[rep.geometry.coordinates.length - 1];
    const from = pts.find((p) => p.id === sec.fromPointId);
    const to = pts.find((p) => p.id === sec.toPointId);
    if (first && last && from && to && (distanceToKm(from, { lat: first[1], lon: first[0] }) > 0.15 || distanceToKm(to, { lat: last[1], lon: last[0] }) > 0.15)) {
      return 'Un point a bougé depuis le calcul : recréez la comparaison.';
    }
  }
  return null;
}

export function compareVariant(workspace: RouteWorkspaceState, variant: RouteVariant): VariantComparison {
  const secs = variant.replacements.map((r) => workspace.sections.find((s) => s.id === r.sectionId)).filter((s): s is CollaborativeRouteSection => Boolean(s));
  const complete = secs.length === variant.replacements.length;
  const baseKm = secs.reduce((a, s) => a + s.distanceKm, 0);
  const baseAsc = complete ? sumOrNull(secs.map((s) => s.ascentM)) : null;
  const baseDur = complete ? sumOrNull(secs.map((s) => s.durationMin)) : null;
  const varKm = variant.replacements.reduce((a, r) => a + r.distanceKm, 0);
  const varAsc = sumOrNull(variant.replacements.map((r) => r.ascentM));
  const varDur = sumOrNull(variant.replacements.map((r) => r.durationMin));
  const baseKnownKm = secs.reduce((a, s) => a + surfaceKnownShare(s) * s.distanceKm, 0);
  const baseSurface = baseKm > 0 ? baseKnownKm / baseKm : null;
  const varKnownKm = variant.replacements.reduce((a, r) => a + r.surfaceKnownRatio * r.distanceKm, 0);
  const varSurface = varKm > 0 ? varKnownKm / varKm : null;
  const pct = (v: number | null) => (v == null ? 'inconnue' : v <= 0 ? 'inconnue' : `${Math.round(v * 100)} % connue`);
  const dAsc = baseAsc != null && varAsc != null ? varAsc - baseAsc : null;
  const dDur = baseDur != null && varDur != null ? varDur - baseDur : null;
  const dKm = complete ? varKm - baseKm : null;
  const rows: CompareRow[] = [
    {
      id: 'distance',
      label: 'Distance',
      base: complete ? fmtKm(baseKm) : 'inconnue',
      variant: fmtKm(varKm),
      delta: dKm != null ? fmtSignedKm(dKm) : null,
      tone: tone(dKm, 0.05),
    },
    {
      id: 'ascent',
      label: 'D+',
      base: baseAsc != null ? fmtMeters(baseAsc) : 'inconnu',
      variant: varAsc != null ? fmtMeters(varAsc) : 'inconnu',
      delta: dAsc != null ? fmtSignedMeters(dAsc) : null,
      tone: tone(dAsc, 10),
    },
    {
      id: 'duration',
      label: 'Durée du routeur',
      base: baseDur != null ? fmtDuration(baseDur) : 'inconnue',
      variant: varDur != null ? fmtDuration(varDur) : 'inconnue',
      delta: dDur != null ? fmtSignedDuration(dDur) : null,
      tone: tone(dDur, 3),
    },
    {
      id: 'surface',
      label: 'Surface',
      base: pct(baseSurface),
      variant: pct(varSurface),
      delta: null,
      tone: null,
    },
  ];
  return { variantId: variant.id, title: variant.title, rows, stale: staleReason(workspace, variant), status: variant.status };
}

/** Deux ou trois variantes d'une même portée, côte à côte. */
export function compareVariants(workspace: RouteWorkspaceState): VariantComparison[] {
  return workspace.variants.filter((v) => v.status === 'draft' || v.status === 'proposed').map((v) => compareVariant(workspace, v));
}
