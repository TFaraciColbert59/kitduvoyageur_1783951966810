import type { PlannerWarning } from './types';

export interface SeasonalityRule {
  countryCode: string;
  targetMonths: number[]; // 1 = Janvier ... 12 = Décembre
  code: string;
  severity: 'info' | 'warning' | 'alert';
  message: string;
}

export interface SeasonalityProfile {
  countryCode: string;
  bestMonths: number[];
  cautionMonths: number[];
  notes: string;
  rules: SeasonalityRule[];
}

export const SEASONALITY_REGISTRY: Record<string, SeasonalityProfile> = {
  NP: {
    countryCode: 'NP',
    bestMonths: [3, 4, 10, 11],
    cautionMonths: [6, 7, 8, 9],
    notes: 'Haute saison trek en automne (oct-nov, ciel cristallin) et printemps (mars-avr, rhododendrons).',
    rules: [
      {
        countryCode: 'NP',
        targetMonths: [6, 7, 8, 9],
        code: 'NEPAL_MONSOON',
        severity: 'warning',
        message:
          'Période de mousson estivale au Népal (juin à septembre) : fortes précipitations, risques accrus de glissements de terrain, sangsues en moyenne altitude et nébulosité masquant les sommets. Les mois d’octobre-novembre et mars-avril offrent des conditions idéales.',
      },
      {
        countryCode: 'NP',
        targetMonths: [12, 1, 2],
        code: 'NEPAL_WINTER',
        severity: 'info',
        message:
          'Hiver himalayen : températures nocturnes extrêmes en altitude (-15°C à -20°C au-delà de 4000m). Les hauts cols (Thorong La, Cho La) peuvent être encombrés par d’épaisses chutes de neige.',
      },
    ],
  },
  PE: {
    countryCode: 'PE',
    bestMonths: [5, 6, 7, 8, 9],
    cautionMonths: [12, 1, 2, 3],
    notes: 'Saison sèche andine optimale de mai à septembre pour Cuzco, la cordillère Blanche et l’Altiplano.',
    rules: [
      {
        countryCode: 'PE',
        targetMonths: [12, 1, 2, 3],
        code: 'PERU_RAINY_SEASON',
        severity: 'warning',
        message:
          'Saison des pluies dans les Andes péruviennes (décembre à mars) : sentiers boueux et visibilité diminuée. Note importante : le célèbre Chemin de l’Inca est réglementairement fermé pour entretien tout le mois de février.',
      },
    ],
  },
  IS: {
    countryCode: 'IS',
    bestMonths: [6, 7, 8],
    cautionMonths: [10, 11, 12, 1, 2, 3, 4, 5],
    notes: 'Courte saison estivale (juin-août) idéale pour le trekking (Laugavegur) et l’accès aux hautes terres.',
    rules: [
      {
        countryCode: 'IS',
        targetMonths: [10, 11, 12, 1, 2, 3, 4, 5],
        code: 'ICELAND_F_ROADS_CLOSED',
        severity: 'alert',
        message:
          'Les pistes intérieures (pistes F) et les hautes terres (Landmannalaugar, Askja, Kerlingarfjöll) sont fermées et interdites d’accès d’octobre à début juin en raison de la neige et du dégel printanier.',
      },
      {
        countryCode: 'IS',
        targetMonths: [11, 12, 1, 2, 3],
        code: 'ICELAND_WINTER_CONDITIONS',
        severity: 'warning',
        message:
          'Conditions hivernales rigoureuses : courtes journées (4 à 5 heures de lumière en décembre-janvier), tempêtes de neige subites et verglas fréquent sur la Ring Road.',
      },
    ],
  },
  MA: {
    countryCode: 'MA',
    bestMonths: [3, 4, 5, 9, 10, 11],
    cautionMonths: [7, 8],
    notes: 'Printemps et automne idéaux pour le désert et les vallées du Sud ; été propice au sommet du Toubkal.',
    rules: [
      {
        countryCode: 'MA',
        targetMonths: [7, 8],
        code: 'MOROCCO_EXTREME_HEAT',
        severity: 'warning',
        message:
          'Chaleurs extrêmes et températures pouvant dépasser 42°C en plaine et dans les zones désertiques (Merzouga, Zagora) en juillet et août. Privilégier les hautes altitudes du Haut-Atlas ou la côte Atlantique.',
      },
      {
        countryCode: 'MA',
        targetMonths: [1, 2],
        code: 'MOROCCO_ATLAS_SNOW',
        severity: 'info',
        message:
          'Présence de neige sur les sommets du Haut-Atlas (Toubkal, Mgoun). Équipement crampons / piolets nécessaire pour les ascensions au-dessus de 3000m.',
      },
    ],
  },
  FR: {
    countryCode: 'FR',
    bestMonths: [6, 7, 8, 9],
    cautionMonths: [11, 12, 1, 2, 3, 4, 5],
    notes: 'Haute saison rando estivale de mi-juin à fin septembre sur les GR alpins et pyrénéens.',
    rules: [
      {
        countryCode: 'FR',
        targetMonths: [11, 12, 1, 2, 3, 4, 5],
        code: 'FRANCE_MOUNTAIN_SNOW',
        severity: 'info',
        message:
          'En haute montagne (Alpes, Pyrénées), névés persistants et hauts cols fermés ou enneigés jusqu’en juin. Équipement adapté (raquettes, crampons) indispensable hors moyenne montagne.',
      },
    ],
  },
};

