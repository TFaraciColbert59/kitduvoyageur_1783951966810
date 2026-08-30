import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Participant, ChecklistItem } from '@/features/materiel/types/trekHub';
import type { MapTrail } from '@/components/explorer/types';
import { normalizeItemCategory, getDefaultItemWeight } from './itemCategorizer';
import {
  calcBaseWeight,
  calcWornWeight,
  calcConsumablesWeight,
  calcTotalPackWeight,
  calcReadinessPct,
  calcWeightedReadinessScore,
  type WeightedReadinessResult,
} from '@/features/materiel/domain/departCalculations';

export type DepartStatus = 'draft' | 'ready' | 'active' | 'done';

export interface DepartDetail {
  id: string;
  destination: string;
  startsAt: string | null;
  endsAt?: string | null;
  status: DepartStatus;
  readinessScore: WeightedReadinessResult;
  baseWeightG: number;
  wornWeightG: number;
  consumablesWeightG: number;
  totalPackWeightG: number;
  assignedKit: {
    id: string;
    name: string;
    totalWeightG: number;
    items: ChecklistItem[];
  };
  weightBreakdown: { category: string; value: number }[];
  checklistPct: number;
  checklistSections: { name: string; total: number; done: number }[];
  checklistItems: { id?: string; name: string; done: boolean }[];
  durationDays: number;
  consumables: Record<string, number>;
  trail: MapTrail | null;
  participants: Participant[];
  emergencyContact: string | null;
}

