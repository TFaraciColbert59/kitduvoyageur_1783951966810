import { createClient } from '@/lib/supabase/client';
import { analyzeKit } from './configuratorCore';
import type {
  OwnedGearItem,
  RealShopProduct,
  MissingShopItem,
  InadequateGearAlert,
  AnalyzeKitParams,
} from './configuratorCore';

// Types partagés avec le cœur pur — ré-exportés pour compatibilité (wizard, hooks).
export type { OwnedGearItem, RealShopProduct, MissingShopItem, InadequateGearAlert };

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

  // Détection manques/alertes/totaux/score : cœur pur délégué (server-safe, testé).
  const analysis = analyzeKit({
    catalog,
    ownedItems,
    weatherKey: weatherKey as AnalyzeKitParams['weatherKey'],
    durationKey: durationKey as AnalyzeKitParams['durationKey'],
    groupMode: params.groupMode,
    groupMembersCount: params.groupMembersCount,
  });

  const {
    missingItems,
    inadequateAlerts,
    totalWeightKg,
    totalOwnedWeightKg,
    totalMissingPriceEur,
  } = analysis;

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

  // Score computation délégué au cœur pur (analysis.preparationScore)
  const destinationSummary = params.carnetContext
    ? `Voyage carnet "${params.carnetContext.title}" vers ${params.carnetContext.destination}`
    : `Conditions ${weatherLabels[weatherKey]} pour ${durationLabels[durationKey]}`;

  return {
    summary: `Analyse basée sur ${ownedItems.length} équipement(s) possédé(s). ${destinationSummary}.`,
    preparationScore: analysis.preparationScore,
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
