/**
 * Moteur de Préparation Centralisé (Intelligent Matching)
 * Indépendant de React/UI. Analyse Randonnée + Conditions + Inventaire = Besoins & Score.
 */

import { WeatherSnapshot } from '../../features/hiking/types';

export interface HikeContext {
  id: string;
  name: string;
  distanceKm: number;
  durationHours?: number;
  elevationGain?: number;
  difficulty?: string;
  season?: string;
  terrain?: string;
  hasWaterPoints?: boolean;
  waterPointsCount?: number;
  hasRefuges?: boolean;
  weather?: WeatherSnapshot | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  tags?: string[];
  weightGrams: number;
  condition: string;
  quantity: number;
  loan_status?: string | null;
  product_id?: string;
}

export type Priority = 'vital' | 'recommande' | 'optionnel';
export type Unit = 'L' | 'repas' | 'L (volume)' | 'unité';
export type MatchStatus = 'EXACT' | 'EQUIVALENT' | 'PARTIAL' | 'INCOMPATIBLE';

export interface GearRequirement {
  id: string;
  label: string; 
  categoryKeywords: string[];
  nameKeywords: string[];
  required: number;
  unit: Unit;
  priority: Priority;
  reason: string;
  /** Contenance (ou quantité) maximale raisonnablement transportable.
   *  Au-delà, la valeur demandée est plafonnée et l'interface invite à prévoir un ravitaillement. */
  maxCarryable?: number;
  /** Vrai quand le besoin dépasse la contenance transportable → « prévoir ravitaillement ». */
  needsRefill?: boolean;
}

export interface MatchingDetail {
  item: InventoryItem;
  status: MatchStatus;
  reason: string;
  contributedQuantity: number;
}

export interface MatchedItem {
  requirement: GearRequirement;
  matchingDetails: MatchingDetail[];
  available: number;
  missing: number;
  isFulfilled: boolean;
}

export interface PreparationResult {
  score: number;
  matchedRequirements: MatchedItem[];
  missingRequirements: GearRequirement[];
  warnings: string[];
}

/**
 * Alternatives Dictionary: 
 */
export type AlternativesDict = Record<string, string[]>;

/**
 * 1. Détermine les besoins (GearRequirements) mesurables.
 */