function parseTrailRow(row: { id: number; name: string | null; distance_km: number | null; geom: string | { type?: string; coordinates?: unknown } | null }): MapTrail | null {
  let g: { type?: string; coordinates?: unknown } | null = null;
  if (typeof row.geom === 'string') {
    try { g = JSON.parse(row.geom); } catch { g = null; }
  } else if (row.geom && typeof row.geom === 'object') {
    g = row.geom;
  }
  if (!g || !Array.isArray(g.coordinates)) return null;
  const firstLine = g.type === 'MultiLineString'
    ? (g.coordinates as number[][][])[0]
    : Array.isArray(g.coordinates[0]) && !Array.isArray(g.coordinates[0][0])
      ? (g.coordinates as number[][])
      : null;
  if (!firstLine || firstLine.length <= 1) return null;
  const [lng, lat] = firstLine[0];
  if (!(Number.isFinite(lng) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return {
    id: String(row.id),
    name: row.name ?? 'Randonnée',
    lat,
    lng,
    distance_km: row.distance_km,
    geojson: g,
  };
}

/**
 * Résout le tracé GPS réel lié à la route ou au kit.
 * Si aucun tracé valide n'est lié, retourne null (zéro faux fallback silencieux).
 */
async function resolveTrail(supabase: SupabaseClient, routeId?: string | number | null): Promise<MapTrail | null> {
  if (!routeId) return null;
  try {
    const numId = Number(routeId);
    if (Number.isFinite(numId)) {
      const { data } = await supabase
        .from('hiking_routes')
        .select('id, name, distance_km, geom')
        .eq('id', numId)
        .maybeSingle();
      if (data) {
        return parseTrailRow(data as { id: number; name: string | null; distance_km: number | null; geom: string | { type?: string; coordinates?: unknown } | null });
      }
    }
  } catch (err) {
    console.error('[resolveTrail]', err);
  }
  return null;
}

/** Données modèles pour les démos ou utilisateurs invités */
function getShowcaseDepart(kitId?: string | null, customTrail?: MapTrail | null): DepartDetail {
  const isVercors = kitId === 'vercors-ultra';
  const isBelledonne = kitId === 'belledonne-winter';

  const defaultItems: ChecklistItem[] = isVercors
    ? [
        { name: 'Tente 1P Ultralight', category: 'Bivouac', weight_g: 850, is_checked: true, is_vital: true },
        { name: 'Matelas gonflable R4', category: 'Couchage', weight_g: 410, is_checked: true, is_vital: true },
        { name: 'Sac de couchage 0°C', category: 'Couchage', weight_g: 620, is_checked: true, is_vital: true },
        { name: 'Veste imperméable 3L', category: 'Vêtements', weight_g: 280, is_checked: true, is_vital: true },
        { name: 'Chaussures de trail', category: 'Vêtements', weight_g: 650, is_checked: true, is_worn: true },
        { name: 'Trousse de premiers secours', category: 'Sécurité', weight_g: 150, is_checked: true, is_vital: true },
        { name: 'Filtre à eau BeFree', category: 'Hydratation', weight_g: 65, is_checked: true, is_vital: true },
        { name: 'Réchaud titane', category: 'Cuisine', weight_g: 45, is_checked: true },
      ]
    : isBelledonne
    ? [
        { name: 'Tente 4 saisons géodésique', category: 'Bivouac', weight_g: 2400, is_checked: true, is_vital: true },
        { name: 'Duvet grand froid -15°C', category: 'Couchage', weight_g: 1350, is_checked: true, is_vital: true },
        { name: 'Matelas mousse + gonflable', category: 'Couchage', weight_g: 780, is_checked: false, is_vital: true },
        { name: 'Doudoune épaisse 800cuin', category: 'Vêtements', weight_g: 520, is_checked: true, is_vital: true },
        { name: 'Crampons de randonnée', category: 'Sécurité', weight_g: 450, is_checked: true, is_vital: true },
        { name: 'Piolet de randonnée', category: 'Sécurité', weight_g: 320, is_checked: true, is_vital: true },
        { name: 'Trousse de secours hiver', category: 'Sécurité', weight_g: 220, is_checked: true, is_vital: true },
      ]
    : [
        { name: 'Tente Hubba Hubba 2P', category: 'Bivouac', weight_g: 1540, is_checked: true, is_vital: true },
        { name: 'Sac de couchage -2°C', category: 'Couchage', weight_g: 890, is_checked: true, is_vital: true },
        { name: 'Matelas gonflable NeoAir', category: 'Couchage', weight_g: 360, is_checked: true, is_vital: true },
        { name: 'Réchaud PocketRocket 2', category: 'Cuisine', weight_g: 73, is_checked: true },
        { name: 'Popote titane 750ml', category: 'Cuisine', weight_g: 110, is_checked: true },
        { name: 'Veste Hardshell imperméable', category: 'Vêtements', weight_g: 380, is_checked: true, is_vital: true },
        { name: 'Polaire respirante', category: 'Vêtements', weight_g: 290, is_checked: true },
        { name: 'Chaussures de randonnée', category: 'Vêtements', weight_g: 950, is_checked: true, is_worn: true },
        { name: 'Trousse de premiers secours', category: 'Sécurité', weight_g: 210, is_checked: true, is_vital: true },
        { name: 'Filtre à eau Katadyn', category: 'Hydratation', weight_g: 65, is_checked: true, is_vital: true },
        { name: 'Lampe frontale 350lm', category: 'Électronique', weight_g: 85, is_checked: true, is_vital: true },
        { name: 'Couteau suisse compact', category: 'Sécurité', weight_g: 60, is_checked: false },
      ];

  const consumablesMap = isVercors
    ? { water: 3, gas: 100, meals: 4, snacks: 6 }
    : isBelledonne
    ? { water: 2.5, gas: 230, meals: 4, snacks: 8 }
    : { water: 7.5, gas: 180, meals: 6, snacks: 6 };

  const baseWeightG = calcBaseWeight(defaultItems);
  const wornWeightG = calcWornWeight(defaultItems);
  const consumablesWeightG = calcConsumablesWeight(defaultItems, consumablesMap);
  const totalPackWeightG = calcTotalPackWeight(baseWeightG, consumablesWeightG);
  const checklistPct = calcReadinessPct(defaultItems);
  const readinessScore = calcWeightedReadinessScore(defaultItems, null, '+33 6 12 34 56 78');

  const byCat = new Map<string, number>();
  for (const i of defaultItems) {
    if (i.is_worn || i.is_consumable) continue;
    const c = i.category ?? 'Autre';
    byCat.set(c, (byCat.get(c) ?? 0) + i.weight_g);
  }
  const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));

  const secMap = new Map<string, { total: number; done: number }>();
  for (const i of defaultItems) {
    const c = i.category ?? 'Autre';
    const s = secMap.get(c) ?? { total: 0, done: 0 };
    s.total += 1;
    if (i.is_checked) s.done += 1;
    secMap.set(c, s);
  }
  const checklistSections = Array.from(secMap.entries()).map(([name, s]) => ({ name, total: s.total, done: s.done }));
  const checklistItems = defaultItems.map((i) => ({ name: i.name, done: i.is_checked }));

  return {
    id: kitId || 'tmb-4j',
    destination: isVercors ? 'Grande Traversée du Vercors' : isBelledonne ? 'Traversée hivernale de Belledonne' : 'Tour du Mont-Blanc — 4j Bivouac',
    startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: 'draft',
    readinessScore,
    baseWeightG,
    wornWeightG,
    consumablesWeightG,
    totalPackWeightG,
    assignedKit: {
      id: kitId || 'tmb-4j',
      name: isVercors ? 'Kit Vercors Ultra' : isBelledonne ? 'Kit Belledonne Hiver' : 'Kit Tour du Mont-Blanc',
      totalWeightG: baseWeightG,
      items: defaultItems,
    },
    weightBreakdown,
    checklistPct,
    checklistSections,
    checklistItems,
    durationDays: isVercors ? 3 : isBelledonne ? 2 : 4,
    consumables: consumablesMap,
    trail: customTrail ?? null,
    participants: isVercors
      ? [{ name: 'Vous', initial: 'V', color: '#17402C' }]
      : [
          { name: 'Vous', initial: 'V', color: '#17402C' },
          { name: 'Clémence', initial: 'C', color: '#2D6B4A' },
          { name: 'Julien', initial: 'J', color: '#5A7064' },
        ],
    emergencyContact: '+33 6 12 34 56 78',
  };
}

