'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { parseWallet, walletView, type Wallet, type WalletView } from '../domain/wallet';
import { toRedeemError, type RedeemErrorCode } from '../domain/redemption';

/**
 * Portefeuille du membre connecté : lecture `/api/rewards/wallet`, dernier
 * solde connu pour le hors-ligne, objectif et échange.
 *
 * Le cache local est une commodité par appareil, rangé sous l'identifiant du
 * membre (jamais relu pour un autre compte) ; il n'autorise aucun échange.
 */

const CACHE_PREFIX = 'lkdv:rewards:wallet:';
export const WALLET_QUERY_KEY = ['rewards', 'wallet'] as const;

export class RewardsHttpError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const code = response.status === 401
      ? 'unauthenticated'
      : response.status === 429
        ? 'rate_limited'
        : typeof payload?.error === 'string' ? payload.error : `http_${response.status}`;
    throw new RewardsHttpError(code, response.status);
  }
  return payload ?? {};
}

function readCache(userId: string | null): { wallet: Wallet; savedAt: string } | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { snapshot?: unknown; savedAt?: unknown };
    const wallet = parseWallet(parsed.snapshot);
    if (!wallet || typeof parsed.savedAt !== 'string') return null;
    return { wallet, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeCache(userId: string, snapshot: unknown) {
  try {
    window.localStorage.setItem(
      CACHE_PREFIX + userId,
      JSON.stringify({ snapshot, savedAt: new Date().toISOString() })
    );
  } catch {
    /* stockage indisponible (navigation privée) : rien à faire */
  }
}

export interface RedeemSuccess {
  status: string;
  reference: string | null;
  balance: number;
  idempotent: boolean;
}

export type RedeemOutcome = { ok: true; data: RedeemSuccess } | { ok: false; code: RedeemErrorCode };

export function useRewardsWallet(userId: string | null, authLoading = false) {
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();
  const [cached, setCached] = useState<{ wallet: Wallet; savedAt: string } | null>(null);

  useEffect(() => {
    setCached(readCache(userId));
  }, [userId]);

  const query = useQuery({
    queryKey: [...WALLET_QUERY_KEY, userId],
    enabled: Boolean(userId) && isOnline,
    staleTime: 15_000,
    retry: (count, error) => !(error instanceof RewardsHttpError && error.status < 500) && count < 1,
    queryFn: async () => {
      const payload = await requestJson('/api/rewards/wallet');
      const wallet = parseWallet(payload.snapshot);
      if (!wallet) throw new RewardsHttpError('invalid_wallet', 500);
      if (userId) {
        writeCache(userId, payload.snapshot);
        setCached({ wallet, savedAt: new Date().toISOString() });
      }
      return wallet;
    },
  });

  const unauthenticated =
    (!authLoading && !userId) ||
    (query.error instanceof RewardsHttpError && query.error.code === 'unauthenticated');

  const view: WalletView = useMemo(
    () =>
      walletView({
        authenticated: authLoading ? null : !unauthenticated,
        online: isOnline,
        loading: query.isPending && query.fetchStatus !== 'idle',
        error: query.isError,
        wallet: query.data ?? null,
        cached,
      }),
    [authLoading, unauthenticated, isOnline, query.isPending, query.fetchStatus, query.isError, query.data, cached]
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
    [queryClient]
  );

  const goal = useMutation({
    mutationFn: async (rewardId: string | null) => {
      if (rewardId) {
        await requestJson('/api/rewards/goal', { method: 'PUT', body: JSON.stringify({ rewardId }) });
      } else {
        await requestJson('/api/rewards/goal', { method: 'DELETE' });
      }
      return rewardId;
    },
    onSuccess: () => void invalidate(),
  });

  const redeem = useCallback(
    async (rewardId: string, idempotencyKey: string): Promise<RedeemOutcome> => {
      if (!isOnline) return { ok: false, code: 'offline' };
      try {
        const payload = await requestJson('/api/rewards/redeem', {
          method: 'POST',
          body: JSON.stringify({ rewardId, idempotencyKey }),
        });
        void invalidate();
        return {
          ok: true,
          data: {
            status: typeof payload.status === 'string' ? payload.status : 'reserved',
            reference: typeof payload.reference === 'string' ? payload.reference : null,
            balance: typeof payload.balance === 'number' ? payload.balance : 0,
            idempotent: payload.idempotent === true,
          },
        };
      } catch (error) {
        if (error instanceof RewardsHttpError) return { ok: false, code: toRedeemError(error.code) };
        // Réseau coupé pendant l'envoi : issue inconnue, la même clé sera réutilisée.
        return { ok: false, code: 'internal_error' };
      }
    },
    [invalidate, isOnline]
  );

  return {
    view,
    isOnline,
    refetch: () => void query.refetch(),
    isFetching: query.isFetching,
    setGoal: goal.mutateAsync,
    goalPending: goal.isPending,
    goalError: goal.error instanceof RewardsHttpError ? goal.error.code : goal.error ? 'internal_error' : null,
    redeem,
  };
}
