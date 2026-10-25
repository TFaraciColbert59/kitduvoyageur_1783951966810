import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUserInventory } from '@/lib/ai/configuratorEngine';
import { 
  getInventoryOffline, 
  saveInventoryOffline, 
  enqueueOfflineAction, 
  getOfflineActions, 
  clearOfflineAction 
} from '@/lib/offlineStorage';

const GUEST_KEY = 'lkdv_guest_gear';

const readGuest = (): any[] => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]'); } catch { return []; }
};
const writeGuest = (list: any[]) => {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(list)); } catch { /* ignore */ }
};

export function useOfflineInventory(userId?: string) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

  const persistState = (next: any[]) => {
    setInventory(next);
    if (!userId) writeGuest(next);
  };

  // Sync offline actions when back online
  const syncOfflineActions = useCallback(async () => {
    if (!userId || !isOnline) return;
    
    const actions = await getOfflineActions();
    if (actions.length === 0) return;

    const supabase = createClient();
    
    for (const action of actions) {
      try {
        if (action.type === 'ADD_GEAR') {
          await supabase.from('gear_items').insert({
            user_id: userId,
            ...action.payload,
            condition: 'excellent',
            quantity: 1
          });
        } else if (action.type === 'UPDATE_GEAR') {
          await supabase.from('gear_items').update(action.payload.patch).eq('id', action.payload.itemId);
        } else if (action.type === 'DELETE_GEAR') {
          await supabase.from('gear_items').delete().eq('id', action.payload.itemId);
        }
        await clearOfflineAction(action.id);
      } catch (err) {
        console.error('Failed to sync offline action:', action, err);
      }
    }
    
    // Refresh inventory from server after sync
    await loadInventory();
  }, [userId, isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineActions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineActions]);

  const loadInventory = useCallback(async () => {
    if (!userId) {
      setInventory(readGuest());
      setLoading(false);
      return;
    }

    try {
      if (isOnline) {
        // Fetch from Supabase
        const inv = await fetchUserInventory(userId);
        setInventory(inv);
        // Cache it for offline use
        await saveInventoryOffline(userId, inv);
      } else {
        // Fetch from IndexedDB
        const cached = await getInventoryOffline(userId);
        if (cached) setInventory(cached);
      }
    } catch (err) {
      console.warn('Network error loading inventory, falling back to cache', err);
      const cached = await getInventoryOffline(userId);
      if (cached) setInventory(cached);
    } finally {
      setLoading(false);
    }
  }, [userId, isOnline]);

  const addGearItem = async (name: string, category: string) => {
    // Mode invité : inventaire local persistant (sans compte requis)
    if (!userId) {
      const guest = readGuest();
      const item = {
        id: `guest-${Date.now()}`,
        name,
        category,
        brand: '',
        weight_g: 0,
        condition: 'excellent',
        quantity: 1,
        tags: [],
      };
      writeGuest([...guest, item]);
      persistState([...guest, item]);
      return;
    }

    const payload = { name, category, weight_g: 0 };
    
    // Optimistic UI update
    const optimisticItem = {
      id: `temp-${Date.now()}`,
      name,
      category,
      brand: '',
      weight_g: 0,
      condition: 'excellent',
      quantity: 1,
      tags: [],
    };
    
    const newInventory = [...inventory, optimisticItem];
    setInventory(newInventory);
    
    // Update local cache to keep it in sync while offline
    await saveInventoryOffline(userId, newInventory);

    if (isOnline) {
      try {
        const supabase = createClient();
        await supabase.from('gear_items').insert({
          user_id: userId,
          ...payload,
          condition: 'excellent',
          quantity: 1
        });
        await loadInventory(); // Refetch to get real ID
      } catch (err) {
        console.error('Failed to save gear item:', err);
        // Fallback to queue if network suddenly fails
        await enqueueOfflineAction({ type: 'ADD_GEAR', payload });
      }
    } else {
      await enqueueOfflineAction({ type: 'ADD_GEAR', payload });
    }
  };

  // Mettre à jour un article (quantité, poids, etc.) — optimiste + sync online
  const updateGearItem = async (itemId: string, patch: Record<string, unknown>) => {
    if (!userId) {
      const guest = readGuest();
      writeGuest(guest.map((i: any) => (i.id === itemId ? { ...i, ...patch } : i)));
      persistState(guest.map((i: any) => (i.id === itemId ? { ...i, ...patch } : i)));
      return;
    }
    const previous = inventory;
    setInventory((prev: any[]) => prev.map((i: any) => (i.id === itemId ? { ...i, ...patch } : i)));
    await saveInventoryOffline(userId, inventory.map((i: any) => (i.id === itemId ? { ...i, ...patch } : i)));

    if (isOnline) {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('gear_items').update(patch).eq('id', itemId);
        if (error) throw error;
        await loadInventory();
      } catch (err) {
        console.error('Failed to update gear item:', err);
        const item = previous.find((i: any) => i.id === itemId);
        if (item) await enqueueOfflineAction({ type: 'UPDATE_GEAR', payload: { itemId, patch, original: item } });
      }
    } else {
      const item = previous.find((i: any) => i.id === itemId);
      if (item) await enqueueOfflineAction({ type: 'UPDATE_GEAR', payload: { itemId, patch, original: item } });
    }
  };

  // Supprimer un article — optimiste + sync online
  const removeGearItem = async (itemId: string) => {
    if (!userId) {
      const guest = readGuest();
      writeGuest(guest.filter((i: any) => i.id !== itemId));
      persistState(guest.filter((i: any) => i.id !== itemId));
      return;
    }
    const previous = inventory;
    const removed = previous.find((i: any) => i.id === itemId);
    setInventory((prev: any[]) => prev.filter((i: any) => i.id !== itemId));
    await saveInventoryOffline(userId, inventory.filter((i: any) => i.id !== itemId));

    if (isOnline) {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('gear_items').delete().eq('id', itemId);
        if (error) throw error;
        await loadInventory();
      } catch (err) {
        console.error('Failed to delete gear item:', err);
        if (removed) await enqueueOfflineAction({ type: 'DELETE_GEAR', payload: { itemId, original: removed } });
      }
    } else {
      if (removed) await enqueueOfflineAction({ type: 'DELETE_GEAR', payload: { itemId, original: removed } });
    }
  };

  return {
    inventory,
    loading,
    addGearItem,
    updateGearItem,
    removeGearItem,
    loadInventory,
    isOnline
  };
}
