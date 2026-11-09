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
  const [loading, setLoading] = useState(false);

  // Load existing forks for this user & carnet
  useEffect(() => {
    if (!userId || !carnetId) return;
    let active = true;

    async function loadForks() {
      try {
        const { data, error } = await supabase
          .from('kit_forks')
          .select('kit_item_id')
          .eq('carnet_id', carnetId)
          .eq('user_id', userId);

        if (!error && data && active) {
          setForkedItemIds(new Set(data.map((r) => r.kit_item_id)));
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

  const forkItem = useCallback(
    async (kitItemId: string, notes?: string): Promise<boolean> => {
      if (!userId) {
        onRequireAuth?.();
        return false;
      }
      if (forkedItemIds.has(kitItemId)) {
        onIsland?.('Déjà ajouté à votre sac');
        return true;
      }

      setLoading(true);
      // Optimistic update
      setForkedItemIds((prev) => new Set([...prev, kitItemId]));

      try {
        const { error } = await supabase.from('kit_forks').insert({
          carnet_id: carnetId,
          kit_item_id: kitItemId,
          user_id: userId,
          notes: notes ?? null,
        });

        if (error) throw error;

        onIsland?.('Équipement ajouté à votre sac', () => {
          void undoFork(kitItemId);
        });
        return true;
      } catch {
        // Rollback
        setForkedItemIds((prev) => {
          const next = new Set(prev);
          next.delete(kitItemId);
          return next;
        });
        onIsland?.('Impossible d’ajouter l’équipement');
        return false;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carnetId, forkedItemIds, onIsland, onRequireAuth, supabase, userId]
  );

  const undoFork = useCallback(
    async (kitItemId: string) => {
      if (!userId) return;
      setForkedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(kitItemId);
        return next;
      });

      try {
        await supabase
          .from('kit_forks')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('kit_item_id', kitItemId)
          .eq('user_id', userId);
      } catch {
        // silent
      }
    },
    [carnetId, supabase, userId]
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
      setForkedItemIds((prev) => new Set([...prev, ...toAdd]));

      try {
        const rows = toAdd.map((id) => ({
          carnet_id: carnetId,
          kit_item_id: id,
          user_id: userId,
        }));

        const { error } = await supabase.from('kit_forks').insert(rows);
        if (error) throw error;

        onIsland?.(`${toAdd.length} équipement${toAdd.length > 1 ? 's' : ''} ajouté${toAdd.length > 1 ? 's' : ''} à votre sac`);
        return true;
      } catch {
        setForkedItemIds((prev) => {
          const next = new Set(prev);
          toAdd.forEach((id) => next.delete(id));
          return next;
        });
        onIsland?.('Échec de l’ajout du kit');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [carnetId, forkedItemIds, onIsland, onRequireAuth, supabase, userId]
  );

  return {
    forkedItemIds,
    isForked: (id: string) => forkedItemIds.has(id),
    forkItem,
    forkAllItems,
    loading,
  };
}
