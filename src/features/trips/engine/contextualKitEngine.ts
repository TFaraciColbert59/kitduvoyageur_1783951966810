import type { TripItem, TripStep } from '../types/trip.types';
import type {
  ShopProductReference,
  ContextualGearRecommendation,
  TripKitAnalysis,
} from '../types/kit.types';
import type { ElevationProfile } from '../lib/elevation';
import { getCivilDurationDays } from '@/lib/dates/tripDates';

export interface ContextualKitInput {
  countryCode?: string | null;
  activity?: string | null;
  durationDays: number;
  seasonMonth?: number; // 1 to 12
  steps?: TripStep[];
  currentItems?: TripItem[];
  availableProducts?: ShopProductReference[];
  elevationProfile?: ElevationProfile;
}

export interface KitWeightResult {
  totalWeightGrams: number;
  baseWeightGrams: number;
  wornWeightGrams: number;
  consumableWeightGrams: number;
  unweighedItemsCount: number;
  weightCategory: 'none' | 'incomplet' | 'ultralight' | 'light' | 'standard' | 'heavy';
}

/**
 * Calcul déterministe et cohérent du poids du sac (résout D3 et D4)
 * Invariants :
 * - Sac vide (0g ou 0 items) -> pas de badge ULTRALIGHT (weightCategory: 'none')
 * - Item sans poids renseigné (null/undefined) -> 'incomplet'
 * - Conditionné à totalWeightGrams > 0
 */
export function computeKitWeight(items: TripItem[]): KitWeightResult {
  let totalWeightGrams = 0;
  let baseWeightGrams = 0;
  let wornWeightGrams = 0;
  let consumableWeightGrams = 0;
  let unweighedItemsCount = 0;

  for (const item of items) {
    const qty = item.quantity || 1;
    if (item.weight_grams === null || item.weight_grams === undefined) {
      unweighedItemsCount++;
      continue;
    }
    const w = item.weight_grams * qty;
    totalWeightGrams += w;
    if ((item as any).is_worn) {
      wornWeightGrams += w;
    } else if ((item as any).is_consumable) {
      consumableWeightGrams += w;
    } else {
      baseWeightGrams += w;
    }
  }

  let weightCategory: KitWeightResult['weightCategory'] = 'none';

  if (items.length === 0 || totalWeightGrams === 0) {
    weightCategory = 'none';
  } else if (unweighedItemsCount > 0) {
    weightCategory = 'incomplet';
  } else if (baseWeightGrams < 5000) {
    weightCategory = 'ultralight';
  } else if (baseWeightGrams < 8000) {
    weightCategory = 'light';
  } else if (baseWeightGrams <= 12000) {
    weightCategory = 'standard';
  } else {
    weightCategory = 'heavy';
  }

  return {
    totalWeightGrams,
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    unweighedItemsCount,
    weightCategory,
  };
}

/**
 * Catalogue de référence des règles contextuelles avec mapping direct vers les slugs boutique réels
 */
interface KitRuleTemplate {
  key: string;
  name: string;
  category: ContextualGearRecommendation['category'];
  defaultPriority: 'vital' | 'recommended' | 'optional';
  baseWeightGrams: number;
  condition: (input: ContextualKitInput, maxAlt: number) => { match: boolean; reason: string; priority?: 'vital' | 'recommended' };
  preferredProductSlug: string;
}

