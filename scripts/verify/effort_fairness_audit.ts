#!/usr/bin/env npx tsx
/**
 * LOT P6 — Audit d'équité contrefactuel (`complet` vs `socle`), calibration conforme
 * asymétrique par case et ablations automatisées (`effort-score-v1`).
 *
 * Usage : npx tsx scripts/verify/effort_fairness_audit.ts
 * Retourne exit 0 si tous les invariants passent, exit 1 sinon.
 */
import { pathToFileURL } from 'node:url';
import type { EffortScoreInput } from '../../src/features/adventure-intelligence/schemas/effort.schema';
import {
  EFFORT_SCORE_VERSION,
  computeEffortScore,
} from '../../src/features/adventure-intelligence/domain/effortScore';
import {
  CONFORMAL_MAX_NOMINAL_DEVIATION_PTS,
  CONFORMAL_MIN_P90_COVERAGE,
  evaluateConformalCoverage,
  fitConformalCalibrator,
  historyBucketFromCount,
  type ConformalCalibrationSample,
  type RouteTypeBucket,
} from '../../src/features/adventure-intelligence/domain/conformalCalibration';
import {
  assertNoSplitLeakage,
  evaluateTemporalEffortBacktest,
  runEffortAblations,
  type EffortBacktestRecord,
} from '../../src/features/adventure-intelligence/domain/backtesting';
import { createSeededNormalGenerator } from '../../src/features/adventure-intelligence/domain/groupIntelligence';
import {
  MIN_DISTINCT_USERS,
  MIN_PUBLISH_CONFIDENCE,
  evaluateCollectivePublishGate,
  resolveEffortShadowRollout,
} from '../../src/features/adventure-intelligence/domain/shadowMode';

export interface FairnessAuditResult {
  passed: boolean;
  leakageFree: boolean;
  counterfactualMeanBiasPts: number;
  counterfactualAbsBiasPts: number;
  conformalP90Coverage: number;
  conformalIntervalCoverage: number;
  conformalP90DeviationPts: number;
  conformalIntervalDeviationPts: number;
  socleConformalP90Coverage: number;
  ablations: ReturnType<typeof runEffortAblations>;
  temporal: ReturnType<typeof evaluateTemporalEffortBacktest>;
  failures: string[];
}

