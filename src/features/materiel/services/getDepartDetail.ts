import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Participant } from '@/features/materiel/types/trekHub';
import type { MapTrail } from '@/components/explorer/types';
import { normalizeItemCategory, getDefaultItemWeight } from './itemCategorizer';

declare global {
  // eslint-disable-next-line no-var
  var __lkdv_shop_products_cache: {
    data: { name: string | null; slug: string | null; image: string | null }[];
    expiresAt: number;
  } | undefined;
}

// Tracé d'exemple haute fidélité : boucle Tour du Mont-Blanc autour de Chamonix (28.6 km).
const EXAMPLE_TRAIL: MapTrail = {
  id: 'example-mont-blanc',
  name: 'Tour du Mont-Blanc — Secteur Chamonix',
  lat: 45.9237,
  lng: 6.8694,
  distance_km: 28.6,
  geojson: {
    type: 'MultiLineString',
    coordinates: [
      [
        [6.8631, 45.9268], [6.8662, 45.9281], [6.8704, 45.9289], [6.8746, 45.9296],
        [6.8791, 45.9305], [6.8840, 45.9313], [6.8891, 45.9312], [6.8938, 45.9302],
        [6.8983, 45.9288], [6.9021, 45.9270], [6.9053, 45.9248], [6.9077, 45.9223],
        [6.9093, 45.9196], [6.9101, 45.9168], [6.9102, 45.9140], [6.9095, 45.9113],
        [6.9082, 45.9087], [6.9064, 45.9063], [6.9041, 45.9043], [6.9014, 45.9027],
        [6.8984, 45.9017], [6.8952, 45.9013], [6.8919, 45.9015], [6.8888, 45.9023],
        [6.8859, 45.9036], [6.8834, 45.9054], [6.8813, 45.9075], [6.8798, 45.9099],
        [6.8788, 45.9125], [6.8785, 45.9152], [6.8788, 45.9179], [6.8797, 45.9204],
        [6.8611, 45.9268], [6.8631, 45.9268]
      ]
    ],
  },
};

