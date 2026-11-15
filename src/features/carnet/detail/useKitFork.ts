'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UseKitForkArgs {
  carnetId: string;
  userId: string | null;
  onRequireAuth?: () => void;
  onIsland?: (message: string, undo?: () => void) => void;
}

export function useKitFork({
  carnetId,
  userId,
  onRequireAuth,
  onIsland,
}: UseKitForkArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [forkedItemIds, setForkedItemIds] = useState<Set<string>>(new Set());
  const [carnetForked, setCarnetForked] = useState(false);
  const [loading, setLoading] = useState(false);

  const persistLocal = useCallback(
    (next: Set<string>) => {
      if (typeof window === 'undefined' || !userId || !carnetId) return;
      try {
        window.localStorage.setItem(`lkdv-kit-forks:${userId}:${carnetId}`, JSON.stringify([...next]));
      } catch {
        // quota/private mode
      }
    },
    [carnetId, userId]
  );

  // Load existing fork state for this user & source carnet (`kit_forks` stores `(id, user_id, source_carnet_id, created_at)`)
  useEffect(() => {
    if (!userId || !carnetId) return;
    let active = true;

    try {
      const cached = window.localStorage.getItem(`lkdv-kit-forks:${userId}:${carnetId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as unknown;
        if (Array.isArray(parsed)) {
          setForkedItemIds(new Set(parsed.filter((v): v is string => typeof v === 'string')));
        }
      }
    } catch {
      // silent
    }

    async function loadForks() {
      try {
        const { data, error } = await supabase
          .from('kit_forks')
          .select('id')
          .eq('source_carnet_id', carnetId)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (!error && active) {
          setCarnetForked(Boolean(data));
        }
      } catch {
        // silent
      }
    }

    void loadForks();
    return () => {
      active = false;
    };
  }, [carnetId, supabase, userId]);

  const ensureCarnetForkRow = useCallback(async () => {
    if (!userId || carnetForked) return;
    const { data: existing, error: checkErr } = await supabase
      .from('kit_forks')
      .select('id')
      .eq('source_carnet_id', carnetId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (checkErr) throw checkErr;
    if (!existing) {
      const { error } = await supabase.from('kit_forks').insert({
        source_carnet_id: carnetId,
        user_id: userId,
      });
      if (error) throw error;
    }
    setCarnetForked(true);
  }, [carnetForked, carnetId, supabase, userId]);

  const forkItem = useCallback(
    async (kitItemId: string, _notes?: string): Promise<boolean> => {
      if (!userId) {
        onRequireAuth?.();
        return false;
      }
      if (forkedItemIds.has(kitItemId)) {
        onIsland?.('Déjà ajouté à votre sac');
        return true;
      }

      setLoading(true);
      const next = new Set(forkedItemIds);
      next.add(kitItemId);
      setForkedItemIds(next);

      try {
        await ensureCarnetForkRow();
        persistLocal(next);

        onIsland?.('Équipement ajouté à votre sac', () => {
          void undoFork(kitItemId);
        });
        return true;
      } catch {
        setForkedItemIds((prev) => {
          const rollback = new Set(prev);
          rollback.delete(kitItemId);
          return rollback;
        });
        onIsland?.('Impossible d’ajouter l’équipement');
        return false;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureCarnetForkRow, forkedItemIds, onIsland, onRequireAuth, persistLocal, userId]
  );

  const undoFork = useCallback(
    async (kitItemId: string) => {
      if (!userId) return;
      let shouldDeleteRow = false;
      setForkedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(kitItemId);
        shouldDeleteRow = next.size === 0;
        persistLocal(next);
        return next;
      });

      try {
        if (shouldDeleteRow) {
          await supabase
            .from('kit_forks')
            .delete()
            .eq('source_carnet_id', carnetId)
            .eq('user_id', userId);
          setCarnetForked(false);
        }
      } catch {
        // silent
      }
    },
    [carnetId, persistLocal, supabase, userId]
  );

  const forkAllItems = useCallback(
    async (kitItemIds: string[]): Promise<boolean> => {
      if (!userId) {
        onRequireAuth?.();
        return false;
      }
      const toAdd = kitItemIds.filter((id) => !forkedItemIds.has(id));
      if (toAdd.length === 0) {
        onIsland?.('Tous les équipements sont déjà dans votre sac');
        return true;
      }

      setLoading(true);
      const next = new Set([...forkedItemIds, ...toAdd]);
      setForkedItemIds(next);

      try {
        await ensureCarnetForkRow();
        persistLocal(next);

        onIsland?.(`${toAdd.length} équipement${toAdd.length > 1 ? 's' : ''} ajouté${toAdd.length > 1 ? 's' : ''} à votre sac`);
        return true;
      } catch {
        setForkedItemIds((prev) => {
          const rollback = new Set(prev);
          toAdd.forEach((id) => rollback.delete(id));
          return rollback;
        });
        onIsland?.('Échec de l’ajout du kit');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [ensureCarnetForkRow, forkedItemIds, onIsland, onRequireAuth, persistLocal, userId]
  );

  return {
    forkedItemIds,
    isForked: (id: string) => forkedItemIds.has(id),
    forkItem,
    forkAllItems,
    loading,
  };
}
