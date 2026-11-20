import { describe, expect, it } from 'vitest';
import {
  EffortScoreInputSchema,
  EffortScoreOutputSchema,
  EffortSegmentInputSchema,
  computePandolfSnowEta,
  computeSnapshotHash,
  type EffortScoreInput,
} from '../../schemas/effort.schema';
import {
  EFFORT_SCORE_VERSION,
  buildFallbackSegmentsFromPositionsTimed,
  computeBackpackLoadFactor,
  computeEffortScore,
  computePeronnetHypoxiaFactor,
  computePughWindDragW,
  computeSnapshotHashSync,
  resolveSurfaceEta,
  type EffortScoreExtendedInput,
} from '../effortScore';
import {
  EFFORT_SCORE_ENGINE_ID,
  EngineRegistry,
  registerEffortScoreEngine,
} from '../engineRegistry';
import { computeFatigue, computeMultiplicativeFatigue } from '../fatigue';

const BASE_SNAPSHOT = {
  modelVersion: EFFORT_SCORE_VERSION,
  profileVersion: 'prof-v1',
  routeFeatureVersion: 'route-v1',
  equipmentSnapshot: 'standard-pack',
  contextSnapshot: 'daylight-spring',
  scenario: 'nominal',
};

function makeSpringFlat15kmInput(
  overrides: Partial<EffortScoreExtendedInput> = {}
): EffortScoreExtendedInput {
  const distanceM = 15_000;
  const speedMs = 1.35;
  const durationS = distanceM / speedMs;

  return {
    segments: [
      {
        segmentId: 1,
        distanceM,
        durationS,
        speedMs,
        gradePct: 0,
        gradeDec: 0,
        gainM: 0,
        lossM: 0,
        altitudeM: 0,
        surface: 'asphalt',
        snowSinkCm: 0,
        technicalClass: 1,
        exposureClass: 0,
        isolationClass: 0,
        outOfDomain: false,
        isRegroupPoint: false,
      },
    ],
    weather: {
      tempC: 15,
      windMs: 1,
      humidityPct: 50,
      precipMmPerH: 0,
      solarRadiationWm2: 200,
    },
    ground: {
      surface: 'asphalt',
      snowSinkCm: 0,
      wetness: 0,
    },
    pack: {
      packWeightKg: 3,
    },
    physiology: {
      weightKg: 75,
      vo2MaxMlKgMin: 48,
    },
    dataLevel: 'socle',
    snapshot: { ...BASE_SNAPSHOT },
    evidence: [
      {
        value: 15,
        unit: '°C',
        source: 'met-norway',
        kind: 'measured',
        quality: 0.9,
        capturedAt: '2026-11-20T12:00:00.000Z',
        licenceSnapshot: 'CC BY 4.0',
      },
    ],
    ...overrides,
  };
}

