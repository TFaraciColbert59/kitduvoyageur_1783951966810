/**
 * « Emprunter · Louer · Acheter » pour un objet à trouver (fonctions pures).
 *
 * Chaque mode dit ce que les données réelles permettent : l'équipe (sans voir son inventaire,
 * qui est privé), les locations et les produits de la boutique avec leur prix, le total d'une
 * location pour la durée DATÉE du voyage, l'écart de poids avec l'objet prévu. Une durée, un prix
 * ou un poids absents sont dits absents : jamais un zéro, jamais une estimation déguisée.
 * Rien ici n'achète : choisir un produit à l'achat relie l'objet et remplit le panier, la commande se
 * fait au panier, par un geste de la personne. Une location ne passe JAMAIS par le panier (il ne sait
 * pas porter un prix par jour avec des dates) : choisie, elle est reliée à l'objet et attend sa
 * réservation, qui se fait sur la page Location.
 */
import { formatKg, formatMoney } from './format';

export type AcquireKind = 'emprunter' | 'louer' | 'acheter';

export interface AcquireProduct {
  id: string;
  mode: 'achat' | 'location' | 'occasion' | 'enchere' | null;
  weightG: number | null;
  priceEur: number | null;
  pricePerDay: number | null;
}

/** Les produits proposés pour un mode : locations pour « louer », achats et occasions pour « acheter ». */
export function productsFor<P extends AcquireProduct>(shop: readonly P[], kind: 'louer' | 'acheter'): P[] {
  return shop.filter((p) =>
    kind === 'louer' ? p.mode === 'location' : (p.mode ?? 'achat') === 'achat' || p.mode === 'occasion'
  );
}

/** Page où se réservent les locations (dates, caution) : le seul chemin de réservation existant. */
export const RENTAL_BOOKING_PATH = '/location';

/**
 * Ce que le panier peut réellement porter : un achat ou une occasion (le mode absent vaut achat, comme
 * dans la liste « Acheter »), avec un prix unique et une fiche à ouvrir. Une location (prix par jour,
 * dates), une enchère ou un produit sans prix ne le sont pas. Règle UNIQUE, lue par l'écran ET par le
 * serveur : « dans le panier » n'est écrit que pour ce que cette règle accepte.
 */
export function isCartable(p: { mode: AcquireProduct['mode']; priceEur: number | null; slug: string | null }): boolean {
  const buyable = (p.mode ?? 'achat') === 'achat' || p.mode === 'occasion';
  return buyable && Boolean(p.slug) && p.priceEur != null && Number.isFinite(p.priceEur) && p.priceEur >= 0;
}

/**
 * L'état d'achat tel qu'il se lit : « au panier » n'est vrai que pour un produit que le panier peut
 * porter. Une ligne qui dit `in_cart` alors que son produit est une location (écrite avant ce verrou)
 * n'est pas dans le panier : elle se lit « à acquérir ». Produit inconnu : l'état écrit est gardé.
 */
export function honestPurchaseState(
  state: string | null,
  product: { mode: AcquireProduct['mode']; priceEur: number | null; slug: string | null } | null | undefined
): string | null {
  return state === 'in_cart' && product && !isCartable(product) ? 'needed' : state;
}

/** Prix de la location pour `days` jours (jours datés du voyage) ; null si le prix ou la durée manque. */
export function rentalTotal(pricePerDay: number | null, days: number | null): number | null {
  if (pricePerDay == null || !Number.isFinite(pricePerDay) || pricePerDay < 0) return null;
  if (days == null || !Number.isInteger(days) || days < 1) return null;
  return Math.round(pricePerDay * days * 100) / 100;
}

/** Écart de poids du produit avec l'objet prévu, par exemplaire ; null si l'un des deux poids manque. */
export function weightDelta(
  plannedG: number | null,
  productG: number | null
): { grams: number; text: string; tone: 'good' | 'warn' | 'same' } | null {
  if (plannedG == null || productG == null || !(plannedG > 0) || !(productG > 0)) return null;
  const grams = Math.round(productG - plannedG);
  if (grams === 0) return { grams, text: 'même poids que prévu', tone: 'same' };
  const text = `${grams < 0 ? '−' : '+'}${formatKg(Math.abs(grams))} par rapport à l’objet prévu`;
  return { grams, text, tone: grams < 0 ? 'good' : 'warn' };
}

/** La ligne de prix d'un produit : « 6 € / jour · 5 jours = 30 € » ou « 39 € ». */
export function priceText(p: AcquireProduct, days: number | null): string {
  if (p.mode === 'location') {
    if (p.pricePerDay == null) return 'prix non renseigné';
    const base = `${formatMoney(p.pricePerDay)} / jour`;
    const total = rentalTotal(p.pricePerDay, days);
    return total == null ? `${base} · durée du voyage non datée` : `${base} · ${days} jour${(days ?? 0) > 1 ? 's' : ''} = ${formatMoney(total)}`;
  }
  return p.priceEur == null ? 'prix non renseigné' : formatMoney(p.priceEur);
}

export interface AcquireOverview {
  emprunter: string;
  louer: string;
  acheter: string;
}

/** Une phrase par mode, pour choisir en connaissance de cause. */
export function acquireOverview(input: {
  shop: readonly AcquireProduct[];
  teammates: number;
  days: number | null;
}): AcquireOverview {
  const rent = productsFor(input.shop, 'louer');
  const buy = productsFor(input.shop, 'acheter');
  const cheapest = (xs: Array<number | null>) => {
    const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
    return v.length ? Math.min(...v) : null;
  };
  const rentFrom = cheapest(rent.map((p) => rentalTotal(p.pricePerDay, input.days)));
  const rentDay = cheapest(rent.map((p) => p.pricePerDay));
  const buyFrom = cheapest(buy.map((p) => p.priceEur));
  return {
    emprunter: input.teammates
      ? `${input.teammates} personne${input.teammates > 1 ? 's' : ''} dans l’équipe : ce que chacun possède n’est pas visible ici, demande-lui.`
      : 'Personne d’autre dans l’équipe pour l’instant.',
    louer: rent.length
      ? `${rent.length} location${rent.length > 1 ? 's' : ''} en boutique${
          rentFrom != null
            ? `, dès ${formatMoney(rentFrom)} pour ${input.days} jour${(input.days ?? 0) > 1 ? 's' : ''}`
            : rentDay != null
              ? `, dès ${formatMoney(rentDay)} par jour (durée du voyage non datée)`
              : ' (prix non renseignés)'
        }.`
      : 'Aucune location en boutique pour l’instant.',
    acheter: buy.length
      ? `${buy.length} produit${buy.length > 1 ? 's' : ''} en boutique${buyFrom != null ? `, dès ${formatMoney(buyFrom)}` : ' (prix non renseignés)'}.`
      : 'Aucun produit en boutique pour l’instant.',
  };
}
