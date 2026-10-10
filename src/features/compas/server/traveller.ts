import 'server-only';
import type { Supa } from './compasServer';
import {
  UNKNOWN_TRAVELLER,
  travellerFromRow,
  type TravellerContext,
  type TravellerFields,
  type TravellerHome,
} from '../engine/traveller';

/**
 * Profil voyageur de la personne connectée (table `user_traveller`, PLAN-100 4.1).
 *
 * Seul module qui nomme cette table, avec l'export RGPD de la personne (verrou
 * `scripts/verify/traveller_privacy.mjs`) : toujours avec le client de la personne
 * (RLS : sa ligne seule), jamais un client service, jamais pour quelqu'un d'autre.
 * Aucun journal : ni nationalité, ni domicile.
 */

const COLUMNS =
  'nationality, residence_country, currency, language, time_zone, home_name, home_lat, home_lon, home_country';

type Reader = { from: Supa['from'] } | Supa;

export interface TravellerState {
  /** Une ligne existe (remplie, ou « Passer ») : la question n'est plus posée. */
  asked: boolean;
  traveller: TravellerContext;
  /** La lecture a échoué : tout est inconnu, mais rien ne prouve que la ligne soit vide. */
  failed?: boolean;
}

/**
 * Sa ligne, sinon tout inconnu. Sans personne (essai sans compte compris quand
 * l'appelant passe null) : aucune requête. Lecture en échec : on ne redemande pas
 * (jamais une carte qui insiste) et tout reste inconnu.
 */
export async function readTravellerState(supabase: Reader, userId: string | null): Promise<TravellerState> {
  if (!userId) return { asked: false, traveller: { ...UNKNOWN_TRAVELLER } };
  try {
    const { data, error } = await (supabase as Supa).from('user_traveller').select(COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) return { asked: true, traveller: { ...UNKNOWN_TRAVELLER }, failed: true };
    return { asked: data != null, traveller: travellerFromRow(data) };
  } catch {
    return { asked: true, traveller: { ...UNKNOWN_TRAVELLER }, failed: true };
  }
}

/** Le contexte voyageur seul, pour les moteurs (tout inconnu sans ligne). */
export async function readTraveller(supabase: Reader, userId: string | null): Promise<TravellerContext> {
  return (await readTravellerState(supabase, userId)).traveller;
}

/** Remplace tout le profil de la personne ; le domicile est déjà retrouvé et arrondi. */
export async function writeTraveller(
  supabase: Supa,
  userId: string,
  fields: Omit<TravellerFields, 'home'>,
  home: TravellerHome | null
): Promise<boolean> {
  const { error } = await supabase.from('user_traveller').upsert(
    {
      user_id: userId,
      nationality: fields.nationality,
      residence_country: fields.residenceCountry,
      currency: fields.currency,
      language: fields.language,
      time_zone: fields.timeZone,
      home_name: home?.name ?? null,
      home_lat: home?.lat ?? null,
      home_lon: home?.lon ?? null,
      home_country: home?.countryCode ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  return !error;
}

/** « Passer » : une ligne vide, jamais par-dessus un profil déjà rempli. */
export async function markTravellerAsked(supabase: Supa, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_traveller')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  return !error;
}
