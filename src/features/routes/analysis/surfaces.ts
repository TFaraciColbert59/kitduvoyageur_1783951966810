/**
 * K2.19 · Surfaces et types de voie le long du parcours.
 *
 * Le module agrège des tronçons déjà étiquetés (`surface`, `highway`,
 * `route=ferry`) et rend la répartition, les sections colorables et la
 * couverture réelle. Aucune surface n'est déduite d'un tracé nu : sans
 * étiquette, le tronçon reste `unknown` et la couverture baisse.
 */
import {
  isFiniteNumber,
  type AnalysisGap,
  type AnalysisStatus,
  type AnalysisWarning,
} from './types';
import { normalizeTag, round } from './geo';

export type SurfaceCategory = 'paved' | 'unpaved' | 'natural' | 'steps' | 'ferry' | 'unknown';

export interface SurfaceSectionInput {
  readonly fromM: number;
  readonly toM: number;
  readonly surface?: string | null;
  /** Valeur OSM `highway` (path, track, steps, ferry…). */
  readonly wayType?: string | null;
  readonly name?: string | null;
}

export interface SurfaceAnalysisInput {
  readonly sections?: readonly SurfaceSectionInput[] | null;
  /** Longueur totale du parcours ; déduite du plus grand `toM` si absente. */
  readonly totalLengthM?: number | null;
}

export interface SurfaceSection {
  readonly fromM: number;
  readonly toM: number;
  readonly lengthM: number;
  readonly category: SurfaceCategory;
  readonly rawSurface: string | null;
  readonly rawWayType: string | null;
  readonly name: string | null;
  readonly mapStyleKey: string;
}

export interface SurfaceShare {
  readonly category: Exclude<SurfaceCategory, 'unknown'>;
  readonly lengthM: number;
  /** Part de la longueur effectivement étiquetée. */
  readonly shareOfKnown: number;
  /** Part de la longueur totale du parcours. */
  readonly shareOfRoute: number;
}

export interface SurfaceAnalysis {
  readonly status: AnalysisStatus;
  readonly totalLengthM: number;
  readonly knownLengthM: number;
  readonly unknownLengthM: number;
  /** `knownLengthM / totalLengthM`, entre 0 et 1. */
  readonly coverage: number;
  readonly sections: SurfaceSection[];
  readonly shares: SurfaceShare[];
  readonly dominant: SurfaceCategory | null;
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
}

const PAVED = new Set([
  'paved',
  'asphalt',
  'chipseal',
  'bitumen',
  'concrete',
  'concrete_lanes',
  'concrete_plates',
  'paving_stones',
  'sett',
  'cobblestone',
  'unhewn_cobblestone',
  'metal',
  'wood',
  'tartan',
]);

const UNPAVED = new Set([
  'unpaved',
  'gravel',
  'fine_gravel',
  'compacted',
  'dirt',
  'earth',
  'ground',
  'grass',
  'grass_paver',
  'pebblestone',
  'clay',
]);

const NATURAL = new Set(['rock', 'stone', 'scree', 'sand', 'mud', 'snow', 'ice', 'woodchips']);

/**
 * Catégorie de surface à partir des étiquettes réellement présentes.
 * `steps` et `ferry` viennent du type de voie, pas d'une supposition.
 */
export function surfaceCategory(
  surface: string | null | undefined,
  wayType: string | null | undefined
): SurfaceCategory {
  const way = normalizeTag(wayType);
  if (way === 'steps' || way === 'ferry') return way;
  const value = normalizeTag(surface);
  if (!value) return 'unknown';
  if (value === 'steps' || value === 'ferry') return value;
  if (PAVED.has(value)) return 'paved';
  if (UNPAVED.has(value)) return 'unpaved';
  if (NATURAL.has(value)) return 'natural';
  return 'unknown';
}

function finiteRange(fromM: unknown, toM: unknown): boolean {
  return isFiniteNumber(fromM) && isFiniteNumber(toM);
}

