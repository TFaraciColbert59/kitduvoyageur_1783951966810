'use client';

/**
 * Suivre un carnet et choisir la fréquence de ses notifications.
 *
 * Propositions n° 20 et 41 de `docs/carnets/maquette-carnets-de-bord.html` :
 * le suivi du carnet (distinct du suivi de la personne via `user_follows`) et
 * la fréquence choisie par chaque suiveur (`carnet_follows`, migration
 * 20261111120000) :
 * - `moment` : à chaque moment ;
 * - `digest` : résumé du soir, un par jour ;
 * - `highlights` : départ, sommets, arrivée.
 *
 * Dégradations honnêtes, jamais de mock :
 * - table absente sur la base (code 42P01 / PGRST205) ou erreur réseau → la
 *   préférence retombe sur le localStorage de l'appareil (`persisted: false`),
 *   comme avant la table ;
 * - un participant (auteur, collaborateur, présent d'une sortie) ne « suit »
 *   pas son propre carnet : le suivi reste inactif ;
 * - invité : aucun appel réseau, le composant le renvoie vers la connexion.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type CarnetNotifyMode = 'moment' | 'digest' | 'highlights';

/** Ordre des trois options de la lentille « Suivre » (maquette). */
export const CARNET_NOTIFY_MODES: readonly CarnetNotifyMode[] = [
  'moment',
  'digest',
  'highlights',
];

export type CarnetFollowState = 'idle' | 'loading' | 'ready' | 'error';

export interface UseCarnetFollowArgs {
  carnetId: string;
  userId: string | null;
  /** Auteur / collaborateur / présent d'une sortie : on ne suit pas son carnet. */
  isParticipant?: boolean;
}

export interface UseCarnetFollowResult {
  following: boolean;
  notifyMode: CarnetNotifyMode;
  state: CarnetFollowState;
  /** `true` : la préférence vient du compte ; `false` : repli local appareil. */
  persisted: boolean;
  busy: boolean;
  toggle: () => Promise<void>;
  setNotifyMode: (mode: CarnetNotifyMode) => Promise<void>;
}

const LOCAL_NOTIF_KEY = (carnetId: string) => `lkdv:carnet:${carnetId}:notif-pref`;
const LOCAL_FOLLOW_KEY = (carnetId: string) => `lkdv:carnet:${carnetId}:following`;
const DEFAULT_MODE: CarnetNotifyMode = 'digest';

function isMissingTable(error: { code?: string | null } | null | undefined): boolean {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205'));
}

function readLocalMode(carnetId: string): CarnetNotifyMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const stored = window.localStorage.getItem(LOCAL_NOTIF_KEY(carnetId));
    if (stored === null) return DEFAULT_MODE;
    const raw = Number(stored);
    if (Number.isInteger(raw) && raw >= 0 && raw < CARNET_NOTIFY_MODES.length) {
      return CARNET_NOTIFY_MODES[raw];
    }
  } catch {
    /* stockage refusé : préférence par défaut */
  }
  return DEFAULT_MODE;
}

function writeLocalMode(carnetId: string, mode: CarnetNotifyMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_NOTIF_KEY(carnetId),
      String(CARNET_NOTIFY_MODES.indexOf(mode))
    );
  } catch {
    /* préférence valable pour la session */
  }
}

function readLocalFollowing(carnetId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LOCAL_FOLLOW_KEY(carnetId)) === '1';
  } catch {
    return false;
  }
}

function writeLocalFollowing(carnetId: string, following: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (following) window.localStorage.setItem(LOCAL_FOLLOW_KEY(carnetId), '1');
    else window.localStorage.removeItem(LOCAL_FOLLOW_KEY(carnetId));
  } catch {
    /* préférence valable pour la session */
  }
}

