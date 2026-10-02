/**
 * Rapprochement d'un objet du kit avec un produit réel de la boutique LKDV
 * (shop_products) : mots communs du nom, de la catégorie et de la marque.
 * Fonctions pures : aucun produit n'est inventé, seul le catalogue est lu.
 */

export interface ShopMatchLine {
  name: string;
  category: string | null;
}

export interface ShopMatchProduct {
  name: string;
  category: string | null;
  brand: string | null;
  mode?: string | null;
}

const STOP = new Set(['avec', 'pour', 'les', 'des', 'une', 'categorie', 'bigbuy', 'outdoor']);

export function shopTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Pertinence d'un produit pour un objet du kit : mots communs, catégorie. */
export function shopRelevance(line: ShopMatchLine, p: ShopMatchProduct): number {
  const want = new Set(shopTokens(`${line.name} ${line.category ?? ''}`));
  const have = new Set(shopTokens(`${p.name} ${p.category ?? ''} ${p.brand ?? ''}`));
  let score = 0;
  for (const t of have) if (want.has(t)) score += 1;
  return score;
}

/**
 * Le produit d'achat le plus pertinent, ou null : il faut au moins un mot du
 * NOM de l'objet en commun (une catégorie seule ne suffit pas à proposer).
 */
export function bestShopProduct<P extends ShopMatchProduct>(
  line: ShopMatchLine,
  shop: readonly P[]
): P | null {
  const nameWords = new Set(shopTokens(line.name));
  if (!nameWords.size) return null;
  let best: P | null = null;
  let bestScore = 0;
  for (const p of shop) {
    if (p.mode != null && p.mode !== 'achat') continue;
    if (!shopTokens(p.name).some((t) => nameWords.has(t))) continue;
    const s = shopRelevance(line, p);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}