describe('LOT P1 — Moteur bioénergétique pur d’effort et de fatigue (effort-score-v1)', () => {
  describe('Vecteurs de test dorés (Golden Tests)', () => {
    it('Golden Test 1 (Printemps plat 15 km) : 75 kg, VO2max 48, 3 kg sac, bitume eta=1.0, 15 °C, vent face 1 m/s, jour, 1.35 m/s => puissance ~345–355 W, score IEA entre 13 % et 19 %', () => {
      const input = makeSpringFlat15kmInput();
      expect(EffortScoreInputSchema.safeParse(input).success).toBe(true);

      const result = computeEffortScore(input);

      // Puissance métabolique effective moyenne ~345–355 W
      expect(result.mEffW).toBeGreaterThanOrEqual(345);
      expect(result.mEffW).toBeLessThanOrEqual(355);
      expect(result.meanPowerW).toBeCloseTo(result.mEffW, 6);

      // Capacité aérobie de référence au niveau de la mer : (48 * 75 / 1000) * 335 = 1206 W
      expect(result.pVo2MaxSeaW).toBeCloseTo(1206, 4);

      // Score IEA entre 13 % et 19 %
      expect(result.iea).toBeGreaterThanOrEqual(13);
      expect(result.iea).toBeLessThanOrEqual(19);

      // Conformité au contrat Zod EffortScoreOutputSchema
      const parsedOutput = EffortScoreOutputSchema.safeParse(result);
      expect(parsedOutput.success).toBe(true);
    });

    it('Golden Test 2 (Hiver rigoureux même 15 km plat) : 15 cm neige (eta=2.53 Pandolf 76), -8 °C, vent face 12 m/s, sac 18 kg, bottes + couches + crépuscule, 0.95 m/s => puissance > 800 W, score IEA entre 75 % et 90 %', () => {
      const distanceM = 15_000;
      const speedMs = 0.95;
      const durationS = distanceM / speedMs;

      const etaSnow = computePandolfSnowEta(15);
      expect(etaSnow).toBeCloseTo(2.53, 5);

      const winterInput = makeSpringFlat15kmInput({
        segments: [
          {
            segmentId: 1,
            distanceM,
            durationS,
            speedMs,
            gradePct: 0,
            gradeDec: 0,
            gainM: 0,
            lossM: 0,
            altitudeM: 0,
            surface: 'snow',
            snowSinkCm: 15,
            technicalClass: 1,
            exposureClass: 0,
            isolationClass: 0,
            outOfDomain: false,
            isRegroupPoint: false,
          },
        ],
        weather: {
          tempC: -8,
          windMs: 12,
          humidityPct: 75,
          precipMmPerH: 0,
        },
        ground: {
          surface: 'snow',
          snowSinkCm: 15,
          wetness: 0.3,
        },
        pack: {
          packWeightKg: 18,
          footwearWeightKg: 1.6,
        },
        clothingLayers: 3,
        clothingWeightKg: 2.4,
        isNight: true,
        windHeadMs: 12,
        snapshot: {
          ...BASE_SNAPSHOT,
          equipmentSnapshot: 'winter-boots-3-layers-18kg',
          contextSnapshot: 'winter-twilight-snow-15cm',
          scenario: 'winter-rigorous',
        },
      });

      const result = computeEffortScore(winterInput);

      // Facteur terrain Pandolf 1976 = 2.53
      expect(result.multipliers.terrainEta).toBeCloseTo(2.53, 4);

      // Puissance métabolique effective > 800 W
      expect(result.mEffW).toBeGreaterThan(800);

      // Score IEA compris entre 75 % et 90 %
      expect(result.iea).toBeGreaterThanOrEqual(75);
      expect(result.iea).toBeLessThanOrEqual(90);

      // Conformité au contrat Zod EffortScoreOutputSchema
      expect(EffortScoreOutputSchema.safeParse(result).success).toBe(true);
    });
  });

  describe('Tests de propriété (Monotonie, Bornes, Équité, Shapley exact & Sécurité)', () => {
    it('Propriété 1 (Monotonie) : ajouter du poids au sac, du vent de face, de la neige ou de la chaleur ne diminue jamais mEffW ni IEA', () => {
      const base = makeSpringFlat15kmInput();
      const baseRes = computeEffortScore(base);

      // 1a. Monotonie sur le poids du sac (0 -> 5 -> 12 -> 25 -> 40 kg)
      let prevPackRes = computeEffortScore(
        makeSpringFlat15kmInput({ pack: { packWeightKg: 0 } })
      );
      for (const packKg of [3, 8, 15, 25, 40]) {
        const cur = computeEffortScore(
          makeSpringFlat15kmInput({ pack: { packWeightKg: packKg } })
        );
        expect(cur.mEffW).toBeGreaterThanOrEqual(prevPackRes.mEffW);
        expect(cur.iea).toBeGreaterThanOrEqual(prevPackRes.iea);
        prevPackRes = cur;
      }

      // 1b. Monotonie sur le vent de face (0 -> 2 -> 6 -> 12 -> 20 m/s)
      let prevWindRes = computeEffortScore(
        makeSpringFlat15kmInput({
          weather: { ...base.weather, windMs: 0 },
          windHeadMs: 0,
        })
      );
      for (const windMs of [1, 4, 8, 14, 20]) {
        const cur = computeEffortScore(
          makeSpringFlat15kmInput({
            weather: { ...base.weather, windMs },
            windHeadMs: windMs,
          })
        );
        expect(cur.mEffW).toBeGreaterThanOrEqual(prevWindRes.mEffW);
        expect(cur.iea).toBeGreaterThanOrEqual(prevWindRes.iea);
        prevWindRes = cur;
      }

      // 1c. Monotonie sur l'enfoncement neige (0 -> 5 -> 15 -> 30 -> 50 cm)
      let prevSnowRes = baseRes;
      for (const snowCm of [5, 12, 22, 35, 50]) {
        const cur = computeEffortScore(
          makeSpringFlat15kmInput({
            segments: [{ ...base.segments[0], snowSinkCm: snowCm, surface: 'snow' }],
            ground: { ...base.ground, snowSinkCm: snowCm, surface: 'snow' },
          })
        );
        expect(cur.mEffW).toBeGreaterThanOrEqual(prevSnowRes.mEffW);
        expect(cur.iea).toBeGreaterThanOrEqual(prevSnowRes.iea);
        prevSnowRes = cur;
      }

      // 1d. Monotonie sur l'ajout de chaleur (-15 -> 0 -> 15 -> 25 -> 35 -> 42 °C)
      let prevHeatRes = computeEffortScore(
        makeSpringFlat15kmInput({
          weather: { ...base.weather, tempC: -15 },
        })
      );
      for (const tempC of [-5, 5, 15, 22, 30, 38, 45]) {
        const cur = computeEffortScore(
          makeSpringFlat15kmInput({
            weather: { ...base.weather, tempC },
          })
        );
        expect(cur.mEffW).toBeGreaterThanOrEqual(prevHeatRes.mEffW);
        expect(cur.iea).toBeGreaterThanOrEqual(prevHeatRes.iea);
        prevHeatRes = cur;
      }
    });

    it('Propriété 2 (Bornes & Finitude) : le score ne contient jamais NaN, Infinity, ni valeur hors [0, 100]', () => {
      const scenarios: EffortScoreExtendedInput[] = [
        makeSpringFlat15kmInput({
          segments: [
            {
              ...makeSpringFlat15kmInput().segments[0],
              distanceM: 100,
              durationS: 80,
              speedMs: 1.25,
            },
          ],
          pack: { packWeightKg: 0 },
        }),
        makeSpringFlat15kmInput({
          segments: [
            {
              ...makeSpringFlat15kmInput().segments[0],
              distanceM: 60_000,
              durationS: 50_000,
              speedMs: 1.2,
              gradePct: 28,
              gradeDec: 0.28,
              gainM: 4500,
              altitudeM: 5200,
              snowSinkCm: 65,
              technicalClass: 5,
            },
          ],
          weather: { tempC: 42, windMs: 28, humidityPct: 90, precipMmPerH: 15 },
          ground: { surface: 'sand', snowSinkCm: 65, wetness: 1 },
          pack: { packWeightKg: 50, footwearWeightKg: 2.5 },
        }),
        makeSpringFlat15kmInput({
          segments: [
            {
              ...makeSpringFlat15kmInput().segments[0],
              gradePct: -35,
              gradeDec: -0.35,
              lossM: 2500,
              altitudeM: 3800,
            },
          ],
          weather: { tempC: -35, windMs: 30, precipMmPerH: 0 },
          windHeadMs: -25, // fort vent arrière
        }),
      ];

      for (const scenario of scenarios) {
        const res = computeEffortScore(scenario);
        for (const num of [
          res.iea,
          res.erp,
          res.interval.p10,
          res.interval.p50,
          res.interval.p90,
          res.risque.score,
        ]) {
          expect(Number.isFinite(num)).toBe(true);
          expect(Number.isNaN(num)).toBe(false);
          expect(num).toBeGreaterThanOrEqual(0);
          expect(num).toBeLessThanOrEqual(100);
        }
        expect(Number.isFinite(res.mEffW)).toBe(true);
        expect(Number.isFinite(res.rawDose)).toBe(true);
        expect(Number.isFinite(res.eFlatKm)).toBe(true);
        expect(res.interval.p10).toBeLessThanOrEqual(res.interval.p50);
        expect(res.interval.p50).toBeLessThanOrEqual(res.interval.p90);
        expect(EffortScoreOutputSchema.safeParse(res).success).toBe(true);
      }
    });

    it('Propriété 3 (Équité complet vs socle) : à effort identique sans biais réel, passer de complet à socle garde le même score espéré et élargit uniquement [p10, p90]', () => {
      const baseSocle = makeSpringFlat15kmInput({
        dataLevel: 'socle',
        physiology: {
          weightKg: 75,
          vo2MaxMlKgMin: 48,
          hrRest: 55,
          hrMax: 185,
        },
      });
      const resSocle = computeEffortScore(baseSocle);

      // Fréquence cardiaque observée sans biais (iObs === iMod)
      const unbiasedHrBpm = 55 + resSocle.iMod * (185 - 55);

      const resCardio = computeEffortScore({
        ...baseSocle,
        dataLevel: 'cardio',
        observations: {
          avgHeartRateBpm: unbiasedHrBpm,
          hrCoverageRatio: 0.9,
        },
      });

      const resComplet = computeEffortScore({
        ...baseSocle,
        dataLevel: 'complet',
        observations: {
          avgHeartRateBpm: unbiasedHrBpm,
          hrCoverageRatio: 0.95,
          sessionRpe: 4,
        },
      });

      // Même score espéré (aucune pénalité sur la valeur centrale en socle)
      expect(resSocle.iea).toBeCloseTo(resComplet.iea, 10);
      expect(resSocle.erp).toBeCloseTo(resComplet.erp, 10);
      expect(resSocle.interval.p50).toBeCloseTo(resComplet.interval.p50, 10);
      expect(resCardio.iea).toBeCloseTo(resComplet.iea, 10);

      // Élargissement strict de [p10, p90] : complet < cardio < socle
      const widthComplet = resComplet.interval.p90 - resComplet.interval.p10;
      const widthCardio = resCardio.interval.p90 - resCardio.interval.p10;
      const widthSocle = resSocle.interval.p90 - resSocle.interval.p10;

      expect(widthSocle).toBeGreaterThan(widthCardio);
      expect(widthCardio).toBeGreaterThan(widthComplet);
      expect(resSocle.interval.p10).toBeLessThan(resComplet.interval.p10);
      expect(resSocle.interval.p90).toBeGreaterThan(resComplet.interval.p90);
    });

    it('Propriété 4 (Additivité exacte de Shapley) : la somme des K=6 valeurs de Shapley égale exactement IEA - IEA_baseline à 10^-6 près', () => {
      const complexInput = makeSpringFlat15kmInput({
        segments: [
          {
            segmentId: 1,
            distanceM: 8000,
            durationS: 7200,
            speedMs: 8000 / 7200,
            gradePct: 12,
            gradeDec: 0.12,
            gainM: 960,
            lossM: 0,
            altitudeM: 2400,
            surface: 'rock',
            snowSinkCm: 8,
            technicalClass: 3,
            exposureClass: 2,
            isolationClass: 2,
            outOfDomain: false,
            isRegroupPoint: false,
          },
          {
            segmentId: 2,
            distanceM: 7000,
            durationS: 5400,
            speedMs: 7000 / 5400,
            gradePct: -10,
            gradeDec: -0.1,
            gainM: 0,
            lossM: 700,
            altitudeM: 2100,
            surface: 'mud',
            snowSinkCm: 0,
            technicalClass: 2,
            exposureClass: 1,
            isolationClass: 2,
            outOfDomain: false,
            isRegroupPoint: false,
          },
        ],
        weather: {
          tempC: 24,
          windMs: 6,
          humidityPct: 70,
          precipMmPerH: 2,
        },
        ground: {
          surface: 'mud',
          snowSinkCm: 4,
          wetness: 0.7,
        },
        pack: {
          packWeightKg: 14,
          footwearWeightKg: 1.4,
        },
        clothingLayers: 2,
        isNight: true,
      });

      const res = computeEffortScore(complexInput);
      const { shapley } = res;

      const sum6Pillars =
        shapley.ascent +
        shapley.descent +
        shapley.packLoad +
        shapley.surfaceAndSnow +
        shapley.thermalAndWind +
        shapley.altitude;

      const expectedDelta = res.iea - res.ieaBaseline;

      expect(Math.abs(sum6Pillars - expectedDelta)).toBeLessThan(1e-6);
      expect(Math.abs(shapley.total - expectedDelta)).toBeLessThan(1e-6);
      expect(Math.abs(shapley.baseDistance + sum6Pillars - res.iea)).toBeLessThan(1e-6);

      // Chaque pilier actif sur ce parcours complexe apporte une contribution positive
      expect(shapley.ascent).toBeGreaterThan(0);
      expect(shapley.descent).toBeGreaterThan(0);
      expect(shapley.packLoad).toBeGreaterThan(0);
      expect(shapley.surfaceAndSnow).toBeGreaterThan(0);
      expect(shapley.thermalAndWind).toBeGreaterThan(0);
      expect(shapley.altitude).toBeGreaterThan(0);
    });

    it('Propriété 5 (Sécurité séparée sans bonus de danger) : augmenter un indicateur de danger (risque avalanche, manque de couches, exposition, verglas) ne majore jamais IEA à titre de récompense', () => {
      const safeInput = makeSpringFlat15kmInput({
        weather: { tempC: -2, windMs: 5, precipMmPerH: 0 },
        ground: { surface: 'dirt', snowSinkCm: 0, wetness: 0 },
        soilTempC: -2,
      });
      const safeRes = computeEffortScore(safeInput);

      const dangerousInput = makeSpringFlat15kmInput({
        segments: [
          {
            ...safeInput.segments[0],
            exposureClass: 5,
            isolationClass: 5,
          },
        ],
        weather: { tempC: -2, windMs: 5, precipMmPerH: 0 },
        ground: { surface: 'dirt', snowSinkCm: 0, wetness: 0.8 },
        soilTempC: -2,
        avalancheRiskIndex: 4,
        missingColdLayers: true,
        turnaroundMarginS: -1800,
      });
      const dangerousRes = computeEffortScore(dangerousInput);

      // L'IEA et mEffW ne sont JAMAIS majorés par les indicateurs de danger
      expect(dangerousRes.iea).toBeLessThanOrEqual(safeRes.iea + 1e-12);
      expect(dangerousRes.mEffW).toBeLessThanOrEqual(safeRes.mEffW + 1e-12);

      // En revanche, l'objet `risque` séparé capture fidèlement l'augmentation du danger
      expect(dangerousRes.risque.score).toBeGreaterThan(safeRes.risque.score);
      expect(dangerousRes.risque.factors.some((f) => f.includes('verglas'))).toBe(true);
      expect(dangerousRes.risque.factors.some((f) => f.includes('nivologie_bra'))).toBe(true);
      expect(
        dangerousRes.risque.factors.some((f) => f.includes('couches_isolantes_ireq'))
      ).toBe(true);

      // Absence totale de langage de diagnostic médical dans les facteurs de risque
      const joinedFactors = dangerousRes.risque.factors.join(' ').toLowerCase();
      for (const medicalWord of [
        'hypothermie',
        'hyperthermie',
        'gelure',
        'oedème',
        'œdème',
        'diagnostic',
        'pathologie',
        'clinique',
      ]) {
        expect(joinedFactors).not.toContain(medicalWord);
      }
    });
  });

  describe('Sous-systèmes bioénergétiques, double canal descente, fallback & registre', () => {
    it('Double canal en descente : les bâtons (hasPoles = true) atténuent de 25 % la pénalité excentrique du score sans altérer la dépense métabolique kJ', () => {
      const descentBase = makeSpringFlat15kmInput({
        segments: [
          {
            segmentId: 1,
            distanceM: 6000,
            durationS: 4800,
            speedMs: 1.25,
            gradePct: -15,
            gradeDec: -0.15,
            gainM: 0,
            lossM: 900,
            altitudeM: 1200,
            surface: 'dirt',
            snowSinkCm: 0,
            technicalClass: 2,
            exposureClass: 0,
            isolationClass: 0,
            outOfDomain: false,
            isRegroupPoint: false,
          },
        ],
        pack: { packWeightKg: 10 },
        hasPoles: false,
      });

      const withoutPoles = computeEffortScore(descentBase);
      const withPoles = computeEffortScore({ ...descentBase, hasPoles: true });

      // Atténuation exacte de 25 % sur le canal excentrique
      expect(withPoles.eccentricPenaltyW).toBeCloseTo(
        withoutPoles.eccentricPenaltyW * 0.75,
        6
      );
      expect(withPoles.iea).toBeLessThan(withoutPoles.iea);

      // Canal métabolique (LCDA kJ) strictement conservé
      expect(withPoles.metabolicEnergyKj).toBeCloseTo(
        withoutPoles.metabolicEnergyKj,
        6
      );
    });

    it('Filtre anti-surdéclaration & gilet (vest) : rétracte un sac surdéclaré si (iMod - iObs) > 2.5*sigma et applique le facteur linéaire pour carryType="vest"', () => {
      expect(computeBackpackLoadFactor(15, 75, 'vest')).toBeCloseTo(1 + 15 / 75, 6);
      expect(computeBackpackLoadFactor(15, 75, 'backpack')).toBeGreaterThan(
        computeBackpackLoadFactor(15, 75, 'vest')
      );

      const overdeclared = makeSpringFlat15kmInput({
        dataLevel: 'complet',
        pack: { packWeightKg: 35 },
        physiology: {
          weightKg: 75,
          vo2MaxMlKgMin: 48,
          hrRest: 55,
          hrMax: 185,
        },
        observations: {
          // FC très basse incohérente avec un sac de 35 kg
          avgHeartRateBpm: 72,
          hrCoverageRatio: 0.95,
        },
      });

      const res = computeEffortScore(overdeclared);
      expect(res.warnings.some((w) => w.code === 'low_confidence')).toBe(true);
      expect(res.iec).not.toBeNull();
      expect(res.iec!).toBeGreaterThan(1.5);
    });

    it('Hypoxie Péronnet 1991 & relais sigmoïde > 4 500 m + modulation boue / verglas + vent arrière Pugh', () => {
      const f0 = computePeronnetHypoxiaFactor(0);
      const f2500 = computePeronnetHypoxiaFactor(2500);
      const f4500 = computePeronnetHypoxiaFactor(4500);
      const f5500 = computePeronnetHypoxiaFactor(5500);

      expect(f0).toBe(1.0);
      expect(f2500).toBeLessThan(f0);
      expect(f4500).toBeLessThan(f2500);
      expect(f5500).toBeLessThan(f4500);
      expect(f5500).toBeGreaterThanOrEqual(0.25);

      // Sol non revêtu avec T_sol > 0 °C => modulation boue 1.50..1.80
      const mudWarm = resolveSurfaceEta('mud', 1.2, {
        api72h: 50,
        soilMoistureVwc: 0.4,
        soilTempC: 8,
      });
      expect(mudWarm.eta).toBeGreaterThan(1.5);
      expect(mudWarm.eta).toBeLessThanOrEqual(1.8);
      expect(mudWarm.verglas).toBe(false);

      // Sol avec T_sol <= 0 °C et humide => flag verglas
      const coldWet = resolveSurfaceEta('dirt', 1.2, {
        api72h: 40,
        soilMoistureVwc: 0.35,
        soilTempC: -3,
      });
      expect(coldWet.verglas).toBe(true);

      // Vent arrière fort (vRel < 0) => P_aero = 0 (jamais négatif)
      const tailwind = computePughWindDragW(1.2, -5, 75, 0, 15);
      expect(tailwind.fAeroN).toBeLessThan(0);
      expect(tailwind.pAeroW).toBe(0);
    });

    it('Parité exacte de computeSnapshotHashSync avec computeSnapshotHash (WebCrypto SHA-256)', async () => {
      const syncHash = computeSnapshotHashSync(BASE_SNAPSHOT);
      const asyncHash = await computeSnapshotHash(BASE_SNAPSHOT);
      expect(syncHash).toBe(asyncHash);
      expect(syncHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('buildFallbackSegmentsFromPositionsTimed segmente hike_sessions.positions_timed avec MNT et hystérésis 3 m', () => {
      const positionsTimed = [
        { lat: 45.9, lng: 6.86, elevationM: 1000, timestamp: '2026-11-20T08:00:00.000Z' },
        { lat: 45.901, lng: 6.861, elevationM: 1001.5, timestamp: '2026-11-20T08:02:00.000Z' }, // < 3m hystérésis
        { lat: 45.903, lng: 6.863, elevationM: 1025, timestamp: '2026-11-20T08:06:00.000Z' },
      ];

      const segments = buildFallbackSegmentsFromPositionsTimed(positionsTimed, {
        defaultSurface: 'dirt',
        hysteresisM: 3,
      });

      expect(segments.length).toBeGreaterThanOrEqual(1);
      for (const seg of segments) {
        expect(EffortSegmentInputSchema.safeParse(seg).success).toBe(true);
        expect(seg.surface).toBe('dirt');
      }
    });

    it('Extension multiplicative de fatigue.ts (effort-score-v1) et rétrocompatibilité a3-v1', () => {
      const legacy = computeFatigue({
        activeDurationS: 7200,
        gainM: 600,
        lossM: 400,
        packWeightKg: 8,
      });
      const mult = computeFatigue({
        activeDurationS: 7200,
        gainM: 600,
        lossM: 400,
        packWeightKg: 8,
        version: EFFORT_SCORE_VERSION,
      });
      const multWithPoles = computeMultiplicativeFatigue({
        activeDurationS: 7200,
        gainM: 600,
        lossM: 400,
        packWeightKg: 8,
        hasPoles: true,
      });

      expect(legacy.score).toBeGreaterThan(0);
      expect(mult.version).toBe(EFFORT_SCORE_VERSION);
      expect(mult.score).toBeGreaterThan(0);
      expect(mult.score).toBeLessThanOrEqual(100);
      expect(multWithPoles.score).toBeLessThan(mult.score);
    });

    it('Enregistrement et exécution de effort-score-v1 dans EngineRegistry', async () => {
      const registry = EngineRegistry.withEffortScoreV1();
      expect(registry.has(EFFORT_SCORE_ENGINE_ID)).toBe(true);
      registerEffortScoreEngine(registry); // idempotent

      const input: EffortScoreInput = makeSpringFlat15kmInput();
      const pipeline = await registry.runPipeline(
        { userId: '00000000-0000-4000-8000-000000000001', nowIso: '2026-11-20T12:00:00.000Z' },
        input,
        () => input
      );

      expect(pipeline.runs).toHaveLength(1);
      expect(pipeline.runs[0].engineId).toBe(EFFORT_SCORE_ENGINE_ID);
      expect(pipeline.runs[0].status).toBe('succeeded');
      expect(pipeline.outputs.has(EFFORT_SCORE_ENGINE_ID)).toBe(true);
    });
  });
});
