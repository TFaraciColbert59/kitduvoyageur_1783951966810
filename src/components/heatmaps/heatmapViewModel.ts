/**
 * Modèle de vue pur des heatmaps C02.
 *
 * Aucune dépendance React : les bornes, projections, libellés et résumés sont
 * testables seuls et ne connaissent ni fetch ni DOM.
 */

import { SPORT_FAMILIES } from '@/features/explorer-v2/sheet/sportSelection';
import type {
  CommunityTimeWindow,
  HeatmapIntensityBand,
  PersonalHeatmapCell,
  PersonalHeatmapComparison,
  PersonalHeatmapLayer,
  PersonalTimePeriodKind,
  PublicHeatmapCell,
  PublicHeatmapLayer,
  Sport,
} from '@/features/heatmaps/types';

export interface SportOption {
  id: Sport | 'all';
  label: string;
}

export const SPORT_OPTIONS: readonly SportOption[] = [
  { id: 'all', label: 'Tous les sports' },
  ...SPORT_FAMILIES.map((family) => ({ id: family.sport, label: family.label })),
];

export const COMMUNITY_WINDOW_OPTIONS: readonly {
  id: CommunityTimeWindow;
  label: string;
  description: string;
}[] = [
  { id: 'global', label: 'Globale', description: 'Toutes les traces publiables' },
  { id: 'last_7_days', label: '7 jours', description: 'Passages des sept derniers jours' },
  { id: 'nocturnal', label: 'Nocturne', description: 'Entre coucher et lever du soleil' },
];

export const PERSONAL_PERIOD_OPTIONS: readonly {
  id: PersonalTimePeriodKind;
  label: string;
}[] = [
  { id: 'all_time', label: 'Tout' },
  { id: 'last_7_days', label: '7 j' },
  { id: 'last_30_days', label: '30 j' },
  { id: 'last_90_days', label: '90 j' },
  { id: 'year_to_date', label: 'Cette année' },
];

export function sportLabel(sport: Sport | 'all'): string {
  return SPORT_OPTIONS.find((option) => option.id === sport)?.label ?? 'Sport';
}

export function communityWindowLabel(window: CommunityTimeWindow): string {
  return COMMUNITY_WINDOW_OPTIONS.find((option) => option.id === window)?.label ?? 'Globale';
}

export function personalPeriodLabel(kind: PersonalTimePeriodKind): string {
  return PERSONAL_PERIOD_OPTIONS.find((option) => option.id === kind)?.label ?? 'Tout';
}

export function bandLabel(band: HeatmapIntensityBand): string {
  switch (band) {
    case 'peak':
      return 'Très fréquenté';
    case 'high':
      return 'Fréquenté';
    case 'medium':
      return 'Modéré';
    default:
      return 'Peu fréquenté';
  }
}