/**
 * Vérifie les alertes de saisonnalité pour un pays et un mois donné (1..12).
 */
export function checkSeasonality(countryCode: string, month: number): PlannerWarning[] {
  const code = countryCode.toUpperCase();
  const profile = SEASONALITY_REGISTRY[code];
  if (!profile) return [];

  const warnings: PlannerWarning[] = [];

  for (const rule of profile.rules) {
    if (rule.targetMonths.includes(month)) {
      warnings.push({
        code: rule.code,
        severity: rule.severity,
        country_code: code,
        message: rule.message,
      });
    }
  }

  return warnings;
}

/**
 * Vérifie la saisonnalité sur une plage de dates (ISO YYYY-MM-DD).
 */
export function checkSeasonalityForDates(
  countryCode: string,
  startDate?: string | null,
  endDate?: string | null
): PlannerWarning[] {
  if (!startDate) return [];

  const parsedStart = new Date(startDate);
  if (isNaN(parsedStart.getTime())) return [];

  const monthsToCheck = new Set<number>();
  monthsToCheck.add(parsedStart.getMonth() + 1);

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!isNaN(parsedEnd.getTime())) {
      monthsToCheck.add(parsedEnd.getMonth() + 1);
    }
  }

  const allWarnings: PlannerWarning[] = [];
  const seenCodes = new Set<string>();

  for (const month of monthsToCheck) {
    const warnings = checkSeasonality(countryCode, month);
    for (const w of warnings) {
      if (!seenCodes.has(w.code)) {
        seenCodes.add(w.code);
        allWarnings.push(w);
      }
    }
  }

  return allWarnings;
}

/**
 * Récupère le résumé et les conseils de saisonnalité pour un pays.
 */
export function getSeasonalityAdvice(countryCode: string): {
  bestMonths: number[];
  cautionMonths: number[];
  notes: string;
} {
  const code = countryCode.toUpperCase();
  const profile = SEASONALITY_REGISTRY[code];
  if (!profile) {
    return {
      bestMonths: [5, 6, 7, 8, 9],
      cautionMonths: [],
      notes: 'Données météo standard. Vérifiez les prévisions locales avant le départ.',
    };
  }

  return {
    bestMonths: profile.bestMonths,
    cautionMonths: profile.cautionMonths,
    notes: profile.notes,
  };
}

export interface MonthlyClimateNormals {
  month: number;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  rainDays: number;
  windSpeedKmH: number;
  suitabilityScore: number; // 0 à 100
}

export interface TripClimateRisk {
  overallRisk: 'low' | 'moderate' | 'high';
  primaryConcern?: string;
  advice: string;
  averageSuitability: number;
}