function buildSyntheticOuting(
  idx: number,
  split: 'cal' | 'eval',
  randN: () => number
): {
  record: EffortBacktestRecord;
  routeType: RouteTypeBucket;
  historyCount: number;
  truePackKg: number;
  priorPackKg: number;
  observedNoisePts: number;
} {
  const routeTypes: RouteTypeBucket[] = ['flat', 'mountain', 'alpine', 'winter'];
  const routeType = routeTypes[idx % routeTypes.length];
  const historyCounts = [0, 2, 10, 28];
  const historyCount = historyCounts[Math.floor(idx / routeTypes.length) % historyCounts.length];

  const isWinter = routeType === 'winter';
  const isAlpine = routeType === 'alpine';
  const isMountain = routeType === 'mountain';

  const distanceM = 8000 + (idx % 7) * 1800;
  const gradePct = isAlpine ? 11 : isMountain ? 7 : isWinter ? 3 : 1;
  const speedMs = isWinter ? 0.98 : isAlpine ? 1.02 : isMountain ? 1.15 : 1.32;
  const altitudeM = isAlpine ? 2700 : isMountain ? 1600 : isWinter ? 1400 : 300;
  const tempC = isWinter ? -4 : isAlpine ? 6 : 16 + (idx % 4) * 3;
  const windMs = isWinter ? 8 : isAlpine ? 6 : 2;
  const snowSinkCm = isWinter ? 10 : 0;

  // Prior sac sans biais systématique (bruit centré autour du prior 8 kg)
  const priorPackKg = 8;
  const packPerturb = Math.max(-4, Math.min(4, randN() * 1.4));
  const truePackKg = Number((priorPackKg + packPerturb).toFixed(2));

  const weightKg = 68 + (idx % 5) * 4;
  const vo2MaxMlKgMin = 44 + (idx % 5) * 2;
  const hrRest = 55;
  const hrMax = 185;

  const baseInput: EffortScoreInput = {
    segments: [
      {
        segmentId: 1,
        distanceM,
        durationS: distanceM / speedMs,
        speedMs,
        gradePct,
        gradeDec: gradePct / 100,
        gainM: (gradePct / 100) * distanceM,
        lossM: 0,
        altitudeM,
        surface: isWinter ? 'snow' : isAlpine ? 'rock' : 'dirt',
        snowSinkCm,
        technicalClass: isAlpine ? 3 : isMountain ? 2 : 1,
        exposureClass: isAlpine ? 2 : 0,
        isolationClass: isAlpine ? 2 : 0,
        outOfDomain: false,
        isRegroupPoint: false,
      },
    ],
    weather: {
      tempC,
      windMs,
      humidityPct: 60,
      precipMmPerH: isWinter ? 1 : 0,
    },
    ground: {
      surface: isWinter ? 'snow' : isAlpine ? 'rock' : 'dirt',
      snowSinkCm,
      wetness: isWinter ? 0.3 : 0.1,
    },
    pack: {
      packWeightKg: truePackKg,
    },
    physiology: {
      weightKg,
      vo2MaxMlKgMin,
      hrRest,
      hrMax,
    },
    dataLevel: 'complet',
    snapshot: {
      modelVersion: EFFORT_SCORE_VERSION,
      profileVersion: `prof-${split}-${idx}`,
      routeFeatureVersion: `route-${split}-${idx}`,
      equipmentSnapshot: `pack-${truePackKg}`,
      contextSnapshot: `ctx-${routeType}`,
      scenario: split,
    },
    evidence: [
      {
        value: tempC,
        unit: '°C',
        source: 'audit-fixture',
        kind: 'measured',
        quality: 0.9,
        capturedAt: split === 'cal' ? '2026-05-10T08:00:00.000Z' : '2026-10-15T08:00:00.000Z',
      },
    ],
  };

  // Calcul préalable pour générer une FC observée réaliste (bruit centré, zéro biais)
  const prelim = computeEffortScore(baseInput);
  const hrNoise = randN() * 2.5;
  const avgHeartRateBpm = Math.max(
    hrRest + 10,
    Math.min(hrMax - 5, hrRest + prelim.iMod * (hrMax - hrRest) + hrNoise)
  );

  const completInput: EffortScoreInput = {
    ...baseInput,
    observations: {
      avgHeartRateBpm,
      hrCoverageRatio: 0.92,
      sessionRpe: Math.max(1, Math.min(10, Math.round(prelim.erp / 10))),
      declaredFatigue: idx % 3,
      recentLoadS: (idx % 4) * 3600,
    },
  };

  const completOut = computeEffortScore(completInput);
  const observedNoisePts = randN() * 3.2;
  const observedScore = Math.max(0, Math.min(100, completOut.erp + observedNoisePts));

  const pipeline = idx % 2 === 0 ? 'forecast' : 'retrospective';

  const record: EffortBacktestRecord = {
    userId: `${split}-user-${idx}`,
    routeId: `${split}-route-${idx}`,
    groupId: `${split}-group-${Math.floor(idx / 4)}`,
    season: split === 'cal' ? '2026-spring' : '2026-autumn',
    occurredAt:
      split === 'cal'
        ? new Date(Date.parse('2026-05-01T08:00:00.000Z') + idx * 3600_000).toISOString()
        : new Date(Date.parse('2026-10-01T08:00:00.000Z') + idx * 3600_000).toISOString(),
    pipeline,
    dataLevel: 'complet',
    input: completInput,
    observedScore,
  };

  return {
    record,
    routeType,
    historyCount,
    truePackKg,
    priorPackKg,
    observedNoisePts,
  };
}

/** Masque cardio, fatigue/sommeil et sac déclaré (remplacé par le prior) pour simuler le contrefactuel `socle`. */
function maskCompletToSocle(input: EffortScoreInput, priorPackKg: number): EffortScoreInput {
  return {
    ...input,
    dataLevel: 'socle',
    pack: {
      ...input.pack,
      packWeightKg: priorPackKg,
    },
    observations: undefined,
  };
}

