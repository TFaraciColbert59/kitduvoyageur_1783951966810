import { computeEffortScore, EFFORT_SCORE_VERSION, IEA_REFERENCE_VO2MAX_ML_KG_MIN, IEA_REFERENCE_WEIGHT_KG } from '@/features/adventure-intelligence/domain/effortScore';
import { buildGroupPlan, type GroupExperienceLevel, type GroupMemberInput, type GroupPlan } from '@/features/adventure-intelligence/domain/groupIntelligence';
import { predictRoute } from '@/features/adventure-intelligence/domain/prediction';
import type { EffortScoreInput } from '@/features/adventure-intelligence/schemas/effort.schema';
import type { ProfileModel } from '../profileLink';
import type { CollaborativeStage } from '../types';
import { bandOf, type SlopeBand } from './segments';

/**
 * Moteur d'effort branché (7.1) : score 0 à 100 %, prédiction de groupe (temps, fatigue, passages difficiles).
 * Aucun calcul propre à la page : `computeEffortScore`, `predictRoute` et `buildGroupPlan` du moteur de
 * performance font tout ; ce module ne fait que découper le tracé en segments et nommer les hypothèses.
 *
 * Règles « rien d'inventé » :
 * - un segment dont le dénivelé est inconnu n'entre pas dans le calcul (la couverture est dite) ;
 * - le moteur d'effort est calibré pour la marche (domaine LCDA) : pour un autre sport, le score reste inconnu ;
 * - physiologie : profil de référence de l'indice absolu (75 kg, VO2max 48), nommé comme tel ;
 * - allure d'un membre sans profil déclaré : allure standard du moteur, dite à l'écran.
 */
export const EFFORT_METHOD =
  'Indice d’effort absolu (effort-score-v1, profil de référence 75 kg, VO2max 48) ; temps : prédiction de route non personnalisée (profil froid) ; groupe : allure du membre le plus lent';

export interface WorkSegment {
  readonly id: number;
  readonly sectionId: string;
  readonly day: number | null;
  readonly fromKm: number;
  readonly toKm: number;
  readonly distanceM: number;
  readonly gainM: number;
  readonly lossM: number;
  readonly altitudeM: number | null;
}

export interface SegmentSet {
  readonly segments: readonly WorkSegment[];
  readonly knownKm: number;
  readonly totalKm: number;
}

const WINDOW_M = 1000;

/** Découpe le profil en fenêtres d'environ 1 km, entre altitudes connues d'un même tronçon. */
export function workSegments(model: ProfileModel, sections: readonly { id: string; ascentM: number | null; descentM: number | null; distanceKm: number }[]): SegmentSet {
  const segs: WorkSegment[] = [];
  const secById = new Map(sections.map((s) => [s.id, s]));
  const pts = model.points;
  let nextId = 1;
  let i = 0;
  while (i < pts.length) {
    const sectionId = pts[i].sectionId;
    let j = i;
    while (j + 1 < pts.length && pts[j + 1].sectionId === sectionId) j += 1;
    const slice = pts.slice(i, j + 1);
    const day = slice[0].day;
    const knots = slice.filter((p) => p.elevationM != null);
    const sec = secById.get(sectionId);
    if (knots.length >= 2) {
      let wStart = knots[0];
      let gain = 0;
      let loss = 0;
      let prev = knots[0];
      let altSum = 0;
      let altN = 0;
      const flush = (end: typeof prev) => {
        const dist = end.distanceM - wStart.distanceM;
        if (dist > 0) {
          segs.push({
            id: nextId++,
            sectionId,
            day,
            fromKm: Math.round(wStart.distanceM / 10) / 100,
            toKm: Math.round(end.distanceM / 10) / 100,
            distanceM: dist,
            gainM: gain,
            lossM: loss,
            altitudeM: altN > 0 ? altSum / altN : null,
          });
        }
      };
      for (let k = 1; k < knots.length; k += 1) {
        const cur = knots[k];
        const d = (cur.elevationM as number) - (prev.elevationM as number);
        if (d > 0) gain += d;
        else loss += -d;
        altSum += cur.elevationM as number;
        altN += 1;
        if (cur.distanceM - wStart.distanceM >= WINDOW_M || k === knots.length - 1) {
          flush(cur);
          wStart = cur;
          gain = 0;
          loss = 0;
          altSum = 0;
          altN = 0;
        }
        prev = cur;
      }
    } else if (sec && sec.ascentM != null && sec.descentM != null && slice.length >= 2) {
      const dist = slice[slice.length - 1].distanceM - slice[0].distanceM;
      if (dist > 0) {
        segs.push({
          id: nextId++,
          sectionId,
          day,
          fromKm: Math.round(slice[0].distanceM / 10) / 100,
          toKm: Math.round(slice[slice.length - 1].distanceM / 10) / 100,
          distanceM: dist,
          gainM: sec.ascentM,
          lossM: sec.descentM,
          altitudeM: knots.length === 1 ? (knots[0].elevationM as number) : null,
        });
      }
    }
    i = j + 1;
  }
  const knownKm = Math.round(segs.reduce((a, s) => a + s.distanceM, 0) / 10) / 100;
  return { segments: segs, knownKm, totalKm: Math.round(model.totalM / 10) / 100 };
}

