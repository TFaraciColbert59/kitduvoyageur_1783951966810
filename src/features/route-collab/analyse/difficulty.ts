import { analyzeClimbs } from '@/features/routes/analysis/climbs';
import { analyzeDifficulty, type DifficultyAnalysis, type DifficultyFactor } from '@/features/routes/analysis/difficulty';
import type { SurfaceAnalysis, SurfaceShare } from '@/features/routes/analysis/surfaces';
import { isAnalysisSport, type AnalysisSport } from '@/features/routes/analysis/types';
import { surfaceBreakdown } from '../insights/surfaces';
import type { ProfileModel } from '../profileLink';
import type { RouteWorkspaceState } from '../types';
import { SOURCE_DIFFICULTY } from './provenance';

/**
 * Difficulté (7.2) : la cote vient de `routes/analysis/difficulty.ts`, jamais d'un calcul de la page.
 * « Pourquoi ? » nomme les trois facteurs qui pèsent le plus sur le temps de déplacement.
 */
export interface DifficultyFactorRow {
  readonly id: string;
  readonly label: string;
  /** « 42 km », « 1 200 m », « catégorie 4 ». */
  readonly valueText: string;
  readonly minutes: number;
  /** Part du temps de déplacement attribuable à ce facteur, en %. */
  readonly sharePct: number;
}

export interface DifficultyReading {
  readonly status: 'known' | 'unknown';
  readonly reason: string | null;
  readonly level: 1 | 2 | 3 | 4 | 5 | null;
  readonly levelLabel: string | null;
  readonly score: number | null;
  readonly effortKm: number | null;
  readonly top3: readonly DifficultyFactorRow[];
  readonly why: string;
  readonly notes: readonly string[];
  readonly method: string;
  readonly source: string;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function valueText(f: DifficultyFactor): string {
  switch (f.id) {
    case 'distance':
      return `${nf.format(f.value)} km`;
    case 'ascent':
    case 'descent':
    case 'altitude':
      return `${nf.format(f.value)} m`;
    case 'climb_technical':
      return `catégorie ${f.value}`;
    case 'surface':
      return `${nf.format(f.value)} % étiqueté`;
    default:
      return `${nf.format(f.value)} ${f.unit}`;
  }
}

/** Les trois facteurs dominants, du plus lourd au plus léger ; les pauses et les facteurs sans effet sont écartés. */
export function topFactors(analysis: Pick<DifficultyAnalysis, 'factors'>, count = 3): DifficultyFactorRow[] {
  const usable = analysis.factors.filter((f) => f.id !== 'breaks' && f.contributionMinutes > 0);
  const total = usable.reduce((a, f) => a + f.contributionMinutes, 0);
  return usable
    .slice()
    .sort((a, b) => b.contributionMinutes - a.contributionMinutes)
    .slice(0, count)
    .map((f) => ({
      id: f.id,
      label: f.label,
      valueText: valueText(f),
      minutes: f.contributionMinutes,
      sharePct: total > 0 ? Math.round((f.contributionMinutes / total) * 100) : 0,
    }));
}

function surfaceInput(ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages'>): Pick<SurfaceAnalysis, 'status' | 'shares' | 'coverage' | 'unknownLengthM'> | null {
  const b = surfaceBreakdown(ws).overall;
  if (b.totalKm <= 0) return null;
  const mk = (category: SurfaceShare['category'], km: number): SurfaceShare => ({
    category,
    lengthM: km * 1000,
    shareOfKnown: 0,
    shareOfRoute: km / b.totalKm,
  });
  const known = b.km.goudron + b.km.piste + b.km.sentier;
  if (known <= 0) return null;
  return {
    status: b.km.inconnu > 0 ? 'partial' : 'available',
    shares: [mk('paved', b.km.goudron), mk('unpaved', b.km.piste), mk('natural', b.km.sentier)].filter((s) => s.lengthM > 0),
    coverage: known / b.totalKm,
    unknownLengthM: b.km.inconnu * 1000,
  };
}

export function readDifficulty(
  ws: Pick<RouteWorkspaceState, 'points' | 'sections' | 'stages' | 'sport'>,
  model: ProfileModel,
): DifficultyReading {
  const sport: AnalysisSport = isAnalysisSport(ws.sport) ? ws.sport : 'marche';
  const distanceKm = ws.sections.reduce((a, s) => a + s.distanceKm, 0);
  const ascents = ws.sections.map((s) => s.ascentM);
  const gainM = ascents.length > 0 && ascents.every((a): a is number => a != null) ? ascents.reduce((a, b) => a + b, 0) : null;
  const descents = ws.sections.map((s) => s.descentM);
  const lossM = descents.length > 0 && descents.every((a): a is number => a != null) ? descents.reduce((a, b) => a + b, 0) : null;
  const elevations = model.points.map((p) => p.elevationM).filter((e): e is number => e != null);
  const climbs = model.hasElevation
    ? analyzeClimbs({ sport, profile: model.points.map((p) => ({ distanceM: p.distanceM, elevationM: p.elevationM })) })
    : null;
  const analysis = analyzeDifficulty({
    sport,
    distanceM: distanceKm * 1000,
    gainM,
    lossM,
    maxAltitudeM: elevations.length > 0 ? Math.max(...elevations) : null,
    surface: surfaceInput(ws),
    climbs,
  });
  const base = { method: analysis.method.formula, source: SOURCE_DIFFICULTY } as const;
  if (analysis.status === 'unavailable') {
    const reason = analysis.missing[0]?.message ?? 'Données insuffisantes pour une difficulté.';
    return { status: 'unknown', reason, level: null, levelLabel: null, score: null, effortKm: null, top3: [], why: reason, notes: [], ...base };
  }
  const top3 = topFactors(analysis);
  const why = top3.length > 0
    ? `Cote ${analysis.level} sur 5 (${analysis.levelLabel.toLowerCase()}) surtout à cause de : ${top3.map((f) => `${f.label.toLowerCase()} (${f.valueText})`).join(', ')}.`
    : `Cote ${analysis.level} sur 5 (${analysis.levelLabel.toLowerCase()}).`;
  return {
    status: 'known',
    reason: null,
    level: analysis.level,
    levelLabel: analysis.levelLabel,
    score: analysis.score,
    effortKm: analysis.effortKm,
    top3,
    why,
    notes: [...analysis.missing, ...analysis.warnings].map((m) => m.message),
    ...base,
  };
}