export function bandColor(band: HeatmapIntensityBand): string {
  switch (band) {
    case 'peak':
      return 'var(--lkv-forest-900)';
    case 'high':
      return 'var(--lkv-forest-600)';
    case 'medium':
      return 'var(--lkv-forest-400)';
    default:
      return 'var(--lkv-forest-200)';
  }
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapRect {
  cellId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  title: string;
}

export const MAP_VIEWBOX = { width: 1_000, height: 560 } as const;

const WORLD_BOUNDS: GeoBounds = { minLat: -55, maxLat: 72, minLng: -12, maxLng: 32 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Bornes d'affichage : celles des cellules, avec une marge minimale pour
 * qu'une cellule isolée ne remplisse pas tout l'écran. Sans cellule, on retombe
 * sur un cadrage Europe visible et honnête (aucune donnée n'est inventée).
 */
export function computeMapBounds(
  cells: readonly (PublicHeatmapCell | PersonalHeatmapCell)[]
): GeoBounds {
  if (cells.length === 0) return WORLD_BOUNDS;

  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  for (const cell of cells) {
    const [cellMinLng, cellMinLat, cellMaxLng, cellMaxLat] = cell.cellBounds;
    minLat = Math.min(minLat, cellMinLat);
    maxLat = Math.max(maxLat, cellMaxLat);
    minLng = Math.min(minLng, cellMinLng);
    maxLng = Math.max(maxLng, cellMaxLng);
  }

  const latSpan = Math.max(maxLat - minLat, 0.05);
  const lngSpan = Math.max(maxLng - minLng, 0.05);
  const latPad = latSpan * 0.12;
  const lngPad = lngSpan * 0.12;

  return {
    minLat: clamp(minLat - latPad, -85, 85),
    maxLat: clamp(maxLat + latPad, -85, 85),
    minLng: clamp(minLng - lngPad, -180, 180),
    maxLng: clamp(maxLng + lngPad, -180, 180),
  };
}

/** Projection équirectangulaire simple, suffisante pour une grille agrégée. */
export function projectCells(
  cells: readonly (PublicHeatmapCell | PersonalHeatmapCell)[],
  bounds: GeoBounds,
  width = MAP_VIEWBOX.width,
  height = MAP_VIEWBOX.height
): MapRect[] {
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.000001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.000001);
  const xScale = width / lngSpan;
  const yScale = height / latSpan;

  return cells.map((cell) => {
    const [minLng, minLat, maxLng, maxLat] = cell.cellBounds;
    const x = (minLng - bounds.minLng) * xScale;
    const y = (bounds.maxLat - maxLat) * yScale;
    const cellWidth = Math.max(2, (maxLng - minLng) * xScale);
    const cellHeight = Math.max(2, (maxLat - minLat) * yScale);
    const isPersonal = 'activityCount' in cell;

    return {
      cellId: cell.cellId,
      x: clamp(x, 0, width - Math.min(cellWidth, width)),
      y: clamp(y, 0, height - Math.min(cellHeight, height)),
      width: Math.min(cellWidth, width),
      height: Math.min(cellHeight, height),
      fill: bandColor(cell.band),
      opacity: 0.35 + clamp(cell.intensity, 0, 1) * 0.6,
      title: isPersonal
        ? `${cell.activityCount} sortie${cell.activityCount > 1 ? 's' : ''} · ${bandLabel(cell.band)}`
        : `${cell.distinctContributorCount} contributeurs · ${cell.passageCount} passages · ${bandLabel(cell.band)}`,
    };
  });
}

export interface CommunitySummary {
  cellCount: number;
  maxPassages: number;
  maxContributors: number;
  excludedActivityCount: number;
  maskedPointCount: number;
  suppressedCellCount: number;
  topCells: PublicHeatmapCell[];
}

export function summarizeCommunity(layer: PublicHeatmapLayer | null): CommunitySummary {
  if (!layer) {
    return {
      cellCount: 0,
      maxPassages: 0,
      maxContributors: 0,
      excludedActivityCount: 0,
      maskedPointCount: 0,
      suppressedCellCount: 0,
      topCells: [],
    };
  }

  return {
    cellCount: layer.cells.length,
    maxPassages: layer.cells.reduce((max, cell) => Math.max(max, cell.passageCount), 0),
    maxContributors: layer.cells.reduce(
      (max, cell) => Math.max(max, cell.distinctContributorCount),
      0
    ),
    excludedActivityCount: layer.excludedActivityCount,
    maskedPointCount: layer.maskedPointCount,
    suppressedCellCount: layer.suppressedCellCount,
    topCells: [...layer.cells]
      .sort((a, b) => b.passageCount - a.passageCount || b.intensity - a.intensity)
      .slice(0, 5),
  };
}

export interface PersonalSummary {
  cellCount: number;
  activityCount: number;
  sportCount: number;
  lastVisitedAt: string | null;
  topCells: PersonalHeatmapCell[];
}

export function summarizePersonal(layer: PersonalHeatmapLayer | null): PersonalSummary {
  if (!layer) {
    return { cellCount: 0, activityCount: 0, sportCount: 0, lastVisitedAt: null, topCells: [] };
  }

  const sports = new Set<Sport>();
  let lastVisitedAt: string | null = null;
  for (const cell of layer.cells) {
    for (const sport of cell.sports) sports.add(sport);
    if (cell.lastVisitedAt && (!lastVisitedAt || cell.lastVisitedAt > lastVisitedAt)) {
      lastVisitedAt = cell.lastVisitedAt;
    }
  }

  return {
    cellCount: layer.cells.length,
    activityCount: layer.activityCount,
    sportCount: sports.size,
    lastVisitedAt,
    topCells: [...layer.cells]
      .sort((a, b) => b.activityCount - a.activityCount || b.intensity - a.intensity)
      .slice(0, 5),
  };
}

export interface ComparisonSummary {
  newlyExplored: number;
  recurring: number;
  unvisited: number;
  totalDelta: number;
}

export function summarizeComparison(
  comparison: PersonalHeatmapComparison | null
): ComparisonSummary {
  if (!comparison) {
    return { newlyExplored: 0, recurring: 0, unvisited: 0, totalDelta: 0 };
  }
  return {
    newlyExplored: comparison.newlyExploredCells.length,
    recurring: comparison.recurringCells.length,
    unvisited: comparison.unvisitedBaselineCells.length,
    totalDelta: comparison.recurringCells.reduce((sum, cell) => sum + cell.activityDelta, 0),
  };
}

export function formatIsoDate(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}
