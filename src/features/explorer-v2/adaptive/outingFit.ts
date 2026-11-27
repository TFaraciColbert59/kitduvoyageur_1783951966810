/**
 * Évaluation d'adéquation d'une sortie (Outing Fit) pour Explorer v2.
 *
 * Calcule 4 sous-scores (physiologique, technique, environnemental, équipement | null),
 * applique des vetos de sécurité stricts (plafonne `fitScore <= 25` et impose
 * `'not_recommended'`), produit des explications en français (`reasons[]`) et
 * liste les écarts de matériel actionnables (`gearDeltas[]`).
 */

import { computeEffectiveRidgeWind, computeThermalStress } from './environment';
import type {
  GearDelta,
  OutingFitInput,
  OutingFitResult,
  OutingFitVerdict,
  SafetyVetoCode,
  TechnicalGrade,
} from './types';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const GRADE_DIFFICULTY_RANK: Record<TechnicalGrade, number> = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
  T6: 6,
};

const EXPERIENCE_MAX_COMFORT_GRADE: Record<string, number> = {
  beginner: 2,
  intermediate: 3,
  advanced: 4,
  expert: 6,
};

export function scoreOutingFit(input: OutingFitInput): OutingFitResult {
  const { safeEta, readiness, weather, gear } = input;
  const maxAlt = Math.max(0, input.maxAltitudeM ?? 0);
  const reasons: string[] = [];
  const gearDeltas: GearDelta[] = [];
  const vetoes: SafetyVetoCode[] = [];

  // ── 1. Sous-score physiologique (0..100) ────────────────────────────────
  let physiological = readiness.score ?? 68;
  const ke = safeEta.effortScoreKe;
  const enduranceRef = readiness.aerobicEnduranceIndex ?? 50;
  // Capacité Ke de confort selon endurance aérobie (entre ~14 et ~38 Ke)
  const comfortKe = 12 + (enduranceRef / 100) * 26;

  if (ke > comfortKe) {
    const excessRatio = (ke - comfortKe) / Math.max(8, comfortKe);
    physiological -= Math.min(38, excessRatio * 42);
    reasons.push(
      `Effort physique estimé élevé (${ke} Ke) par rapport à ton endurance actuelle.`,
    );
  } else if (ke > 0) {
    physiological += 6;
    reasons.push(`Charge mécanique adaptée (${ke} Ke) à ton niveau d’endurance.`);
  }

  if (readiness.acwr.zone === 'spike') {
    physiological -= 22;
    reasons.push(
      `Pic de charge récent (ACWR ${readiness.acwr.dampedRatio}) : risque de surmenage accru.`,
    );
  } else if (readiness.acwr.zone === 'caution') {
    physiological -= 10;
  }

  if (readiness.eccentricDomsScore >= 55) {
    physiological -= 12;
    reasons.push('Fatigue musculaire excentrique résiduelle après les descentes récentes.');
  }

  if (safeEta.flags.includes('high_altitude_unacclimatized')) {
    physiological -= 18;
    reasons.push(
      `Altitude (${Math.round(maxAlt)} m) au-dessus de ton plafond acclimaté (${readiness.altitudeAcclimatization.ceilingM} m).`,
    );
  }

  if (readiness.activeRehabPainLevel !== null && readiness.activeRehabPainLevel >= 7) {
    vetoes.push('rehab_pain_high');
    physiological = Math.min(physiological, 15);
    reasons.push(
      `Veto sécurité : douleur rééducation déclarée à ${readiness.activeRehabPainLevel}/10.`,
    );
  } else if (readiness.activeRehabPainLevel !== null && readiness.activeRehabPainLevel >= 4) {
    physiological -= 22;
    reasons.push(
      `Douleur rééducation modérée (${readiness.activeRehabPainLevel}/10) : prudence recommandée.`,
    );
  }

  physiological = Math.round(clamp(physiological, 0, 100));

  // ── 2. Sous-score technique (0..100) ────────────────────────────────────
  let technical = 88;
  const gradeRank = input.technicalGrade ? GRADE_DIFFICULTY_RANK[input.technicalGrade] : 2;
  const userMaxGrade =
    input.userTechnicalExperience && input.userTechnicalExperience in EXPERIENCE_MAX_COMFORT_GRADE
      ? EXPERIENCE_MAX_COMFORT_GRADE[input.userTechnicalExperience]
      : 3;

  if (gradeRank > userMaxGrade) {
    const gap = gradeRank - userMaxGrade;
    technical -= gap * 24;
    reasons.push(
      `Cotation technique ${input.technicalGrade} supérieure à ton niveau habituel.`,
    );
  } else if (input.technicalGrade) {
    reasons.push(`Cotation ${input.technicalGrade} cohérente avec ton expérience terrain.`);
  }

  if (input.surface === 'ice' || input.surface === 'scree') {
    technical -= 12;
  } else if (input.surface === 'snow' || input.surface === 'rocky_alpine') {
    technical -= 6;
  }
  if (input.ridgeExposed && gradeRank >= 4) {
    technical -= 8;
  }
  technical = Math.round(clamp(technical, 0, 100));

  // ── 3. Sous-score environnemental (0..100) ──────────────────────────────
  let environmental = 92;
  const ridgeWind = computeEffectiveRidgeWind(
    weather?.windSpeedKmh ?? 0,
    maxAlt,
    Boolean(input.ridgeExposed),
    weather?.windGustKmh ?? null,
  );
  const thermal = computeThermalStress(weather, ridgeWind.effectiveWindKmh);

  if (ridgeWind.hazardLevel === 'storm') {
    environmental -= 55;
    vetoes.push('extreme_wind_storm');
    reasons.push(
      `Veto sécurité : rafales/vent tempétueux sur le secteur (${ridgeWind.effectiveWindKmh} km/h effectifs).`,
    );
  } else if (ridgeWind.hazardLevel === 'gale') {
    environmental -= 28;
    reasons.push(`Vent fort en altitude (${ridgeWind.effectiveWindKmh} km/h effectifs).`);
  } else if (ridgeWind.hazardLevel === 'strong') {
    environmental -= 12;
  }

  if (thermal.level === 'cold_extreme' || thermal.level === 'heat_extreme') {
    environmental -= 30;
    if (thermal.advisoryFr) reasons.push(thermal.advisoryFr);
  } else if (thermal.level === 'cold' || thermal.level === 'warm') {
    environmental -= 10;
  }

  if (weather?.thunderstormRisk === 'high') {
    environmental -= 45;
    if (input.ridgeExposed || maxAlt >= 1800) {
      vetoes.push('thunderstorm_ridge');
      reasons.push('Veto sécurité : risque d’orage fort sur relief ou crête exposée.');
    } else {
      reasons.push('Risque d’orage fort annoncé : reporter ou raccourcir la sortie.');
    }
  } else if (weather?.thunderstormRisk === 'moderate') {
    environmental -= 16;
    reasons.push('Risque orageux modéré : surveiller l’évolution et l’heure de demi-tour.');
  }

  if (weather?.wildfireAlert === true) {
    environmental -= 65;
    vetoes.push('wildfire_active');
    reasons.push('Veto sécurité : alerte incendie active sur le massif.');
  }

  if (weather?.floodAlert === true) {
    environmental -= 25;
    reasons.push('Vigilance crue / ruissellement active : éviter les traversées de cours d’eau.');
  }

  const avalancheLevel = weather?.avalancheRiskLevel ?? null;
  if (avalancheLevel !== null && avalancheLevel >= 4) {
    environmental -= 38;
    reasons.push(`Risque avalanche fort (BRA ${avalancheLevel}/5).`);
  } else if (avalancheLevel === 3) {
    environmental -= 20;
    reasons.push('Risque avalanche marqué (BRA 3/5) : itinéraire à choisir avec rigueur.');
  }

  const darknessRisk =
    safeEta.flags.includes('darkness_risk') || safeEta.flags.includes('polar_night');
  if (darknessRisk) {
    environmental -= 22;
    reasons.push('Arrivée P90 prévue après la fin du crépuscule civil.');
  }

  environmental = Math.round(clamp(environmental, 0, 100));

  // ── 4. Sous-score équipement (0..100 ou null si non renseigné) ──────────
  let equipment: number | null = null;
  const needsAvalancheKit =
    Boolean(input.requiresAvalancheKit) ||
    (avalancheLevel !== null && avalancheLevel >= 3) ||
    (input.surface === 'snow' && avalancheLevel !== null && avalancheLevel >= 2);
  const needsGlacierKit = Boolean(input.requiresGlacierGear) || input.surface === 'ice';
  const needsRainShell = (weather?.precipitationMmH ?? 0) >= 1.5;
  const needsThermal =
    thermal.level === 'cold' || thermal.level === 'cold_extreme' || maxAlt >= 2000;

  if (gear != null) {
    let eqScore = 100;

    if (darknessRisk && gear.hasHeadlamp === false) {
      vetoes.push('darkness_no_headlamp');
      eqScore -= 60;
      gearDeltas.push({
        itemId: 'headlamp',
        labelFr: 'Lampe frontale + piles de secours',
        severity: 'critical',
        reasonFr: 'Retour prévu après le crépuscule civil sans frontale déclarée.',
      });
      reasons.push('Veto sécurité : retour de nuit estimé sans lampe frontale dans le kit.');
    } else if (darknessRisk && gear.hasHeadlamp !== true) {
      eqScore -= 15;
      gearDeltas.push({
        itemId: 'headlamp',
        labelFr: 'Lampe frontale',
        severity: 'recommended',
        reasonFr: 'Marge lumineuse serrée avant la tombée de la nuit.',
      });
    }

    if (needsAvalancheKit && gear.hasAvalancheKit === false) {
      vetoes.push('avalanche_no_kit');
      eqScore -= 65;
      gearDeltas.push({
        itemId: 'avalanche_kit',
        labelFr: 'Triptyque DVA · Pelle · Sonde',
        severity: 'critical',
        reasonFr: 'Secteur neigeux ou risque avalanche nécessitant le triptyque complet.',
      });
      reasons.push('Veto sécurité : triptyque DVA / pelle / sonde absent en terrain avalancheux.');
    }

    if (needsGlacierKit && gear.hasCramponsIceAxe === false) {
      vetoes.push('glacier_no_crampons');
      eqScore -= 60;
      gearDeltas.push({
        itemId: 'crampons_ice_axe',
        labelFr: 'Crampons + piolet',
        severity: 'critical',
        reasonFr: 'Progression sur glace ou glacier sans équipement crampons/piolet.',
      });
      reasons.push('Veto sécurité : crampons et piolet indispensables sur ce terrain glaciaire.');
    }

    if (
      gear.hasWaterFilterOrCapacityL != null &&
      Number.isFinite(gear.hasWaterFilterOrCapacityL) &&
      gear.hasWaterFilterOrCapacityL < safeEta.hydrationLiters
    ) {
      const missingL = Math.round((safeEta.hydrationLiters - gear.hasWaterFilterOrCapacityL) * 10) / 10;
      eqScore -= missingL >= 1.0 ? 22 : 12;
      gearDeltas.push({
        itemId: 'hydration',
        labelFr: `+${missingL} L d’eau ou filtre`,
        severity: missingL >= 1.2 ? 'critical' : 'recommended',
        reasonFr: `Besoin estimé à ${safeEta.hydrationLiters} L pour la durée P90.`,
      });
    }

    if (needsThermal && gear.hasThermalLayer === false) {
      eqScore -= 18;
      gearDeltas.push({
        itemId: 'thermal_layer',
        labelFr: 'Couche thermique coupe-vent',
        severity: thermal.level === 'cold_extreme' ? 'critical' : 'recommended',
        reasonFr: 'Température ressentie froide ou altitude supérieure à 2 000 m.',
      });
    }

    if (needsRainShell && gear.hasRainShell === false) {
      eqScore -= 14;
      gearDeltas.push({
        itemId: 'rain_shell',
        labelFr: 'Veste imperméable (membrane)',
        severity: 'recommended',
        reasonFr: 'Précipitations prévues pendant la fenêtre de sortie.',
      });
    }

    if (safeEta.flags.includes('offline_uncertainty') && gear.hasOfflineMap === false) {
      eqScore -= 12;
      gearDeltas.push({
        itemId: 'offline_map',
        labelFr: 'Carte hors ligne téléchargée',
        severity: 'recommended',
        reasonFr: 'Réseau absent : précharger la zone et le tracé GPX.',
      });
    }

    equipment = Math.round(clamp(eqScore, 0, 100));
  } else {
    // Aucun inventaire fourni : equipment reste `null` (zéro mock), mais on signale les deltas utiles
    if (darknessRisk) {
      gearDeltas.push({
        itemId: 'headlamp',
        labelFr: 'Lampe frontale',
        severity: 'critical',
        reasonFr: 'Arrivée proche ou au-delà du crépuscule civil.',
      });
    }
    if (needsAvalancheKit) {
      gearDeltas.push({
        itemId: 'avalanche_kit',
        labelFr: 'Triptyque DVA · Pelle · Sonde',
        severity: 'critical',
        reasonFr: 'Requis par les conditions nivologiques du secteur.',
      });
    }
    if (needsGlacierKit) {
      gearDeltas.push({
        itemId: 'crampons_ice_axe',
        labelFr: 'Crampons + piolet',
        severity: 'critical',
        reasonFr: 'Terrain glaciaire ou glacé signalé.',
      });
    }
  }

  // ── 5. Agrégation & application des vetos de sécurité ───────────────────
  let weightedFit: number;
  if (equipment !== null) {
    weightedFit =
      physiological * 0.32 + technical * 0.23 + environmental * 0.25 + equipment * 0.2;
  } else {
    weightedFit = physiological * 0.4 + technical * 0.28 + environmental * 0.32;
  }

  const vetoed = vetoes.length > 0;
  const fitScore = Math.round(
    vetoed ? Math.min(25, clamp(weightedFit, 0, 100)) : clamp(weightedFit, 0, 100),
  );

  let verdict: OutingFitVerdict;
  if (vetoed || fitScore < 42) {
    verdict = 'not_recommended';
  } else if (fitScore >= 80) {
    verdict = 'ideal';
  } else if (fitScore >= 62) {
    verdict = 'good';
  } else {
    verdict = 'caution';
  }

  if (reasons.length === 0) {
    reasons.push('Conditions globales favorables pour cette sortie.');
  }

  return {
    fitScore,
    verdict,
    subScores: {
      physiological,
      technical,
      environmental,
      equipment,
    },
    vetoes,
    vetoed,
    reasons,
    gearDeltas,
  };
}