const CLIMATE_NORMALS_DATABASE: Record<string, Record<number, MonthlyClimateNormals>> = {
  IS: {
    1: { month: 1, tempMinC: -3, tempMaxC: 2, precipitationMm: 85, rainDays: 14, windSpeedKmH: 26, suitabilityScore: 25 },
    2: { month: 2, tempMinC: -2, tempMaxC: 3, precipitationMm: 80, rainDays: 13, windSpeedKmH: 25, suitabilityScore: 30 },
    3: { month: 3, tempMinC: -1, tempMaxC: 3, precipitationMm: 75, rainDays: 13, windSpeedKmH: 24, suitabilityScore: 35 },
    4: { month: 4, tempMinC: 1, tempMaxC: 6, precipitationMm: 60, rainDays: 11, windSpeedKmH: 22, suitabilityScore: 45 },
    5: { month: 5, tempMinC: 4, tempMaxC: 10, precipitationMm: 45, rainDays: 10, windSpeedKmH: 20, suitabilityScore: 60 },
    6: { month: 6, tempMinC: 7, tempMaxC: 13, precipitationMm: 40, rainDays: 9, windSpeedKmH: 18, suitabilityScore: 85 },
    7: { month: 7, tempMinC: 9, tempMaxC: 15, precipitationMm: 50, rainDays: 10, windSpeedKmH: 17, suitabilityScore: 90 },
    8: { month: 8, tempMinC: 8, tempMaxC: 14, precipitationMm: 65, rainDays: 11, windSpeedKmH: 19, suitabilityScore: 85 },
    9: { month: 9, tempMinC: 6, tempMaxC: 11, precipitationMm: 85, rainDays: 13, windSpeedKmH: 22, suitabilityScore: 65 },
    10: { month: 10, tempMinC: 2, tempMaxC: 7, precipitationMm: 95, rainDays: 15, windSpeedKmH: 24, suitabilityScore: 35 },
    11: { month: 11, tempMinC: -1, tempMaxC: 4, precipitationMm: 90, rainDays: 14, windSpeedKmH: 26, suitabilityScore: 25 },
    12: { month: 12, tempMinC: -3, tempMaxC: 2, precipitationMm: 95, rainDays: 15, windSpeedKmH: 27, suitabilityScore: 20 },
  },
  NP: {
    1: { month: 1, tempMinC: 2, tempMaxC: 18, precipitationMm: 15, rainDays: 2, windSpeedKmH: 8, suitabilityScore: 70 },
    2: { month: 2, tempMinC: 5, tempMaxC: 21, precipitationMm: 20, rainDays: 3, windSpeedKmH: 9, suitabilityScore: 75 },
    3: { month: 3, tempMinC: 9, tempMaxC: 26, precipitationMm: 35, rainDays: 4, windSpeedKmH: 10, suitabilityScore: 85 },
    4: { month: 4, tempMinC: 12, tempMaxC: 29, precipitationMm: 60, rainDays: 7, windSpeedKmH: 11, suitabilityScore: 90 },
    5: { month: 5, tempMinC: 16, tempMaxC: 30, precipitationMm: 120, rainDays: 12, windSpeedKmH: 10, suitabilityScore: 75 },
    6: { month: 6, tempMinC: 19, tempMaxC: 29, precipitationMm: 250, rainDays: 18, windSpeedKmH: 9, suitabilityScore: 40 },
    7: { month: 7, tempMinC: 20, tempMaxC: 28, precipitationMm: 380, rainDays: 23, windSpeedKmH: 8, suitabilityScore: 25 },
    8: { month: 8, tempMinC: 20, tempMaxC: 28, precipitationMm: 340, rainDays: 21, windSpeedKmH: 8, suitabilityScore: 30 },
    9: { month: 9, tempMinC: 18, tempMaxC: 28, precipitationMm: 200, rainDays: 15, windSpeedKmH: 8, suitabilityScore: 50 },
    10: { month: 10, tempMinC: 13, tempMaxC: 27, precipitationMm: 50, rainDays: 4, windSpeedKmH: 8, suitabilityScore: 95 },
    11: { month: 11, tempMinC: 7, tempMaxC: 23, precipitationMm: 10, rainDays: 1, windSpeedKmH: 7, suitabilityScore: 95 },
    12: { month: 12, tempMinC: 3, tempMaxC: 19, precipitationMm: 10, rainDays: 1, windSpeedKmH: 7, suitabilityScore: 75 },
  },
  FR: {
    1: { month: 1, tempMinC: 1, tempMaxC: 7, precipitationMm: 55, rainDays: 10, windSpeedKmH: 15, suitabilityScore: 45 },
    2: { month: 2, tempMinC: 2, tempMaxC: 8, precipitationMm: 45, rainDays: 9, windSpeedKmH: 15, suitabilityScore: 50 },
    3: { month: 3, tempMinC: 4, tempMaxC: 12, precipitationMm: 50, rainDays: 9, windSpeedKmH: 16, suitabilityScore: 65 },
    4: { month: 4, tempMinC: 7, tempMaxC: 16, precipitationMm: 55, rainDays: 9, windSpeedKmH: 15, suitabilityScore: 75 },
    5: { month: 5, tempMinC: 10, tempMaxC: 20, precipitationMm: 65, rainDays: 10, windSpeedKmH: 14, suitabilityScore: 85 },
    6: { month: 6, tempMinC: 14, tempMaxC: 24, precipitationMm: 55, rainDays: 8, windSpeedKmH: 13, suitabilityScore: 92 },
    7: { month: 7, tempMinC: 16, tempMaxC: 26, precipitationMm: 50, rainDays: 7, windSpeedKmH: 13, suitabilityScore: 95 },
    8: { month: 8, tempMinC: 15, tempMaxC: 26, precipitationMm: 55, rainDays: 7, windSpeedKmH: 12, suitabilityScore: 93 },
    9: { month: 9, tempMinC: 12, tempMaxC: 22, precipitationMm: 60, rainDays: 8, windSpeedKmH: 13, suitabilityScore: 90 },
    10: { month: 10, tempMinC: 9, tempMaxC: 16, precipitationMm: 70, rainDays: 10, windSpeedKmH: 14, suitabilityScore: 70 },
    11: { month: 11, tempMinC: 5, tempMaxC: 11, precipitationMm: 65, rainDays: 11, windSpeedKmH: 15, suitabilityScore: 55 },
    12: { month: 12, tempMinC: 2, tempMaxC: 8, precipitationMm: 60, rainDays: 11, windSpeedKmH: 16, suitabilityScore: 45 },
  },
};

