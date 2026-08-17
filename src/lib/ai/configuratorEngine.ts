import { createClient } from '@/lib/supabase/client';

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

export interface GroupAllocation {
  memberName: string;
  assignedGear: string[];
  totalWeightKg: number;
}

export interface CarnetContextData {
  carnetId: string;
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  weather?: string;
  distanceKm?: number;
  kitItems: OwnedGearItem[];
}

export interface ConnectedKitReport {
  summary: string;
  preparationScore: number; // 0 - 100%
  durationLabel: string;
  weatherLabel: string;
  ownedItems: OwnedGearItem[];
  missingItems: MissingShopItem[];
  inadequateAlerts: InadequateGearAlert[];
  groupAllocations: GroupAllocation[];
  totalWeightKg: number;
  totalOwnedWeightKg: number;
  totalMissingPriceEur: number;
  carbonEstimateKg: number;
}

/**
 * Fetch real products from the products table in Supabase
 */
export async function fetchRealCatalog(): Promise<RealShopProduct[]> {
  try {
    const supabase = createClient();
    let data: any[] | null = null;
    const res = await supabase
      .from('shop_products')
      .select('id, slug, name, brand, category, category_main, price_eur, weight_g, image, stock')
      .order('rating', { ascending: false });

    data = res.data;

    if (!data || data.length === 0) {
      const fallback = await supabase
        .from('products')
        .select('id, slug, name, brand, category, price_eur, weight_g, image, stock')
        .eq('is_active', true)
        .order('rating', { ascending: false });
      data = fallback.data;
    }

    if (!data || data.length === 0) return [];

    return data.map((p: any) => ({
      id: p.id,
      slug: p.slug || p.id,
      name: p.name,
      brand: p.brand || 'Le Kit du Voyageur',
      category: p.category_main || p.category || 'Accessoires',
      priceEur: Number(p.price_eur) || 0,
      weightGrams: Number(p.weight_g) || 0,
      image: p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
      stock: p.stock || 10,
    }));
  } catch (_e) {
    return [];
  }
}

/**
 * Fetch personal inventory items owned by the logged-in user
 */
export async function fetchUserInventory(userId?: string): Promise<OwnedGearItem[]> {
  if (!userId) return [];
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('gear_items')
      .select('id, name, brand, category, weight_g')
      .eq('user_id', userId);

    return (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      brand: item.brand ?? undefined,
      category: item.category ?? 'Équipement',
      weightGrams: item.weight_g ?? 300,
      source: 'inventory',
    }));
  } catch (_e) {
    return [];
  }
}

/**
 * Fetch trip context and items from a carnet
 */
