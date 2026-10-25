import {
  TripBriefSchema,
  type TripBrief,
  type TripStyleEnum,
  type TransportModeEnum,
} from '../schemas/autoGen.schema';
import type { z } from 'zod';

type TripStyle = z.infer<typeof TripStyleEnum>;
type TransportMode = z.infer<typeof TransportModeEnum>;

interface DestinationMatch {
  country: string;
  region?: string;
}

const DESTINATION_DICTIONARY: { keywords: string[]; match: DestinationMatch }[] = [
  {
    keywords: ['toubkal', 'haut atlas', 'marrakech'],
    match: { country: 'MA', region: 'Haut Atlas / Toubkal' },
  },
  {
    keywords: ['maroc', 'morocco'],
    match: { country: 'MA', region: 'Maroc' },
  },
  {
    keywords: ['islande', 'iceland', 'laugavegur', 'landmannalaugar', 'thorsmork', 'skogar'],
    match: { country: 'IS', region: 'Laugavegur / Hautes Terres' },
  },
  {
    keywords: ['mont-blanc', 'mont blanc', 'tmb', 'chamonix', 'val montjoie', 'les houches'],
    match: { country: 'FR', region: 'Tour du Mont-Blanc / Val Montjoie' },
  },
  {
    keywords: ['sancy', 'auvergne', 'massif du sancy', 'mont-dore'],
    match: { country: 'FR', region: 'Massif du Sancy / Auvergne' },
  },
  {
    keywords: ['bretagne', 'gr34', 'crozon', 'finistere', 'finistère'],
    match: { country: 'FR', region: 'Bretagne / GR34' },
  },
  {
    keywords: ['dolomites', 'tre cime', 'alta via', 'cortina'],
    match: { country: 'IT', region: 'Dolomites / Alta Via' },
  },
  {
    keywords: ['italie', 'italy', 'toscane'],
    match: { country: 'IT', region: 'Italie' },
  },
  {
    keywords: ['annapurna', 'nepal', 'népal', 'pokhara', 'sanctuaire'],
    match: { country: 'NP', region: 'Sanctuaire des Annapurnas' },
  },
  {
    keywords: ['madere', 'madère', 'funchal', 'portugal'],
    match: { country: 'PT', region: 'Madère' },
  },
  {
    keywords: ['kumano', 'kodo', 'japon', 'japan', 'kyoto'],
    match: { country: 'JP', region: 'Kumano Kodo / Péninsule de Kii' },
  },
  {
    keywords: ['france', 'alpes', 'pyrenees', 'pyrénées', 'corse', 'gr20'],
    match: { country: 'FR', region: 'France' },
  },
];

const MONTH_MAP: { [key: string]: number } = {
  janvier: 1,
  jan: 1,
  fevrier: 2,
  février: 2,
  fev: 2,
  fév: 2,
  mars: 3,
  mar: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  août: 8,
  aou: 8,
  septembre: 9,
  sept: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  décembre: 12,
  dec: 12,
  été: 7,
  ete: 7,
  printemps: 4,
  automne: 10,
  hiver: 1,
};

/**
 * Moteur d'extraction déterministe d'intention de voyage (Loi 1 & Loi 2).
 * Parse en < 2 ms sans hallucination ni LLM.
 */
