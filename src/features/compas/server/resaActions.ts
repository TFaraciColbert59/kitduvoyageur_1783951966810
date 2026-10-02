'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  BookingProviderError,
  createBookingProvider,
  type BookingSearchRequest,
} from '@/features/booking/server/bookingProvider';
import { simplifyOffers, type CompasStayOffer } from '../engine/stays';
import type { CompasLiveVertical } from '../engine/resaExamples';

/**
 * Résa du Compas : recherche en direct chez les partenaires (Viator pour les
 * activités, RouteStack pour les vols et les trajets). Lecture seule : rien
 * n'est réservé ni payé ici, aucun lien de paiement n'est créé. L'offre
 * s'ouvre chez le fournisseur seulement si la personne la touche.
 */

export type CompasOfferSearchResult =
  | { success: true; mode: 'sandbox' | 'live'; offers: CompasStayOffer[]; fetchedAt: string }
  | { success: false; error: string; unavailable?: boolean };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  tripId: z.string().uuid(),
  vertical: z.enum(['activity', 'flight', 'car'] as const satisfies readonly CompasLiveVertical[]),
  /** Départ d'un vol (ville ou code IATA), saisi par la personne. */
  from: z.string().trim().max(80).optional(),
  /** Destination ; par défaut celle du voyage. */
  to: z.string().trim().max(80).optional(),
  date: z.string().regex(ISO).optional(),
  returnDate: z.string().regex(ISO).optional(),
});

export async function compasSearchOffersAction(
  input: z.input<typeof schema>
): Promise<CompasOfferSearchResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Recherche invalide' };
  const d = parsed.data;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour chercher des offres.' };
    const trip = (await getTripById(d.tripId, user.id)) as
      | (Awaited<ReturnType<typeof getTripById>> & {
          start_date?: string | null;
          end_date?: string | null;
          destination_name?: string | null;
          party_size?: number | null;
        })
      | null;
    if (!trip) return { success: false, error: 'Voyage introuvable ou non autorisé.' };

    const destination = (d.to || trip.destination_name || '').trim();
    if (!destination) return { success: false, error: 'Indique une destination.' };
    const start = d.date ?? trip.start_date ?? null;
    if (!start || !ISO.test(start))
      return { success: false, error: 'Choisis d’abord la date de départ du voyage.' };
    const end = d.returnDate ?? trip.end_date ?? null;
    const travelers = Math.max(1, Math.min(20, trip.party_size ?? 1));

    let request: BookingSearchRequest;
    if (d.vertical === 'activity') {
      request = { vertical: 'activity', destination, date: start, travelers, limit: 8 };
    } else if (d.vertical === 'flight') {
      const origin = d.from?.trim();
      if (!origin) return { success: false, error: 'Indique ta ville ou ton aéroport de départ.' };
      request = {
        vertical: 'flight',
        origin,
        destination,
        departure: start,
        ...(end && ISO.test(end) && end >= start ? { return: end } : {}),
        travelers,
        limit: 8,
      };
    } else {
      const back = end && ISO.test(end) && end >= start ? end : start;
      request = {
        vertical: 'car',
        destination,
        pickupAt: `${start}T09:00:00Z`,
        dropoffAt: `${back}T18:00:00Z`,
        travelers,
        limit: 8,
      };
    }

    const provider = createBookingProvider({ env: process.env });
    if (!provider.supports(request.vertical))
      return {
        success: false,
        unavailable: true,
        error: 'Partenaire non activé pour cette catégorie : recherche en direct indisponible.',
      };

    const limited = await enforceRateLimit(user.id, {
      scope: 'booking-search',
      limit: 30,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited)
      return { success: false, error: 'Trop de recherches : réessaie dans quelques minutes.' };

    const result = await provider.search(request);
    return {
      success: true,
      mode: result.mode,
      offers: simplifyOffers(result.offers),
      fetchedAt: result.fetchedAt,
    };
  } catch (err) {
    if (err instanceof BookingProviderError) {
      // Code et statut seulement : jamais de clé ni de réponse brute du partenaire.
      console.warn(
        '[compas] recherche partenaire',
        err.provider,
        err.code,
        err.status ?? '',
        err.message
      );
      return { success: false, error: 'Le partenaire n’a pas répondu : réessaie plus tard.' };
    }
    console.error('[compas] compasSearchOffersAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
