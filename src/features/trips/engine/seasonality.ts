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