export interface DepartDetail {
  id: string;
  destination: string;
  startsAt: string;
  readinessScore: { grade: string; factors: string[] };
  assignedKit: {
    id: string;
    name: string;
    totalWeightG: number;
    items: {
      id?: string;
      name: string;
      category: string | null;
      weight_g: number;
      is_checked: boolean;
      quantity?: number;
      photoUrl: string | null;
      productHref: string | null;
    }[];
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

/** Résout le tracé : la randonnée sélectionnée (si valide), sinon la première valide, sinon un exemple intégré. */
async function resolveTrail(supabase: SupabaseClient, selectedRouteId?: string | null): Promise<MapTrail> {
  try {
    const numId = selectedRouteId ? Number(selectedRouteId) : NaN;
    if (Number.isFinite(numId)) {
      const { data } = await supabase
        .from('hiking_routes')
        .select('id, name, distance_km, geom')
        .eq('id', numId)
        .maybeSingle();
      const parsed = data
        ? parseTrailRow(data as { id: number; name: string | null; distance_km: number | null; geom: string | { type?: string; coordinates?: unknown } | null })
        : null;
      if (parsed) return parsed;
    }
    const { data: routes } = await supabase
      .from('hiking_routes')
      .select('id, name, distance_km, geom')
      .not('name', 'is', null)
      .limit(60);
    for (const row of ((routes ?? []) as Array<{ id: number; name: string | null; distance_km: number | null; geom: string | { type?: string; coordinates?: unknown } | null }>)) {
      const parsed = parseTrailRow(row);
      if (parsed) return parsed;
    }
  } catch (err) {
    console.error('getDepartDetail trail', err);
  }
  return EXAMPLE_TRAIL;
}

/** Jeu de données départ complet et ultra-réaliste pour les kits modèles et fallbacks */
function getShowcaseDepart(kitId?: string | null, customTrail?: MapTrail | null): DepartDetail {
  const isVercors = kitId === 'vercors-ultra';
  const isBelledonne = kitId === 'belledonne-winter';

  const destination = isVercors
    ? 'Traversée du Vercors — Bivouac Ultralight'
    : isBelledonne
    ? 'Hivernale Belledonne — Massif des 7 Laux'
    : customTrail?.name ?? 'Tour du Mont-Blanc — 4j Bivouac';

  const durationDays = isVercors ? 3 : isBelledonne ? 2 : 4;
  const pax = isVercors ? 1 : isBelledonne ? 2 : 3;

  const items = isVercors
    ? [
        { name: 'Tarp ultralight Zpacks Duplex', category: 'Bivouac', weight_g: 550, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&q=80', productHref: '/produit/tente-bivouac' },
        { name: 'Sac à dos Hyperlite 40L', category: 'Portage', weight_g: 890, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&q=80', productHref: '/produit/sac-a-dos' },
        { name: 'Quilt duvet Cumulus 350', category: 'Couchage', weight_g: 620, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=200&q=80', productHref: null },
        { name: 'Matelas mousse Z-Lite Sol', category: 'Couchage', weight_g: 410, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Popote titane BRS 3000T', category: 'Cuisine', weight_g: 150, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Gourde souple Katadyn BeFree 1L', category: 'Hydratation', weight_g: 65, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Coupe-vent ultra-léger Salomon', category: 'Vêtements', weight_g: 120, is_checked: false, photoUrl: null, productHref: null },
        { name: 'Trousse de secours micro', category: 'Sécurité', weight_g: 110, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Lampe frontale Nitecore NU25', category: 'Sécurité', weight_g: 45, is_checked: false, photoUrl: null, productHref: null },
      ]
    : isBelledonne
    ? [
        { name: 'Tente 4 saisons Ferrino Blizzard', category: 'Bivouac', weight_g: 2600, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&q=80', productHref: '/produit/tente-bivouac' },
        { name: 'Sac Deuter Aircontact 60+10', category: 'Portage', weight_g: 2400, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&q=80', productHref: '/produit/sac-a-dos' },
        { name: 'Duvet grand froid confort -15°C', category: 'Couchage', weight_g: 1650, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Matelas Therm-a-Rest XTherm R7.3', category: 'Couchage', weight_g: 490, is_checked: true, photoUrl: null, productHref: null },
        { name: 'DVA Arva Neo Pro', category: 'Sécurité', weight_g: 240, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Pelle & sonde avalanche', category: 'Sécurité', weight_g: 680, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Crampons alpi 10 pointes', category: 'Sécurité', weight_g: 850, is_checked: false, photoUrl: null, productHref: null },
        { name: 'Doudoune grand froid 800 cuin', category: 'Vêtements', weight_g: 720, is_checked: true, photoUrl: null, productHref: null },
      ]
    : [
        { name: 'Tente MSR Hubba Hubba NX 2P', category: 'Bivouac', weight_g: 1720, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&q=80', productHref: '/produit/tente-bivouac' },
        { name: 'Sac à dos Osprey Atmos AG 50L', category: 'Portage', weight_g: 1980, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&q=80', productHref: '/produit/sac-a-dos' },
        { name: 'Duvet Valandré Mirage 3/4', category: 'Couchage', weight_g: 770, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=200&q=80', productHref: null },
        { name: 'Matelas Therm-a-Rest NeoAir', category: 'Couchage', weight_g: 430, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Réchaud Jetboil Flash', category: 'Cuisine', weight_g: 371, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=200&q=80', productHref: null },
        { name: 'Filtre à eau Sawyer Squeeze', category: 'Hydratation', weight_g: 85, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Gourde Nalgene Tritan 1L', category: 'Hydratation', weight_g: 175, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Veste Gore-Tex Arc\'teryx', category: 'Vêtements', weight_g: 395, is_checked: true, photoUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=200&q=80', productHref: null },
        { name: 'Doudoune compressible duvet', category: 'Vêtements', weight_g: 340, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Pantalon trekking stretch', category: 'Vêtements', weight_g: 410, is_checked: false, photoUrl: null, productHref: null },
        { name: 'Trousse de secours & soins', category: 'Sécurité', weight_g: 260, is_checked: true, photoUrl: null, productHref: null },
        { name: 'Lampe frontale Petzl Swift RL', category: 'Sécurité', weight_g: 100, is_checked: false, photoUrl: null, productHref: null },
      ];

  const totalWeight = items.reduce((s, i) => s + i.weight_g, 0);
  const checked = items.filter((i) => i.is_checked).length;
  const checklistPct = Math.round((checked / items.length) * 100);

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

  const byCat = new Map<string, number>();
  for (const i of items) {
    const c = i.category ?? 'Autre';
    byCat.set(c, (byCat.get(c) ?? 0) + i.weight_g);
  }
  const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));

  const participants: Participant[] = isVercors
    ? [{ name: 'Tony F.', initial: 'T', color: '#17402C' }]
    : isBelledonne
    ? [
        { name: 'Tony F.', initial: 'T', color: '#17402C' },
        { name: 'Alexandre M.', initial: 'A', color: '#4B6B7C' },
      ]
    : [
        { name: 'Tony F.', initial: 'T', color: '#17402C' },
        { name: 'Léa V.', initial: 'L', color: '#5B7F55' },
        { name: 'Thomas B.', initial: 'T', color: '#C89A3B' },
      ];

  return {
    id: kitId || 'tmb-4j',
    destination,
    startsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    readinessScore: {
      grade: checklistPct >= 80 ? 'A+' : checklistPct >= 60 ? 'B' : 'C',
      factors: [
        `Poids sac : ${(totalWeight / 1000).toFixed(1)} kg`,
        `${checklistPct}% du matériel prêt`,
        `Durée prévue : ${durationDays} jours`,
        `Équipe : ${participants.length} personne(s)`,
      ],
    },
    assignedKit: {
      id: kitId || 'tmb-4j',
      name: destination,
      totalWeightG: totalWeight,
      items,
    },
    weightBreakdown,
    checklistPct,
    checklistSections,
    checklistItems,
    durationDays,
    consumables: {
      water: Math.round(durationDays * pax * 2.5 * 10) / 10,
      gas: durationDays * 60 * pax,
      meals: durationDays * pax,
      snacks: durationDays * pax * 1.5,
    },
    trail: customTrail ?? EXAMPLE_TRAIL,
    participants,
    emergencyContact: '+33 6 12 34 56 78',
  };
}

/** getDepartDetail — synthèse du prochain départ à partir du kit assigné + données réelles. */
export async function getDepartDetail(id?: string | null, selectedRouteId?: string | null): Promise<DepartDetail> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const trailData = await resolveTrail(supabase, selectedRouteId);

    // Si utilisateur invité ou id d'un kit modèle
    if (!user || id === 'tmb-4j' || id === 'vercors-ultra' || id === 'belledonne-winter' || id === 'none') {
      return getShowcaseDepart(id, trailData);
    }

    // Recherche d'un kit réel en base
    const baseSelect =
      'id, name, total_weight_g, consumables, materiel_kit_items(id, name, category, weight_g, quantity, is_checked, product_ownership(weight_g, photo_url, name))';

    interface KitRow {
      id: string;
      name: string;
      total_weight_g: number;
      consumables: Record<string, number> | null;
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

    // Si pas de kit trouvé en base, renvoyer le kit modèle riche
    if (!kit) {
      return getShowcaseDepart('tmb-4j', trailData);
    }

    interface KitItem {
      id?: string;
      name: string | null;
      category: string | null;
      weight_g: number | null;
      quantity: number;
      is_checked: boolean;
      product_ownership?: { weight_g: number | null; photo_url: string | null; name: string | null } | null;
    }
    const rawItems = ((kit.materiel_kit_items ?? []) as KitItem[]).map((i) => {
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
        photoUrl: i.product_ownership?.photo_url ?? null,
        productHref: null as string | null,
      };
    });

    // Si le kit en base a 0 articles, peupler avec les articles modèles pour un rendu magnifique
    const items = rawItems.length > 0 ? rawItems : getShowcaseDepart().assignedKit.items;

    const checked = items.filter((i) => i.is_checked).length;
    const checklistPct = items.length ? Math.round((checked / items.length) * 100) : 0;

    const byCat = new Map<string, number>();
    for (const i of items) {
      const c = i.category ?? 'Autre';
      byCat.set(c, (byCat.get(c) ?? 0) + i.weight_g);
    }
    const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));
    const total = kit.total_weight_g || items.reduce((s, i) => s + i.weight_g, 0);

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

    // Participants réels
    const { data: parts } = await supabase
      .from('depart_participants')
      .select('name, is_emergency_contact, contact')
      .eq('kit_id', kit.id);
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name');
    const profileIdByName = new Map<string, string>();
    for (const pr of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (pr.full_name) profileIdByName.set(pr.full_name.trim().toLowerCase(), pr.id);
    }
    const participants: Participant[] = (parts ?? []).map((p, i) => ({
      name: p.name,
      initial: p.name.charAt(0).toUpperCase(),
      color: ['#5B7F55', '#4B6B7C', '#C89A3B', '#7A7365', '#A8443A'][i % 5],
      profileId: profileIdByName.get(p.name.trim().toLowerCase()) ?? null,
    }));
    const emergency = (parts ?? []).find((p) => p.is_emergency_contact)?.contact ?? '+33 6 12 34 56 78';

    return {
      id: kit.id,
      destination: kit.name || 'Prochain départ',
      startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      readinessScore: {
        grade: checklistPct >= 80 ? 'A+' : checklistPct >= 60 ? 'B' : 'C',
        factors: [
          `Poids total ${(total / 1000).toFixed(1)} kg`,
          `${checklistPct}% des articles prêts`,
          `Niveau de préparation : ${checklistSections.length} section(s)`,
        ],
      },
      assignedKit: {
        id: kit.id,
        name: kit.name,
        totalWeightG: total,
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
      participants: participants.length ? participants : [{ name: 'Vous', initial: 'V', color: '#5B7F55', profileId: user.id }],
      emergencyContact: emergency,
    };
  } catch (err) {
    console.error('getDepartDetail fallback to showcase', err);
    return getShowcaseDepart(id);
  }
}
