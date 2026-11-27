/**
 * Recommandation adaptative de sport, enveloppe d'effort, configuration
 * d'auto-pause (`autoPauseConfigForSport`) et densité du HUD (Adaptive HUD
 * Profile selon le score de charge cognitive).
 */

import { autoPauseConfigForSport } from '../activity/tracker';
import type { Sport } from '../state/types';
import type {
  ActivityPresetInput,
  ActivityPresetRecommendation,
  AdaptiveHudProfile,
  AdaptiveHudRecommendation,
  EffortEnvelope,
  ExplorerPresetId,
  TechnicalGrade,
} from './types';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sportToExplorerPreset(
  sport: Sport,
  hasHazards: boolean,
  isNight: boolean,
): ExplorerPresetId {
  if (hasHazards) return 'securite_risques';
  if (isNight && sport === 'bivouac') return 'bivouac_astro';
  switch (sport) {
    case 'trail':
    case 'course':
      return 'trail_run';
    case 'velo':
      return 'vtt_gravel';
    case 'kayak':
      return 'nautique';
    case 'bivouac':
      return 'bivouac_astro';
    case 'rando':
    case 'ski':
    case 'escalade':
    case 'famille':
    default:
      return 'rando_montagne';
  }
}

function pickRecommendedSport(input: ActivityPresetInput): {
  sport: Sport;
  rationaleFr: string;
} {
  const { readiness, preferredSport, recentSports, terrain, weather } = input;

  if (readiness.band === 'rehab_guarded' || (readiness.activeRehabPainLevel ?? 0) >= 7) {
    return {
      sport: 'famille',
      rationaleFr:
        'Douleur rééducation active : marche très douce et terrain plat privilégiés.',
    };
  }

  if (readiness.band === 'recover' || readiness.acwr.zone === 'spike') {
    const gentle: Sport = terrain === 'water' ? 'kayak' : 'famille';
    return {
      sport: gentle,
      rationaleFr:
        'Fatigue ou pic de charge récent : sortie de récupération active à faible impact.',
    };
  }

  if (terrain === 'water') {
    return { sport: 'kayak', rationaleFr: 'Secteur nautique détecté : activité eau & glisse.' };
  }
  if (terrain === 'snow' && (weather?.avalancheRiskLevel ?? 0) < 4) {
    return { sport: 'ski', rationaleFr: 'Conditions nivologiques compatibles : ski de randonnée.' };
  }

  if (preferredSport) {
    return {
      sport: preferredSport,
      rationaleFr:
        readiness.band === 'peak'
          ? 'Disponibilité optimale pour ton activité favorite.'
          : 'Activité alignée avec ta préférence et ton état de forme.',
    };
  }

  if (recentSports && recentSports.length > 0) {
    const freq = new Map<Sport, number>();
    for (const s of recentSports) {
      freq.set(s, (freq.get(s) ?? 0) + 1);
    }
    let topSport: Sport = recentSports[0];
    let topCount = 0;
    for (const [s, count] of freq.entries()) {
      if (count > topCount) {
        topSport = s;
        topCount = count;
      }
    }
    return {
      sport: topSport,
      rationaleFr: 'Sport habituel recommandé d’après tes sorties récentes.',
    };
  }

  if (terrain === 'mountain' || terrain === 'forest') {
    return {
      sport: readiness.band === 'peak' ? 'trail' : 'rando',
      rationaleFr:
        readiness.band === 'peak'
          ? 'Forme de pic en relief : sortie trail dynamique adaptée.'
          : 'Relief naturel : randonnée adaptée au terrain.',
    };
  }

  return {
    sport: 'rando',
    rationaleFr: 'Randonnée polyvalente recommandée par défaut en l’absence d’historique ciblé.',
  };
}

function buildEffortEnvelope(input: ActivityPresetInput): EffortEnvelope {
  const { readiness } = input;
  const band = readiness.band;

  if (band === 'rehab_guarded') {
    return {
      maxDurationMin: 40,
      maxElevationGainM: 100,
      targetRpeRange: [1, 3],
      labelFr: 'Rééducation protégée · 40 min max · RPE 1–3',
    };
  }
  if (band === 'recover' || readiness.acwr.zone === 'spike') {
    return {
      maxDurationMin: 60,
      maxElevationGainM: 250,
      targetRpeRange: [2, 4],
      labelFr: 'Récupération active · 1 h max · D+ ≤ 250 m',
    };
  }
  if (band === 'moderate') {
    return {
      maxDurationMin: 150,
      maxElevationGainM: 750,
      targetRpeRange: [4, 6],
      labelFr: 'Endurance modérée · 2 h 30 max · D+ ≤ 750 m',
    };
  }
  if (band === 'peak') {
    return {
      maxDurationMin: 360,
      maxElevationGainM: 1800,
      targetRpeRange: [6, 8],
      labelFr: 'Objectif engagé · jusqu’à 6 h · D+ ≤ 1 800 m',
    };
  }
  // 'ready' ou 'cold_start' (prudent sans historique)
  if (readiness.status === 'cold_start') {
    return {
      maxDurationMin: 150,
      maxElevationGainM: 600,
      targetRpeRange: [3, 5],
      labelFr: 'Calibration initiale · 2 h 30 max · D+ ≤ 600 m',
    };
  }
  return {
    maxDurationMin: 240,
    maxElevationGainM: 1200,
    targetRpeRange: [5, 7],
    labelFr: 'Sortie complète · 4 h max · D+ ≤ 1 200 m',
  };
}

