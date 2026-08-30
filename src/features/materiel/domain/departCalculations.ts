import type { ChecklistItem } from '../types/trekHub';
import type { WeatherForecast } from '../services/getWeather';

const VITAL_KEYWORDS = [
  'tente',
  'abri',
  'tarp',
  'sac de couchage',
  'duvet',
  'trousse',
  'secours',
  'premiers secours',
  'filtre',
  'gourde',
  'poche à eau',
  'veste',
  'imperméable',
  'pluie',
  'hardshell',
  'couverture de survie',
  'lampe',
  'frontale',
  'boussole',
  'sifflet',
];

/** Détecte si un article est vital pour la sécurité en randonnée/bivouac. */
export function isVitalItem(name: string, category: string | null = null): boolean {
  const lowerName = (name || '').toLowerCase();
  const lowerCat = (category || '').toLowerCase();

  if (lowerCat === 'sécurité' || lowerCat === 'secours' || lowerCat === 'bivouac' || lowerCat === 'couchage') {
    if (VITAL_KEYWORDS.some((kw) => lowerName.includes(kw))) return true;
  }

  return VITAL_KEYWORDS.some((kw) => lowerName.includes(kw));
}

/**
 * Calcule le Poids de Base (Base Weight) :
 * Somme des articles au dos, à l exclusion stricte des vêtements portés sur soi (is_worn)
 * et des consommables (is_consumable).
 */
export function calcBaseWeight(items: ChecklistItem[]): number {
  return items.reduce((sum, item) => {
    if (item.is_worn || item.is_consumable) return sum;
    const w = item.weight_g ?? 0;
    return sum + (w > 0 ? w : 0);
  }, 0);
}

/** Calcule le poids total porté sur soi (vêtements, chaussures, montre). */
export function calcWornWeight(items: ChecklistItem[]): number {
  return items.reduce((sum, item) => {
    if (!item.is_worn) return sum;
    const w = item.weight_g ?? 0;
    return sum + (w > 0 ? w : 0);
  }, 0);
}

/** Calcule le poids des consommables (eau, nourriture, gaz). */
export function calcConsumablesWeight(
  items: ChecklistItem[],
  consumables?: Record<string, number> | null
): number {
  let weightFromItems = items.reduce((sum, item) => {
    if (!item.is_consumable) return sum;
    const w = item.weight_g ?? 0;
    return sum + (w > 0 ? w : 0);
  }, 0);

  if (consumables) {
    const waterLiters = consumables.water ?? 0;
    const gasGrams = consumables.gas ?? 0;
    const meals = consumables.meals ?? 0;
    const snacks = consumables.snacks ?? 0;

    // Eau : 1000g/L, Gaz : grammes bruts, Repas lyophilisés : ~150g/repas, Snacks : ~50g/ration
    const estimatedExtraGrams = (waterLiters * 1000) + gasGrams + (meals * 150) + (snacks * 50);
    if (weightFromItems === 0) {
      weightFromItems = estimatedExtraGrams;
    }
  }

  return weightFromItems;
}

/** Calcule le poids total au dos au moment du départ (Poids de base + Consommables). */
export function calcTotalPackWeight(baseWeightG: number, consumablesWeightG: number): number {
  return Math.max(0, baseWeightG + consumablesWeightG);
}

/** Calcule le % de préparation brut à partir des items cochés. Retourne [0, 100]. */
export function calcReadinessPct(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const checked = items.filter((i) => i.is_checked).length;
  return Math.min(100, Math.max(0, Math.round((checked / items.length) * 100)));
}

export interface WeightedReadinessResult {
  status: 'critical' | 'warning' | 'ok';
  grade: 'A+' | 'A' | 'B' | 'C' | 'Critique';
  label: string;
  percentage: number;
  missingVitals: string[];
  factors: string[];
}

/**
 * Score de statut pondéré selon la règle du Master Prompt V2 (§4A) :
 * - Critique si : ≥1 item vital manquant OU pluie sans protection.
 * - Warning si : checklist < 100% OU alerte météo active OU contact ICE manquant.
 * - Prêt si : tout coché + vitaux présents + météo compatible + contact ICE renseigné.
 */
