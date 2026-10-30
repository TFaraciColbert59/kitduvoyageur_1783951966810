'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { MarketplaceListing } from '@/features/marketplace/types';
import { LISTING_MODE, mapInventoryRow, mapListing, mapShopRow } from './catalog';
import type { KitSource, PickerProduct } from './types';

export type CatalogState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: PickerProduct[];
};

const IDLE: CatalogState = { status: 'idle', items: [] };

/**
 * Chargement paresseux d'une source à la fois (inventaire, boutique neuve, locations,
 * occasions, prêts), conservée tant que le sélecteur est monté : changer d'onglet
 * ne refait aucune requête déjà faite.
 */
export function useKitCatalog(userId: string | undefined) {
  const [state, setState] = useState<Record<KitSource, CatalogState>>({
    inventory: IDLE,
    achat: IDLE,
    location: IDLE,
    occasion: IDLE,
    pret: IDLE,
  });
  const requested = useRef(new Set<KitSource>());

  const set = useCallback((source: KitSource, next: CatalogState) => {
    setState((current) => ({ ...current, [source]: next }));
  }, []);

  const load = useCallback(
    async (source: KitSource, force = false) => {
      if (requested.current.has(source) && !force) return;
      requested.current.add(source);
      set(source, { status: 'loading', items: [] });
      try {
        if (source === 'inventory') {
          if (!userId) {
            set(source, { status: 'ready', items: [] });
            return;
          }
          const { data, error } = await createClient()
            .from('gear_items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);
          if (error) throw error;
          set(source, {
            status: 'ready',
            items: ((data ?? []) as UserEquipmentItem[]).map(mapInventoryRow),
          });
          return;
        }
        if (source === 'achat') {
          const { data, error } = await createClient()
            .from('shop_products')
            .select('*')
            .order('name', { ascending: true })
            .limit(200);
          if (error) throw error;
          const items = (data ?? [])
            .map(mapShopRow)
            .filter((row): row is PickerProduct => row !== null);
          set(source, { status: 'ready', items });
          return;
        }
        const response = await fetch(`/api/marketplace/listings?mode=${LISTING_MODE[source]}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { listings?: MarketplaceListing[] };
        set(source, {
          status: 'ready',
          items: (body.listings ?? []).map((listing) => mapListing(listing, source)),
        });
      } catch {
        requested.current.delete(source);
        set(source, { status: 'error', items: [] });
      }
    },
    [set, userId]
  );

  useEffect(() => {
    requested.current.clear();
    setState({ inventory: IDLE, achat: IDLE, location: IDLE, occasion: IDLE, pret: IDLE });
  }, [userId]);

  return { state, load };
}