export function analyzeNeeds(context: HikeContext): GearRequirement[] {
  const needs: GearRequirement[] = [];
  
  const duration = context.durationHours || (context.distanceKm / 4); 
  const isDayHike = duration <= 12;

  // --- EAU (Litres) ---
  let waterNeeded = duration * 0.5;
  if (context.elevationGain && context.elevationGain > 500) waterNeeded += 0.5;
  if (context.difficulty?.toLowerCase().includes('difficile')) waterNeeded += 0.5;
  waterNeeded = Math.max(1, waterNeeded);
  
  const waterPoints = context.waterPointsCount || (context.hasWaterPoints ? 1 : 0);
  if (waterPoints > 0) {
    waterNeeded = Math.min(waterNeeded, 1.5 + (0.2 * waterPoints));
  }
  waterNeeded = Math.ceil(waterNeeded * 2) / 2;

  needs.push({
    id: 'req-eau',
    label: 'Eau',
    categoryKeywords: ['eau', 'hydratation', 'gourde', 'camelbak', 'poche'],
    nameKeywords: ['gourde', 'poche', 'bouteille', 'flask'],
    required: waterNeeded,
    unit: 'L',
    priority: 'vital',
    maxCarryable: 4,
    needsRefill: waterNeeded > 4,
    reason: `Calcul basé sur ${duration.toFixed(1)}h de marche${waterPoints > 0 ? ' avec points d\'eau' : ' sans point d\'eau'}.`
      + (waterNeeded > 4 ? ' Contenance maximale transportable ≈ 4 L : prévoir un ravitaillement en cours de route.' : ''),
  });

  // --- NOURRITURE (Repas) ---
  const foodNeeded = Math.max(1, Math.floor(duration / 4));
  needs.push({
    id: 'req-nourriture',
    label: 'Nourriture (Repas / Encas)',
    categoryKeywords: ['nourriture', 'repas', 'alimentation', 'nutrition'],
    nameKeywords: ['barre', 'repas', 'lyophilisé', 'gel', 'ration'],
    required: Math.min(foodNeeded, 8),
    unit: 'repas',
    priority: 'vital',
    maxCarryable: 8,
    needsRefill: foodNeeded > 8,
    reason: foodNeeded > 8
      ? 'Maintenir son niveau d\'énergie est crucial. Espace limité dans le sac : prévoir un ravitaillement en nourriture en cours de route (max ≈ 8 repas).'
      : 'Maintenir son niveau d\'énergie est crucial.',
  });

  // --- SAC À DOS (L Volume) ---
  let bagVolume = isDayHike ? 20 : 45;
  if (!isDayHike && (context.weather?.tempC !== undefined && context.weather.tempC < 5)) {
    bagVolume = 60;
  }
  needs.push({
    id: 'req-sac',
    label: 'Sac à dos',
    categoryKeywords: ['sac', 'portage', 'backpack'],
    nameKeywords: ['sac à dos', 'sac'],
    required: bagVolume,
    unit: 'L (volume)',
    priority: 'vital',
    reason: `Volume recommandé pour ${isDayHike ? 'une journée' : 'plusieurs jours'}.`,
  });

  // --- COUCHAGE & ABRI (Unité) ---
  if (!isDayHike) {
    needs.push({
      id: 'req-couchage',
      label: 'Sac de couchage',
      categoryKeywords: ['couchage', 'duvet', 'sleeping'],
      nameKeywords: ['duvet', 'sac de couchage'],
      required: 1,
      unit: 'unité',
      priority: 'vital',
      reason: 'Nuit en extérieur ou refuge prévue.',
    });

    if (!context.hasRefuges) {
      needs.push({
        id: 'req-tente',
        label: 'Abri / Tente',
        categoryKeywords: ['tente', 'abri', 'bivouac', 'tarp'],
        nameKeywords: ['tente', 'tarp', 'hamac', 'bivouac'],
        required: 1,
        unit: 'unité',
        priority: 'vital',
        reason: 'Aucun refuge identifié sur le parcours.',
      });
    }
  }

  // --- VÊTEMENTS & PROTECTION (Basé sur la vraie météo) ---
  if (context.weather) {
    const w = context.weather;
    
    // Froid
    if (w.tempC < 10) {
      needs.push({
        id: 'req-chaud',
        label: 'Vêtement thermique',
        categoryKeywords: ['vêtement', 'isolation', 'polaire', 'doudoune'],
        nameKeywords: ['polaire', 'doudoune', 'thermique'],
        required: 1,
        unit: 'unité',
        priority: 'vital',
        reason: `Température prévue : ${w.tempC}°C. Risque de froid.`,
      });
    }
    
    // Pluie
    const isRaining = w.precipitationProbability > 30 || w.condition.toLowerCase().includes('pluie') || w.condition.toLowerCase().includes('averses') || w.condition.toLowerCase().includes('orage');
    if (isRaining) {
      needs.push({
        id: 'req-imper',
        label: 'Veste imperméable',
        categoryKeywords: ['vêtement', 'protection', 'imperméable', 'veste'],
        nameKeywords: ['imper', 'hardshell', 'gore-tex', 'poncho'],
        required: 1,
        unit: 'unité',
        priority: 'vital',
        reason: `Probabilité de pluie : ${w.precipitationProbability}%. Condition : ${w.condition}.`,
      });
    }

    // Vent
    if (w.windKmH > 40) {
      needs.push({
        id: 'req-vent',
        label: 'Coupe-vent',
        categoryKeywords: ['vêtement', 'protection', 'veste', 'windstopper'],
        nameKeywords: ['coupe-vent', 'windbreaker', 'softshell'],
        required: 1,
        unit: 'unité',
        priority: 'recommande',
        reason: `Vent fort attendu (${w.windKmH} km/h).`,
      });
    }

    // Soleil / UV
    if (w.uvIndex && w.uvIndex > 5) {
      needs.push({
        id: 'req-soleil',
        label: 'Protection solaire',
        categoryKeywords: ['soin', 'protection', 'soleil', 'lunettes'],
        nameKeywords: ['crème', 'solaire', 'lunettes', 'chapeau', 'casquette'],
        required: 1,
        unit: 'unité',
        priority: 'recommande',
        reason: `Indice UV élevé (${w.uvIndex}).`,
      });
    }
  }

  return needs;
}