export function runEffortFairnessAudit(seed = 20261120): FairnessAuditResult {
  const randN = createSeededNormalGenerator(seed);
  const N_CAL = 240;
  const N_EVAL = 240;

  const calBuilt = Array.from({ length: N_CAL }, (_, i) => buildSyntheticOuting(i, 'cal', randN));
  const evalBuilt = Array.from({ length: N_EVAL }, (_, i) => buildSyntheticOuting(i, 'eval', randN));

  // 1. Étanchéité stricte des splits (utilisateurs, itinéraires, groupes, saisons, chronologie)
  const leakage = assertNoSplitLeakage(
    calBuilt.map((b) => b.record),
    evalBuilt.map((b) => b.record),
    { requireStrictChronology: true }
  );

  // 2. Construction des échantillons conformes (complet + contrefactuel socle)
  const calConformalSamples: ConformalCalibrationSample[] = [];
  for (const item of calBuilt) {
    const outComplet = computeEffortScore(item.record.input);
    const socleInput = maskCompletToSocle(item.record.input, item.priorPackKg);
    const outSocle = computeEffortScore(socleInput);
    const historyBucket = historyBucketFromCount(item.historyCount);

    calConformalSamples.push({
      dataLevel: 'complet',
      historyBucket,
      routeType: item.routeType,
      predicted: outComplet.erp,
      observed: item.record.observedScore,
    });
    calConformalSamples.push({
      dataLevel: 'socle',
      historyBucket,
      routeType: item.routeType,
      predicted: outSocle.erp,
      observed: item.record.observedScore,
    });
  }

  const calibrator = fitConformalCalibrator(calConformalSamples, {
    alphaLow: 0.10,
    alphaHigh: 0.10,
    minCellSamples: 12,
  });

  // 3. Évaluation contrefactuelle `complet` vs `socle` sur le split d'évaluation étanche
  const evalConformalSamples: ConformalCalibrationSample[] = [];
  let biasSum = 0;

  for (const item of evalBuilt) {
    const outComplet = computeEffortScore(item.record.input);
    const socleInput = maskCompletToSocle(item.record.input, item.priorPackKg);
    const outSocle = computeEffortScore(socleInput);
    const historyBucket = historyBucketFromCount(item.historyCount);

    // Biais contrefactuel sur le score de base (IEA/ERP sans biais de fatigue personnelle)
    biasSum += outSocle.iea - outComplet.iea;

    evalConformalSamples.push({
      dataLevel: 'complet',
      historyBucket,
      routeType: item.routeType,
      predicted: outComplet.erp,
      observed: item.record.observedScore,
    });
    evalConformalSamples.push({
      dataLevel: 'socle',
      historyBucket,
      routeType: item.routeType,
      predicted: outSocle.erp,
      observed: item.record.observedScore,
    });
  }

  const counterfactualMeanBiasPts = Number((biasSum / N_EVAL).toFixed(4));
  const counterfactualAbsBiasPts = Math.abs(counterfactualMeanBiasPts);

  const coverage = evaluateConformalCoverage(calibrator, evalConformalSamples);
  const socleCoverage = coverage.byDataLevel.socle.p90Coverage;

  // 4. Ablations & backtest temporel (forecast vs retrospective)
  const evalRecords = evalBuilt.map((b) => b.record);
  const temporal = evaluateTemporalEffortBacktest(evalRecords);
  const ablations = runEffortAblations(evalRecords);

  // 5. Contrôles D-13 et rollback
  const d13Block = evaluateCollectivePublishGate({
    distinctUsers: MIN_DISTINCT_USERS - 1,
    confidenceScore: MIN_PUBLISH_CONFIDENCE,
  });
  const d13Pass = evaluateCollectivePublishGate({
    distinctUsers: MIN_DISTINCT_USERS,
    confidenceScore: MIN_PUBLISH_CONFIDENCE,
  });
  const rollbackOff = resolveEffortShadowRollout({ effort_score_v1_shadow: false });

  const failures: string[] = [];
  if (!leakage.isLeakFree) {
    failures.push('Fuite détectée entre le split calibration et le split évaluation.');
  }
  if (counterfactualAbsBiasPts >= 2.0) {
    failures.push(
      `Biais contrefactuel |E[S_socle - S_complet]| = ${counterfactualAbsBiasPts.toFixed(3)} pts >= 2 pts.`
    );
  }
  if (coverage.p90Coverage < CONFORMAL_MIN_P90_COVERAGE) {
    failures.push(
      `Couverture conforme P90 globale insuffisante (${coverage.p90Coverage} < ${CONFORMAL_MIN_P90_COVERAGE}).`
    );
  }
  if (socleCoverage < CONFORMAL_MIN_P90_COVERAGE) {
    failures.push(
      `Couverture conforme P90 socle insuffisante (${socleCoverage} < ${CONFORMAL_MIN_P90_COVERAGE}).`
    );
  }
  if (coverage.p90DeviationPts > CONFORMAL_MAX_NOMINAL_DEVIATION_PTS) {
    failures.push(
      `Écart P90 au nominal trop élevé (${coverage.p90DeviationPts} pts > ${CONFORMAL_MAX_NOMINAL_DEVIATION_PTS} pts).`
    );
  }
  if (d13Block.allowed || !d13Pass.allowed) {
    failures.push('Contrôle des seuils collectifs D-13 (MIN_DISTINCT_USERS=5, MIN_PUBLISH_CONFIDENCE=0.5) invalide.');
  }
  if (rollbackOff.writesEffortShadowRows || rollbackOff.requiresDestructiveMigrationForRollback) {
    failures.push('Rollback non destructif via effort_score_v1_shadow=false non garanti.');
  }

  return {
    passed: failures.length === 0,
    leakageFree: leakage.isLeakFree,
    counterfactualMeanBiasPts,
    counterfactualAbsBiasPts,
    conformalP90Coverage: coverage.p90Coverage,
    conformalIntervalCoverage: coverage.intervalCoverage,
    conformalP90DeviationPts: coverage.p90DeviationPts,
    conformalIntervalDeviationPts: coverage.intervalDeviationPts,
    socleConformalP90Coverage: socleCoverage,
    ablations,
    temporal,
    failures,
  };
}

