import type { OvernightPlace, RouteWorkspaceState } from '../types';
import { DEFAULT_NAISMITH, type NaismithParams, naismithMethod } from './pace';
import { orderedLegs, projectOnTrack, round1, trackVertices } from './shared';

export interface OvernightCandidate {
  readonly id: string;
  readonly name: string;
  readonly type: OvernightPlace['type'];
  readonly lat: number;
  readonly lon: number;
}

export interface StageSplitOptions {
  /** Nombre de jours voulu ; sinon déduit des seuils. */
  readonly days?: number;
  readonly maxHoursPerDay: number;
  readonly maxAscentPerDay: number;
  readonly overnightCandidates: readonly OvernightCandidate[];
  readonly pace?: NaismithParams;
  /** Écart maximal d'un candidat au tracé pour être proposé (km, défaut 2). */
  readonly maxDetourKm?: number;
}

export interface ProposedStage {
  readonly dayNumber: number;
  readonly startKm: number;
  readonly endKm: number;
  readonly distanceKm: number;
  /** `null` : D+ inconnu sur une partie de la journée. */
  readonly ascentM: number | null;
  readonly durationMin: number;
  /** Vrai si le D+ inconnu n'est pas compté dans la durée. */
  readonly durationIsLowerBound: boolean;
  readonly endLat: number;
  readonly endLon: number;
  /** Lieu de la nuit (dernier jour : aucune nuit). */
  readonly overnight: OvernightCandidate | null;
  readonly overnightStatus: 'candidate' | 'to_find' | 'none';
  readonly exceeds: readonly ('hours' | 'ascent')[];
}

export interface StageSplitProposal {
  readonly ok: boolean;
  readonly stages: readonly ProposedStage[];
  readonly explanation: string;
  readonly rule: string;
  readonly thresholds: { readonly maxHoursPerDay: number; readonly maxAscentPerDay: number; readonly pace: NaismithParams };
  readonly warnings: readonly string[];
}

const TYPE_PLURAL: Record<OvernightPlace['type'], [string, string]> = {
  refuge: ['au refuge', 'aux refuges'],
  hut: ['à la cabane', 'aux cabanes'],
  bivouac: ['au bivouac', 'aux bivouacs'],
  camp: ['au camp', 'aux camps'],
  gite: ['au gîte', 'aux gîtes'],
  hotel: ['à l’hôtel', 'aux hôtels'],
};