export function extractCapacity(name: string, unit: Unit): number | null {
  if (unit === 'L' || unit === 'L (volume)') {
    const match = name.match(/(\d+(?:\.\d+)?)\s*(?:L|litres?|liter)\b/i);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
    if (unit === 'L') {
      const mlMatch = name.match(/(\d+)\s*ml\b/i);
      if (mlMatch && mlMatch[1]) {
        return parseFloat(mlMatch[1]) / 1000;
      }
    }
  }
  return null;
}

/**
 * Vérifie si un objet possède un tag spécifique (ou si sa marque / modèle le suggère).
 */
function hasEquivalentTag(item: InventoryItem, reqKeywords: string[], alternatives: AlternativesDict = {}): boolean {
  // Direct tags
  if (item.tags) {
    for (const tag of item.tags) {
      if (reqKeywords.some(k => tag.toLowerCase().includes(k))) return true;
      // Check if this tag is a known equivalent in the alternatives dict
      if (alternatives[tag] && alternatives[tag].some(alt => reqKeywords.some(k => alt.toLowerCase().includes(k)))) return true;
    }
  }
  // Brand equivalence (e.g. CamelBak -> poche à eau)
  if (item.brand) {
    const b = item.brand.toLowerCase();
    if (b === 'camelbak' && reqKeywords.includes('eau')) return true;
    if (b === 'nalgene' && reqKeywords.includes('eau')) return true;
  }
  // Model equivalence
  if (item.model) {
    const m = item.model.toLowerCase();
    if (m.includes('tarp') && reqKeywords.includes('tente')) return true;
  }
  return false;
}

/**
 * 2. Moteur de Classification Expert. Compare les besoins avec l'inventaire réel.
 */
