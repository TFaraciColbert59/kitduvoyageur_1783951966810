import { describe, expect, it } from 'vitest';
import {
  assertNoSplitLeakage,
  evaluateTemporalEffortBacktest,
  runEffortAblations,
} from '../backtesting';
import {
  CONFORMAL_MAX_NOMINAL_DEVIATION_PTS,
  CONFORMAL_MIN_P90_COVERAGE,
  evaluateConformalCoverage,
  fitConformalCalibrator,
  historyBucketFromCount,
  predictConformalInterval,
  resolveConformalCell,
  type ConformalCalibrationSample,
} from '../conformalCalibration';
import {
  ALL_SHADOW_FLAGS,
  EFFORT_SHADOW_FLAGS,
  MIN_DISTINCT_USERS,
  MIN_PUBLISH_CONFIDENCE,
  SHADOW_FLAGS,
  evaluateCollectivePublishGate,
  resolveEffortShadowRollout,
} from '../shadowMode';
import { runEffortFairnessAudit } from '../../../../../scripts/verify/effort_fairness_audit';

describe('LOT P6 — Backtest, Calibration conforme, Audit d’équité & Rollback Shadow', () => {
  describe('1. Étanchéité temporelle (assertNoSplitLeakage)', () => {
    it('valide un split sans fuite et détecte toute fuite user / route / group / season / chronologie', () => {
      const cal = [
        {
          userId: 'u-1',
          routeId: 'r-1',
          groupId: 'g-1',
          season: '2026-spring',
          occurredAt: '2026-04-10T08:00:00.000Z',
        },
      ];
      const evalClean = [
        {
          userId: 'u-2',
          routeId: 'r-2',
          groupId: 'g-2',
          season: '2026-autumn',
          occurredAt: '2026-10-10T08:00:00.000Z',
        },
      ];

      const clean = assertNoSplitLeakage(cal, evalClean, {
        requireStrictChronology: true,
        throwOnLeak: true,
      });
      expect(clean.isLeakFree).toBe(true);

      const leaky = assertNoSplitLeakage(
        cal,
        [
          {
            userId: 'u-1',
            routeId: 'r-1',
            groupId: 'g-1',
            season: '2026-spring',
            occurredAt: '2026-03-01T08:00:00.000Z',
          },
        ],
        { requireStrictChronology: true }
      );
      expect(leaky.isLeakFree).toBe(false);
      expect(leaky.overlappingUsers).toContain('u-1');
      expect(leaky.overlappingRoutes).toContain('r-1');
      expect(leaky.overlappingGroups).toContain('g-1');
      expect(leaky.overlappingSeasons).toContain('2026-spring');
      expect(leaky.temporalOrderViolations).toBe(1);
    });
  });

  describe('2. Calibration conforme asymétrique par case & repli hiérarchique', () => {
    it('calcule des quantiles asymétriques [qLow, qHigh] par case avec repli hiérarchique propre', () => {
      expect(historyBucketFromCount(0)).toBe('0');
      expect(historyBucketFromCount(3)).toBe('1-4');
      expect(historyBucketFromCount(12)).toBe('5-19');
      expect(historyBucketFromCount(25)).toBe('20+');

      const calSamples: ConformalCalibrationSample[] = [];
      for (let i = 0; i < 60; i += 1) {
        const resid = ((i % 20) - 10) * 0.6;
        calSamples.push({
          dataLevel: 'socle',
          historyBucket: '0',
          routeType: 'mountain',
          predicted: 40,
          observed: 40 + resid,
        });
      }

      const calibrator = fitConformalCalibrator(calSamples, {
        alphaLow: 0.10,
        alphaHigh: 0.10,
        minCellSamples: 12,
      });

      const exactCell = resolveConformalCell(calibrator, {
        dataLevel: 'socle',
        historyBucket: '0',
        routeType: 'mountain',
      });
      expect(exactCell.fallbackLevel).toBe('exact');

      // RouteType jamais vu -> repli sur dataLevel × historyBucket
      const fallbackLH = resolveConformalCell(calibrator, {
        dataLevel: 'socle',
        historyBucket: '0',
        routeType: 'glacier',
      });
      expect(fallbackLH.fallbackLevel).toBe('dataLevel_history');

      // DataLevel jamais vu -> repli global
      const fallbackGlobal = resolveConformalCell(calibrator, {
        dataLevel: 'complet',
        historyBucket: '20+',
        routeType: 'alpine',
      });
      expect(fallbackGlobal.fallbackLevel).toBe('global');

      const { interval } = predictConformalInterval(calibrator, 42, {
        dataLevel: 'socle',
        historyBucket: '0',
        routeType: 'mountain',
      });
      expect(interval.p10).toBeLessThanOrEqual(interval.p50);
      expect(interval.p50).toBeLessThanOrEqual(interval.p90);

      const cov = evaluateConformalCoverage(calibrator, calSamples);
      expect(cov.p90Coverage).toBeGreaterThanOrEqual(CONFORMAL_MIN_P90_COVERAGE);
    });
  });

  describe('3. Audit d’équité contrefactuel, ablations & couverture P90 ±3 pts du nominal', () => {
    it('valide l’audit complet (biais |E[S_socle - S_complet]| < 2 pts, couverture P90 >= 0.85 à ±3 pts, ablations & forecast/retrospective)', () => {
      const audit = runEffortFairnessAudit(20261120);

      expect(audit.passed).toBe(true);
      expect(audit.leakageFree).toBe(true);
      expect(audit.counterfactualAbsBiasPts).toBeLessThan(2.0);
      expect(audit.conformalP90Coverage).toBeGreaterThanOrEqual(CONFORMAL_MIN_P90_COVERAGE);
      expect(audit.socleConformalP90Coverage).toBeGreaterThanOrEqual(CONFORMAL_MIN_P90_COVERAGE);
      expect(audit.conformalP90DeviationPts).toBeLessThanOrEqual(
        CONFORMAL_MAX_NOMINAL_DEVIATION_PTS
      );

      // Pipelines forecast et retrospective évalués séparément
      expect(audit.temporal.forecast.sampleCount).toBeGreaterThan(0);
      expect(audit.temporal.retrospective.sampleCount).toBeGreaterThan(0);

      // Ablations automatisées présentes
      expect(audit.ablations.variants.full.sampleCount).toBeGreaterThan(0);
      expect(audit.ablations.variants.no_weather.mae).toBeGreaterThan(0);
      expect(audit.ablations.variants.no_pack.mae).toBeGreaterThan(0);
      expect(audit.ablations.variants.no_fatigue.mae).toBeGreaterThan(0);
      expect(audit.ablations.variants.no_cardio.mae).toBeGreaterThan(0);

      // Vérifie que evaluateTemporalEffortBacktest et runEffortAblations gèrent les listes vides sans NaN
      const emptyTemp = evaluateTemporalEffortBacktest([]);
      expect(emptyTemp.forecast.mae).toBe(0);
      expect(emptyTemp.retrospective.mae).toBe(0);
      const emptyAbl = runEffortAblations([]);
      expect(emptyAbl.variants.full.mae).toBe(0);
    });
  });

  describe('4. Seuils collectifs D-13 & preuve de rollback non destructif (shadowMode.ts)', () => {
    it('applique MIN_DISTINCT_USERS = 5 et MIN_PUBLISH_CONFIDENCE = 0.5 et prouve le rollback sans migration destructive', () => {
      expect(MIN_DISTINCT_USERS).toBe(5);
      expect(MIN_PUBLISH_CONFIDENCE).toBe(0.5);

      expect(EFFORT_SHADOW_FLAGS).toEqual([
        'effort_score_v1_shadow',
        'group_prediction_v2_shadow',
      ]);
      expect(ALL_SHADOW_FLAGS).toEqual([...SHADOW_FLAGS, ...EFFORT_SHADOW_FLAGS]);

      expect(
        evaluateCollectivePublishGate({ distinctUsers: 4, confidenceScore: 0.8 }).allowed
      ).toBe(false);
      expect(
        evaluateCollectivePublishGate({ distinctUsers: 5, confidenceScore: 0.49 }).allowed
      ).toBe(false);
      expect(
        evaluateCollectivePublishGate({ distinctUsers: 5, confidenceScore: 0.5 }).allowed
      ).toBe(true);

      // Preuve de rollback : bascule effort_score_v1_shadow = false => noop instantané sans migration destructive
      const rolledBack = resolveEffortShadowRollout({
        effort_score_v1_shadow: false,
        group_prediction_v2_shadow: false,
      });
      expect(rolledBack.activePrimaryEngine).toBe('a3-legacy');
      expect(rolledBack.effortShadowEnabled).toBe(false);
      expect(rolledBack.writesEffortShadowRows).toBe(false);
      expect(rolledBack.requiresDestructiveMigrationForRollback).toBe(false);
      expect(rolledBack.rollbackMode).toBe('flag_off_instant_noop');

      // Mode shadow actif : n'affecte jamais le moteur primaire utilisateur
      const shadowActive = resolveEffortShadowRollout({
        effort_score_v1_shadow: true,
        group_prediction_v2_shadow: true,
      });
      expect(shadowActive.activePrimaryEngine).toBe('a3-legacy');
      expect(shadowActive.effortShadowEnabled).toBe(true);
      expect(shadowActive.writesEffortShadowRows).toBe(true);
      expect(shadowActive.requiresDestructiveMigrationForRollback).toBe(false);
    });
  });
});
