/**
 * Moteur PUR de sélection du kit depuis le catalogue `shop_products` importé.
 *
 * Règles déterministes (aucune I/O, aucune invention) :
 *   • `indispensable` : toujours retenu (quantité 1) ;
 *   • `recommande` : retenu si le contexte réel matche la catégorie
 *     (hiver → Protection froid ; bivouac / multi-jours → Bivouac / Sommeil ;
 *     D+ ≥ 800 m → bâtons ; difficulté hard/expert → protection des pieds) ;
 *   • `optionnel` : retenu seulement si le budget de poids le permet ;
 *   • matériel partagé (abri / cuisine) : ×1 pour le groupe ; hydratation :
 *     quantité = nombre de personnes ;
 *   • avertissements explicites pour les catégories indispensables absentes.
 */

export type KitSelectionPriority = 'indispensable' | 'recommande' | 'optionnel';

export interface KitProduct {
  slug: string;
  name: string;
  category: string;
  priority: KitSelectionPriority;
  weightGrams: number | null;
  sellPriceEur: number | null;
}

export interface KitSelectionInput {
  activity: string;
  durationDays: number;
  season?: string | null;
  difficulty?: string | null;
  elevationGainM?: number | null;
  partySize: number;
}

export interface KitSelectionItem {
  product: KitProduct;
  quantity: number;
  ownership: 'personal' | 'shared';
  reason: string;
}

export interface KitSelection {
  items: KitSelectionItem[];
  totalWeightGrams: number;
  warnings: string[];
}

/** Catégories de matériel partagé par le groupe (abri / cuisine). */
export const SHARED_CATEGORIES = ['Bivouac / Sommeil', 'Alimentation / Cuisine'];

/** Catégories dont la quantité se compte par personne (eau). */
export const PER_PERSON_CATEGORIES = ['Hydratation'];

/** Catégories indispensables attendues au catalogue (sinon alerte explicite). */
export const REQUIRED_CATEGORIES = [
  'Sécurité / Urgence',
  'Éclairage',
  'Hydratation',
  'Navigation / Orientation',
];

/** Budget de poids dur pour les produits optionnels (grammes). */
export const MAX_TOTAL_WEIGHT_GRAMS = 12000;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function categoryMatches(category: string, expected: string): boolean {
  return normalizeText(category) === normalizeText(expected);
}

function isWinterSeason(season: string | null | undefined): boolean {
  if (!season) return false;
  const value = normalizeText(season);
  if (value.includes('hiver') || value.includes('winter')) return true;
  const month = Number(value);
  if (Number.isFinite(month) && [12, 1, 2].includes(month)) return true;
  return ['decembre', 'janvier', 'fevrier', 'dec', 'jan', 'feb'].some((monthName) =>
    value.includes(monthName)
  );
}

function isTrekkingPole(product: KitProduct): boolean {
  if (!categoryMatches(product.category, 'Équipement du sac')) return false;
  return /baton/.test(normalizeText(product.name));
}

function isHardDifficulty(difficulty: string | null | undefined): boolean {
  if (!difficulty) return false;
  const value = normalizeText(difficulty);
  return value === 'hard' || value === 'expert' || value === 'difficile';
}

function sharedCategory(category: string): boolean {
  return SHARED_CATEGORIES.some((shared) => categoryMatches(category, shared));
}

/**
 * Sélectionne les produits réels du catalogue pour un voyage donné.
 * Les poids inconnus comptent 0 dans le total (jamais inventés).
 */
export function selectKitProducts(
  input: KitSelectionInput,
  catalogue: KitProduct[]
): KitSelection {
  const warnings: string[] = [];
  const products = Array.isArray(catalogue) ? catalogue : [];
  const partySize = Math.max(1, Math.trunc(input.partySize || 1));
  const durationDays = Math.max(0, Math.trunc(input.durationDays || 0));
  const activity = normalizeText(input.activity ?? '');
  const isBivouac = activity.includes('bivouac');
  const isTrekking = activity.includes('trekking');
  const multiDay = durationDays >= 2;
  const winter = isWinterSeason(input.season);
  const elevationGainM = Number.isFinite(input.elevationGainM ?? NaN)
    ? Number(input.elevationGainM)
    : 0;
  const highGain = elevationGainM >= 800;
  const hardDifficulty = isHardDifficulty(input.difficulty);

  for (const required of REQUIRED_CATEGORIES) {
    if (!products.some((product) => categoryMatches(product.category, required))) {
      warnings.push(
        `Catalogue incomplet : aucun produit « ${required} » (indispensable) — à compléter.`
      );
    }
  }

  const items: KitSelectionItem[] = [];
  let totalWeightGrams = 0;

  const append = (product: KitProduct, reason: string) => {
    const ownership: KitSelectionItem['ownership'] = sharedCategory(product.category)
      ? 'shared'
      : 'personal';
    const perPerson = PER_PERSON_CATEGORIES.some((category) =>
      categoryMatches(product.category, category)
    );
    const quantity = perPerson ? partySize : 1;
    items.push({ product, quantity, ownership, reason });
    totalWeightGrams += (product.weightGrams ?? 0) * quantity;
  };

  const indispensables = products.filter((product) => product.priority === 'indispensable');
  const recommandables = products.filter((product) => product.priority === 'recommande');
  const optionals = products.filter((product) => product.priority === 'optionnel');

  for (const product of indispensables) {
    append(product, 'Indispensable au catalogue : sélection systématique du kit.');
  }

  for (const product of recommandables) {
    if (categoryMatches(product.category, 'Protection froid') && winter) {
      append(
        product,
        `Saison hivernale : protection froid recommandée (${product.name}).`
      );
      continue;
    }
    if (
      (isBivouac || isTrekking || multiDay) &&
      (categoryMatches(product.category, 'Bivouac / Sommeil') ||
        categoryMatches(product.category, 'Alimentation / Cuisine'))
    ) {
      append(
        product,
        'Bivouac / itinérance multi-jours : abri, couchage et cuisine recommandés.'
      );
      continue;
    }
    if (highGain && isTrekkingPole(product)) {
      append(
        product,
        `D+ ${elevationGainM} m (≥ 800 m) : bâtons recommandés pour préserver les genoux.`
      );
      continue;
    }
    if (hardDifficulty && categoryMatches(product.category, 'Confort des pieds')) {
      append(
        product,
        `Difficulté ${input.difficulty} : protection des pieds recommandée.`
      );
    }
  }

  let skippedOptionals = 0;
  for (const product of optionals) {
    const weight = (product.weightGrams ?? 0) * 1;
    if (totalWeightGrams + weight <= MAX_TOTAL_WEIGHT_GRAMS) {
      append(product, 'Optionnel retenu : budget de poids disponible.');
    } else {
      skippedOptionals++;
    }
  }
  if (skippedOptionals > 0) {
    warnings.push(
      `Optionnel(s) écarté(s) : budget de poids dépassé (${skippedOptionals} produit(s), plafond ${MAX_TOTAL_WEIGHT_GRAMS} g).`
    );
  }

  return { items, totalWeightGrams, warnings };
}