export function useCarnetFollow({
  carnetId,
  userId,
  isParticipant = false,
}: UseCarnetFollowArgs): UseCarnetFollowResult {
  const supabase = useMemo(() => createClient(), []);
  const [following, setFollowing] = useState(false);
  const [notifyMode, setNotifyModeState] = useState<CarnetNotifyMode>(DEFAULT_MODE);
  const [state, setState] = useState<CarnetFollowState>('idle');
  const [persisted, setPersisted] = useState(false);
  const [busy, setBusy] = useState(false);

  /* Lecture initiale : compte si connecté et non participant, sinon appareil. */
  useEffect(() => {
    let cancelled = false;
    setFollowing(readLocalFollowing(carnetId));
    setNotifyModeState(readLocalMode(carnetId));
    setPersisted(false);

    if (!userId || isParticipant) {
      /* Un participant ne suit pas son propre carnet, quoi qu'il y ait en local. */
      if (isParticipant) setFollowing(false);
      setState('ready');
      return () => {
        cancelled = true;
      };
    }

    setState('loading');
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('carnet_follows')
          .select('notify_mode')
          .eq('carnet_id', carnetId)
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (isMissingTable(error)) {
          /* Table pas encore appliquée : repli local, l'écran reste utilisable. */
          setState('ready');
          return;
        }
        const row = data as { notify_mode?: string | null } | null;
        const mode = CARNET_NOTIFY_MODES.includes(row?.notify_mode as CarnetNotifyMode)
          ? (row?.notify_mode as CarnetNotifyMode)
          : DEFAULT_MODE;
        setFollowing(Boolean(row));
        setNotifyModeState(row ? mode : readLocalMode(carnetId));
        setPersisted(Boolean(row));
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [carnetId, isParticipant, supabase, userId]);

  const toggle = useCallback(async () => {
    if (!userId || isParticipant || busy) return;
    setBusy(true);
    try {
      if (following) {
        const { error } = await supabase
          .from('carnet_follows')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('user_id', userId);
        if (error && !isMissingTable(error)) throw error;
        setFollowing(false);
        setPersisted(!isMissingTable(error));
        writeLocalFollowing(carnetId, false);
      } else {
        const { error } = await supabase.from('carnet_follows').insert({
          carnet_id: carnetId,
          user_id: userId,
          notify_mode: readLocalMode(carnetId),
        });
        if (error && !isMissingTable(error)) throw error;
        setFollowing(true);
        setPersisted(!isMissingTable(error));
        writeLocalFollowing(carnetId, true);
      }
    } catch {
      /* Écriture impossible : suivi local, jamais un faux état serveur. */
      const next = !following;
      setFollowing(next);
      setPersisted(false);
      writeLocalFollowing(carnetId, next);
    } finally {
      setBusy(false);
    }
  }, [busy, carnetId, following, isParticipant, supabase, userId]);

  const setNotifyMode = useCallback(
    async (mode: CarnetNotifyMode) => {
      setNotifyModeState(mode);
      writeLocalMode(carnetId, mode);
      if (!userId || isParticipant) return;
      setBusy(true);
      try {
        if (persisted && following) {
          const { error } = await supabase
            .from('carnet_follows')
            .update({ notify_mode: mode, updated_at: new Date().toISOString() })
            .eq('carnet_id', carnetId)
            .eq('user_id', userId);
          if (error && !isMissingTable(error)) throw error;
          setPersisted(!isMissingTable(error));
        } else {
          /* Choisir une fréquence, c'est suivre le carnet : un seul geste. */
          const { error } = await supabase.from('carnet_follows').insert({
            carnet_id: carnetId,
            user_id: userId,
            notify_mode: mode,
          });
          if (error && !isMissingTable(error)) throw error;
          setFollowing(true);
          setPersisted(!isMissingTable(error));
          writeLocalFollowing(carnetId, true);
        }
      } catch {
        setPersisted(false);
      } finally {
        setBusy(false);
      }
    },
    [carnetId, following, isParticipant, persisted, supabase, userId]
  );

  return { following, notifyMode, state, persisted, busy, toggle, setNotifyMode };
}

export default useCarnetFollow;
