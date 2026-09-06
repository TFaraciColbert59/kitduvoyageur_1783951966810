import type { TripItem, TripStep } from '../types/trip.types';
import type {
  ShopProductReference,
  ContextualGearRecommendation,
  TripKitAnalysis,
} from '../types/kit.types';

export interface ContextualKitInput {
  countryCode?: string | null;
  activity?: string | null;
  durationDays: number;
  seasonMonth?: number; // 1 to 12
  steps?: TripStep[];
  currentItems?: TripItem[];
  availableProducts?: ShopProductReference[];
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
    defaultPriority: 'vital',
    baseWeightGrams: 20,
    condition: () => ({
      match: true,
      reason: 'Signal sonore d’urgence audible à longue distance en cas de brouillard ou chute.',
      priority: 'vital',
    }),
    preferredProductSlug: 'sifflet-de-survie-urgence-categorie-bigbuy',
  },
  {
    key: 'headlamp',
    name: 'Lampe frontale LED haute autonomie',
    category: 'tech',
    defaultPriority: 'vital',
    baseWeightGrams: 90,
    condition: () => ({
      match: true,
      reason: 'Éclairage mains libres essentiel pour les départs matinaux, arrivées tardives et nuits en refuge/bivouac.',
      priority: 'vital',
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

  // 2. ALTITUDE & CONDITIONS ALPINES (Montagne, passages de cols)
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
    defaultPriority: 'vital',
    baseWeightGrams: 120,
    condition: (input, maxAlt) => {
      const intenseUv = maxAlt >= 1800 || input.countryCode === 'MA' || input.countryCode === 'PE';
      return {
        match: true,
        reason: intenseUv
          ? `Rayonnement UV démultiplié par l’altitude (${maxAlt}m) ou l'exposition désertique : protection vitale contre les brûlures solaires.`
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
    defaultPriority: 'vital',
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
    defaultPriority: 'vital',
    baseWeightGrams: 200,
    condition: () => ({
      match: true,
      reason: 'Réservoir principal d’eau pour sécuriser l’autonomie entre deux points de ravitaillement.',
      priority: 'vital',
    }),
    preferredProductSlug: 'bouteille-deau-picture-acc121-a-blanc-naturel-acier',
  },

  // 4. PLUIE & INTEMPÉRIES
  {
    key: 'rain-poncho',
    name: 'Poncho imperméable & coupe-vent',
    category: 'clothing',
    defaultPriority: 'vital',
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
    defaultPriority: 'vital',
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
    defaultPriority: 'vital',
    baseWeightGrams: 50,
    condition: (input) => {
      const needsFire = input.activity === 'bivouac' || input.activity === 'trekking';
      return {
        match: needsFire,
        reason: 'Source de feu indispensable pour allumer réchaud, feu de secours ou signaux.',
        priority: 'vital',
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
    defaultPriority: 'vital',
    baseWeightGrams: 200,
    condition: (input) => ({
      match: input.durationDays >= 2,
      reason: 'Garantit la charge continue de votre smartphone ou GPS de secours sans prise électrique.',
      priority: 'vital',
    }),
    preferredProductSlug: 'batterie-externe-power-bank-categorie-bigbuy',
  },
  {
    key: 'backpack',
    name: 'Sac à dos technique de randonnée',
    category: 'misc',
    defaultPriority: 'vital',
    baseWeightGrams: 800,
    condition: () => ({
      match: true,
      reason: 'Portage équilibré et ergonomique adapté à la charge totale de votre aventure.',
      priority: 'vital',
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

  // 1. Calcul de l'altitude maximale sur les étapes du voyage
  let maxAltitudeM = 0;
  for (const step of steps) {
    if (step.elevation_gain_m && step.elevation_gain_m > maxAltitudeM) {
      maxAltitudeM = Math.max(maxAltitudeM, step.elevation_gain_m);
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
      // Correspondance exacte ou partielle significative
      return (
        name.includes(rule.key) ||
        ruleKeyWords.filter((w) => w.length > 4).some((w) => name.includes(w))
      );
    });

    if (!hasItem) {
      // Rechercher le produit réel de la boutique LKDV correspondant
      const matchedProduct = availableProducts.find(
        (p) => p.slug === rule.preferredProductSlug
      ) || null;

      requiredGaps.push({
        id: `rec-${rule.key}`,
        name: rule.name,
        category: rule.category,
        priority: priority || rule.defaultPriority,
        reason,
        weightGrams: matchedProduct ? matchedProduct.weight_g : rule.baseWeightGrams,
        shopProduct: matchedProduct,
      });
    }
  }

  const vitalGaps = requiredGaps.filter((g) => g.priority === 'vital');
  const recommendedGaps = requiredGaps.filter((g) => g.priority !== 'vital');

  // 4. Métriques de poids et de complétude
  let totalWeightGrams = 0;
  let baseWeightGrams = 0;
  let wornWeightGrams = 0;
  let consumableWeightGrams = 0;
  let packedItemsCount = 0;
  let vitalItemsCount = 0;
  let packedVitalCount = 0;

  for (const item of currentItems) {
    const weight = (item.weight_grams || 0) * (item.quantity || 1);
    totalWeightGrams += weight;

    if (item.is_worn) {
      wornWeightGrams += weight;
    } else if (item.is_consumable) {
      consumableWeightGrams += weight;
    } else {
      baseWeightGrams += weight;
    }

    if (item.is_packed) {
      packedItemsCount++;
    }

    if (item.is_vital || item.priority === 'vital') {
      vitalItemsCount++;
      if (item.is_packed) {
        packedVitalCount++;
      }
    }
  }

  const totalItemsCount = currentItems.length;
  const completionPercent = totalItemsCount > 0 ? Math.round((packedItemsCount / totalItemsCount) * 100) : 0;

  let weightCategory: TripKitAnalysis['weightCategory'] = 'standard';
  if (baseWeightGrams < 5000) {
    weightCategory = 'ultralight';
  } else if (baseWeightGrams < 8000) {
    weightCategory = 'light';
  } else if (baseWeightGrams <= 12000) {
    weightCategory = 'standard';
  } else {
    weightCategory = 'heavy';
  }

  return {
    totalItemsCount,
    packedItemsCount,
    vitalItemsCount,
    packedVitalCount,
    completionPercent,
    totalWeightGrams,
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    weightCategory,
    maxAltitudeM,
    seasonContext: input.seasonMonth ? `Mois ${input.seasonMonth}` : 'Dates flexibles',
    climateWarnings,
    vitalGaps,
    recommendedGaps,
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
    const start = new Date(trip.start_date).getTime();
    const end = new Date(trip.end_date).getTime();
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (diff > 0) return diff;
  }
  if (trip.steps && trip.steps.length > 0) {
    const maxDay = Math.max(...trip.steps.map((s) => s.day_number || 1));
    return Math.max(maxDay, 1);
  }
  return 1;
}
