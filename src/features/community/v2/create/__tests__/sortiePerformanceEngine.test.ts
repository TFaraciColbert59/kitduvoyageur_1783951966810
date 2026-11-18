import { describe, expect, it } from 'vitest';
import {
  computeParticipantStatDensity,
  computeRouteDifficulty,
  estimateSortiePerformance,
  type ParticipantPerformanceStats,
} from '../sortie/sortiePerformanceEngine';

describe('sortiePerformanceEngine — calcul automatique durée, difficulté & densité statistique', () => {
  it('calcule automatiquement durée, difficulté (5 niveaux), KE et IBP selon la distance et le D+', () => {
    const veryEasy = estimateSortiePerformance({
      activity: 'rando',
      distanceKm: 3.5,
      elevationGainM: 120,
      nbJours: 1,
    });
    expect(veryEasy.recommendedLevel).toBe('tres_facile');
    expect(veryEasy.formattedDuration).toBeTruthy();

    const easy = estimateSortiePerformance({
      activity: 'rando',
      distanceKm: 7.5,
      elevationGainM: 380,
      nbJours: 1,
    });
    expect(easy.recommendedLevel).toBe('facile');

    const medium = estimateSortiePerformance({
      activity: 'rando',
      distanceKm: 12.5,
      elevationGainM: 750,
      nbJours: 1,
    });
    expect(medium.recommendedLevel).toBe('moyen');
    expect(medium.durationHoursP50).toBeGreaterThan(easy.durationHoursP50);

    const hard = estimateSortiePerformance({
      activity: 'rando',
      distanceKm: 17,
      elevationGainM: 1250,
      nbJours: 1,
    });
    expect(hard.recommendedLevel).toBe('difficile');

    const expert = computeRouteDifficulty(
      {
        activity: 'rando',
        distanceKm: 24,
        elevationGainM: 1850,
        maxAltitudeM: 3350,
        nbJours: 1,
      },
      9.5,
    );
    expect(expert.recommendedLevel).toBe('expert');
    expect(expert.ibpIndex).toBeGreaterThan(100);
  });

  it('augmente la densité statistique avec le nombre de sorties BDD et échantillons GPS', () => {
    const cold = computeParticipantStatDensity({ userId: 'u-cold' });
    const moderate = computeParticipantStatDensity({
      userId: 'u-mod',
      flatSpeedKmh: 4.4,
      ascentSpeedMPerH: 380,
      sampleCount: 4,
      recordedOutingsCount: 3,
      calibrationLevel: 'calibration',
      confidenceScore: 0.55,
    });
    const dense = computeParticipantStatDensity({
      userId: 'u-dense',
      flatSpeedKmh: 4.9,
      ascentSpeedMPerH: 460,
      descentSpeedMPerH: 620,
      packWeightKg: 7.5,
      experienceLevel: 'advanced',
      sampleCount: 28,
      recordedOutingsCount: 22,
      calibrationLevel: 'contextualization',
      confidenceScore: 0.94,
    });

    expect(cold.density).toBeLessThan(moderate.density);
    expect(moderate.density).toBeLessThan(dense.density);
    expect(dense.density).toBeGreaterThan(0.8);
  });

  it('fait évoluer la variable de temps selon la densité de stats de chaque participant qui rejoint la sortie', () => {
    const route = {
      activity: 'rando' as const,
      distanceKm: 14,
      elevationGainM: 900,
      elevationLossM: 900,
      maxAltitudeM: 2450,
      nbJours: 1,
      packWeightKg: 8,
    };

    // 1. Créateur seul à la création (profil rapide bien calibré)
    const creatorFast: ParticipantPerformanceStats = {
      userId: 'creator-1',
      flatSpeedKmh: 5.1,
      ascentSpeedMPerH: 480,
      descentSpeedMPerH: 650,
      experienceLevel: 'advanced',
      calibrationLevel: 'personalization',
      confidenceScore: 0.82,
      sampleCount: 15,
      recordedOutingsCount: 12,
    };

    const soloEst = estimateSortiePerformance(route, [creatorFast]);
    expect(soloEst.participantCount).toBe(1);
    expect(soloEst.groupDeltaMinutes).toBe(0);

    // 2. Deux participants supplémentaires rejoignent avec une forte densité statistique
    // et une allure montagne plus prudente (3.4 km/h, 290 m/h sur 25 sorties enregistrées)
    const participantSlowDense: ParticipantPerformanceStats = {
      userId: 'part-2',
      flatSpeedKmh: 3.4,
      ascentSpeedMPerH: 285,
      descentSpeedMPerH: 430,
      packWeightKg: 11,
      maxCarryKg: 12,
      experienceLevel: 'intermediate',
      calibrationLevel: 'contextualization',
      confidenceScore: 0.92,
      sampleCount: 26,
      recordedOutingsCount: 24,
    };
    const participantRegular: ParticipantPerformanceStats = {
      userId: 'part-3',
      flatSpeedKmh: 3.9,
      ascentSpeedMPerH: 330,
      descentSpeedMPerH: 490,
      experienceLevel: 'intermediate',
      calibrationLevel: 'personalization',
      confidenceScore: 0.76,
      sampleCount: 11,
      recordedOutingsCount: 9,
    };

    const groupEst = estimateSortiePerformance(route, [
      creatorFast,
      participantSlowDense,
      participantRegular,
    ]);

    expect(groupEst.participantCount).toBe(3);
    expect(groupEst.totalAnalyzedOutings).toBeGreaterThan(soloEst.totalAnalyzedOutings);
    expect(groupEst.collectiveStatDensity).toBeGreaterThan(soloEst.collectiveStatDensity);
    // La densité statistique élevée des nouveaux participants déplace le temps estimé à la hausse
    expect(groupEst.durationHoursP50).toBeGreaterThan(soloEst.durationHoursP50);
    expect(groupEst.groupDeltaMinutes).toBeGreaterThan(15);
  });

  it('gère les sorties sur plusieurs jours (J1..JN) avec répartition journalière et fatigue multi-jours', () => {
    const multiDayEst = estimateSortiePerformance({
      activity: 'rando',
      distanceKm: 32,
      elevationGainM: 2100,
      nbJours: 3,
      daysMetrics: [
        { dayNumber: 1, distanceKm: 11, elevationGainM: 800 },
        { dayNumber: 2, distanceKm: 12, elevationGainM: 850 },
        { dayNumber: 3, distanceKm: 9, elevationGainM: 450 },
      ],
    });

    expect(multiDayEst.formattedDuration).toContain('3 j ·');
    expect(multiDayEst.factors.perDayFormatted).toHaveLength(3);
    expect(multiDayEst.factors.fatiguePenaltyPct).toBeGreaterThan(0);
  });
});