export const CONTEXTUAL_RULES: KitRuleTemplate[] = [
  // 1. SÉCURITÉ & SECOURS (Fondamental partout)
  {
    key: 'first-aid',
    name: 'Trousse de premiers secours complète',
    category: 'safety',
    defaultPriority: 'vital',
    baseWeightGrams: 200,
    condition: () => ({
      match: true,
      reason: 'Indispensable pour faire face aux traumatismes, coupures et ampoules en milieu isolé.',
      priority: 'vital',
    }),
    preferredProductSlug: 'trousse-de-premiers-secours-michelin-9531-44-pieces',
  },
  {
    key: 'whistle',
    name: 'Sifflet de survie et détresse',
    category: 'safety',
    defaultPriority: 'recommended',
    baseWeightGrams: 20,
    condition: () => ({
      match: true,
      reason: 'Signal sonore d’urgence audible à longue distance en cas de brouillard ou chute.',
      priority: 'recommended',
    }),
    preferredProductSlug: 'sifflet-de-survie-urgence-categorie-bigbuy',
  },
  {
    key: 'headlamp',
    name: 'Lampe frontale LED haute autonomie',
    category: 'tech',
    defaultPriority: 'recommended',
    baseWeightGrams: 90,
    condition: () => ({
      match: true,
      reason: 'Éclairage mains libres essentiel pour les départs matinaux, arrivées tardives et nuits en refuge/bivouac.',
      priority: 'recommended',
    }),
    preferredProductSlug: 'lampe-frontale-led-rechargeable-black-diamond-spot-400',
  },
  {
    key: 'repair-kit',
    name: 'Kit de réparation multi-usage',
    category: 'safety',
    defaultPriority: 'recommended',
    baseWeightGrams: 150,
    condition: () => ({
      match: true,
      reason: 'Permet de réparer sac, tente, chaussures ou bâtons en plein trek sans abandonner.',
    }),
    preferredProductSlug: 'kit-de-reparation-colliers-de-cable-jokari-system-4-70-n70',
  },

  // 2. RÈGLES D'ALTITUDE > 2400M (Contrat D2 strict)
  {
    key: 'water-filter',
    name: 'Filtre à eau / paille filtrante',
    category: 'water',
    defaultPriority: 'vital',
    baseWeightGrams: 140,
    condition: (_input, maxAlt) => {
      const needFilter = maxAlt > 2400;
      return {
        match: needFilter,
        reason: needFilter
          ? `Altitude supérieure à 2400m (${maxAlt}m) : filtration indispensable des névés, torrents et sources naturelles non contrôlées.`
          : '',
        priority: 'vital',
      };
    },
    preferredProductSlug: 'filtre-a-eau-randonnee-categorie-bigbuy',
  },
  {
    key: 'cold-down-jacket',
    name: 'Doudoune grand froid en duvet compressible',
    category: 'clothing',
    defaultPriority: 'vital',
    baseWeightGrams: 380,
    condition: (_input, maxAlt) => {
      const extremeCold = maxAlt > 2400;
      return {
        match: extremeCold,
        reason: extremeCold
          ? `Haute altitude (${maxAlt}m > 2400m) : isolation thermique grand froid indispensable face aux températures nocturnes négatives.`
          : '',
        priority: 'vital',
      };
    },
    preferredProductSlug: 'doudoune-grand-froid-categorie-bigbuy',
  },
  {
    key: 'survival-blanket',
    name: 'Couverture de survie renforcée',
    category: 'safety',
    defaultPriority: 'vital',
    baseWeightGrams: 60,
    condition: (_input, maxAlt) => {
      const isHigh = maxAlt > 2400;
      return {
        match: isHigh,
        reason: isHigh
          ? `Haute altitude (${maxAlt}m > 2400m) : isolation thermique vitale d’urgence en cas d’aléa météo ou blessure immobilisante.`
          : '',
        priority: 'vital',
      };
    },
    preferredProductSlug: 'couverture-de-survie-categorie-bigbuy',
  },
  {
    key: 'crampons',
    name: 'Crampons de traction / neige & glace',
    category: 'clothing',
    defaultPriority: 'vital',
    baseWeightGrams: 400,
    condition: (input, maxAlt) => {
      const isHighAltitude = maxAlt >= 2400 || input.countryCode === 'IS' || input.countryCode === 'NP';
      return {
        match: isHighAltitude,
        reason: isHighAltitude
          ? `Itinéraire avec altitude max de ${maxAlt}m ou terrain glaciaire : indispensable pour traverser les névés et passages verglacés en toute sécurité.`
          : '',
        priority: 'vital',
      };
    },
    preferredProductSlug: 'crampons-a-neigeglace-baton-trekking-black-diamond-bd110045',
  },
  {
    key: 'cold-gloves',
    name: 'Gants thermiques coupe-vent',
    category: 'clothing',
    defaultPriority: 'recommended',
    baseWeightGrams: 100,
    condition: (input, maxAlt) => {
      const coldExpected = Boolean(
        maxAlt >= 2000 ||
        input.countryCode === 'IS' ||
        (input.seasonMonth && (input.seasonMonth <= 4 || input.seasonMonth >= 10))
      );
      return {
        match: coldExpected,
        reason: coldExpected
          ? `Baisse sensible des températures (vent ou altitude de ${maxAlt}m) : prévient l’engourdissement et les gelures.`
          : '',
        priority: maxAlt > 3000 ? 'vital' : 'recommended',
      };
    },
    preferredProductSlug: 'gants-randonnee-froid-categorie-bigbuy',
  },
  {
    key: 'hand-warmers',
    name: 'Chauffe-mains / Chauffe-pieds d’urgence',
    category: 'clothing',
    defaultPriority: 'optional',
    baseWeightGrams: 30,
    condition: (input, maxAlt) => {
      const extremeCold = maxAlt >= 3000 || input.countryCode === 'IS';
      return {
        match: extremeCold,
        reason: extremeCold ? 'Réconfort thermique immédiat lors des bivouacs glaciaux ou passages de cols ventés.' : '',
      };
    },
    preferredProductSlug: 'chauffe-mains-chauffe-pieds-categorie-bigbuy',
  },

  // 3. HYDRATATION & SOLEIL
  {
    key: 'sunscreen',
    name: 'Crème solaire haute protection SPF 50+',
    category: 'safety',
    defaultPriority: 'recommended',
    baseWeightGrams: 120,
    condition: (input, maxAlt) => {
      const intenseUv = maxAlt >= 1800 || input.countryCode === 'MA' || input.countryCode === 'PE';
      return {
        match: true,
        reason: intenseUv
          ? `Rayonnement UV démultiplié par l’altitude (${maxAlt}m) ou l'exposition désertique : protection cutanée indispensable.`
          : 'Protection cutanée contre le soleil.',
        priority: intenseUv ? 'vital' : 'recommended',
      };
    },
    preferredProductSlug: 'creme-solaire-nivea-spf-50-200-ml',
  },
  {
    key: 'sunglasses',
    name: 'Lunettes de soleil sport UV400 cat. 3/4',
    category: 'safety',
    defaultPriority: 'recommended',
    baseWeightGrams: 30,
    condition: (input, maxAlt) => {
      const needGlasses = maxAlt >= 1500 || input.countryCode === 'MA' || input.countryCode === 'IS';
      return {
        match: needGlasses,
        reason: 'Protection rétinienne indispensable contre la réverbération de la neige, roche claire ou soleil direct.',
        priority: 'vital',
      };
    },
    preferredProductSlug: 'lunettes-de-soleil-sport-uv400-categorie-bigbuy',
  },
  {
    key: 'thermos',
    name: 'Gourde isotherme / Thermos en acier inoxydable',
    category: 'water',
    defaultPriority: 'recommended',
    baseWeightGrams: 280,
    condition: (input, maxAlt) => ({
      match: true,
      reason: maxAlt >= 2500 || input.countryCode === 'IS'
        ? 'Maintient l’eau chaude par températures négatives ou l’eau fraîche par forte chaleur.'
        : 'Conservation optimale de votre réserve hydrique quotidienne.',
    }),
    preferredProductSlug: 'thermos-de-voyage-thermosport-inoxibar-61126-acier-inoxydable',
  },
  {
    key: 'water-bottle',
    name: 'Bouteille d’eau légère de randonnée',
    category: 'water',
    defaultPriority: 'recommended',
    baseWeightGrams: 200,
    condition: () => ({
      match: true,
      reason: 'Réservoir principal d’eau pour sécuriser l’autonomie entre deux points de ravitaillement.',
      priority: 'recommended',
    }),
    preferredProductSlug: 'bouteille-deau-picture-acc121-a-blanc-naturel-acier',
  },

  // 4. PLUIE & INTEMPÉRIES
  {
    key: 'rain-poncho',
    name: 'Poncho imperméable & coupe-vent',
    category: 'clothing',
    defaultPriority: 'recommended',
    baseWeightGrams: 150,
    condition: (input) => {
      const wetClimate = input.countryCode === 'IS' || input.countryCode === 'NP' || input.countryCode === 'FR';
      return {
        match: wetClimate,
        reason: wetClimate
          ? 'Protection immédiate contre les averses torrentielles et le vent froid protégeant le marcheur et son sac.'
          : 'Couverture d’intempéries d’appoint.',
        priority: input.countryCode === 'IS' ? 'vital' : 'recommended',
      };
    },
    preferredProductSlug: 'poncho-impermeable-pluie-categorie-bigbuy',
  },
  {
    key: 'dry-bag',
    name: 'Sac étanche / Dry bag de protection',
    category: 'misc',
    defaultPriority: 'recommended',
    baseWeightGrams: 100,
    condition: (input) => {
      const wet = input.countryCode === 'IS' || input.countryCode === 'NP';
      return {
        match: wet,
        reason: 'Garantit l’étanchéité absolue de vos vêtements de rechange et équipements électroniques sensibles.',
      };
    },
    preferredProductSlug: 'sac-etanche-dry-bag-bouteille-filtrante-brita-1052250-bleu-600-ml',
  },

  // 5. BIVOUAC & NUITÉE
  {
    key: 'tent-2p',
    name: 'Tente de randonnée légère 2 personnes',
    category: 'shelter',
    defaultPriority: 'recommended',
    baseWeightGrams: 1800,
    condition: (input) => {
      const needsShelter = input.activity === 'bivouac' || input.activity === 'trekking' || input.durationDays >= 3;
      return {
        match: needsShelter,
        reason: 'Abri robuste indispensable pour passer la nuit en autonomie face au vent et aux précipitations.',
        priority: input.activity === 'bivouac' ? 'vital' : 'recommended',
      };
    },
    preferredProductSlug: 'tente-de-camping-2-personnes-categorie-bigbuy',
  },
  {
    key: 'sleeping-mat',
    name: 'Matelas gonflable isolé de camping',
    category: 'sleep',
    defaultPriority: 'recommended',
    baseWeightGrams: 600,
    condition: (input) => {
      const needsMat = input.activity === 'bivouac' || input.activity === 'trekking';
      return {
        match: needsMat,
        reason: 'Isolation thermique essentielle contre le froid du sol et confort de récupération nocturne.',
      };
    },
    preferredProductSlug: 'matelas-gonflable-camping-categorie-bigbuy',
  },
  {
    key: 'stove',
    name: 'Réchaud de camping compact',
    category: 'cook',
    defaultPriority: 'recommended',
    baseWeightGrams: 300,
    condition: (input) => {
      const needsCook = input.activity === 'bivouac' || input.activity === 'trekking' || input.durationDays >= 2;
      return {
        match: needsCook,
        reason: 'Permet de faire bouillir l’eau pour les repas lyophilisés et les boissons chaudes en itinérance.',
      };
    },
    preferredProductSlug: 'rechaud-de-camping-categorie-bigbuy',
  },
  {
    key: 'fire-starter',
    name: 'Briquet / allume-feu résistant au vent',
    category: 'cook',
    defaultPriority: 'recommended',
    baseWeightGrams: 50,
    condition: (input) => {
      const needsFire = input.activity === 'bivouac' || input.activity === 'trekking';
      return {
        match: needsFire,
        reason: 'Source de feu indispensable pour allumer réchaud, feu de secours ou signaux.',
        priority: 'recommended',
      };
    },
    preferredProductSlug: 'briquetallume-feu-camping-baton-trekking-black-diamond-bd110065-pourpre',
  },

  // 6. OUTILS & BÂTONS
  {
    key: 'trekking-poles',
    name: 'Bâtons de trekking télescopiques',
    category: 'misc',
    defaultPriority: 'recommended',
    baseWeightGrams: 500,
    condition: (input, maxAlt) => {
      const hilly = maxAlt >= 1200 || input.durationDays >= 3;
      return {
        match: hilly,
        reason: 'Soulagent jusqu’à 25% de la pression sur les genoux en descente et stabilisent les franchissements difficiles.',
      };
    },
    preferredProductSlug: 'baton-trekking-aktive-telescopique-135-cm',
  },
  {
    key: 'folding-knife',
    name: 'Couteau pliant multifonction en inox',
    category: 'misc',
    defaultPriority: 'recommended',
    baseWeightGrams: 100,
    condition: () => ({
      match: true,
      reason: 'Outil polyvalent pour la cuisine, la coupe de cordelettes et les ajustements d’équipement.',
    }),
    preferredProductSlug: 'couteau-pliant-opinel-n8-acier-inoxydable-8-cm',
  },
  {
    key: 'powerbank',
    name: 'Batterie externe étanche Power Bank',
    category: 'tech',
    defaultPriority: 'recommended',
    baseWeightGrams: 200,
    condition: (input) => ({
      match: input.durationDays >= 2,
      reason: 'Garantit la charge continue de votre smartphone ou GPS de secours sans prise électrique.',
      priority: 'recommended',
    }),
    preferredProductSlug: 'batterie-externe-power-bank-categorie-bigbuy',
  },
  {
    key: 'backpack',
    name: 'Sac à dos technique de randonnée',
    category: 'misc',
    defaultPriority: 'recommended',
    baseWeightGrams: 800,
    condition: () => ({
      match: true,
      reason: 'Portage équilibré et ergonomique adapté à la charge totale de votre aventure.',
      priority: 'recommended',
    }),
    preferredProductSlug: 'sac-a-dos-de-randonnee-categorie-bigbuy',
  },
];