function joinFr(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

export function proposeStageSplit(
  state: Pick<RouteWorkspaceState, 'points' | 'sections'>,
  options: StageSplitOptions,
): StageSplitProposal {
  const pace = options.pace ?? DEFAULT_NAISMITH;
  const thresholds = { maxHoursPerDay: options.maxHoursPerDay, maxAscentPerDay: options.maxAscentPerDay, pace };
  const detour = options.maxDetourKm ?? 2;
  const fail = (message: string): StageSplitProposal => ({
    ok: false,
    stages: [],
    explanation: message,
    rule: '',
    thresholds,
    warnings: [],
  });
  const verts = trackVertices(orderedLegs(state));
  if (verts.length < 2 || verts[verts.length - 1].km <= 0) return fail('Aucun tracé à découper.');
  if (!(options.maxHoursPerDay > 0)) return fail('Seuil d’heures par jour invalide.');
  const n = verts.length;
  const unknownTotal = verts[n - 1].unknownAscentKm > 0;
  // Effort cumulé en minutes (Naismith) ; le D+ inconnu n'est pas compté.
  const effort = verts.map((v) => (v.km / pace.speedKmh) * 60 + (v.ascentM / pace.ascentMPerHour) * 60);
  const effortBetween = (a: number, b: number) => effort[b] - effort[a];
  const ascentBetween = (a: number, b: number): number | null =>
    verts[b].unknownAscentKm - verts[a].unknownAscentKm > 1e-9 ? null : verts[b].ascentM - verts[a].ascentM;

  // Candidats posés sur le tracé : seuls les lieux fournis, jamais inventés.
  const snapped = options.overnightCandidates
    .map((c) => {
      const p = projectOnTrack(verts, c.lat, c.lon);
      return p && p.offsetKm <= detour && p.vertexIndex > 0 && p.vertexIndex < n - 1 ? { c, idx: p.vertexIndex } : null;
    })
    .filter((x): x is { c: OvernightCandidate; idx: number } => x !== null)
    .sort((a, b) => a.idx - b.idx || a.c.id.localeCompare(b.c.id));

  const cuts: { idx: number; cand: OvernightCandidate | null }[] = [];
  let rule: string;
  const limitMin = options.maxHoursPerDay * 60;
  const exceedsLimit = (a: number, b: number) =>
    effortBetween(a, b) > limitMin || (() => {
      const asc = ascentBetween(a, b);
      return asc !== null && asc > options.maxAscentPerDay;
    })();

  if (options.days && options.days >= 1) {
    const days = Math.floor(options.days);
    rule = `Jours de durée équilibrée (effort ${naismithMethod(pace)}), coupure au lieu de nuit fourni le plus proche de chaque cible`;
    const total = effort[n - 1];
    const used = new Set<string>();
    let last = 0;
    for (let k = 1; k < days; k += 1) {
      const target = (total * k) / days;
      const window = (total / days) * 0.25;
      let best: { c: OvernightCandidate; idx: number } | null = null;
      for (const s of snapped) {
        if (used.has(s.c.id) || s.idx <= last) continue;
        const d = Math.abs(effort[s.idx] - target);
        if (d <= window && (!best || d < Math.abs(effort[best.idx] - target))) best = s;
      }
      if (best) {
        used.add(best.c.id);
        cuts.push({ idx: best.idx, cand: best.c });
        last = best.idx;
      } else {
        let idx = last + 1;
        for (let i = last + 1; i < n - 1; i += 1) if (Math.abs(effort[i] - target) < Math.abs(effort[idx] - target)) idx = i;
        if (idx >= n - 1 || idx <= last) break;
        cuts.push({ idx, cand: null });
        last = idx;
      }
    }
  } else {
    rule = `Jour le plus long possible sous ${options.maxHoursPerDay} h (${naismithMethod(pace)}) et ${options.maxAscentPerDay} m de D+, coupure au lieu de nuit fourni (au moins la moitié du seuil d’heures), sinon nuit à trouver`;
    let s = 0;
    while (s < n - 1 && exceedsLimit(s, n - 1)) {
      let e = s + 1;
      while (e + 1 < n - 1 && !exceedsLimit(s, e + 1)) e += 1;
      if (e >= n - 1) break;
      const pick = [...snapped].reverse().find((x) => x.idx > s && x.idx <= e && effortBetween(s, x.idx) >= limitMin * 0.5);
      if (pick) {
        cuts.push({ idx: pick.idx, cand: pick.c });
        s = pick.idx;
      } else {
        cuts.push({ idx: e, cand: null });
        s = e;
      }
    }
  }

  const bounds = [0, ...cuts.map((c) => c.idx), n - 1];
  const stages: ProposedStage[] = bounds.slice(1).map((end, i) => {
    const start = bounds[i];
    const asc = ascentBetween(start, end);
    const isLast = i === bounds.length - 2;
    const cand = isLast ? null : cuts[i].cand;
    const exceeds: ('hours' | 'ascent')[] = [];
    if (effortBetween(start, end) > limitMin) exceeds.push('hours');
    if (asc !== null && asc > options.maxAscentPerDay) exceeds.push('ascent');
    return {
      dayNumber: i + 1,
      startKm: round1(verts[start].km),
      endKm: round1(verts[end].km),
      distanceKm: round1(verts[end].km - verts[start].km),
      ascentM: asc === null ? null : Math.round(asc),
      durationMin: Math.round(effortBetween(start, end)),
      durationIsLowerBound: asc === null,
      endLat: verts[end].lat,
      endLon: verts[end].lon,
      overnight: cand,
      overnightStatus: isLast ? 'none' : cand ? 'candidate' : 'to_find',
      exceeds,
    };
  });

  const warnings: string[] = [];
  if (unknownTotal) warnings.push('D+ inconnu sur une partie du tracé : seuil de D+ non vérifié là, durées minimales.');
  if (stages.some((st) => st.exceeds.length > 0)) warnings.push('Au moins un jour dépasse un seuil : tracé sans lieu de coupure plus court.');
  if (options.days && stages.length < Math.floor(options.days)) warnings.push('Moins de jours que demandé : le tracé est trop court pour être coupé davantage.');

  const hours = stages.map((st) => Math.round(st.durationMin / 60));
  const hMin = Math.min(...hours);
  const hMax = Math.max(...hours);
  const range = hMin === hMax ? `de ${hMin} h` : `de ${hMin} à ${hMax} h`;
  const nights = stages.slice(0, -1);
  let nightsText = '';
  if (nights.length > 0) {
    const allFound = nights.every((x) => x.overnight);
    const types = new Set(nights.map((x) => x.overnight?.type));
    if (allFound && types.size === 1) {
      const t = nights[0].overnight!.type;
      const [one, many] = TYPE_PLURAL[t];
      nightsText = nights.length === 1 ? `, nuit ${one} ${nights[0].overnight!.name}` : `, nuits ${many} ${joinFr(nights.map((x) => x.overnight!.name))}`;
    } else {
      nightsText = `, ${nights.length === 1 ? 'nuit' : 'nuits'} : ${nights.map((x) => (x.overnight ? x.overnight.name : 'nuit à trouver')).join(', ')}`;
    }
  }
  const explanation = `${stages.length} ${stages.length > 1 ? 'jours' : 'jour'} ${range}${nightsText}`;
  return { ok: true, stages, explanation, rule, thresholds, warnings };
}