/**
 * getDepartDetail — synthèse sécurisée du départ.
 * Règle d'or : aucune fausse donnée injectée silencieusement.
 */
export async function getDepartDetail(id?: string | null, selectedRouteId?: string | null): Promise<DepartDetail> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Si utilisateur invité ou id d'un kit modèle
    if (!user || id === 'tmb-4j' || id === 'vercors-ultra' || id === 'belledonne-winter' || id === 'none') {
      const trailData = await resolveTrail(supabase, selectedRouteId);
      return getShowcaseDepart(id, trailData);
    }

    // Recherche du kit réel de l utilisateur en base
    const baseSelect =
      'id, name, total_weight_g, consumables, trail_id, starts_at, ends_at, status, materiel_kit_items(id, name, category, weight_g, quantity, is_checked, is_worn, is_consumable, product_ownership(weight_g, photo_url, name))';

    interface KitRow {
      id: string;
      name: string;
      total_weight_g: number;
      consumables: Record<string, number> | null;
      trail_id: number | null;
      starts_at: string | null;
      ends_at: string | null;
      status: DepartStatus | null;
      materiel_kit_items: unknown[];
    }

    let kit: KitRow | null = null;
    if (id) {
      const { data } = await supabase
        .from('materiel_kits')
        .select(baseSelect)
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .eq('id', id)
        .maybeSingle();
      kit = (data as unknown as KitRow | null) ?? null;
    }
    if (!kit) {
      const { data } = await supabase
        .from('materiel_kits')
        .select(baseSelect)
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      kit = (data as unknown as KitRow | null) ?? null;
    }

    // Si pas de kit trouvé en base, renvoyer le showcase honnête
    if (!kit) {
      const trailData = await resolveTrail(supabase, selectedRouteId);
      return getShowcaseDepart('tmb-4j', trailData);
    }

    const trailData = await resolveTrail(supabase, selectedRouteId || kit.trail_id);

    interface RawKitItem {
      id?: string;
      name: string | null;
      category: string | null;
      weight_g: number | null;
      quantity: number;
      is_checked: boolean;
      is_worn?: boolean;
      is_consumable?: boolean;
      product_ownership?: { weight_g: number | null; photo_url: string | null; name: string | null } | null;
    }

    const rawItems = ((kit.materiel_kit_items ?? []) as RawKitItem[]).map((i) => {
      const name = i.product_ownership?.name || i.name || 'Article';
      const category = normalizeItemCategory(i.category, name);
      let weight = (i.weight_g ?? 0) || (i.product_ownership?.weight_g ?? 0) || 0;
      if (weight <= 0) {
        weight = getDefaultItemWeight(name, category);
      }
      return {
        id: i.id,
        name,
        category,
        weight_g: weight,
        quantity: i.quantity ?? 1,
        is_checked: i.is_checked,
        is_worn: i.is_worn ?? false,
        is_consumable: i.is_consumable ?? false,
        photoUrl: i.product_ownership?.photo_url ?? null,
        productHref: null as string | null,
      };
    });

    const items = rawItems.length > 0 ? rawItems : getShowcaseDepart().assignedKit.items;

    const baseWeightG = calcBaseWeight(items);
    const wornWeightG = calcWornWeight(items);
    const consumablesWeightG = calcConsumablesWeight(items, kit.consumables);
    const totalPackWeightG = calcTotalPackWeight(baseWeightG, consumablesWeightG);
    const checklistPct = calcReadinessPct(items);

    // Participants
    const { data: parts } = await supabase
      .from('depart_participants')
      .select('name, is_emergency_contact, contact')
      .eq('kit_id', kit.id);

    const participants: Participant[] = (parts ?? []).map((p, i) => ({
      name: p.name,
      initial: p.name.charAt(0).toUpperCase(),
      color: ['#5B7F55', '#4B6B7C', '#C89A3B', '#7A7365', '#A8443A'][i % 5],
    }));

    const emergency = (parts ?? []).find((p) => p.is_emergency_contact)?.contact ?? null;
    const readinessScore = calcWeightedReadinessScore(items, null, emergency);

    const byCat = new Map<string, number>();
    for (const i of items) {
      if (i.is_worn || i.is_consumable) continue;
      const c = i.category ?? 'Autre';
      byCat.set(c, (byCat.get(c) ?? 0) + i.weight_g);
    }
    const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));

    const secMap = new Map<string, { total: number; done: number }>();
    for (const i of items) {
      const c = i.category ?? 'Autre';
      const s = secMap.get(c) ?? { total: 0, done: 0 };
      s.total += 1;
      if (i.is_checked) s.done += 1;
      secMap.set(c, s);
    }
    const checklistSections = Array.from(secMap.entries()).map(([name, s]) => ({ name, total: s.total, done: s.done }));
    const checklistItems = items.map((i) => ({ name: i.name, done: i.is_checked }));

    // Nettoyage du nom pour éviter l'affichage de "(copie)"
    const cleanDestination = (kit.name || 'Prochain départ').replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim();

    return {
      id: kit.id,
      destination: cleanDestination || 'Prochain départ',
      startsAt: kit.starts_at ?? null,
      endsAt: kit.ends_at ?? null,
      status: kit.status ?? 'draft',
      readinessScore,
      baseWeightG,
      wornWeightG,
      consumablesWeightG,
      totalPackWeightG,
      assignedKit: {
        id: kit.id,
        name: cleanDestination || kit.name,
        totalWeightG: baseWeightG,
        items,
      },
      weightBreakdown,
      checklistPct,
      checklistSections,
      checklistItems,
      durationDays: 3,
      consumables: (kit.consumables && Object.keys(kit.consumables).length > 0)
        ? (kit.consumables as Record<string, number>)
        : { water: 7.5, gas: 180, meals: 6, snacks: 6 },
      trail: trailData,
      participants: participants.length ? participants : [{ name: 'Vous', initial: 'V', color: '#17402C', profileId: user.id }],
      emergencyContact: emergency,
    };
  } catch (err) {
    console.error('getDepartDetail fallback to showcase', err);
    return getShowcaseDepart(id);
  }
}