/**
 * Moteur pur déterministe de recommandation de kit et d'analyse d'inventaire
 */
export function generateTripContextualKit(input: ContextualKitInput): TripKitAnalysis {
  const currentItems = input.currentItems || [];
  const steps = input.steps || [];
  const availableProducts = input.availableProducts || [];

  // 1. Calcul de l'altitude maximale sur la source unique ElevationProfile (résolution D2)
  let maxAltitudeM = 0;
  if (input.elevationProfile) {
    maxAltitudeM = input.elevationProfile.maxM;
  } else {
    for (const step of steps) {
      const explicitMax = (step as any).elevation_max_m;
      if (typeof explicitMax === 'number' && explicitMax > maxAltitudeM) {
        maxAltitudeM = explicitMax;
      }
    }
    if (maxAltitudeM === 0) {
      // Vérifier si des étapes ont un dénivelé très élevé (>2000m) comme indice de haute altitude
      for (const step of steps) {
        if (step.elevation_gain_m && step.elevation_gain_m > 2000) {
          maxAltitudeM = Math.max(maxAltitudeM, step.elevation_gain_m);
        }
      }
    }
    if (maxAltitudeM === 0 && input.countryCode) {
      const countryCode = input.countryCode.toUpperCase();
      const fallbacks: Record<string, number> = { NP: 3500, PE: 3400, MA: 1200, IS: 500, FR: 480 };
      maxAltitudeM = fallbacks[countryCode] || 0;
    }
  }

  // 2. Alertes contextuelles et climatiques
  const climateWarnings: string[] = [];
  if (input.countryCode === 'IS') {
    climateWarnings.push('Islande : Météo hautement imprévisible, vents violents et passages gués froids. Imperméabilité critique.');
  }
  if (input.countryCode === 'NP') {
    climateWarnings.push('Népal : Écarts thermiques extrêmes entre le jour et la nuit en altitude. Protection thermique prioritaire.');
  }
  if (input.countryCode === 'MA' && input.seasonMonth && input.seasonMonth >= 6 && input.seasonMonth <= 8) {
    climateWarnings.push('Maroc (été) : Risque de canicule sévère. Augmentez la capacité d’emport hydrique.');
  }
  if (maxAltitudeM >= 2500) {
    climateWarnings.push(`Altitude maximale élevée (${maxAltitudeM}m) : risque de mal aigu des montagnes, gel et UV intenses.`);
  }

  // 3. Évaluation des règles contextuelles
  const requiredGaps: ContextualGearRecommendation[] = [];

  for (const rule of CONTEXTUAL_RULES) {
    const { match, reason, priority } = rule.condition(input, maxAltitudeM);
    if (!match) continue;

    // Vérifier si l'utilisateur possède déjà cet objet dans ses items de voyage
    const hasItem = currentItems.some((item) => {
      const name = item.item_name.toLowerCase();
      const ruleKeyWords = rule.name.toLowerCase().split(' ');
      return (
        name.includes(rule.key) ||
        ruleKeyWords.filter((w) => w.length > 4).some((w) => name.includes(w))
      );
    });

    if (!hasItem) {
      const matchedProduct = availableProducts.find(
        (p) => p.slug === rule.preferredProductSlug
      ) || null;

      // Anti-D3 : si le produit boutique a un poids de 0g, repli sur le poids de base calibré
      const weightGrams =
        matchedProduct && matchedProduct.weight_g > 0
          ? matchedProduct.weight_g
          : rule.baseWeightGrams;

      requiredGaps.push({
        id: `rec-${rule.key}`,
        key: rule.key,
        name: rule.name,
        category: rule.category,
        priority: priority || rule.defaultPriority,
        reason,
        weightGrams,
        shopProduct: matchedProduct,
      });
    }
  }

  // 4. Plafond dur de maximum 2 recommandations vitales / safety_critical (résolution D7)
  const candidateVitals = requiredGaps.filter((g) => g.priority === 'vital');
  const candidateOthers = requiredGaps.filter((g) => g.priority !== 'vital');

  // Scoring de criticité technique pour sélectionner les 2 plus vitaux (Plafond D7)
  const scoreRisk = (gap: ContextualGearRecommendation) => {
    let score = 0;
    if (gap.key === 'first-aid') score += 10;
    if (gap.key === 'rain-poncho' && input.countryCode === 'IS') score += 9.8;
    if (gap.key === 'crampons' && (maxAltitudeM >= 2400 || input.countryCode === 'IS' || input.countryCode === 'NP')) score += 9.5;
    if (gap.key === 'water-filter' && maxAltitudeM > 2400) score += 8.8;
    if (gap.key === 'cold-down-jacket' && maxAltitudeM > 2400) score += 8.5;
    if (gap.key === 'survival-blanket' && maxAltitudeM > 2400) score += 8.2;
    if (gap.key === 'headlamp') score += 5;
    if (gap.key === 'whistle') score += 4.5;
    if (gap.key === 'water-bottle') score += 3;
    return score;
  };

  candidateVitals.sort((a, b) => scoreRisk(b) - scoreRisk(a));

  const vitalGaps: ContextualGearRecommendation[] = [];
  const recommendedGaps: ContextualGearRecommendation[] = [...candidateOthers];

  for (let i = 0; i < candidateVitals.length; i++) {
    if (i < 2) {
      vitalGaps.push(candidateVitals[i]);
    } else {
      // Reclassement en recommandé avec raison technique conservée
      recommendedGaps.push({
        ...candidateVitals[i],
        priority: 'recommended',
      });
    }
  }

  const gearGaps = [...vitalGaps, ...recommendedGaps];

  // 5. Métriques de poids et de complétude via computeKitWeight (résolution D3, D4)
  const weightResult = computeKitWeight(currentItems);

  let packedItemsCount = 0;
  let vitalItemsCount = 0;
  let packedVitalCount = 0;

  for (const item of currentItems) {
    if (item.is_packed) {
      packedItemsCount++;
    }
    if ((item as any).is_vital || item.priority === 'vital') {
      vitalItemsCount++;
      if (item.is_packed) {
        packedVitalCount++;
      }
    }
  }

  const totalItemsCount = currentItems.length;
  const completionPercent =
    totalItemsCount > 0 ? Math.round((packedItemsCount / totalItemsCount) * 100) : 0;

  return {
    totalItemsCount,
    packedItemsCount,
    vitalItemsCount,
    packedVitalCount,
    completionPercent,
    totalWeightGrams: weightResult.totalWeightGrams,
    baseWeightGrams: weightResult.baseWeightGrams,
    wornWeightGrams: weightResult.wornWeightGrams,
    consumableWeightGrams: weightResult.consumableWeightGrams,
    weightCategory: weightResult.weightCategory,
    unweighedItemsCount: weightResult.unweighedItemsCount,
    maxAltitudeM,
    seasonContext: input.seasonMonth ? `Mois ${input.seasonMonth}` : 'Dates flexibles',
    climateWarnings,
    vitalGaps,
    recommendedGaps,
    gearGaps,
  };
}

/**
 * Calcule la durée en jours d'un voyage à partir de ses dates ou étapes
 */
export function getTripDurationDays(trip: {
  start_date?: string | null;
  end_date?: string | null;
  steps?: { day_number: number }[];
}): number {
  if (trip.start_date && trip.end_date) {
    const duration = getCivilDurationDays(trip.start_date, trip.end_date);
    if (duration > 0) return duration;
  }
  if (trip.steps && trip.steps.length > 0) {
    const maxDay = Math.max(...trip.steps.map((s) => s.day_number || 1));
    return Math.max(maxDay, 1);
  }
  return 1;
}