export function analyzeSurfaces(input: SurfaceAnalysisInput): SurfaceAnalysis {
  const missing: AnalysisGap[] = [];
  const warnings: AnalysisWarning[] = [];
  const rawSections = input.sections ?? [];

  if (rawSections.length === 0) {
    return {
      status: 'unavailable',
      totalLengthM: isFiniteNumber(input.totalLengthM) ? Math.max(0, input.totalLengthM) : 0,
      knownLengthM: 0,
      unknownLengthM: isFiniteNumber(input.totalLengthM) ? Math.max(0, input.totalLengthM) : 0,
      coverage: 0,
      sections: [],
      shares: [],
      dominant: null,
      missing: [
        {
          code: 'surface_source_unavailable',
          message: 'Aucun tronçon de surface fourni : la répartition ne peut pas être calculée.',
        },
      ],
      warnings: [],
    };
  }

  const declaredTotal = isFiniteNumber(input.totalLengthM) ? input.totalLengthM : null;
  const maxTo = rawSections.reduce(
    (max, section) => (isFiniteNumber(section.toM) ? Math.max(max, section.toM) : max),
    0
  );
  const totalLengthM = Math.max(0, declaredTotal ?? maxTo);

  if (totalLengthM <= 0) {
    return {
      status: 'unavailable',
      totalLengthM: 0,
      knownLengthM: 0,
      unknownLengthM: 0,
      coverage: 0,
      sections: [],
      shares: [],
      dominant: null,
      missing: [
        {
          code: 'route_length_invalid',
          message: 'La longueur du parcours est absente ou nulle : aucune répartition publiable.',
        },
      ],
      warnings: [],
    };
  }

  const ordered = rawSections
    .filter((section) => finiteRange(section.fromM, section.toM))
    .slice()
    .sort((a, b) => a.fromM - b.fromM || a.toM - b.toM);

  if (ordered.length !== rawSections.length) {
    warnings.push({
      code: 'surface_section_invalid',
      message: 'Des tronçons sans bornes numériques ont été ignorés.',
      severity: 'warning',
    });
  }

  const sections: SurfaceSection[] = [];
  let cursorM = 0;

  for (const section of ordered) {
    let fromM = Math.max(0, Math.min(totalLengthM, section.fromM));
    let toM = Math.max(0, Math.min(totalLengthM, section.toM));
    if (toM <= fromM) {
      warnings.push({
        code: 'surface_section_empty',
        message: `Tronçon ${section.fromM}–${section.toM} m vide après bornage, ignoré.`,
        severity: 'info',
      });
      continue;
    }
    if (fromM < cursorM - 0.5) {
      warnings.push({
        code: 'surface_sections_overlap',
        message: 'Des tronçons se recouvrent : seul le premier recouvrement est compté.',
        severity: 'warning',
      });
      fromM = cursorM;
    }
    if (toM <= fromM) continue;
    cursorM = Math.max(cursorM, toM);

    const rawSurface = normalizeTag(section.surface);
    const rawWayType = normalizeTag(section.wayType);
    const category = surfaceCategory(rawSurface, rawWayType);
    sections.push({
      fromM: round(fromM, 1),
      toM: round(toM, 1),
      lengthM: round(toM - fromM, 1),
      category,
      rawSurface,
      rawWayType,
      name: section.name?.trim() || null,
      mapStyleKey: `surface-${category}`,
    });
  }

  const knownLengthM = sections
    .filter((section) => section.category !== 'unknown')
    .reduce((sum, section) => sum + section.lengthM, 0);
  const unknownLengthM = Math.max(0, totalLengthM - knownLengthM);
  const coverage = totalLengthM > 0 ? Math.min(1, knownLengthM / totalLengthM) : 0;

  if (knownLengthM <= 0) {
    missing.push({
      code: 'surface_tags_missing',
      message:
        'Les tronçons existent mais aucun ne porte de surface ou de type de voie exploitable.',
    });
  } else if (coverage < 0.999) {
    missing.push({
      code: 'surface_coverage_incomplete',
      message: `${round(coverage * 100, 0)} % du parcours est étiqueté ; le reste reste inconnu.`,
    });
  }

  const grouped = new Map<Exclude<SurfaceCategory, 'unknown'>, number>();
  for (const section of sections) {
    if (section.category === 'unknown') continue;
    grouped.set(section.category, (grouped.get(section.category) ?? 0) + section.lengthM);
  }
  const shares: SurfaceShare[] = [...grouped.entries()]
    .map(([category, lengthM]) => ({
      category,
      lengthM: round(lengthM, 1),
      shareOfKnown: knownLengthM > 0 ? round(lengthM / knownLengthM, 4) : 0,
      shareOfRoute: totalLengthM > 0 ? round(lengthM / totalLengthM, 4) : 0,
    }))
    .sort((a, b) => b.lengthM - a.lengthM);

  const dominant = shares.length > 0 ? shares[0].category : null;
  const status: AnalysisStatus = knownLengthM <= 0 ? 'unavailable' : coverage < 0.999 ? 'partial' : 'available';

  return {
    status,
    totalLengthM: round(totalLengthM, 1),
    knownLengthM: round(knownLengthM, 1),
    unknownLengthM: round(unknownLengthM, 1),
    coverage: round(coverage, 4),
    sections,
    shares,
    dominant,
    missing,
    warnings,
  };
}
