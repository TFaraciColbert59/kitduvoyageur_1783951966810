import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { categorySchema } from '@/lib/schemas/materiel';
export interface InventoryCatalogProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  weight_g: number | null;
  price_cents: number | null;
}
const CATEGORY_MAP: Record<string, string> = {
  'Sacs à dos': 'Sacs & Portage',
  Tentes: 'Couchage & Tentes',
  Couchage: 'Couchage & Tentes',
  Vêtements: 'Vêtements & Vestes',
  Chaussures: 'Vêtements & Vestes',
  Cuisine: 'Cuisine & Réchauds',
  Eau: 'Eau & Filtres',
  Éclairage: 'Lampes & Éclairage',
  Navigation: 'Navigation & GPS',
  Sécurité: 'Sécurité & Soins',
  Accessoires: 'Accessoires & Outils',
};
function inventoryCategory(value: string): string {
  return categorySchema.safeParse(value).success ? value : (CATEGORY_MAP[value] ?? 'Autre');
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Only public catalog fields; owner records and serials never enter this loader. */
export async function getInventoryCatalog(ids: string[]): Promise<InventoryCatalogProduct[]> {
  const valid = Array.from(new Set(ids.filter((id) => UUID.test(id))));
  if (!valid.length) return [];
  try {
    const db = await createClient();
    const { data, error } = await db
      .from('shop_products')
      .select('id,slug,name,brand,category,weight_g,price_eur')
      .in('id', valid)
      .eq('is_active', true);
    if (error) throw error;
    return (data ?? [])
      .filter((p) => typeof p.slug === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: typeof p.brand === 'string' ? p.brand : null,
        category: inventoryCategory(p.category),
        weight_g:
          typeof p.weight_g === 'number' && p.weight_g >= 0 && p.weight_g <= 50000
            ? Math.round(p.weight_g)
            : null,
        price_cents:
          p.price_eur != null &&
          Number.isFinite(Number(p.price_eur)) &&
          Number(p.price_eur) >= 0 &&
          Number(p.price_eur) <= 1000000
            ? Math.round(Number(p.price_eur) * 100)
            : null,
      }));
  } catch {
    return [];
  }
}