/**
 * Récupère les normales climatiques mensuelles déterministes d'une destination.
 */
export function getMonthlyClimateNormals(countryCode: string, month: number): MonthlyClimateNormals | null {
  const code = countryCode.toUpperCase();
  const countryData = CLIMATE_NORMALS_DATABASE[code];
  if (countryData && countryData[month]) {
    return countryData[month];
  }

  // Fallback générique tempéré
  const isSummer = month >= 6 && month <= 8;
  const isWinter = month === 12 || month <= 2;
  return {
    month,
    tempMinC: isWinter ? 0 : isSummer ? 14 : 7,
    tempMaxC: isWinter ? 8 : isSummer ? 25 : 17,
    precipitationMm: 60,
    rainDays: 9,
    windSpeedKmH: 15,
    suitabilityScore: isSummer ? 85 : isWinter ? 40 : 70,
  };
}

/**
 * Évalue le risque climatique global d'un voyage sur une plage de dates donnée.
 */
export function evaluateTripClimateRisk(
  countryCode: string,
  startDate: string,
  endDate: string
): TripClimateRisk {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const code = countryCode.toUpperCase();

  const months = new Set<number>();
  if (!isNaN(start.getTime())) months.add(start.getMonth() + 1);
  if (!isNaN(end.getTime())) months.add(end.getMonth() + 1);

  if (months.size === 0) {
    return {
      overallRisk: 'moderate',
      advice: 'Dates non spécifiées, vérifiez les prévisions météo locales.',
      averageSuitability: 60,
    };
  }

  let totalScore = 0;
  let count = 0;
  for (const m of months) {
    const normals = getMonthlyClimateNormals(code, m);
    if (normals) {
      totalScore += normals.suitabilityScore;
      count++;
    }
  }

  const avgSuitability = count > 0 ? Math.round(totalScore / count) : 60;

  // Détection de règles spécifiques critiques
  if (code === 'NP' && Array.from(months).some((m) => m >= 6 && m <= 9)) {
    return {
      overallRisk: 'high',
      primaryConcern: 'Mousson d’été violente et risques de glissements',
      advice: 'Fortes précipitations et nébulosité. Privilégier octobre-novembre ou mars-avril.',
      averageSuitability: avgSuitability,
    };
  }

  if (code === 'IS' && Array.from(months).some((m) => m >= 10 || m <= 5)) {
    return {
      overallRisk: 'high',
      primaryConcern: 'Fermeture des pistes intérieures F-Roads et tempêtes de neige',
      advice: 'Accès aux hautes terres fermé. Privilégier juin à août.',
      averageSuitability: avgSuitability,
    };
  }

  if (code === 'MA' && Array.from(months).some((m) => m === 7 || m === 8)) {
    return {
      overallRisk: 'moderate',
      primaryConcern: 'Chaleurs extrêmes en plaine et désert (> 40°C)',
      advice: 'Rester en très haute altitude dans l’Atlas ou sur la côte Atlantique.',
      averageSuitability: avgSuitability,
    };
  }

  const overallRisk = avgSuitability >= 75 ? 'low' : avgSuitability >= 50 ? 'moderate' : 'high';

  return {
    overallRisk,
    advice: overallRisk === 'low' ? 'Excellentes conditions climatiques attendues.' : 'Conditions variables, équipement adapté requis.',
    averageSuitability: avgSuitability,
  };
}
