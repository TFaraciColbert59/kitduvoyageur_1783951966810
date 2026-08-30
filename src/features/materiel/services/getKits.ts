import { createClient } from '@/lib/supabase/server';

export interface KitListItem {
  id: string;
  name: string;
  description: string | null;
  season: string | null;
  total_weight_g: number;
  is_favorite: boolean;
  is_trashed: boolean;
  updated_at: string;
  item_count: number;
  checked_count: number;
  items: { name: string; category: string | null; weight_g: number; quantity: number; product_ownership_id?: string | null }[];
}

const SHOWCASE_KITS: KitListItem[] = [
  {
    id: 'tmb-4j',
    name: 'Tour du Mont-Blanc — 4j Bivouac',
    description: 'Pack complet bivouac 4 jours en autonomie moyenne montagne.',
    season: 'été',
    total_weight_g: 11400,
    is_favorite: true,
    is_trashed: false,
    updated_at: new Date().toISOString(),
    item_count: 12,
    checked_count: 9,
    items: [
      { name: 'Tente MSR Hubba Hubba NX 2P', category: 'Bivouac', weight_g: 1720, quantity: 1 },
      { name: 'Sac à dos Osprey Atmos AG 50L', category: 'Portage', weight_g: 1980, quantity: 1 },
      { name: 'Duvet Valandré Mirage 3/4', category: 'Couchage', weight_g: 770, quantity: 1 },
      { name: 'Matelas Therm-a-Rest NeoAir', category: 'Couchage', weight_g: 430, quantity: 1 },
      { name: 'Réchaud Jetboil Flash', category: 'Cuisine', weight_g: 371, quantity: 1 },
      { name: 'Filtre à eau Sawyer Squeeze', category: 'Hydratation', weight_g: 85, quantity: 1 },
      { name: 'Veste Gore-Tex Arc\'teryx', category: 'Vêtements', weight_g: 395, quantity: 1 },
      { name: 'Lampe frontale Petzl Swift RL', category: 'Sécurité', weight_g: 100, quantity: 1 },
    ],
  },
  {
    id: 'vercors-ultra',
    name: 'Traversée du Vercors — Ultraléger',
    description: 'Kit minimaliste ultralight pour bivouac estival rapide.',
    season: 'printemps',
    total_weight_g: 8200,
    is_favorite: false,
    is_trashed: false,
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    item_count: 9,
    checked_count: 7,
    items: [
      { name: 'Tarp ultralight Zpacks Duplex', category: 'Bivouac', weight_g: 550, quantity: 1 },
      { name: 'Sac à dos Hyperlite 40L', category: 'Portage', weight_g: 890, quantity: 1 },
      { name: 'Quilt Cumulus 350', category: 'Couchage', weight_g: 620, quantity: 1 },
      { name: 'Matelas mousse Z-Lite Sol', category: 'Couchage', weight_g: 410, quantity: 1 },
      { name: 'Popote titane BRS', category: 'Cuisine', weight_g: 150, quantity: 1 },
    ],
  },
  {
    id: 'belledonne-winter',
    name: 'Hivernale Belledonne — Grand Froid',
    description: 'Kit grand froid 4 saisons avec équipement d\'alpinisme et sécurité neige.',
    season: 'hiver',
    total_weight_g: 14600,
    is_favorite: false,
    is_trashed: false,
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    item_count: 14,
    checked_count: 11,
    items: [
      { name: 'Tente 4 saisons Ferrino Blizzard', category: 'Bivouac', weight_g: 2600, quantity: 1 },
      { name: 'Sac Deuter Aircontact 60+10', category: 'Portage', weight_g: 2400, quantity: 1 },
      { name: 'Duvet grand froid confort -15°C', category: 'Couchage', weight_g: 1650, quantity: 1 },
      { name: 'DVA Arva Neo Pro', category: 'Sécurité', weight_g: 240, quantity: 1 },
      { name: 'Pelle & sonde avalanche', category: 'Sécurité', weight_g: 680, quantity: 1 },
    ],
  },
];

/** getKits — kits utilisateur avec stats de complétude (Server-only, RLS). */
export async function getKits(): Promise<KitListItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return SHOWCASE_KITS;

    const { data, error } = await supabase
      .from('materiel_kits')
      .select('id, name, description, season, total_weight_g, is_favorite, is_trashed, updated_at, materiel_kit_items(name, category, weight_g, quantity, is_checked, product_ownership_id)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error || !data || data.length === 0) return SHOWCASE_KITS;

    return data.map((k) => {
      const kitItems = (k.materiel_kit_items ?? []) as { name: string; category: string | null; weight_g: number; quantity: number; is_checked: boolean; product_ownership_id: string | null }[];
      return {
        id: k.id,
        name: k.name,
        description: k.description,
        season: k.season,
        total_weight_g: k.total_weight_g ?? 0,
        is_favorite: k.is_favorite,
        is_trashed: k.is_trashed,
        updated_at: k.updated_at,
        item_count: kitItems.length,
        checked_count: kitItems.filter((i) => i.is_checked).length,
        items: kitItems.map((i) => ({
          name: i.name ?? 'Article',
          category: i.category,
          weight_g: i.weight_g ?? 0,
          quantity: i.quantity ?? 1,
          product_ownership_id: i.product_ownership_id,
        })),
      };
    });
  } catch (err) {
    console.error('getKits fallback to showcase', err);
    return SHOWCASE_KITS;
  }
}
