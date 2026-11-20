import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_PUBLIC_BIOMETRIC_AND_INDIVIDUAL_KEYS,
  PublicGroupPredictionSchema,
} from '../../schemas/effort.schema';
import {
  ATP_PAUSE_PRIOR_MIN_PER_HOUR,
  MAX_GEAR_TRANSFER_KG,
  computeAsymmetricSuperposedDepartureS,
  computeCompactGroupFrictionFactor,
  evaluateRegroupWaitingColdAlert,
  projectGroupPlanPublic,
  projectGroupPredictionPublic,
  simulateGroupPredictionV2,
  simulateMaxPlusBottleneckStep,
  type GroupMemberV2Input,
  type GroupSegmentV2Input,
} from '../groupIntelligence';
import {
  applyKalmanPaceResidual,
  computeWoodCampbellPriorSpeedMs,
  resolveIndividualSegmentSpeedMs,
  solveEnergeticSpeedLimitMs,
} from '../paceResolver';
import {
  ATP_DEFAULT_PAUSE_MINUTES_PER_HOUR,
  createInitialKalmanPosterior,
  updateKalmanProfileOnline,
} from '../performanceProfile';

const SNAPSHOT_V2 = {
  modelVersion: 'effort-score-v1',
  profileVersion: 'prof-v2',
  routeFeatureVersion: 'route-v2',
  equipmentSnapshot: 'group-kit-v2',
  contextSnapshot: 'alpine-day',
  scenario: 'group-v2',
};

function makeMember(
  index: number,
  overrides: Partial<GroupMemberV2Input> = {}
): GroupMemberV2Input {
  const idHex = String(index).padStart(12, '0');
  return {
    memberId: `10000000-0000-4000-8000-${idHex}`,
    consentedAt: '2026-11-20T07:00:00.000Z',
    dataLevel: 'socle',
    physiology: {
      weightKg: 75,
      vo2MaxMlKgMin: 48,
      hrRest: 56,
      hrMax: 186,
      birthYear: 1990,
      sex: 'male',
    },
    pack: {
      packWeightKg: 8,
    },
    isChild: false,
    groupSimulationConsented: true,
    ...overrides,
  };
}

function makeSegment(
  segmentId: number,
  overrides: Partial<GroupSegmentV2Input> = {}
): GroupSegmentV2Input {
  const gradePct = overrides.gradePct ?? 6;
  const distanceM = overrides.distanceM ?? 1000;
  const speedMs = overrides.speedMs ?? 1.1;
  return {
    segmentId,
    distanceM,
    durationS: distanceM / speedMs,
    speedMs,
    gradePct,
    gradeDec: gradePct / 100,
    gainM: gradePct > 0 ? (gradePct / 100) * distanceM : 0,
    lossM: gradePct < 0 ? (-gradePct / 100) * distanceM : 0,
    altitudeM: 1400,
    surface: 'dirt',
    snowSinkCm: 0,
    technicalClass: 1,
    exposureClass: 1,
    isolationClass: 1,
    outOfDomain: false,
    isRegroupPoint: false,
    ...overrides,
  };
}