export interface MemberProfile {
  readonly id: string;
  readonly name: string;
  readonly flatSpeedKmh?: number | null;
  readonly ascentMPerH?: number | null;
  readonly descentMPerH?: number | null;
  readonly packWeightKg?: number | null;
  readonly maxCarryKg?: number | null;
  readonly level?: GroupExperienceLevel | null;
  readonly isChild?: boolean;
}

export function hasDeclaredPace(m: MemberProfile): boolean {
  return [m.flatSpeedKmh, m.ascentMPerH, m.descentMPerH].some((v) => typeof v === 'number' && v > 0);
}

export interface CriticalPassage {
  readonly segmentId: number;
  readonly day: number | null;
  readonly fromKm: number;
  readonly toKm: number;
  readonly gainM: number;
  readonly lossM: number;
  readonly gradePct: number;
  readonly band: SlopeBand;
}

export interface DayEffort {
  readonly day: number;
  readonly stageId: string;
  readonly scorePct: number | null;
  readonly p50Min: number | null;
  readonly p90Min: number | null;
  readonly fatiguePct: number | null;
  readonly critical: readonly CriticalPassage[];
  readonly coveragePct: number;
}

export interface GroupReading {
  readonly paceKmh: number;
  readonly durationMin: number | null;
  readonly limitingName: string | null;
  readonly limitingReason: string | null;
  readonly difficulty: number;
  readonly pauseEveryMin: number;
  readonly separation: GroupPlan['separationRisk'];
  readonly perMember: readonly { id: string; name: string; paceKmh: number; difficulty: number; declared: boolean }[];
  readonly declaredCount: number;
  readonly memberCount: number;
}

export interface EffortAnalysis {
  readonly status: 'ok' | 'partial' | 'unknown';
  /** Pourquoi le résultat est absent ou partiel, en clair. */
  readonly reason: string | null;
  readonly scorePct: number | null;
  readonly technicite: number | null;
  readonly riskLevel: 'low' | 'moderate' | 'high' | 'critical' | null;
  readonly p50Min: number | null;
  readonly p90Min: number | null;
  readonly fatiguePct: number | null;
  readonly critical: readonly CriticalPassage[];
  readonly coveragePct: number;
  readonly days: readonly DayEffort[];
  readonly group: GroupReading | null;
  readonly assumptions: readonly string[];
  readonly method: string;
  readonly version: string;
}

export interface EffortOptions {
  readonly sport: string;
  readonly members: readonly MemberProfile[];
  /** Poids du sac de l'utilisateur en kg ; `null` : inconnu (charge non comptée, et dit). */
  readonly packWeightKg: number | null;
  /** Objets du sac sans poids connu : leur charge n'est pas comptée, et c'est dit. */
  readonly packUnweightedCount?: number;
  /** Température du moment (MET Norway) ; `null` : conditions neutres, et dit. */
  readonly tempC: number | null;
  readonly stages: readonly CollaborativeStage[];
}

