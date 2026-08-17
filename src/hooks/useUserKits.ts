'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserEquipmentItem } from '@/hooks/useEquipment';

export interface CustomKitItem {
  id: string;
  kit_id: string;
  gear_item_id?: string | null;
  item_name: string;
  category: string;
  weight_g: number;
  quantity: number;
  is_essential: boolean;
  is_checked: boolean;
  custom_notes?: string;
}

export interface CustomKit {
  id: string;
  user_id: string;
  name: string;
  description: string;
  for_destination: string;
  season: string;
  activity: string;
  total_weight_g: number;
  source: 'configurator' | 'manuel' | 'auto_prepared';
  status: 'active' | 'trash' | 'archived';
  deleted_at?: string | null;
  is_favorite: boolean;
  last_used_at?: string | null;
  trail_id?: number | null;
  created_at: string;
  updated_at: string;
  items: CustomKitItem[];
}

const GUEST_KITS_STORAGE_KEY = 'lkdv_guest_kits';

export const DEFAULT_AUTHENTIC_KITS: CustomKit[] = [
  {
    id: 'kit-trek-montagne-3j',
    user_id: 'guest',
    name: 'Trek Montagne 3 jours',
    description: 'Kit complet optimisé pour autonomie en altitude (bivouac, couchage, cuisine).',
    for_destination: 'Massif Alpin',
    season: 'Été',
    activity: 'Trek Alpin',
    total_weight_g: 9400,
    source: 'configurator',
    status: 'active',
    is_favorite: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'ki-1', kit_id: 'kit-trek-montagne-3j', item_name: 'Osprey Farpoint 40', category: 'Sacs & Portage', weight_g: 1420, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-2', kit_id: 'kit-trek-montagne-3j', item_name: 'MSR Hubba Hubba NX 2P', category: 'Couchage & Tentes', weight_g: 1720, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-3', kit_id: 'kit-trek-montagne-3j', item_name: 'Sea to Summit Spark SP1', category: 'Couchage & Tentes', weight_g: 490, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-4', kit_id: 'kit-trek-montagne-3j', item_name: 'Therm-a-Rest NeoAir XLite', category: 'Couchage & Tentes', weight_g: 340, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-5', kit_id: 'kit-trek-montagne-3j', item_name: 'Patagonia Torrentshell 3L', category: 'Vêtements & Vestes', weight_g: 394, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-6', kit_id: 'kit-trek-montagne-3j', item_name: 'MSR PocketRocket 2', category: 'Cuisine & Réchauds', weight_g: 73, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-7', kit_id: 'kit-trek-montagne-3j', item_name: 'Filtre Sawyer Mini', category: 'Eau & Filtres', weight_g: 57, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-8', kit_id: 'kit-trek-montagne-3j', item_name: 'Petzl Actik Core 450lm', category: 'Lampes & Éclairage', weight_g: 85, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-9', kit_id: 'kit-trek-montagne-3j', item_name: 'Garmin inReach Mini 2', category: 'Navigation & GPS', weight_g: 100, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-10', kit_id: 'kit-trek-montagne-3j', item_name: 'Trousse Care Plus Mountaineer', category: 'Sécurité & Soins', weight_g: 450, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-11', kit_id: 'kit-trek-montagne-3j', item_name: 'Couteau Opinel N°8 Inox', category: 'Accessoires & Outils', weight_g: 45, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-12', kit_id: 'kit-trek-montagne-3j', item_name: 'Batterie Anker PowerCore 10 000', category: 'Accessoires & Outils', weight_g: 180, quantity: 1, is_essential: true, is_checked: true },
    ],
  },
  {
    id: 'kit-bivouac-foret-2j',
    user_id: 'guest',
    name: 'Bivouac Forêt & Massif 2j',
    description: 'Kit préparé pour sorties nature avec abri et popote.',
    for_destination: 'Forêt & Massifs',
    season: 'Printemps/Automne',
    activity: 'Bivouac Forêt',
    total_weight_g: 7800,
    source: 'auto_prepared',
    status: 'active',
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'ki-21', kit_id: 'kit-bivouac-foret-2j', item_name: 'Osprey Farpoint 40', category: 'Sacs & Portage', weight_g: 1420, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-22', kit_id: 'kit-bivouac-foret-2j', item_name: 'MSR Hubba Hubba NX 2P', category: 'Couchage & Tentes', weight_g: 1720, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-23', kit_id: 'kit-bivouac-foret-2j', item_name: 'Sea to Summit Spark SP1', category: 'Couchage & Tentes', weight_g: 490, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-24', kit_id: 'kit-bivouac-foret-2j', item_name: 'Therm-a-Rest NeoAir XLite', category: 'Couchage & Tentes', weight_g: 340, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-25', kit_id: 'kit-bivouac-foret-2j', item_name: 'MSR PocketRocket 2', category: 'Cuisine & Réchauds', weight_g: 73, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-26', kit_id: 'kit-bivouac-foret-2j', item_name: 'Filtre Sawyer Mini', category: 'Eau & Filtres', weight_g: 57, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-27', kit_id: 'kit-bivouac-foret-2j', item_name: 'Petzl Actik Core 450lm', category: 'Lampes & Éclairage', weight_g: 85, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-28', kit_id: 'kit-bivouac-foret-2j', item_name: 'Couteau Opinel N°8 Inox', category: 'Accessoires & Outils', weight_g: 45, quantity: 1, is_essential: true, is_checked: true },
    ],
  },
  {
    id: 'kit-journee-estivale',
    user_id: 'guest',
    name: 'Randonnée Journée Légère',
    description: 'Kit ultra-léger 15–25 km sans bivouac.',
    for_destination: 'Moyenne Montagne',
    season: 'Été',
    activity: 'Randonnée Journée',
    total_weight_g: 3200,
    source: 'manuel',
    status: 'active',
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'ki-31', kit_id: 'kit-journee-estivale', item_name: 'Osprey Farpoint 40', category: 'Sacs & Portage', weight_g: 1420, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-32', kit_id: 'kit-journee-estivale', item_name: 'Patagonia Torrentshell 3L', category: 'Vêtements & Vestes', weight_g: 394, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-33', kit_id: 'kit-journee-estivale', item_name: 'Filtre Sawyer Mini', category: 'Eau & Filtres', weight_g: 57, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-34', kit_id: 'kit-journee-estivale', item_name: 'Petzl Actik Core 450lm', category: 'Lampes & Éclairage', weight_g: 85, quantity: 1, is_essential: true, is_checked: true },
      { id: 'ki-35', kit_id: 'kit-journee-estivale', item_name: 'Couteau Opinel N°8 Inox', category: 'Accessoires & Outils', weight_g: 45, quantity: 1, is_essential: true, is_checked: true },
    ],
  },
];

