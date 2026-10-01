/**
 * Compas — recherche d'hébergement pour une nuit (fonctions pures).
 *
 * La recherche ne réserve rien : elle liste des offres, l'utilisateur en note
 * une comme repère ou ouvre l'offre chez le fournisseur. Une donnée que le
 * fournisseur ne confirme pas (prix, devise) reste absente, jamais devinée.
 */

import type { BookingCandidate } from '@/features/booking/server/bookingProviderTypes';

export interface CompasStayOffer {
  id: string;
  title: string;
  /** Le fournisseur ne nomme pas l'offre : le titre est un libellé, pas un nom de lieu. */
  untitled: boolean;
  description: string | null;
  /** Null si le fournisseur ne confirme pas le prix. */
  amount: number | null;
  /** Null si le fournisseur ne confirme pas la devise : jamais EUR par défaut. */
  currency: string | null;
  provider: string;
  /** Lien de l'offre chez le fournisseur (ouvert par l'utilisateur, jamais automatiquement). */
  url: string | null;
  requiresRevalidation: boolean;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 86_400_000;

const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Dates d'arrivée et de départ de la nuit du jour `day` (1 = premier jour du
 * voyage). Null sans date de départ valide ou pour un jour hors limites.
 */
export function stayDates(
  startDate: string | null,
  day: number
): { checkIn: string; checkOut: string } | null {
  if (!startDate || !ISO_DAY.test(startDate) || !Number.isInteger(day) || day < 1 || day > 60)
    return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(start)) return null;
  return { checkIn: toIso(start + (day - 1) * MS_DAY), checkOut: toIso(start + day * MS_DAY) };
}

/** Garde les offres exploitables (titre) et limite leur nombre. */
export function simplifyOffers(candidates: BookingCandidate[], limit = 8): CompasStayOffer[] {
  const out: CompasStayOffer[] = [];
  for (const c of candidates) {
    const title = typeof c.title === 'string' ? c.title.trim() : '';
    if (!title) continue;
    const amount =
      typeof c.amount === 'number' && Number.isFinite(c.amount) && c.amount >= 0 ? c.amount : null;
    const currency =
      typeof c.currency === 'string' && /^[A-Za-z]{3}$/.test(c.currency)
        ? c.currency.toUpperCase()
        : null;
    out.push({
      id: c.id,
      title,
      untitled: c.untitled === true,
      description: c.description?.trim() || null,
      amount: amount != null && currency != null ? amount : null,
      currency: amount != null ? currency : null,
      provider: c.provider,
      url: typeof c.deeplink === 'string' && /^https:\/\//i.test(c.deeplink) ? c.deeplink : null,
      requiresRevalidation: c.requiresRevalidation === true,
    });
    if (out.length >= limit) break;
  }
  return out;
}
