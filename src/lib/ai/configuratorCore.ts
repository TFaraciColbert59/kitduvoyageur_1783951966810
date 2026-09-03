/**
 * Cœur DÉTERMINISTE du configurateur de kit — fonction PURE, zéro dépendance
 * Supabase/Next : testable en unitaire ET utilisable côté serveur (API routes)
 * comme côté client (via configuratorEngine qui passe les données pré-fetchées).
 *
 * RÈGLE D'OR : "Never fabricates a product" — n'injecte que des produits
 * RÉELS du catalogue passé en paramètre (findProductForCategory retourne null
 * si pas de match, jamais de produit inventé).
 */

export interface OwnedGearItem {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  brand?: string;
  source: 'inventory' | 'group' | 'carnet';
}

export interface RealShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  priceEur: number;
  weightGrams: number;
  image: string;
  stock: number;
}

export interface MissingShopItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  brand: string;
  priceEur: number;
  weightGrams: number;
  image: string;
  essentiality: 'indispensable' | 'recommande' | 'optionnel';
  reason: string;
}

export interface InadequateGearAlert {
  item: string;
  issue: string;
  recommendation: string;
  severity: 'warning' | 'danger';
}

export interface KitAnalysis {
  missingItems: MissingShopItem[];
  inadequateAlerts: InadequateGearAlert[];
  totalOwnedWeightKg: number;
  totalWeightKg: number;
  totalMissingPriceEur: number;
  preparationScore: number;
}

export interface AnalyzeKitParams {
  catalog: RealShopProduct[];
  ownedItems: OwnedGearItem[];
  weatherKey: 'sec_chaud' | 'frais_brumeux' | 'pluvieux_vente' | 'froid_sec';
  durationKey: '1-2d' | '3-5d' | '1-2w' | '2w+';
  groupMode?: boolean;
  groupMembersCount?: number;
}

export function analyzeKit(params: AnalyzeKitParams): KitAnalysis {
  const { catalog, ownedItems, weatherKey, durationKey } = params;

  const ownedNames = ownedItems.map((g) => g.name.toLowerCase());
  const ownedCategories = ownedItems.map((g) => g.category.toLowerCase());

  // Category detection logic (verbatim du moteur historique)
  const hasSac = ownedNames.some((n) => n.includes('sac') || n.includes('bag') || n.includes('portage')) ||
                 ownedCategories.some((c) => c.includes('sac') || c.includes('portage'));

  const hasDuvet = ownedNames.some((n) => n.includes('duvet') || n.includes('couchage') || n.includes('sac de couchage')) ||
                   ownedCategories.some((c) => c.includes('couchage'));

  const hasEau = ownedNames.some((n) => n.includes('gourde') || n.includes('eau') || n.includes('filtre') || n.includes('poche')) ||
                 ownedCategories.some((c) => c.includes('eau') || c.includes('hydratation'));

  const hasVeste = ownedNames.some((n) => n.includes('veste') || n.includes('imper') || n.includes('gore') || n.includes('hardshell')) ||
                   ownedCategories.some((c) => c.includes('vêtement') || c.includes('protection'));

  const hasTente = ownedNames.some((n) => n.includes('tente') || n.includes('abri') || n.includes('tarp')) ||
                   ownedCategories.some((c) => c.includes('tente') || c.includes('abri') || c.includes('bivouac'));

  const missingItems: MissingShopItem[] = [];
  const inadequateAlerts: InadequateGearAlert[] = [];

  // Helper to pick a real product from the catalog matching a sub-category.
  // Never fabricates a product: returns null when the catalog has no match.
  const findProductForCategory = (catName: string): RealShopProduct | null => {
    const match = catalog.find((p) => p.category.toLowerCase().includes(catName.toLowerCase()) || p.name.toLowerCase().includes(catName.toLowerCase()));
    return match || null;
  };

  const pushIfReal = (prod: RealShopProduct | null, essentiality: MissingShopItem['essentiality'], reason: string) => {
    if (!prod) return;
    missingItems.push({
      id: prod.id,
      slug: prod.slug,
      name: prod.name,
      brand: prod.brand,
      category: prod.category,
      priceEur: prod.priceEur,
      weightGrams: prod.weightGrams,
      image: prod.image,
      essentiality,
      reason,
    });
  };

  // 1. Sac à dos
  if (!hasSac) {
    pushIfReal(findProductForCategory('Sacs à dos'), 'indispensable', 'Volume de portage essentiel pour la durée sélectionnée.');
  }

  // 2. Couchage
  if (!hasDuvet) {
    pushIfReal(findProductForCategory('Couchage'), 'indispensable', 'Isolation thermique certifiée pour nuits en altitude.');
  }

  // 3. Hydratation
  if (!hasEau) {
    pushIfReal(findProductForCategory('Eau'), 'indispensable', 'Garantit votre autonomie en eau potable.');
  }

  // 4. Vêtement imperméable si météo humide
  if (!hasVeste && (weatherKey === 'pluvieux_vente' || weatherKey === 'frais_brumeux')) {
    pushIfReal(findProductForCategory('Vêtements'), 'indispensable', 'Protection contre la pluie battante et les rafales de vent.');
  }

  // 5. Abri / Tente si voyage itinérant et pas de tente
  if (!hasTente && durationKey !== '1-2d') {
    pushIfReal(findProductForCategory('Tentes'), 'recommande', 'Abri autonome pour les nuits en sauvage.');
  }

  // Weather safety warnings
  if (weatherKey === 'froid_sec' && !hasDuvet) {
    inadequateAlerts.push({
      item: 'Système de couchage',
      issue: 'Températures négatives prévues (-5°C). Risque fort d’hypothermie sans duvet adapté.',
      recommendation: 'Privilégier un duvet 800 Cuin avec matelas isolant R-Value > 4.0.',
      severity: 'danger',
    });
  }

  if (weatherKey === 'pluvieux_vente' && !hasVeste) {
    inadequateAlerts.push({
      item: 'Protection imperméable',
      issue: 'Vent fort et précipitations continues. Un coupe-vent standard transpercera rapidement.',
      recommendation: 'Emporter une hardshell 3 couches 20 000 mm étanche.',
      severity: 'warning',
    });
  }

  // Totals
  const totalOwnedWeightKg = Number(
    (ownedItems.reduce((acc, i) => acc + (i.weightGrams || 0), 0) / 1000).toFixed(1)
  );

  const totalMissingWeightKg = Number(
    (missingItems.reduce((acc, i) => acc + i.weightGrams, 0) / 1000).toFixed(1)
  );

  const totalWeightKg = Number((totalOwnedWeightKg + totalMissingWeightKg).toFixed(1));
  const totalMissingPriceEur = missingItems.reduce((acc, i) => acc + i.priceEur, 0);

  // Score computation
  let prepScore = 100;
  if (!hasSac) prepScore -= 20;
  if (!hasDuvet) prepScore -= 25;
  if (!hasEau) prepScore -= 15;
  if (inadequateAlerts.length > 0) prepScore -= inadequateAlerts.length * 15;
  prepScore = Math.max(35, Math.min(100, prepScore));

  return {
    missingItems,
    inadequateAlerts,
    totalOwnedWeightKg,
    totalWeightKg,
    totalMissingPriceEur,
    preparationScore: prepScore,
  };
}