export function useUserKits(userEquipment: UserEquipmentItem[] = []) {
  const { user } = useAuth();
  const [kits, setKits] = useState<CustomKit[]>(DEFAULT_AUTHENTIC_KITS);
  const [loading, setLoading] = useState(true);

  // Charger les kits depuis Supabase ou localStorage
  const loadKits = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        const supabase = createClient();
        
        // 1. Nettoyage silencieux des kits expirés en corbeille (> 10 jours)
        try {
          await supabase.rpc('cleanup_expired_trash_kits');
        } catch {}

        // 2. Récupérer les kits de l'utilisateur
        const { data: kitsData, error: kitsError } = await supabase
          .from('custom_kits')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (kitsError) throw kitsError;

        if (kitsData && kitsData.length > 0) {
          const kitIds = kitsData.map((k) => k.id);
          const { data: itemsData } = await supabase
            .from('custom_kit_items')
            .select('*')
            .in('kit_id', kitIds);

          const itemsByKit: Record<string, CustomKitItem[]> = {};
          (itemsData || []).forEach((item: any) => {
            if (!itemsByKit[item.kit_id]) itemsByKit[item.kit_id] = [];
            itemsByKit[item.kit_id].push({
              id: item.id,
              kit_id: item.kit_id,
              gear_item_id: item.gear_item_id,
              item_name: item.item_name || 'Article',
              category: item.category || 'Autre',
              weight_g: item.weight_g || 0,
              quantity: item.quantity || 1,
              is_essential: Boolean(item.is_essential),
              is_checked: Boolean(item.is_checked),
              custom_notes: item.custom_notes || '',
            });
          });

          const formattedKits: CustomKit[] = kitsData.map((k) => {
            const kitItems = itemsByKit[k.id] || [];
            const computedWeight = kitItems.reduce((sum, item) => sum + (item.weight_g * item.quantity), 0);
            return {
              id: k.id,
              user_id: k.user_id,
              name: k.name,
              description: k.description || '',
              for_destination: k.for_destination || '',
              season: k.season || '',
              activity: k.activity || 'randonnee',
              total_weight_g: k.total_weight_g || computedWeight,
              source: (k.source as any) || 'manuel',
              status: (k.status as any) || 'active',
              deleted_at: k.deleted_at,
              is_favorite: Boolean(k.is_favorite),
              last_used_at: k.last_used_at,
              trail_id: k.trail_id,
              created_at: k.created_at,
              updated_at: k.updated_at,
              items: kitItems,
            };
          });

          // Trier : kits créés avec le configurateur en premier !
          formattedKits.sort((a, b) => {
            if (a.source === 'configurator' && b.source !== 'configurator') return -1;
            if (a.source !== 'configurator' && b.source === 'configurator') return 1;
            return 0;
          });

          setKits(formattedKits);
        } else {
          setKits(DEFAULT_AUTHENTIC_KITS);
        }
      } else {
        // Mode Invité / LocalStorage
        const local = localStorage.getItem(GUEST_KITS_STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          const now = Date.now();
          const validKits = Array.isArray(parsed) && parsed.length > 0
            ? parsed.filter((k: CustomKit) => {
                if (k.status === 'trash' && k.deleted_at) {
                  const diffDays = (now - new Date(k.deleted_at).getTime()) / (1000 * 3600 * 24);
                  return diffDays <= 10;
                }
                return true;
              })
            : DEFAULT_AUTHENTIC_KITS;

          // Trier : configurateur IA toujours en premier
          validKits.sort((a: CustomKit, b: CustomKit) => {
            if (a.source === 'configurator' && b.source !== 'configurator') return -1;
            if (a.source !== 'configurator' && b.source === 'configurator') return 1;
            return 0;
          });

          setKits(validKits);
        } else {
          setKits(DEFAULT_AUTHENTIC_KITS);
          try {
            localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(DEFAULT_AUTHENTIC_KITS));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[useUserKits] loadKits fallback:', err);
      setKits(DEFAULT_AUTHENTIC_KITS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadKits();
  }, [loadKits]);

  // Sauvegarde locale pour mode invité
  const saveGuestKits = (newKits: CustomKit[]) => {
    setKits(newKits);
    try {
      localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(newKits));
    } catch {}
  };

  // 1. Créer un kit (depuis configurateur, manuel, ou auto-préparé)
  const createKit = async (params: {
    name: string;
    description?: string;
    for_destination?: string;
    season?: string;
    activity?: string;
    source?: 'configurator' | 'manuel' | 'auto_prepared';
    gearItems?: Array<{
      gear_item_id?: string | null;
      item_name: string;
      category?: string;
      weight_g?: number;
      quantity?: number;
      is_essential?: boolean;
    }>;
  }): Promise<CustomKit | null> => {
    const kitItemsToInsert = (params.gearItems || []).map((item) => {
      // Trouver dans l'inventaire si disponible
      const matchingGear = item.gear_item_id
        ? userEquipment.find((g) => g.id === item.gear_item_id)
        : userEquipment.find((g) => g.name.toLowerCase() === item.item_name.toLowerCase());

      return {
        id: crypto.randomUUID(),
        kit_id: '',
        gear_item_id: matchingGear ? matchingGear.id : item.gear_item_id || null,
        item_name: matchingGear ? matchingGear.name : item.item_name,
        category: matchingGear ? matchingGear.category : item.category || 'Autre',
        weight_g: matchingGear ? (matchingGear.weight_g || 0) : (item.weight_g || 0),
        quantity: item.quantity || 1,
        is_essential: Boolean(item.is_essential),
        is_checked: false,
      };
    });

    const totalWeight = kitItemsToInsert.reduce((sum, i) => sum + (i.weight_g * i.quantity), 0);
    const newKitId = crypto.randomUUID();
    const fallbackKit: CustomKit = {
      id: newKitId,
      user_id: user?.id || 'guest',
      name: params.name.trim(),
      description: params.description || '',
      for_destination: params.for_destination || '',
      season: params.season || 'Été',
      activity: params.activity || 'randonnee',
      total_weight_g: totalWeight,
      source: params.source || 'configurator',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_favorite: false,
      items: kitItemsToInsert.map((i) => ({ ...i, kit_id: newKitId })),
    };

    // 1. Toujours enregistrer immédiatement dans l'état et le stockage local
    setKits((prev) => {
      const next = [fallbackKit, ...prev.filter((k) => k.id !== fallbackKit.id)];
      try {
        localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Synchronisation Supabase en arrière-plan si connecté
    if (user) {
      try {
        const supabase = createClient();
        const { data: newKitData, error: kitErr } = await supabase
          .from('custom_kits')
          .insert({
            id: fallbackKit.id,
            user_id: user.id,
            name: fallbackKit.name,
            description: fallbackKit.description,
            for_destination: fallbackKit.for_destination,
            season: fallbackKit.season,
            activity: fallbackKit.activity,
            total_weight_g: fallbackKit.total_weight_g,
            source: fallbackKit.source,
            status: 'active',
          })
          .select()
          .single();

        if (!kitErr && newKitData && kitItemsToInsert.length > 0) {
          const itemsWithKitId = kitItemsToInsert.map((item) => ({
            kit_id: newKitData.id,
            gear_item_id: item.gear_item_id,
            item_name: item.item_name,
            category: item.category,
            weight_g: item.weight_g,
            quantity: item.quantity,
            is_essential: item.is_essential,
            is_checked: false,
          }));

          await supabase.from('custom_kit_items').insert(itemsWithKitId);
        }
      } catch (err) {
        console.warn('[useUserKits] Supabase kit sync notice:', err);
      }
    }

    return fallbackKit;
  };

  // 2. Modifier un kit
  const updateKit = async (kitId: string, patch: Partial<CustomKit>) => {
    setKits((prev) => {
      const next = prev.map((k) =>
        k.id === kitId ? { ...k, ...patch, updated_at: new Date().toISOString() } : k
      );
      try {
        localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (user) {
      try {
        const supabase = createClient();
        await supabase
          .from('custom_kits')
          .update({
            ...patch,
            updated_at: new Date().toISOString(),
          })
          .eq('id', kitId)
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('[useUserKits] updateKit error:', err);
      }
    }
  };

  // 3. Mettre à la corbeille (Cycle de vie 10 jours)
  const moveToTrash = async (kitId: string) => {
    const deletedAt = new Date().toISOString();

    setKits((prev) => {
      const next = prev.map((k) =>
        k.id === kitId ? { ...k, status: 'trash' as const, deleted_at: deletedAt } : k
      );
      try {
        localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (user) {
      try {
        const supabase = createClient();
        await supabase
          .from('custom_kits')
          .update({
            status: 'trash',
            deleted_at: deletedAt,
            updated_at: deletedAt,
          })
          .eq('id', kitId)
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('[useUserKits] moveToTrash error:', err);
      }
    }
  };

  // 4. Restaurer de la corbeille
  const restoreFromTrash = async (kitId: string) => {
    setKits((prev) => {
      const next = prev.map((k) =>
        k.id === kitId ? { ...k, status: 'active' as const, deleted_at: null } : k
      );
      try {
        localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (user) {
      try {
        const supabase = createClient();
        await supabase
          .from('custom_kits')
          .update({
            status: 'active',
            deleted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', kitId)
          .eq('user_id', user.id);
      } catch (err) {
        console.warn('[useUserKits] restoreFromTrash error:', err);
      }
    }
  };

  // 5. Suppression définitive
  const permanentDelete = async (kitId: string) => {
    setKits((prev) => {
      const next = prev.filter((k) => k.id !== kitId);
      try {
        localStorage.setItem(GUEST_KITS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (user) {
      try {
        const supabase = createClient();
        await supabase.from('custom_kits').delete().eq('id', kitId).eq('user_id', user.id);
      } catch (err) {
        console.warn('[useUserKits] permanentDelete error:', err);
      }
    }
  };

  // 6. Ajouter du matériel à un kit existant
  const addGearToKit = async (kitId: string, gearItem: UserEquipmentItem, quantity = 1) => {
    if (user) {
      const supabase = createClient();
      await supabase.from('custom_kit_items').insert({
        kit_id: kitId,
        gear_item_id: gearItem.id,
        item_name: gearItem.name,
        category: gearItem.category,
        weight_g: gearItem.weight_g || 0,
        quantity,
      });
      await loadKits();
    } else {
      const target = kits.find((k) => k.id === kitId);
      if (!target) return;
      const newItem: CustomKitItem = {
        id: crypto.randomUUID(),
        kit_id: kitId,
        gear_item_id: gearItem.id,
        item_name: gearItem.name,
        category: gearItem.category,
        weight_g: gearItem.weight_g || 0,
        quantity,
        is_essential: false,
        is_checked: false,
      };
      const updated = kits.map((k) =>
        k.id === kitId
          ? {
              ...k,
              items: [...k.items, newItem],
              total_weight_g: k.total_weight_g + (newItem.weight_g * quantity),
            }
          : k
      );
      saveGuestKits(updated);
    }
  };

  // 7. Retirer un article d'un kit
  const removeGearFromKit = async (kitId: string, itemId: string) => {
    if (user) {
      const supabase = createClient();
      await supabase.from('custom_kit_items').delete().eq('id', itemId);
      await loadKits();
    } else {
      const updated = kits.map((k) => {
        if (k.id !== kitId) return k;
        const remainingItems = k.items.filter((i) => i.id !== itemId);
        const newWeight = remainingItems.reduce((sum, i) => sum + (i.weight_g * i.quantity), 0);
        return { ...k, items: remainingItems, total_weight_g: newWeight };
      });
      saveGuestKits(updated);
    }
  };

  // 8. Substitution automatique si un objet est supprimé de l'inventaire
  const handleGearDeleted = useCallback(
    async (deletedGearId: string) => {
      // Trouver tous les kits qui contenaient cet objet
      const affectedKits = kits.filter((k) =>
        k.items.some((i) => i.gear_item_id === deletedGearId)
      );

      for (const kit of affectedKits) {
        for (const item of kit.items) {
          if (item.gear_item_id === deletedGearId) {
            // Chercher une alternative dans l'inventaire actuel
            const alternative = userEquipment.find(
              (g) =>
                g.id !== deletedGearId &&
                g.category.toLowerCase() === item.category.toLowerCase() &&
                g.condition !== 'à_remplacer'
            );

            if (alternative) {
              // Remplacement automatique silencieux
              if (user) {
                const supabase = createClient();
                await supabase
                  .from('custom_kit_items')
                  .update({
                    gear_item_id: alternative.id,
                    item_name: alternative.name,
                    weight_g: alternative.weight_g || 0,
                  })
                  .eq('id', item.id);
              }
            }
          }
        }
      }
      if (affectedKits.length > 0) {
        await loadKits();
      }
    },
    [kits, userEquipment, user, loadKits]
  );

  // Groupement des kits selon le cycle de vie intelligent
  const organizedKits = useMemo(() => {
    const active = kits.filter((k) => k.status === 'active');
    const trash = kits.filter((k) => k.status === 'trash');

    // Récents / Favoris en premier
    const recentAndFavorites = active
      .filter((k) => k.is_favorite || (k.last_used_at && Date.now() - new Date(k.last_used_at).getTime() < 1000 * 3600 * 24 * 30))
      .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));

    return {
      allActive: active,
      recentAndFavorites,
      trash,
      totalCount: active.length,
      trashCount: trash.length,
    };
  }, [kits]);

  return {
    kits: organizedKits.allActive,
    recentKits: organizedKits.recentAndFavorites,
    trashKits: organizedKits.trash,
    totalKitsCount: organizedKits.totalCount,
    trashCount: organizedKits.trashCount,
    loading,
    createKit,
    updateKit,
    moveToTrash,
    restoreFromTrash,
    permanentDelete,
    addGearToKit,
    removeGearFromKit,
    handleGearDeleted,
    refreshKits: loadKits,
  };
}
