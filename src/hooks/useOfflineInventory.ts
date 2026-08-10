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

export function useOfflineInventory(userId?: string) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

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
    if (!userId) return;

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

  return {
    inventory,
    loading,
    addGearItem,
    loadInventory,
    isOnline
  };
}