export async function fetchCarnetContext(carnetId: string): Promise<CarnetContextData | null> {
  if (!carnetId) return null;
  try {
    const supabase = createClient();
    const { data: carnet } = await supabase
      .from('carnets')
      .select('id, title, destination, start_date, end_date, weather, distance_km')
      .eq('id', carnetId)
      .maybeSingle();

    if (!carnet) return null;

    const { data: items } = await supabase
      .from('carnet_kit_items')
      .select('id, nom, detail, poids_g, couleur_tag')
      .eq('carnet_id', carnetId);

    const kitItems: OwnedGearItem[] = (items || []).map((i) => ({
      id: i.id,
      name: i.nom,
      brand: i.detail ?? undefined,
      category: i.couleur_tag ?? 'Carnet',
      weightGrams: i.poids_g ?? 400,
      source: 'carnet',
    }));

    return {
      carnetId: carnet.id,
      title: carnet.title || 'Voyage Carnet',
      destination: carnet.destination || 'Carnet',
      startDate: carnet.start_date ?? undefined,
      endDate: carnet.end_date ?? undefined,
      weather: carnet.weather ?? undefined,
      distanceKm: carnet.distance_km ? Number(carnet.distance_km) : undefined,
      kitItems,
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Fetch group details, member count, and shared kit items
 */
export async function fetchGroupContext(groupId: string): Promise<{
  groupName: string;
  destination: string;
  membersCount: number;
  sharedItems: OwnedGearItem[];
}> {
  if (!groupId) {
    return {
      groupName: 'Groupe d’expédition',
      destination: 'Non spécifiée',
      membersCount: 1,
      sharedItems: [],
    };
  }

  try {
    const supabase = createClient();
    const { data: grp } = await supabase
      .from('groupes')
      .select('nom, destination')
      .eq('id', groupId)
      .maybeSingle();

    const { data: members } = await supabase
      .from('groupe_membres')
      .select('id')
      .eq('group_id', groupId);

    const { data: kitItems } = await supabase
      .from('group_kit_items')
      .select('id, name, category, weight_grams')
      .eq('group_id', groupId);

    return {
      groupName: grp?.nom ?? 'Groupe d’expédition',
      destination: grp?.destination ?? 'Destinations variées',
      membersCount: (members || []).length || 1,
      sharedItems: (kitItems || []).map((k) => ({
        id: k.id,
        name: k.name,
        category: k.category ?? 'Groupe',
        weightGrams: k.weight_grams ?? 500,
        source: 'group',
      })),
    };
  } catch (_e) {
    return {
      groupName: 'Groupe d’expédition',
      destination: 'Non spécifiée',
      membersCount: 1,
      sharedItems: [],
    };
  }
}

/**
 * Main Connected Engine Computation
 */
export async function computeConnectedReport(params: {
  answers: Record<number, string>;
  userOwnedGear: OwnedGearItem[];
  groupMode?: boolean;
  groupMembersCount?: number;
  sharedGroupItems?: OwnedGearItem[];
  carnetContext?: CarnetContextData | null;
}): Promise<ConnectedKitReport> {
  const weatherKey = params.answers[3] || 'frais_brumeux';
  const durationKey = params.answers[2] || '3-5d';

  const weatherLabels: Record<string, string> = {
    sec_chaud: 'Sec, chaud (15 à 25 °C)',
    frais_brumeux: 'Frais, brumeux (5 à 15 °C)',
    pluvieux_vente: 'Pluvieux, venté (0 à 10 °C)',
    froid_sec: 'Froid, sec (-5 à 5 °C)',
  };

  const durationLabels: Record<string, string> = {
    '1-2d': '1 à 2 jours',
    '3-5d': '3 à 5 jours',
    '1-2w': '1 à 2 semaines',
    '2w+': 'Plus de 2 semaines',
  };

  // Fetch real shop products from Supabase
  const catalog = await fetchRealCatalog();

  // Combine owned items from user inventory + group shared + carnet kit items
  const ownedItems: OwnedGearItem[] = [
    ...params.userOwnedGear,
    ...(params.sharedGroupItems || []),
    ...(params.carnetContext?.kitItems || []),
  ];

  const ownedNames = ownedItems.map((g) => g.name.toLowerCase());
  const ownedCategories = ownedItems.map((g) => g.category.toLowerCase());

  // Category detection logic
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

  // Group gear allocations
  const groupAllocations: GroupAllocation[] = [];
  if (params.groupMode && (params.groupMembersCount || 1) > 1) {
    const memberCount = params.groupMembersCount || 2;
    groupAllocations.push({
      memberName: 'Membre 1 (Porteur Réchaud)',
      assignedGear: ['Réchaud titane', 'Popote commune', 'Filtre à eau'],
      totalWeightKg: 1.1,
    });
    groupAllocations.push({
      memberName: 'Membre 2 (Porteur Abri)',
      assignedGear: ['Tente 2-3 places', 'Piquets & haubans', 'Trousse de secours'],
      totalWeightKg: 1.8,
    });
    if (memberCount > 2) {
      groupAllocations.push({
        memberName: 'Membre 3 (Ravitaillement)',
        assignedGear: ['Sacs étanches nourriture', 'Réserve d’eau 5L', 'Trousse bobologie'],
        totalWeightKg: 1.4,
      });
    }
  }

  // Score computation
  let prepScore = 100;
  if (!hasSac) prepScore -= 20;
  if (!hasDuvet) prepScore -= 25;
  if (!hasEau) prepScore -= 15;
  if (inadequateAlerts.length > 0) prepScore -= inadequateAlerts.length * 15;
  prepScore = Math.max(35, Math.min(100, prepScore));

  const destinationSummary = params.carnetContext
    ? `Voyage carnet "${params.carnetContext.title}" vers ${params.carnetContext.destination}`
    : `Conditions ${weatherLabels[weatherKey]} pour ${durationLabels[durationKey]}`;

  return {
    summary: `Analyse basée sur ${ownedItems.length} équipement(s) possédé(s). ${destinationSummary}.`,
    preparationScore: prepScore,
    durationLabel: durationLabels[durationKey] || '3 à 5 jours',
    weatherLabel: weatherLabels[weatherKey] || 'Frais, brumeux',
    ownedItems,
    missingItems,
    inadequateAlerts,
    groupAllocations,
    totalWeightKg,
    totalOwnedWeightKg,
    totalMissingPriceEur,
    carbonEstimateKg: 1.8,
  };
}
