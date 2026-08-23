import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Participant } from '@/features/materiel/components/depart/ParticipantsEmergency';
import type { MapTrail } from '@/components/explorer/types';

declare global {
  // eslint-disable-next-line no-var
  var __lkdv_shop_products_cache: {
    data: { name: string | null; slug: string | null; image: string | null }[];
    expiresAt: number;
  } | undefined;
}

// Tracé d'exemple intégré (fallback quand la base ne fournit aucune route valide)
// : boucle dans le massif du Mont-Blanc, autour de Chamonix.
const EXAMPLE_TRAIL: MapTrail = {
  id: 'example-mont-blanc',
  name: 'Boucle du Mont-Blanc (exemple)',
  lat: 45.9237,
  lng: 6.8694,
  distance_km: 12.4,
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
  assignedKit: { id: string; name: string; totalWeightG: number; items: { name: string; category: string | null; weight_g: number; is_checked: boolean; photoUrl: string | null; productHref: string | null }[] };
  weightBreakdown: { category: string; value: number }[];
  checklistPct: number;
  checklistSections: { name: string; total: number; done: number }[];
  checklistItems: { name: string; done: boolean }[];
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
async function resolveTrail(supabase: SupabaseClient, selectedRouteId?: string | null): Promise<MapTrail | null> {
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

/** Cockpit minimal pour un prochain départ sans kit (la randonnée choisie sert de tracé). */
function minimalDepart(trail: MapTrail | null, userId: string): DepartDetail {
  return {
    id: 'none',
    destination: trail?.name ?? 'Prochain départ',
    startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    readinessScore: { grade: 'E', factors: ['Choisissez votre randonnée puis créez un kit'] },
    assignedKit: { id: 'none', name: 'Prochain départ', totalWeightG: 0, items: [] },
    weightBreakdown: [],
    checklistPct: 0,
    checklistSections: [],
    checklistItems: [],
    durationDays: 3,
    consumables: {},
    trail,
    participants: [{ name: 'Vous', initial: 'V', color: '#5B7F55', profileId: userId }],
    emergencyContact: null,
  };
}

/** getDepartDetail — synthèse du prochain départ à partir du kit assigné + données réelles. */
export async function getDepartDetail(id: string, selectedRouteId?: string | null): Promise<DepartDetail | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Si utilisateur non connecté : cockpit minimal si une randonnée ou un id est demandé, sinon null (onboarding).
    if (!user) {
      if (!selectedRouteId && (!id || id === 'none')) return null;
      const trailData = await resolveTrail(supabase, selectedRouteId);
      return minimalDepart(trailData, 'guest');
    }

    // Le « prochain départ » = le kit qui a des participants (sinon le plus récent non supprimé).
    const { data: partKit } = await supabase
      .from('depart_participants')
      .select('kit_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    const preferredId = partKit?.kit_id ?? null;

    const baseSelect =
      'id, name, total_weight_g, consumables, materiel_kit_items(name, category, weight_g, quantity, is_checked, product_ownership(weight_g, photo_url, name))';

    interface KitRow {
      id: string;
      name: string;
      total_weight_g: number;
      consumables: Record<string, number> | null;
      materiel_kit_items: unknown[];
    }
    let kit: KitRow | null = null;
    if (id && id !== 'none') {
      const { data } = await supabase
        .from('materiel_kits')
        .select(baseSelect)
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .eq('id', id)
        .maybeSingle();
      kit = (data as unknown as KitRow | null) ?? null;
    } else if (preferredId) {
      const { data } = await supabase
        .from('materiel_kits')
        .select(baseSelect)
        .eq('user_id', user.id)
        .eq('is_trashed', false)
        .eq('id', preferredId)
        .maybeSingle();
      kit = (data as unknown as KitRow | null) ?? null;
    }
    if (!kit && id !== 'none') {
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

    // Tracé : randonnée sélectionnée si fournie, sinon la première valide, sinon un exemple.
    const trailData = await resolveTrail(supabase, selectedRouteId);

    // Sans kit : onboarding si aucune randonnée choisie, sinon cockpit minimal avec le tracé choisi.
    if (!kit) {
      if (!selectedRouteId) return null;
      return minimalDepart(trailData, user.id);
    }

    interface KitItem {
      name: string | null;
      category: string | null;
      weight_g: number | null;
      quantity: number;
      is_checked: boolean;
      product_ownership?: { weight_g: number | null; photo_url: string | null; name: string | null } | null;
    }
    const items = ((kit.materiel_kit_items ?? []) as KitItem[]).map((i) => {
      const weight = (i.weight_g ?? 0) || (i.product_ownership?.weight_g ?? 0) || 0;
      return {
        name: i.product_ownership?.name || i.name || 'Article',
        category: i.category,
        weight_g: weight,
        quantity: i.quantity ?? 1,
        is_checked: i.is_checked,
        photoUrl: i.product_ownership?.photo_url ?? null,
        productHref: null as string | null,
      };
    });
    const checked = items.filter((i) => i.is_checked).length;
    const checklistPct = items.length ? Math.round((checked / items.length) * 100) : 0;

    const byCat = new Map<string, number>();
    for (const i of items) {
      const c = i.category ?? 'Autre';
      byCat.set(c, (byCat.get(c) ?? 0) + i.weight_g);
    }
    const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));
    const total = kit.total_weight_g ?? items.reduce((s, i) => s + i.weight_g, 0);
    const grade = total === 0 ? 'E' : total <= 12000 ? 'A+' : total <= 15000 ? 'B' : total <= 20000 ? 'C' : total <= 25000 ? 'D' : 'E';

    // Checklist par sections (groupées par catégorie) — alimente le donut dégradé + le drawer.
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

    const availabilityPct = items.length ? Math.round((checked / items.length) * 100) : 0;
    const readinessGrade =
      availabilityPct === 0 ? 'E'
      : availabilityPct < 40 ? 'D'
      : availabilityPct < 70 ? 'C'
      : availabilityPct < 90 ? 'B'
      : grade === 'E' || grade === 'D' ? 'C' : 'A+';

    // Enrichit les articles avec le vrai produit du catalogue (image + lien page produit),
    // via un rapprochement par mots-clés (noms produits ≠ noms d'articles).
    // Mise en cache en mémoire pendant 10 minutes pour accélérer le SSR.
    let productRows: { name: string | null; slug: string | null; image: string | null }[] = [];
    if (globalThis.__lkdv_shop_products_cache && globalThis.__lkdv_shop_products_cache.expiresAt > Date.now()) {
      productRows = globalThis.__lkdv_shop_products_cache.data;
    } else {
      const { data: products } = await supabase
        .from('shop_products')
        .select('id, name, slug, image')
        .eq('is_active', true)
        .limit(1000);
      productRows = (products ?? []) as { name: string | null; slug: string | null; image: string | null }[];
      globalThis.__lkdv_shop_products_cache = {
        data: productRows,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
    }
    const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'pour', 'avec', 'et', 'au', 'aux', 'à', 'sur', 'en', 'catégorie', 'randonnée', 'sport', 'général', '--', '&']);
    const tokens = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOP.has(t));
    const matchProduct = (name: string): { slug: string | null; image: string | null } | null => {
      const itemTok = tokens(name);
      if (itemTok.length === 0) return null;
      let best: { slug: string | null; image: string | null } | null = null;
      let bestScore = 0;
      for (const p of productRows) {
        if (!p.name) continue;
        const pTok = new Set(tokens(p.name));
        const score = itemTok.reduce((acc, t) => acc + (pTok.has(t) ? 1 : 0), 0);
        if (score > bestScore && score >= 1) {
          bestScore = score;
          best = { slug: p.slug, image: p.image };
        }
      }
      return best;
    };
    const enrichedItems = items.map((it) => {
      const match = matchProduct(it.name);
      return {
        ...it,
        photoUrl: match?.image || it.photoUrl,
        productHref: match?.slug ? `/produit/${match.slug}` : null,
      };
    });

    // Participants réels (depart_participants) + liens profil (user_profiles).
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
    const emergency = (parts ?? []).find((p) => p.is_emergency_contact)?.contact ?? null;

    return {
      id: kit.id,
      destination: kit.name,
      startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      readinessScore: {
        grade: readinessGrade,
        factors: [
          `Poids total ${(total / 1000).toFixed(1)} kg`,
          `${checklistPct}% des articles prêts`,
          `${availabilityPct}% d'équipement disponible`,
          `Niveau de préparation : ${checklistSections.length} section(s)`,
        ],
      },
      assignedKit: {
        id: kit.id,
        name: kit.name,
        totalWeightG: total,
        items: enrichedItems.map((i) => ({ name: i.name, category: i.category, weight_g: i.weight_g, is_checked: i.is_checked, photoUrl: i.photoUrl, productHref: i.productHref })),
      },
      weightBreakdown,
      checklistPct,
      checklistSections,
      checklistItems,
      durationDays: 3,
      consumables: (kit.consumables ?? {}) as Record<string, number>,
      trail: trailData,
      participants: participants.length ? participants : [{ name: 'Vous', initial: 'V', color: '#5B7F55', profileId: user.id }],
      emergencyContact: emergency,
    };
  } catch (err) {
    console.error('getDepartDetail', err);
    return null;
  }
}