export function extractTripBrief(rawInput: string, userProfile?: any): TripBrief {
  const normalized = rawInput.toLowerCase();

  // 1. Destination
  let foundDestinations: DestinationMatch[] = [];
  let destConfidence: 'stated' | 'inferred' | 'defaulted' = 'defaulted';

  for (const entry of DESTINATION_DICTIONARY) {
    for (const kw of entry.keywords) {
      if (normalized.includes(kw)) {
        foundDestinations.push({ ...entry.match });
        destConfidence = 'stated';
        break;
      }
    }
  }

  // If specific region mentioned, refine
  if (normalized.includes('toubkal')) {
    const d = foundDestinations.find((item) => item.country === 'MA');
    if (d) {
      d.region = 'Haut Atlas / Toubkal';
    } else {
      foundDestinations.unshift({ country: 'MA', region: 'Haut Atlas / Toubkal' });
      destConfidence = 'stated';
    }
  }

  // Deduplicate destinations
  if (foundDestinations.length > 0) {
    const uniqueCountries = new Set<string>();
    foundDestinations = foundDestinations.filter((d) => {
      const key = d.country + (d.region || '');
      if (uniqueCountries.has(key)) return false;
      uniqueCountries.add(key);
      return true;
    });
  } else {
    foundDestinations = [{ country: 'FR', region: 'France' }];
    destConfidence = 'defaulted';
  }

  // 2. Durée
  let days = 7;
  let durationConfidence: 'stated' | 'inferred' | 'defaulted' = 'defaulted';

  const daysMatch = normalized.match(/(\d+)\s*(?:j|jours|jour|days|day)\b/);
  const weeksMatch = normalized.match(/(\d+)\s*(?:semaines|semaine|weeks|week)\b/);
  const weekendMatch = normalized.match(/week-?end\b/);

  if (daysMatch && daysMatch[1]) {
    days = parseInt(daysMatch[1], 10);
    durationConfidence = 'stated';
  } else if (weeksMatch && weeksMatch[1]) {
    days = parseInt(weeksMatch[1], 10) * 7;
    durationConfidence = 'stated';
  } else if (weekendMatch) {
    days = 2;
    durationConfidence = 'stated';
  } else {
    // Default duration depending on geography
    const primaryCountry = foundDestinations[0]?.country;
    if (primaryCountry === 'NP' || primaryCountry === 'JP') {
      days = 14;
    } else if (primaryCountry === 'IS' || primaryCountry === 'MA') {
      days = 7;
    } else {
      days = 5;
    }
    durationConfidence = 'defaulted';
  }

  // 3. Fenêtre temporelle / Mois
  let month: number | undefined = undefined;
  let windowConfidence: 'stated' | 'inferred' | 'defaulted' = 'defaulted';

  for (const [key, m] of Object.entries(MONTH_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(normalized)) {
      month = m;
      windowConfidence = 'stated';
      break;
    }
  }

  if (!month) {
    month = 7; // Default summer
    windowConfidence = 'defaulted';
  }

  // 4. Groupe / Nombre de personnes
  let adults = 1;
  let partyConfidence: 'stated' | 'inferred' | 'defaulted' = 'defaulted';

  const partyMatch = normalized.match(/(?:on est|groupe de|sommes|nous sommes)\s*(\d+)\b/);
  const persMatch = normalized.match(/(\d+)\s*(?:personnes|pers|adultes|potes|amis|voyageurs)\b/);

  if (partyMatch && partyMatch[1]) {
    adults = parseInt(partyMatch[1], 10);
    partyConfidence = 'stated';
  } else if (persMatch && persMatch[1]) {
    adults = parseInt(persMatch[1], 10);
    partyConfidence = 'stated';
  } else if (normalized.includes('en couple') || normalized.includes('à deux') || normalized.includes('a deux')) {
    adults = 2;
    partyConfidence = 'stated';
  } else if (normalized.includes('seul') || normalized.includes('solo')) {
    adults = 1;
    partyConfidence = 'stated';
  }

  // 5. Budget
  let totalEur: number | undefined = undefined;
  let tier: 'shoestring' | 'moderate' | 'comfort' = 'moderate';
  let budgetConfidence: 'stated' | 'inferred' | 'defaulted' = 'defaulted';

  const budgetEuroMatch = normalized.match(/(?:budget\s*(?:de\s*)?)?(\d+)\s*(?:€|euros?)(?=[^\w]|$)/i);
  if (budgetEuroMatch && budgetEuroMatch[1]) {
    totalEur = parseInt(budgetEuroMatch[1], 10);
    budgetConfidence = 'stated';
    if (totalEur / (adults * days) <= 50 || totalEur <= 150) {
      tier = 'shoestring';
    } else if (totalEur / (adults * days) > 120) {
      tier = 'comfort';
    } else {
      tier = 'moderate';
    }
  }

  if (
    normalized.includes('budget serré') ||
    normalized.includes('budget serre') ||
    normalized.includes('petit budget') ||
    normalized.includes('économique') ||
    normalized.includes('economique') ||
    normalized.includes('pas cher') ||
    normalized.includes('shoestring')
  ) {
    tier = 'shoestring';
    budgetConfidence = 'stated';
  } else if (normalized.includes('confort') || normalized.includes('luxe') || normalized.includes('haut de gamme')) {
    tier = 'comfort';
    budgetConfidence = 'stated';
  }

  // 6. Style
  const styles: TripStyle[] = [];
  if (normalized.includes('bivouac') || normalized.includes('tente') || normalized.includes('camping sauvage')) {
    styles.push('bivouac');
  }
  if (
    normalized.includes('randonnée') ||
    normalized.includes('randonnee') ||
    normalized.includes('rando') ||
    normalized.includes('trek') ||
    normalized.includes('trekking')
  ) {
    styles.push('trekking');
    styles.push('hiking');
  }
  if (normalized.includes('trail') || normalized.includes('course')) {
    styles.push('trail');
  }
  if (normalized.includes('bikepacking') || normalized.includes('vélo') || normalized.includes('velo')) {
    styles.push('bikepacking');
  }
  if (normalized.includes('van') || normalized.includes('fourgon')) {
    styles.push('van');
  }
  if (styles.length === 0) {
    styles.push('hiking');
  }

  // 7. Mobilité
  const modes: TransportMode[] = ['foot'];
  if (normalized.includes('train') || normalized.includes('gare') || normalized.includes('sncf') || normalized.includes('tgv')) {
    modes.push('train');
  }
  if (normalized.includes('bus') || normalized.includes('car')) {
    modes.push('bus');
  }
  if (normalized.includes('voiture') || normalized.includes('auto') || normalized.includes('permis')) {
    modes.push('car');
  }
  if (modes.length === 1 && (foundDestinations[0]?.country === 'IS' || foundDestinations[0]?.country === 'NP' || foundDestinations[0]?.country === 'JP')) {
    modes.push('plane');
  }

  // Constraints
  const constraints: string[] = [];
  if (normalized.includes('sans avion') || normalized.includes('pas d avion') || normalized.includes('pas d\'avion')) {
    constraints.push('no_plane');
  }
  if (normalized.includes('sommet') || normalized.includes('toubkal')) {
    constraints.push('peak_ascent');
  }

  const brief: TripBrief = {
    rawInput,
    destinations: {
      value: foundDestinations,
      confidence: destConfidence,
    },
    duration: {
      value: {
        days,
        flexible: false,
      },
      confidence: durationConfidence,
    },
    window: {
      value: {
        month,
      },
      confidence: windowConfidence,
    },
    party: {
      value: {
        adults,
        minors: 0,
      },
      confidence: partyConfidence,
    },
    budget: {
      value: {
        totalEur,
        tier,
      },
      confidence: budgetConfidence,
    },
    style: {
      value: styles,
      confidence: styles.length > 0 ? 'stated' : 'defaulted',
    },
    intensity: {
      value: {
        dailyKmMax: 20,
        dailyGainMax: 800,
        restEvery: 4,
      },
      confidence: 'defaulted',
    },
    constraints: {
      value: constraints,
      confidence: constraints.length > 0 ? 'stated' : 'defaulted',
    },
    mobility: {
      value: {
        modes,
        ownsVehicle: modes.includes('car'),
        licence: modes.includes('car'),
      },
      confidence: modes.length > 1 ? 'stated' : 'defaulted',
    },
    departure: {
      value: {
        from: undefined,
      },
      confidence: 'defaulted',
    },
    fromProfile: {
      ownedGear: userProfile?.ownedGear || [],
      pastTrips: userProfile?.pastTrips || [],
      crews: userProfile?.crews || [],
      units: userProfile?.units || 'metric',
      homeAirports: userProfile?.homeAirports || ['PAR'],
    },
  };

  return TripBriefSchema.parse(brief);
}