export function calcWeightedReadinessScore(
  items: ChecklistItem[],
  weather?: WeatherForecast | null,
  emergencyContact?: string | null
): WeightedReadinessResult {
  const percentage = calcReadinessPct(items);
  const factors: string[] = [];

  // Recherche des vitaux non cochés
  const missingVitals: string[] = [];
  for (const item of items) {
    const isVital = item.is_vital ?? isVitalItem(item.name, item.category);
    if (isVital && !item.is_checked) {
      missingVitals.push(item.name);
    }
  }

  // Analyse météo pluie
  const rainExpected = (weather?.current?.precipPct ?? 0) > 40 ||
    (weather?.days && weather.days.some((d) => d.precipPct > 50));
  const hasRainGear = items.some((i) => {
    const isRainItem = i.name.toLowerCase().includes('veste') ||
      i.name.toLowerCase().includes('pluie') ||
      i.name.toLowerCase().includes('imperméable');
    return isRainItem && i.is_checked;
  });

  if (missingVitals.length > 0) {
    factors.push(`${missingVitals.length} équipement(s) vital(aux) manquant(s) : ${missingVitals.slice(0, 2).join(', ')}`);
    return {
      status: 'critical',
      grade: 'Critique',
      label: 'Critique — départ déconseillé',
      percentage,
      missingVitals,
      factors,
    };
  }

  if (rainExpected && !hasRainGear) {
    factors.push('Pluie prévue sans protection imperméable validée');
    return {
      status: 'critical',
      grade: 'Critique',
      label: 'Critique — équipement pluie manquant',
      percentage,
      missingVitals: ['Veste imperméable'],
      factors,
    };
  }

  if (percentage < 100) {
    const remaining = items.length - items.filter((i) => i.is_checked).length;
    factors.push(`${remaining} article(s) restant(s) à préparer`);
    return {
      status: 'warning',
      grade: percentage >= 80 ? 'B' : 'C',
      label: 'À finaliser',
      percentage,
      missingVitals: [],
      factors,
    };
  }

  if (!emergencyContact || emergencyContact.trim().length === 0) {
    factors.push('Contact d’urgence ICE non renseigné');
    return {
      status: 'warning',
      grade: 'A',
      label: 'À finaliser — Contact ICE requis',
      percentage,
      missingVitals: [],
      factors,
    };
  }

  factors.push('Tous les équipements vitaux et consommables sont prêts');
  return {
    status: 'ok',
    grade: 'A+',
    label: 'Prêt pour le départ',
    percentage: 100,
    missingVitals: [],
    factors,
  };
}

/** Rétrocompatibilité : dérive le statut simple à partir du pourcentage. */
export function deriveStatus(readinessPct: number): 'ok' | 'warning' | 'critical' {
  if (readinessPct >= 80) return 'ok';
  if (readinessPct >= 40) return 'warning';
  return 'critical';
}

/** Calcule la répartition du poids par catégorie. */
export function calcWeightBreakdown(
  items: ChecklistItem[]
): { category: string; weightG: number; percentage: number }[] {
  const total = calcBaseWeight(items);
  if (total === 0) return [];

  const map = new Map<string, number>();
  for (const item of items) {
    if (item.is_worn || item.is_consumable) continue;
    const cat = item.category ?? 'Autre';
    map.set(cat, (map.get(cat) ?? 0) + Math.max(0, item.weight_g ?? 0));
  }

  return Array.from(map.entries())
    .map(([category, weightG]) => ({
      category,
      weightG,
      percentage: Math.round((weightG / total) * 100),
    }))
    .sort((a, b) => b.weightG - a.weightG);
}

/** Formate un poids en grammes en chaîne lisible (g ou kg). */
export function formatWeight(grams: number): string {
  if (grams <= 0) return '--';
  if (grams < 1000) return `${grams} g`;
  return `${(grams / 1000).toFixed(1)} kg`;
}

/** Formate une distance en km proprement sans décimales parasites. */
export function formatDistanceKm(distanceKm: number | null | undefined): string {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= 0) return '--';
  if (Number.isInteger(distanceKm)) return `${distanceKm} km`;
  return `${distanceKm.toFixed(1)} km`;
}
