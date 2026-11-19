'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Capacités de la base pour la création de carnet.
 *
 * `public.carnet_nights` (migration `20261108100004_carnet_v2_lot_d`) **n'existe
 * pas en production au 2026-11-08**. Le RPC `create_carnet_v2` ignore les nuits
 * quand la table est absente (`to_regclass('public.carnet_nights') is null`) :
 * afficher la saisie sans la table ferait perdre la nuitée en silence.
 *
 * L'UI ne montre donc la nuitée que si la table **répond** (sonde en lecture,
 * mise en cache pour la session). Dès que la migration est appliquée, la saisie
 * apparaît toute seule — plus de drapeau à basculer à la main. Données de
 * production : tant que la migration n'est pas appliquée, la sonde est fausse et
 * la nuitée reste masquée (comportement honnête, testé).
 *
 * `NEXT_PUBLIC_COMMUNAUTE_V2_NIGHTS=true|false` force la réponse (recette,
 * captures, coupe-circuit).
 */

/** Valeur de repli tant que la sonde n'a pas répondu (et en cas d'échec). */
export const HAS_CARNET_NIGHTS = false;

/** Codes PostgREST/Postgres d'une table absente (`PGRST205`, `42P01`). */
export function isMissingTableError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (code === 'PGRST205' || code === '42P01' || code === 'PGRST200') return true;
  return /could not find the table|does not exist|schema cache/i.test(error.message ?? '');
}

interface ProbeClient {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { head?: boolean; count?: 'exact' },
    ) => PromiseLike<{ error: { code?: string | null; message?: string | null } | null }>;
  };
}

/** Sonde en lecture seule : `true` seulement si la table répond sans erreur. */
export async function probeCarnetNights(client: ProbeClient): Promise<boolean> {
  try {
    const { error } = await client.from('carnet_nights').select('id', { head: true, count: 'exact' });
    return error == null;
  } catch {
    return false;
  }
}

function envOverride(): boolean | null {
  const raw = process.env.NEXT_PUBLIC_COMMUNAUTE_V2_NIGHTS;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

/** Réinitialise le cache (tests). */
export function resetCarnetNightsCapability(): void {
  cached = null;
  inflight = null;
}

export function loadCarnetNightsCapability(client?: ProbeClient): Promise<boolean> {
  const forced = envOverride();
  if (forced != null) return Promise.resolve(forced);
  if (cached != null) return Promise.resolve(cached);
  if (!inflight) {
    let probeClient: ProbeClient;
    try {
      probeClient = client ?? (createClient() as unknown as ProbeClient);
    } catch {
      // Configuration Supabase absente : la nuitée reste masquée.
      return Promise.resolve(false);
    }
    inflight = probeCarnetNights(probeClient).then((value) => {
      cached = value;
      inflight = null;
      return value;
    });
  }
  return inflight;
}

/** `true` quand `carnet_nights` répond ; `false` tant que la sonde n'a pas répondu. */
export function useCarnetNights(): boolean {
  const [available, setAvailable] = useState<boolean>(() => envOverride() ?? cached ?? HAS_CARNET_NIGHTS);
  useEffect(() => {
    let alive = true;
    void loadCarnetNightsCapability().then((value) => {
      if (alive) setAvailable(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return available;
}