export function matchInventory(
  needs: GearRequirement[], 
  inventory: InventoryItem[],
  context: HikeContext,
  alternatives: AlternativesDict = {}
): MatchedItem[] {

  const inventoryPool = [...inventory];

  return needs.map(req => {
    let totalAvailable = 0;
    const matchingDetails: MatchingDetail[] = [];

    // Scan each item in inventory
    for (const item of inventoryPool) {
      let status: MatchStatus | null = null;
      let reason = '';

      // 1. Incompatibilités absolues
      const matchesCategory = req.categoryKeywords.some(k => item.category.toLowerCase().includes(k));
      const matchesName = req.nameKeywords.some(k => item.name.toLowerCase().includes(k));
      const potentialMatch = matchesCategory || matchesName;

      if (item.loan_status === 'loaned') {
        if (potentialMatch) {
          matchingDetails.push({ item, status: 'INCOMPATIBLE', reason: `Équipement prêté (${item.loan_status}).`, contributedQuantity: 0 });
        }
        continue;
      }

      if (item.condition === 'a_remplacer' || item.condition === 'inutilisable') {
        const matchesCategory = req.categoryKeywords.some(k => item.category.toLowerCase().includes(k));
        const matchesName = req.nameKeywords.some(k => item.name.toLowerCase().includes(k));
        if (matchesCategory || matchesName) {
          matchingDetails.push({ item, status: 'INCOMPATIBLE', reason: `État d'usure critique (${item.condition}).`, contributedQuantity: 0 });
        }
        continue;
      }

      // 2. Vérification de Correspondance (Exacte ou Équivalente)
      const exactMatch = req.categoryKeywords.some(k => item.category.toLowerCase().includes(k)) || 
                         req.nameKeywords.some(k => item.name.toLowerCase().includes(k));
      
      const equivMatch = hasEquivalentTag(item, req.categoryKeywords, alternatives) || 
                         hasEquivalentTag(item, req.nameKeywords, alternatives);

      if (!exactMatch && !equivMatch) continue;

      // 3. Incompatibilité contextuelle (ex: Tarp en Hiver)
      const isWinter = context.season?.toLowerCase().includes('hiver');
      const isTarp = item.name.toLowerCase().includes('tarp') || item.model?.toLowerCase().includes('tarp');
      
      if (req.id === 'req-tente' && isWinter && isTarp) {
        matchingDetails.push({ item, status: 'INCOMPATIBLE', reason: `Un Tarp n'est pas adapté pour le bivouac en hiver (Tente fermée requise).`, contributedQuantity: 0 });
        continue;
      }

      // Détermine la capacité unitaire
      let unitCap = 1; // Default
      if (req.unit === 'L') {
        unitCap = extractCapacity(item.name, 'L') || 0.75;
      } else if (req.unit === 'L (volume)') {
        unitCap = extractCapacity(item.name, 'L (volume)') || 20;
      }

      const totalItemCapacity = unitCap * (item.quantity || 1);
      totalAvailable += totalItemCapacity;
      
      // 4. Déduction du statut
      if (exactMatch) {
        status = 'EXACT';
        reason = `Correspondance parfaite trouvée.`;
      } else {
        status = 'EQUIVALENT';
        reason = `Identifié comme alternative compatible.`;
      }

      if ((req.unit === 'L' || req.unit === 'L (volume)') && totalItemCapacity < req.required) {
        status = 'PARTIAL';
        reason = `Équipement adéquat mais capacité insuffisante seule (${totalItemCapacity}${req.unit} sur ${req.required}${req.unit}).`;
      }

      matchingDetails.push({
        item,
        status,
        reason,
        contributedQuantity: totalItemCapacity
      });
    }

    totalAvailable = Math.round(totalAvailable * 10) / 10;
    const missing = Math.max(0, req.required - totalAvailable);
    const isFulfilled = totalAvailable >= req.required;

    if (isFulfilled) {
      matchingDetails.forEach(md => {
        if (md.status === 'PARTIAL') {
          md.reason = `Capacité combinée avec d'autres équipements (${md.contributedQuantity}${req.unit}).`;
        }
      });
    }

    return {
      requirement: req,
      matchingDetails,
      available: totalAvailable,
      missing: Math.round(missing * 10) / 10,
      isFulfilled,
    };
  });
}

/**
 * 3. Calcule le score global de préparation.
 */
export function computeScore(matchedItems: MatchedItem[]): { score: number; warnings: string[] } {
  let score = 100;
  const warnings: string[] = [];

  for (const match of matchedItems) {
    if (!match.isFulfilled) {
      const req = match.requirement;
      const missingRatio = match.missing / req.required;
      
      if (req.priority === 'vital') {
        score -= 25 * missingRatio; 
        warnings.push(`Critique : Il manque ${match.missing} ${req.unit} de ${req.label}.`);
      } else if (req.priority === 'recommande') {
        score -= 10 * missingRatio;
        warnings.push(`Attention : Il manque ${match.missing} ${req.unit} de ${req.label}.`);
      } else {
        score -= 5 * missingRatio;
      }
    }
    
    // Warn about incompatibilities
    match.matchingDetails.filter(md => md.status === 'INCOMPATIBLE').forEach(md => {
      warnings.push(`Info : ${md.item.name} ignoré (${md.reason})`);
    });
  }

  return {
    score: Math.max(0, Math.round(score)),
    warnings
  };
}

/**
 * 4. Orchestrateur principal
 */
export function runPreparation(
  context: HikeContext, 
  inventory: InventoryItem[],
  alternatives: AlternativesDict = {}
): PreparationResult {
  const needs = analyzeNeeds(context);
  const matched = matchInventory(needs, inventory, context, alternatives);
  const { score, warnings } = computeScore(matched);

  return {
    score,
    matchedRequirements: matched.filter(m => m.isFulfilled || m.available > 0), 
    missingRequirements: matched.filter(m => !m.isFulfilled).map(m => m.requirement), 
    warnings
  };
}