function gradeCognitivePoints(grade: TechnicalGrade | null | undefined): number {
  switch (grade) {
    case 'T6':
      return 34;
    case 'T5':
      return 28;
    case 'T4':
      return 20;
    case 'T3':
      return 10;
    case 'T2':
      return 4;
    case 'T1':
    default:
      return 0;
  }
}

function computeAdaptiveHud(
  sport: Sport,
  input: ActivityPresetInput,
): AdaptiveHudRecommendation {
  const speedKmh = input.expectedSpeedKmh ?? (sport === 'velo' ? 24 : sport === 'ski' ? 28 : sport === 'trail' ? 10 : 4.5);
  const hazards = Math.max(0, input.activeHazardCount ?? 0);
  const isNight =
    input.isNight ??
    Boolean(
      input.daylight &&
        input.nowMs != null &&
        ((input.daylight.civilDuskMs != null && input.nowMs > input.daylight.civilDuskMs) ||
          (input.daylight.civilDawnMs != null && input.nowMs < input.daylight.civilDawnMs) ||
          input.daylight.status === 'polar_night'),
    );

  // Calcul du score de charge cognitive (0..100)
  let speedScore = 0;
  if (speedKmh >= 25) speedScore = 36;
  else if (speedKmh >= 18) speedScore = 26;
  else if (speedKmh >= 12) speedScore = 16;
  else if (speedKmh >= 7) speedScore = 8;

  const techScore =
    gradeCognitivePoints(input.technicalGrade) + (sport === 'escalade' ? 22 : 0);
  const hazardScore = Math.min(28, hazards * 14);
  const nightScore = isNight ? 16 : 0;
  const weatherStress =
    (input.weather?.thunderstormRisk === 'high' ? 14 : 0) +
    ((input.weather?.visibilityM ?? 10_000) < 200 ? 14 : 0) +
    ((input.weather?.windSpeedKmh ?? 0) >= 45 ? 10 : 0);
  const offlineScore = input.offline ? 6 : 0;
  const fatigueScore =
    input.readiness.score !== null && input.readiness.score < 45 ? 10 : 0;

  const cognitiveLoadScore = Math.round(
    clamp(
      speedScore + techScore + hazardScore + nightScore + weatherStress + offlineScore + fatigueScore,
      0,
      100,
    ),
  );

  // Sélection du profil HUD adaptatif
  let profile: AdaptiveHudProfile;
  if (speedKmh >= 22 || (sport === 'velo' && cognitiveLoadScore >= 32 && techScore < 20) || (sport === 'ski' && speedKmh >= 22)) {
    profile = 'minimal_high_speed';
  } else if (
    cognitiveLoadScore >= 52 ||
    techScore >= 20 ||
    hazards >= 2 ||
    (isNight && sport !== 'bivouac')
  ) {
    profile = 'tactical_technical';
  } else if (
    cognitiveLoadScore <= 22 &&
    (sport === 'bivouac' || sport === 'rando' || sport === 'famille')
  ) {
    profile = 'expedition_rich';
  } else {
    profile = 'standard';
  }

  switch (profile) {
    case 'minimal_high_speed':
      return {
        profile,
        cognitiveLoadScore,
        maxPrimaryMetrics: 2,
        showMiniProfile: false,
        showHazardBanner: hazards > 0,
        showCompass: false,
        labelFr: 'HUD Minimal haute vitesse',
        rationaleFr:
          'Allure rapide : affichage ultra-lisible limité à 2 métriques majeures pour garder les yeux sur le terrain.',
      };
    case 'tactical_technical':
      return {
        profile,
        cognitiveLoadScore,
        maxPrimaryMetrics: 3,
        showMiniProfile: true,
        showHazardBanner: true,
        showCompass: true,
        labelFr: 'HUD Tactique technique',
        rationaleFr:
          'Charge cognitive élevée (terrain technique, nuit ou aléas) : boussole, bandeau sécurité et 3 métriques clés.',
      };
    case 'expedition_rich':
      return {
        profile,
        cognitiveLoadScore,
        maxPrimaryMetrics: 5,
        showMiniProfile: true,
        showHazardBanner: hazards > 0,
        showCompass: true,
        labelFr: 'HUD Expédition enrichi',
        rationaleFr:
          'Rythme posé et environnement calme : profil altimétrique, boussole et 5 métriques détaillées.',
      };
    case 'standard':
    default:
      return {
        profile: 'standard',
        cognitiveLoadScore,
        maxPrimaryMetrics: 4,
        showMiniProfile: true,
        showHazardBanner: hazards > 0,
        showCompass: false,
        labelFr: 'HUD Standard équilibré',
        rationaleFr: 'Affichage équilibré à 4 métriques avec profil d’élévation compact.',
      };
  }
}

export function recommendActivityPreset(
  input: ActivityPresetInput,
): ActivityPresetRecommendation {
  const { sport, rationaleFr } = pickRecommendedSport(input);
  const autoPauseConfig = autoPauseConfigForSport(sport, input.autoPauseEnabled ?? true);
  const effortEnvelope = buildEffortEnvelope(input);
  const hud = computeAdaptiveHud(sport, input);

  const hasSevereHazard =
    (input.activeHazardCount ?? 0) >= 2 ||
    input.weather?.wildfireAlert === true ||
    input.weather?.thunderstormRisk === 'high';
  const isNight = Boolean(input.isNight);
  const presetId = sportToExplorerPreset(sport, hasSevereHazard, isNight);

  return {
    sport,
    presetId,
    autoPauseConfig,
    effortEnvelope,
    hud,
    rationaleFr,
  };
}
