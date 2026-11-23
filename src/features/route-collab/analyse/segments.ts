import { analyzeClimbs, type GradientSection } from '@/features/routes/analysis/climbs';
import { isAnalysisSport, type AnalysisSport } from '@/features/routes/analysis/types';
import type { ProfileModel } from '../profileLink';

/**
 * Profil interactif (7.3) : pentes par bande, montées classées, trous d'altitude dits sur la zone concernée.
 * Pur. Une pente n'est lue qu'entre deux altitudes connues du MÊME tronçon : on ne comble jamais un trou.
 */
export type SlopeBand = 'plat' | 'modere' | 'soutenu' | 'raide' | 'inconnu';

export const SLOPE_BAND_LABEL: Record<SlopeBand, string> = {
  plat: 'Plat (moins de 5 %)',
  modere: 'Modéré (5 à 10 %)',
  soutenu: 'Soutenu (10 à 15 %)',
  raide: 'Raide (15 % et plus)',
  inconnu: 'Altitude inconnue',
};

export interface SlopeSegment {
  readonly fromKm: number;
  readonly toKm: number;
  /** Pente moyenne signée en % ; `null` si l'altitude manque. */
  readonly gradePct: number | null;
  readonly band: SlopeBand;
  readonly sectionId: string;
  readonly day: number | null;
}

export function bandOf(gradePct: number | null): SlopeBand {
  if (gradePct == null) return 'inconnu';
  const a = Math.abs(gradePct);
  if (a < 5) return 'plat';
  if (a < 10) return 'modere';
  if (a < 15) return 'soutenu';
  return 'raide';
}

const km = (m: number) => Math.round((m / 1000) * 100) / 100;

export function slopeSegments(model: ProfileModel, windowM = 100): SlopeSegment[] {
  const out: SlopeSegment[] = [];
  const pts = model.points;
  let i = 0;
  while (i < pts.length) {
    const sectionId = pts[i].sectionId;
    let j = i;
    while (j + 1 < pts.length && pts[j + 1].sectionId === sectionId) j += 1;
    const slice = pts.slice(i, j + 1);
    const day = slice[0].day;
    const knots = slice.filter((p) => p.elevationM != null);
    const startM = slice[0].distanceM;
    const endM = slice[slice.length - 1].distanceM;
    const push = (fromM: number, toM: number, grade: number | null) => {
      if (toM - fromM <= 0) return;
      out.push({ fromKm: km(fromM), toKm: km(toM), gradePct: grade, band: bandOf(grade), sectionId, day });
    };
    if (knots.length < 2) {
      push(startM, endM, null);
    } else {
      push(startM, knots[0].distanceM, null);
      let from = knots[0];
      for (let k = 1; k < knots.length; k += 1) {
        const to = knots[k];
        const last = k === knots.length - 1;
        if (to.distanceM - from.distanceM >= windowM || last) {
          const span = to.distanceM - from.distanceM;
          const grade = span > 0 ? Number((((to.elevationM as number) - (from.elevationM as number)) / span * 100).toFixed(1)) : null;
          push(from.distanceM, to.distanceM, grade);
          from = to;
        }
      }
      push(knots[knots.length - 1].distanceM, endM, null);
    }
    i = j + 1;
  }
  return out;
}

export interface ElevationGap {
  readonly day: number | null;
  readonly fromKm: number;
  readonly toKm: number;
  readonly lengthKm: number;
}

/** Zones sans altitude, regroupées par jour : « altitude inconnue du km 3 au km 7 (jour 2) ». */
export function elevationGaps(segments: readonly SlopeSegment[]): ElevationGap[] {
  const gaps: ElevationGap[] = [];
  for (const s of segments) {
    if (s.band !== 'inconnu') continue;
    const prev = gaps[gaps.length - 1];
    if (prev && prev.day === s.day && Math.abs(prev.toKm - s.fromKm) < 0.02) {
      gaps[gaps.length - 1] = { ...prev, toKm: s.toKm, lengthKm: Math.round((s.toKm - prev.fromKm) * 100) / 100 };
    } else {
      gaps.push({ day: s.day, fromKm: s.fromKm, toKm: s.toKm, lengthKm: Math.round((s.toKm - s.fromKm) * 100) / 100 });
    }
  }
  return gaps;
}

export function bandShares(segments: readonly SlopeSegment[]): Record<SlopeBand, number> {
  const total = segments.reduce((a, s) => a + (s.toKm - s.fromKm), 0);
  const acc: Record<SlopeBand, number> = { plat: 0, modere: 0, soutenu: 0, raide: 0, inconnu: 0 };
  for (const s of segments) acc[s.band] += s.toKm - s.fromKm;
  if (total <= 0) return acc;
  (Object.keys(acc) as SlopeBand[]).forEach((b) => {
    acc[b] = Math.round((acc[b] / total) * 100);
  });
  return acc;
}

export interface ClimbRow {
  readonly id: string;
  readonly rank: number;
  readonly fromKm: number;
  readonly toKm: number;
  readonly lengthKm: number;
  readonly gainM: number;
  readonly avgGradePct: number;
  readonly maxGradePct: number;
  readonly category: 1 | 2 | 3 | 4 | 5;
  readonly categoryLabel: string;
  readonly day: number | null;
}

export interface RankedClimbs {
  readonly status: 'available' | 'partial' | 'unavailable';
  readonly climbs: readonly ClimbRow[];
  readonly message: string | null;
}

/** Montées classées par catégorie puis par gain (moteur `routes/analysis/climbs`). */
export function rankedClimbs(model: ProfileModel, sport: string): RankedClimbs {
  const analysisSport: AnalysisSport = isAnalysisSport(sport) ? sport : 'marche';
  if (!model.hasElevation) return { status: 'unavailable', climbs: [], message: 'Altitude inconnue sur tout le tracé : aucune montée classée.' };
  const result = analyzeClimbs({
    sport: analysisSport,
    profile: model.points.map((p) => ({ distanceM: p.distanceM, elevationM: p.elevationM })),
  });
  const dayAt = (m: number) => model.points.find((p) => p.distanceM >= m)?.day ?? null;
  const sorted = result.climbs
    .slice()
    .sort((a: GradientSection, b: GradientSection) => b.category - a.category || b.gainM - a.gainM);
  return {
    status: result.status,
    climbs: sorted.map((c, idx) => ({
      id: c.id,
      rank: idx + 1,
      fromKm: km(c.fromM),
      toKm: km(c.toM),
      lengthKm: km(c.lengthM),
      gainM: Math.round(c.gainM),
      avgGradePct: Number(c.avgGradePct.toFixed(1)),
      maxGradePct: Number(c.maxGradePct.toFixed(1)),
      category: c.category,
      categoryLabel: c.categoryLabel,
      day: dayAt(c.fromM),
    })),
    message: result.climbs.length === 0 ? (result.missing[0]?.message ?? 'Aucune montée notable relevée sur les altitudes connues.') : null,
  };
}