const unknown = (reason: string, over: Partial<EffortAnalysis> = {}): EffortAnalysis => ({
  status: 'unknown',
  reason,
  scorePct: null,
  technicite: null,
  riskLevel: null,
  p50Min: null,
  p90Min: null,
  fatiguePct: null,
  critical: [],
  coveragePct: 0,
  days: [],
  group: null,
  assumptions: [],
  method: EFFORT_METHOD,
  version: EFFORT_SCORE_VERSION,
  ...over,
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function criticalOf(ids: readonly number[], segs: readonly WorkSegment[]): CriticalPassage[] {
  const out: CriticalPassage[] = [];
  for (const id of ids) {
    const s = segs.find((x) => x.id === id);
    if (!s || s.distanceM <= 0) continue;
    const grade = Math.round(((s.gainM - s.lossM) / s.distanceM) * 1000) / 10;
    const band = bandOf(Math.max(Math.abs(s.gainM), Math.abs(s.lossM)) / s.distanceM * 100);
    if (band === 'plat') continue;
    out.push({ segmentId: id, day: s.day, fromKm: s.fromKm, toKm: s.toKm, gainM: Math.round(s.gainM), lossM: Math.round(s.lossM), gradePct: grade, band });
  }
  return out;
}

function effortInput(segs: readonly WorkSegment[], movingS: number, opts: EffortOptions, scenario: string): EffortScoreInput {
  const weights = segs.map((s) => s.distanceM + 8 * s.gainM);
  const wTotal = weights.reduce((a, b) => a + b, 0) || 1;
  return {
    segments: segs.map((s, idx) => {
      const durationS = Math.max(1, (movingS * weights[idx]) / wTotal);
      const gradePct = clamp(((s.gainM - s.lossM) / s.distanceM) * 100, -100, 100);
      return {
        segmentId: s.id,
        distanceM: s.distanceM,
        durationS,
        speedMs: s.distanceM / durationS,
        gradePct,
        gainM: s.gainM,
        lossM: s.lossM,
        altitudeM: s.altitudeM ?? 0,
        surface: 'trail',
        snowSinkCm: 0,
        technicalClass: 1,
        exposureClass: 0,
        isolationClass: 0,
        isRegroupPoint: false,
      };
    }),
    weather: { tempC: opts.tempC ?? 14, windMs: 0, precipMmPerH: 0 },
    ground: { surface: 'trail', snowSinkCm: 0, wetness: 0 },
    pack: { packWeightKg: opts.packWeightKg ?? 0 },
    physiology: { weightKg: IEA_REFERENCE_WEIGHT_KG, vo2MaxMlKgMin: IEA_REFERENCE_VO2MAX_ML_KG_MIN },
    dataLevel: 'socle',
    snapshot: {
      modelVersion: EFFORT_SCORE_VERSION,
      profileVersion: 'reference-iea',
      routeFeatureVersion: 'route-collab-windows/1',
      equipmentSnapshot: opts.packWeightKg == null ? 'sac-inconnu' : `sac-${Math.round(opts.packWeightKg * 10)}`,
      contextSnapshot: opts.tempC == null ? 'meteo-neutre' : `t-${Math.round(opts.tempC)}`,
      scenario,
    },
    evidence: [],
  };
}

function groupOf(segs: readonly WorkSegment[], members: readonly MemberProfile[]): GroupReading | null {
  if (members.length === 0 || segs.length === 0) return null;
  const inputs: GroupMemberInput[] = members.map((m, idx) => ({
    memberId: m.id,
    displayName: m.name,
    role: idx === 0 ? 'owner' : 'member',
    flatSpeedKmH: m.flatSpeedKmh ?? null,
    ascentSpeedMPerHour: m.ascentMPerH ?? null,
    descentSpeedMPerHour: m.descentMPerH ?? null,
    packWeightKg: m.packWeightKg ?? null,
    maxCarryKg: m.maxCarryKg ?? null,
    experienceLevel: m.level ?? 'intermediate',
    isChild: m.isChild === true,
  }));
  const plan = buildGroupPlan(
    inputs,
    segs.map((s) => ({ segmentId: s.id, distanceM: s.distanceM, gainM: s.gainM, lossM: s.lossM })),
  );
  const distanceKm = segs.reduce((a, s) => a + s.distanceM, 0) / 1000;
  const limiting = members.find((m) => m.id === plan.limitingMemberId) ?? null;
  const paceOf = (id: string) => plan.memberPacesKmH.find((p) => p.memberId === id)?.paceKmH ?? 0;
  const diffOf = (id: string) => plan.perMemberDifficulty.find((p) => p.memberId === id)?.difficulty ?? 0;
  return {
    paceKmh: plan.groupPaceKmH,
    durationMin: plan.groupPaceKmH > 0 ? Math.round((distanceKm / plan.groupPaceKmH) * 60) : null,
    limitingName: limiting?.name ?? null,
    limitingReason: plan.limitingReason,
    difficulty: plan.groupDifficulty,
    pauseEveryMin: plan.pauseEveryMinutes,
    separation: plan.separationRisk,
    perMember: members.map((m) => ({ id: m.id, name: m.name, paceKmh: paceOf(m.id), difficulty: diffOf(m.id), declared: hasDeclaredPace(m) })),
    declaredCount: members.filter(hasDeclaredPace).length,
    memberCount: members.length,
  };
}

export function buildEffortAnalysis(model: ProfileModel, sections: Parameters<typeof workSegments>[1], opts: EffortOptions): EffortAnalysis {
  if (model.points.length < 2) return unknown('Aucun tracé : rien à évaluer.');
  const set = workSegments(model, sections);
  if (set.segments.length === 0) {
    return unknown('Dénivelé inconnu sur tout le tracé : aucun effort n’est calculé sans lui.');
  }
  const coveragePct = set.totalKm > 0 ? Math.round((set.knownKm / set.totalKm) * 100) : 0;
  const assumptions: string[] = [`Physiologie : profil de référence (${IEA_REFERENCE_WEIGHT_KG} kg, VO2max ${IEA_REFERENCE_VO2MAX_ML_KG_MIN})`];
  if (opts.packWeightKg == null) assumptions.push('Sac inconnu : charge portée non comptée');
  else if ((opts.packUnweightedCount ?? 0) > 0) assumptions.push(`${opts.packUnweightedCount} objet(s) du sac sans poids connu : leur charge n’est pas comptée`);
  if (opts.tempC == null) assumptions.push('Météo non chargée : conditions neutres (14 °C)');
  if (set.segments.some((s) => s.altitudeM == null)) assumptions.push('Altitude inconnue sur une partie du tracé : effet de l’altitude non compté');
  if (coveragePct < 100) assumptions.push(`Dénivelé connu sur ${coveragePct} % du tracé seulement`);

  const group = groupOf(set.segments, opts.members);
  const reasonBase = coveragePct < 100 ? `Calculé sur ${coveragePct} % du tracé : le dénivelé manque ailleurs.` : null;

  if (opts.sport !== 'marche') {
    return {
      ...unknown('Le moteur d’effort est calibré pour la marche : score et temps non calculés pour ce sport.', { group, coveragePct, assumptions }),
    };
  }

  const stageOfDay = new Map(opts.stages.map((s) => [s.dayNumber, s]));
  const dayNumbers = Array.from(new Set(set.segments.map((s) => s.day).filter((d): d is number => d != null))).sort((a, b) => a - b);
  const routeOf = (segs: readonly WorkSegment[]) => ({
    segments: segs.map((s) => ({ segmentId: s.id, distanceM: s.distanceM, gainM: s.gainM, lossM: s.lossM, technicalClass: null })),
    startAt: '2026-01-01T08:00:00.000Z',
    profile: null,
    confidence: null,
    packWeightKg: opts.packWeightKg,
  });

  try {
    const days: DayEffort[] = dayNumbers.map((day) => {
      const segs = set.segments.filter((s) => s.day === day);
      const dayTotalKm = model.points.filter((p) => p.day === day);
      const dayKm = dayTotalKm.length > 1 ? (dayTotalKm[dayTotalKm.length - 1].distanceM - dayTotalKm[0].distanceM) / 1000 : 0;
      const known = segs.reduce((a, s) => a + s.distanceM, 0) / 1000;
      const pred = predictRoute(routeOf(segs), 'recommended');
      const moving = Math.max(60, pred.totalDurationP50Seconds - pred.pausesSeconds);
      const eff = computeEffortScore(effortInput(segs, moving, opts, `jour-${day}`));
      return {
        day,
        stageId: stageOfDay.get(day)?.id ?? `jour-${day}`,
        scorePct: Math.round(eff.iea),
        p50Min: Math.round(pred.totalDurationP50Seconds / 60),
        p90Min: Math.round(pred.totalDurationP90Seconds / 60),
        fatiguePct: pred.maxFatigue != null ? Math.round(pred.maxFatigue) : null,
        critical: criticalOf(pred.criticalSegmentIds, segs),
        coveragePct: dayKm > 0 ? Math.min(100, Math.round((known / dayKm) * 100)) : 0,
      };
    });
    const all = set.segments;
    const predAll = predictRoute(routeOf(all), 'recommended');
    const movingAll = Math.max(60, predAll.totalDurationP50Seconds - predAll.pausesSeconds);
    const effAll = computeEffortScore(effortInput(all, movingAll, opts, 'itineraire'));
    return {
      status: coveragePct < 100 ? 'partial' : 'ok',
      reason: reasonBase,
      scorePct: Math.round(effAll.iea),
      technicite: effAll.technicite,
      riskLevel: effAll.risque.level,
      p50Min: days.length > 0 ? days.reduce((a, d) => a + (d.p50Min ?? 0), 0) : Math.round(predAll.totalDurationP50Seconds / 60),
      p90Min: days.length > 0 ? days.reduce((a, d) => a + (d.p90Min ?? 0), 0) : Math.round(predAll.totalDurationP90Seconds / 60),
      fatiguePct: days.some((d) => d.fatiguePct != null)
        ? Math.max(...days.map((d) => d.fatiguePct ?? 0))
        : predAll.maxFatigue != null
          ? Math.round(predAll.maxFatigue)
          : null,
      critical: days.flatMap((d) => d.critical),
      coveragePct,
      days,
      group,
      assumptions,
      method: EFFORT_METHOD,
      version: EFFORT_SCORE_VERSION,
    };
  } catch {
    return unknown('Le moteur d’effort a refusé ces données : aucun score n’est affiché.', { group, coveragePct, assumptions });
  }
}