describe('LOT P5 — Moteur de groupe V2 & Sécurité préventive', () => {
  describe('1. Surface de capacité individuelle (Wood 2023 / Campbell + Kalman + LCDA / Péronnet)', () => {
    it('combine prior Wood/Campbell, résidu Kalman et minimum des 4 plafonds v_ik = min(v_energetic, v_tech, v_grip, v_visibility)', () => {
      const flatPrior = computeWoodCampbellPriorSpeedMs(0, 'asphalt', 1);
      const steepPrior = computeWoodCampbellPriorSpeedMs(18, 'dirt', 2);
      expect(flatPrior).toBeGreaterThan(steepPrior);

      const faster = applyKalmanPaceResidual(flatPrior, 0, [0.15, 0, 0]);
      const slower = applyKalmanPaceResidual(flatPrior, 0, [-0.15, 0, 0]);
      expect(faster).toBeGreaterThan(flatPrior);
      expect(slower).toBeLessThan(flatPrior);

      // Plafond énergétique en hypoxie (Péronnet 1991) : diminue avec l'altitude
      const seaLevel = solveEnergeticSpeedLimitMs({
        gradePct: 12,
        altitudeM: 200,
        weightKg: 75,
        packWeightKg: 12,
        vo2MaxMlKgMin: 46,
      });
      const highAlt = solveEnergeticSpeedLimitMs({
        gradePct: 12,
        altitudeM: 3800,
        weightKg: 75,
        packWeightKg: 12,
        vo2MaxMlKgMin: 46,
      });
      expect(highAlt.vEnergeticMs).toBeLessThan(seaLevel.vEnergeticMs);

      // Vérifie v_ik = min(v_energetic, v_tech, v_grip, v_visibility)
      const nightTech = resolveIndividualSegmentSpeedMs({
        gradePct: 5,
        altitudeM: 1200,
        surface: 'rock',
        sacScale: 'T4',
        isNight: true,
        weightKg: 75,
        packWeightKg: 8,
        vo2MaxMlKgMin: 52,
      });
      expect(nightTech.speedMs).toBeCloseTo(
        Math.min(
          nightTech.vEnergeticMs,
          nightTech.vTechMs,
          nightTech.vGripMs,
          nightTech.vVisibilityMs
        ),
        6
      );
      expect(nightTech.vTechMs).toBeLessThan(1.0);
    });
  });

  describe('2. Filtre de Kalman en ligne & sous-pondération des sorties de groupe', () => {
    it('met à jour posterior { theta, covarianceP, nSoloSessions } et sous-pondère les sorties de groupe', () => {
      const init = createInitialKalmanPosterior(0.04, '2026-11-01T10:00:00.000Z');
      const obsFast = {
        observedAt: '2026-11-10T10:00:00.000Z',
        distanceM: 6000,
        durationS: 3600,
        movingS: 3400,
        gainM: 0,
        lossM: 0,
        meanGradePct: 0,
        quality: 0.9,
      };

      const afterSolo = updateKalmanProfileOnline(init, {
        ...obsFast,
        isGroupSession: false,
      });
      const afterGroup = updateKalmanProfileOnline(init, {
        ...obsFast,
        isGroupSession: true,
        groupSize: 6,
      });

      // La sortie solo déplace davantage theta et réduit davantage la variance que la sortie de groupe
      expect(Math.abs(afterSolo.theta[0])).toBeGreaterThan(Math.abs(afterGroup.theta[0]));
      expect(afterSolo.covarianceP[0][0]).toBeLessThan(afterGroup.covarianceP[0][0]);

      // nSoloSessions incrémenté uniquement en solo
      expect(afterSolo.nSoloSessions).toBe(1);
      expect(afterSolo.n_solo_sessions).toBe(1);
      expect(afterGroup.nSoloSessions).toBe(0);
      expect(afterGroup.n_solo_sessions).toBe(0);
      expect(ATP_DEFAULT_PAUSE_MINUTES_PER_HOUR).toBe(10);
      expect(ATP_PAUSE_PRIOR_MIN_PER_HOUR).toBe(10);
    });
  });

  describe('3. Modes Compact vs Regroupement, IREQ/CoWEDA, Pauses asymétriques & Files max-plus', () => {
    it('applique g(N) = 1 - 0.03 * min(N - 1, 7) en mode compact et déclenche l’alerte IREQ/CoWEDA en mode regroupement froid', () => {
      expect(computeCompactGroupFrictionFactor(1)).toBeCloseTo(1.0, 6);
      expect(computeCompactGroupFrictionFactor(4)).toBeCloseTo(0.91, 6);
      expect(computeCompactGroupFrictionFactor(8)).toBeCloseTo(0.79, 6);
      expect(computeCompactGroupFrictionFactor(12)).toBeCloseTo(0.79, 6); // plafonné à min(N-1, 7)

      const coldWaitAlert = evaluateRegroupWaitingColdAlert({
        waitDurationS: 900, // 15 min d'attente au col
        tempC: -4,
        windMs: 10,
        upstreamAerobicFraction: 0.75,
        dryClothingClo: 1.5,
      });
      expect(coldWaitAlert.triggered).toBe(true);
      expect(coldWaitAlert.restingMetabolicWm2).toBe(65);
      expect(coldWaitAlert.wetInsulationDegradationFactor).toBeGreaterThanOrEqual(0.5);
      expect(coldWaitAlert.wetInsulationDegradationFactor).toBeLessThanOrEqual(0.7);
      // Aucun langage de diagnostic médical
      for (const medical of ['hypothermie', 'gelure', 'diagnostic', 'pathologie', 'clinique']) {
        expect(coldWaitAlert.message.toLowerCase()).not.toContain(medical);
      }
    });

    it('calcule les pauses superposées asymétriques D_j = max_i(A_ij + R_ij) et les files d’attente max-plus sur passages techniques', () => {
      const dep = computeAsymmetricSuperposedDepartureS([1000, 1400, 1800], [300, 240, 180]);
      // Dernier arrivé à 1800 s + sa pause minimale 180 s = 1980 s > 1800 s
      expect(dep.lastArrivalTimeS).toBe(1800);
      expect(dep.departureTimeS).toBe(1980);
      expect(dep.netStopDurationS).toBe(180);

      // File d'attente max-plus : 3 membres arrivent en même temps à t=100 avec temps libre 60 s et headway 30 s
      const queue = simulateMaxPlusBottleneckStep([100, 100, 100], [60, 60, 60], 30);
      expect(queue.exitTimesS).toEqual([160, 190, 220]);
      expect(queue.queuingDelaysS).toEqual([0, 30, 60]);
    });
  });

  describe('4. Monte Carlo déterministe, matrice goulots, redistribution min-max, performance & vie privée', () => {
    it('est 100 % déterministe à graine fixe, distingue goulot vitesse vs goulot physiologique, et produit une phrase d’action de redistribution', () => {
      const members: GroupMemberV2Input[] = [
        // Membre 1 : rapide au plat mais VO2max modeste + sac lourd -> goulot physiologique
        makeMember(1, {
          flatSpeedMs: 1.35,
          physiology: { weightKg: 62, vo2MaxMlKgMin: 36, hrRest: 64, hrMax: 184 },
          pack: { packWeightKg: 14 },
          maxCarryKg: 8,
        }),
        // Membre 2 : plus lent mais très endurant et sac léger -> goulot vitesse
        makeMember(2, {
          flatSpeedMs: 0.92,
          physiology: { weightKg: 82, vo2MaxMlKgMin: 56, hrRest: 48, hrMax: 188 },
          pack: { packWeightKg: 4 },
          maxCarryKg: 16,
        }),
        // Membre 3 : receveur fort avec marge de portage
        makeMember(3, {
          flatSpeedMs: 1.28,
          physiology: { weightKg: 84, vo2MaxMlKgMin: 58, hrRest: 46, hrMax: 190 },
          pack: { packWeightKg: 3 },
          maxCarryKg: 18,
        }),
      ];

      const segments: GroupSegmentV2Input[] = [
        makeSegment(1, { distanceM: 3500, gradePct: 10, altitudeM: 1800, isRegroupPoint: true }),
        makeSegment(2, {
          distanceM: 2500,
          gradePct: 8,
          altitudeM: 2200,
          sacScale: 'T3',
          technicalClass: 3,
          isBottleneck: true,
        }),
        makeSegment(3, { distanceM: 4000, gradePct: -8, altitudeM: 1700, isRegroupPoint: true }),
      ];

      const input = {
        mode: 'regroupement' as const,
        members,
        departureTime: '2026-11-20T08:00:00.000Z',
        twilightTime: '2026-11-20T16:30:00.000Z',
        segments,
        context: {
          weather: { tempC: -2, windMs: 9, humidityPct: 75, precipMmPerH: 0 },
          ground: { surface: 'dirt', snowSinkCm: 0, wetness: 0.3 },
          strategy: 'recommended' as const,
          regroupPauseMinS: 180,
          snapshot: SNAPSHOT_V2,
        },
      };

      const runA = simulateGroupPredictionV2(input, { seed: 20261120, monteCarloDraws: 2000 });
      const runB = simulateGroupPredictionV2(input, { seed: 20261120, monteCarloDraws: 2000 });

      // Reproductibilité exacte à graine fixe
      expect(runA.publicProjection.totalDurationIntervalS).toEqual(
        runB.publicProjection.totalDurationIntervalS
      );
      expect(runA.twilightOverrunProbability).toBe(runB.twilightOverrunProbability);
      expect(runA.turnaroundTimeIso).toBe(runB.turnaroundTimeIso);

      // Quantiles ordonnés
      const dur = runA.publicProjection.totalDurationIntervalS;
      expect(dur.p10).toBeLessThanOrEqual(dur.p50);
      expect(dur.p50).toBeLessThanOrEqual(dur.p90);

      // Matrice goulot vitesse vs goulot physiologique
      expect(runA.bottleneckMatrix.overallSpeedBottleneckMemberId).toBe(members[1].memberId);
      expect(runA.bottleneckMatrix.overallPhysiologicalBottleneckMemberId).toBe(members[0].memberId);
      expect(runA.bottleneckMatrix.speedAndPhysiologicalDiverge).toBe(true);

      // Redistribution du sac sous plafond MAX_GEAR_TRANSFER_KG + phrase d'action lisible
      expect(runA.gearTransfersPrivate.length).toBeGreaterThan(0);
      for (const tr of runA.gearTransfersPrivate) {
        expect(tr.weightKg).toBeLessThanOrEqual(MAX_GEAR_TRANSFER_KG);
      }
      expect(runA.gearRedistributionActionPhrase).toMatch(/Déplacer .* kg : arrivée −\d+ min, marge sécurité \+\d+ %/);
    });

    it('Benchmark obligatoire : 6 membres × 300 segments × 2 000 tirages s’exécute en < 1000 ms', () => {
      const members: GroupMemberV2Input[] = Array.from({ length: 6 }, (_, i) =>
        makeMember(i + 1, {
          flatSpeedMs: 0.95 + i * 0.08,
          physiology: {
            weightKg: 65 + i * 4,
            vo2MaxMlKgMin: 42 + i * 3,
          },
          pack: { packWeightKg: 6 + (i % 3) * 3 },
        })
      );

      const segments: GroupSegmentV2Input[] = Array.from({ length: 300 }, (_, k) =>
        makeSegment(k + 1, {
          distanceM: 50,
          gradePct: k < 150 ? 6 : -6,
          altitudeM: 1000 + (k < 150 ? k * 3 : (300 - k) * 3),
          technicalClass: k % 40 === 0 ? 3 : 1,
          isBottleneck: k % 40 === 0,
          isRegroupPoint: (k + 1) % 50 === 0,
        })
      );

      const startMs = performance.now();
      const result = simulateGroupPredictionV2(
        {
          mode: 'compact',
          members,
          departureTime: '2026-11-20T08:00:00.000Z',
          twilightTime: '2026-11-20T17:00:00.000Z',
          segments,
          context: {
            weather: { tempC: 8, windMs: 4, humidityPct: 60, precipMmPerH: 0 },
            ground: { surface: 'dirt', snowSinkCm: 0, wetness: 0.1 },
            strategy: 'recommended',
            regroupPauseMinS: 180,
            snapshot: SNAPSHOT_V2,
          },
        },
        { seed: 777, monteCarloDraws: 2000 }
      );
      const elapsedMs = performance.now() - startMs;

      expect(result.monteCarloDraws).toBe(2000);
      expect(result.privateByMember).toHaveLength(6);
      expect(elapsedMs).toBeLessThan(1000);
    });

    it('Confidentialité stricte (PublicGroupPredictionSchema) : zéro donnée biométrique ni vitesse individuelle nominative dans la projection publique sérialisée', () => {
      const members = [
        makeMember(1, {
          physiology: {
            weightKg: 73.42,
            vo2MaxMlKgMin: 51.7,
            hrRest: 52,
            hrMax: 189,
            birthYear: 1988,
            sex: 'female',
          },
          flatSpeedMs: 1.234,
        }),
        makeMember(2, {
          physiology: {
            weightKg: 81.9,
            vo2MaxMlKgMin: 44.3,
            hrRest: 61,
            hrMax: 181,
            birthYear: 1985,
            sex: 'male',
          },
          flatSpeedMs: 0.987,
        }),
      ];

      const output = simulateGroupPredictionV2(
        {
          mode: 'regroupement',
          members,
          departureTime: '2026-11-20T09:00:00.000Z',
          twilightTime: '2026-11-20T16:45:00.000Z',
          segments: [makeSegment(1, { distanceM: 4000, gradePct: 5, isRegroupPoint: true })],
          context: {
            weather: { tempC: 10, windMs: 3, precipMmPerH: 0 },
            ground: { surface: 'dirt', snowSinkCm: 0, wetness: 0 },
            strategy: 'recommended',
            regroupPauseMinS: 180,
            snapshot: SNAPSHOT_V2,
          },
        },
        { seed: 42, monteCarloDraws: 500 }
      );

      const publicViaMain = projectGroupPlanPublic(output);
      const publicViaAlias = projectGroupPredictionPublic(output);

      expect(PublicGroupPredictionSchema.safeParse(publicViaMain).success).toBe(true);
      expect(PublicGroupPredictionSchema.safeParse(publicViaAlias).success).toBe(true);

      const serialized = JSON.stringify(publicViaMain);

      // Aucune clé biométrique ou nominative interdite
      for (const forbiddenKey of FORBIDDEN_PUBLIC_BIOMETRIC_AND_INDIVIDUAL_KEYS) {
        expect(serialized).not.toContain(`"${forbiddenKey}"`);
      }

      // Aucune valeur biométrique ni identifiant membre ne fuite
      for (const forbiddenValue of [
        members[0].memberId,
        members[1].memberId,
        '73.42',
        '81.9',
        '51.7',
        '44.3',
        '1988',
        '1985',
        '1.234',
        '0.987',
      ]) {
        expect(serialized).not.toContain(forbiddenValue);
      }
    });
  });
});