const isCli =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const result = runEffortFairnessAudit();
  console.log('=== AUDIT D’ÉQUITÉ CONTREFACTUEL & CALIBRATION CONFORME (effort-score-v1) ===');
  console.log(`Étanchéité des splits (train/cal vs eval) : ${result.leakageFree ? 'OK (0 fuite)' : 'ÉCHEC'}`);
  console.log(
    `Biais contrefactuel |E[S_socle - S_complet]| : ${result.counterfactualAbsBiasPts.toFixed(4)} pts (seuil < 2.0 pts)`
  );
  console.log(
    `Couverture conforme P90 globale : ${(result.conformalP90Coverage * 100).toFixed(2)} % (écart nominal ${result.conformalP90DeviationPts.toFixed(2)} pts, cible >= 85 % et ±3 pts)`
  );
  console.log(
    `Couverture conforme P90 socle : ${(result.socleConformalP90Coverage * 100).toFixed(2)} %`
  );
  console.log(
    `Backtest temporel : forecast MAE=${result.temporal.forecast.mae} | retrospective MAE=${result.temporal.retrospective.mae}`
  );
  console.log(
    `Ablations (MAE) : full=${result.ablations.variants.full.mae}, no_weather=${result.ablations.variants.no_weather.mae}, no_pack=${result.ablations.variants.no_pack.mae}, no_fatigue=${result.ablations.variants.no_fatigue.mae}, no_cardio=${result.ablations.variants.no_cardio.mae}`
  );

  if (!result.passed) {
    for (const f of result.failures) {
      console.error(`✗ ${f}`);
    }
    process.exit(1);
  }
  console.log('✓ AUDIT ÉQUITÉ & CONFORMAL : TOUS LES INVARIANTS SONT VALIDÉS.');
  process.exit(0);
}
