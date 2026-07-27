import { createClient } from '@/lib/supabase/client';

export interface OwnedGearItem {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  brand?: string;
  source: 'inventory' | 'group' | 'carnet';
}

export interface MissingShopItem {
  id: string;
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

export async function fetchGroupContext(groupId: string): Promise<{
  groupName: string;
  destination: string;
  membersCount: number;
  sharedItems: OwnedGearItem[];
}> {
  try {
    const supabase = createClient();
    const { data: grp } = await supabase
      .from('groupes')
      .select('nom, destination')
      .eq('id', groupId)
      .single();

    const { data: members } = await supabase
      .from('groupe_membres')
      .select('id')
      .eq('groupe_id', groupId);

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

export async function computeConnectedReport(params: {
  answers: Record<number, string>;
  userOwnedGear: OwnedGearItem[];
  groupMode?: boolean;
  groupMembersCount?: number;
  sharedGroupItems?: OwnedGearItem[];
}): Promise<ConnectedKitReport> {
  const weatherKey = params.answers[3] || 'frais_brumeux';
  const durationKey = params.answers[2] || '3-5d';
  const comfortKey = params.answers[4] || 'equilibre';

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

  // Match user's owned gear to required categories
  const ownedNames = params.userOwnedGear.map((g) => g.name.toLowerCase());

  const hasSac = ownedNames.some((n) => n.includes('sac') || n.includes('bag'));
  const hasDuvet = ownedNames.some((n) => n.includes('duvet') || n.includes('couchage'));
  const hasGourde = ownedNames.some((n) => n.includes('gourde') || n.includes('eau') || n.includes('poche'));
  const hasVeste = ownedNames.some((n) => n.includes('veste') || n.includes('imper') || n.includes('gore'));

  const ownedItems: OwnedGearItem[] = [
    ...params.userOwnedGear,
    ...(params.sharedGroupItems || []),
  ];

  const missingItems: MissingShopItem[] = [];
  const inadequateAlerts: InadequateGearAlert[] = [];

  // Add missing items if not owned
  if (!hasSac) {
    missingItems.push({
      id: 'shop-sac-45l',
      name: 'Sac à dos 45 L Ultra-Résistant',
      brand: 'Osprey',
      category: 'Sac à dos',
      priceEur: 340,
      weightGrams: 850,
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
      essentiality: 'indispensable',
      reason: 'Volume adapté pour 3 à 5 jours d’autonomie.',
    });
  }

  if (!hasDuvet) {
    missingItems.push({
      id: 'shop-duvet-800',
      name: 'Duvet 3 saisons 800 Cuin',
      brand: 'Cumulus',
      category: 'Couchage',
      priceEur: 248,
      weightGrams: 450,
      image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400',
      essentiality: 'indispensable',
      reason: 'Isolant thermique certifié jusqu’à 0°C.',
    });
  }

  if (!hasGourde) {
    missingItems.push({
      id: 'shop-gourde-titane',
      name: 'Gourde Titane 1 L Ultralégère',
      brand: 'Keith',
      category: 'Hydratation',
      priceEur: 68,
      weightGrams: 120,
      image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400',
      essentiality: 'indispensable',
      reason: 'Indestructible et directement posable sur le réchaud.',
    });
  }

  if (!hasVeste && (weatherKey === 'pluvieux_vente' || weatherKey === 'frais_brumeux')) {
    missingItems.push({
      id: 'shop-veste-3c',
      name: 'Veste 3 Couches Hardshell Imper 20k',
      brand: 'Arc’teryx',
      category: 'Vêtements',
      priceEur: 290,
      weightGrams: 320,
      image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400',
      essentiality: 'indispensable',
      reason: 'Protection totale contre la pluie continue et les rafales de vent.',
    });
  }

  // Generate gear alerts for cold conditions
  if (weatherKey === 'froid_sec' && !hasDuvet) {
    inadequateAlerts.push({
      item: 'Système de couchage',
      issue: 'Météo négative prévue (-5°C). Un duvet été ou léger entraînera de l’hypothermie.',
      recommendation: 'Privilégier un duvet doudoune 800 cuin avec matelas isolant R-Value > 4.0.',
      severity: 'danger',
    });
  }

  if (weatherKey === 'pluvieux_vente' && !hasVeste) {
    inadequateAlerts.push({
      item: 'Protection contre la pluie',
      issue: 'Pluie soutenue et vent violent. Un coupe-vent simple transpercera en 30 minutes.',
      recommendation: 'Emporter une membrane imperméable 20 000 mm minimum avec coutures étanchées.',
      severity: 'warning',
    });
  }

  // Calculate weights & totals
  const totalOwnedWeightKg = Number(
    (ownedItems.reduce((acc, i) => acc + (i.weightGrams || 0), 0) / 1000).toFixed(1)
  );

  const totalMissingWeightKg = Number(
    (missingItems.reduce((acc, i) => acc + i.weightGrams, 0) / 1000).toFixed(1)
  );

  const totalWeightKg = Number((totalOwnedWeightKg + totalMissingWeightKg).toFixed(1));
  const totalMissingPriceEur = missingItems.reduce((acc, i) => acc + i.priceEur, 0);

  // Group allocations if in group mode
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
      assignedGear: ['Tente 3 places', 'Piquets & haubans', 'Trousse de secours commune'],
      totalWeightKg: 1.8,
    });
    if (memberCount > 2) {
      groupAllocations.push({
        memberName: 'Membre 3 (Ravitaillement)',
        assignedGear: ['Sacs étanches nourriture', 'Réserve d’eau 5L', 'Corde & mousquetons'],
        totalWeightKg: 1.4,
      });
    }
  }

  // Preparation score: Starts at 100%, drops for missing indispensables & alerts
  let prepScore = 100;
  if (!hasSac) prepScore -= 20;
  if (!hasDuvet) prepScore -= 25;
  if (!hasGourde) prepScore -= 15;
  if (inadequateAlerts.length > 0) prepScore -= inadequateAlerts.length * 15;
  prepScore = Math.max(35, Math.min(100, prepScore));

  return {
    summary: `Analyse basée sur ${ownedItems.length} équipement(s) possédé(s), les conditions ${weatherLabels[weatherKey]} et une durée de ${durationLabels[durationKey]}.`,
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
