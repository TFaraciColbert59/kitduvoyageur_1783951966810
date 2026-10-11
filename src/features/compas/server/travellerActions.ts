'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/observability/appErrors';
import { coarsePosition } from '../engine/privacy';
import { isHomePlace, samePlaceName } from '../engine/places';
import { cleanTravellerFields, isCountryCode, travellerView, type TravellerHome, type TravellerView } from '../engine/traveller';
import { placeSearchLimitError, resolvePlaceByName } from './placeSearch';
import { markTravellerAsked, readTravellerState, writeTraveller } from './traveller';

/**
 * Profil voyageur (PLAN-100 4.1) : enregistré par la personne elle-même, jamais
 * exigé, jamais pour un essai sans compte. Le domicile est retrouvé sur la carte
 * UNE fois, ici (même recherche et même limite que le départ « depuis Lyon »), puis
 * rangé arrondi à 0,01° : aucune préparation ne le recherche. Rien de la saisie
 * n'entre dans un journal ni dans `app_errors` (messages fixes).
 */

export type TravellerSaveResult = { success: true; view: TravellerView } | { success: false; error: string };

const text = (max: number) => z.string().max(max).nullable().optional();
const travellerSchema = z.object({
  nationality: text(8),
  residenceCountry: text(8),
  currency: text(8),
  language: text(35),
  timeZone: text(64),
  /** Ville tapée ; 80 caractères au plus une fois nettoyée (`cleanTravellerFields`). */
  home: text(120),
});

const INVALID = 'Profil invalide';

/** Une panne n'est jamais rapportée avec son message (il peut contenir le domicile tapé). */
const quiet = (err: unknown) => new Error(err instanceof Error ? err.name : 'erreur');

export async function saveTravellerAction(input: z.input<typeof travellerSchema>): Promise<TravellerSaveResult> {
  const parsed = travellerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: INVALID };
  const fields = cleanTravellerFields(parsed.data);
  if (!fields) return { success: false, error: INVALID };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour enregistrer ton profil voyageur.' };
    if (user.is_anonymous === true)
      return { success: false, error: 'Crée ton compte pour enregistrer ton profil voyageur.' };
    let home: TravellerHome | null = null;
    if (fields.home) {
      const kept = (await readTravellerState(supabase, user.id)).traveller.home;
      if (kept && samePlaceName(kept.name, fields.home)) home = kept;
      else {
        const limitError = await placeSearchLimitError(user.id);
        if (limitError) return { success: false, error: limitError };
        const found = await resolvePlaceByName(fields.home);
        if (!found) return { success: false, error: `« ${fields.home} » introuvable sur la carte.` };
        if (!isHomePlace(found))
          return { success: false, error: `« ${fields.home} » n’est pas une ville ou un village : écris ta commune (« Lyon »).` };
        const at = coarsePosition({ lat: found.lat, lon: found.lon });
        if (!at) return { success: false, error: INVALID };
        home = {
          name: found.name.slice(0, 80),
          lat: at.lat,
          lon: at.lon,
          countryCode: isCountryCode(found.countryCode) ? found.countryCode : null,
        };
      }
    }
    if (!(await writeTraveller(supabase, user.id, fields, home)))
      return { success: false, error: 'Impossible d’enregistrer ton profil voyageur.' };
    return { success: true, view: travellerView({ ...fields, home }) };
  } catch (err) {
    await reportServerError('compas.saveTravellerAction', quiet(err));
    return { success: false, error: 'Erreur serveur' };
  }
}

/** « Passer » : la réponse est rangée (une ligne vide), la question n'est plus posée. */
export async function skipTravellerAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous === true) return { success: false };
    return { success: await markTravellerAsked(supabase, user.id) };
  } catch (err) {
    await reportServerError('compas.skipTravellerAction', quiet(err));
    return { success: false };
  }
}
