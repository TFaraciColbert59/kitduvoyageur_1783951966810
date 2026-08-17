'use client';

import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  CompteUserProfile,
  CompteDashboardData,
  fetchFullProfile,
  fetchUserCarnets,
  fetchUserClubs,
  fetchUserOrders,
  fetchUserBadges,
  fetchUserActivities,
  fetchNextTrip,
} from '@/lib/supabase/queries-compte';

export type CompteActiveTab = 'activite' | 'carnets' | 'voyages' | 'equipement';

const CACHE_PREFIX = 'lkdv_compte_cache_';

export function useCompte() {
  const { user, signOut } = useAuth();
  const { triggerHaptic } = useHapticFeedback();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();

  // Navigation par onglets ultra rapide
  const [activeTab, setActiveTabState] = useState<CompteActiveTab>('activite');

  // Modales
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Données de compte avec cache local immédiat
  const [profile, setProfile] = useState<CompteUserProfile | null>(() => {
    if (typeof window === 'undefined' || !user?.id) return null;
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}profile_${user.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [dashboardData, setDashboardData] = useState<CompteDashboardData | null>(() => {
    if (typeof window === 'undefined' || !user?.id) return null;
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}dashboard_${user.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // États de chargement par section pour le chargement progressif
  const [loadingProfile, setLoadingProfile] = useState(!profile);
  const [loadingTab, setLoadingTab] = useState<Record<CompteActiveTab, boolean>>({
    activite: !dashboardData?.activite,
    carnets: !dashboardData?.carnets,
    voyages: !dashboardData?.prochainVoyage && (!dashboardData?.aventures || dashboardData.aventures.length === 0),
    equipement: false, // géré par useEquipment
  });

  // Transition d'onglet instantanée (< 16ms)
  const setActiveTab = useCallback(
    (tab: CompteActiveTab) => {
      triggerHaptic('selection');
      startTransition(() => {
        setActiveTabState(tab);
      });
    },
    [triggerHaptic]
  );

  // Sauvegarde dans le cache local
  const updateCache = useCallback((key: string, data: any) => {
    if (typeof window === 'undefined' || !user?.id) return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}_${user.id}`, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [user]);

  // Chargement initial rapide du profil & stats essentielles
  const loadEssentialProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const freshProfile = await fetchFullProfile(user.id);
      if (freshProfile) {
        setProfile(freshProfile);
        updateCache('profile', freshProfile);
      }
    } catch (err) {
      console.warn('Erreur chargement profil essentiel:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, [user, updateCache]);

  // Chargement en arrière-plan des données spécifiques à chaque onglet
  const loadTabData = useCallback(
    async (tab: CompteActiveTab) => {
      if (!user?.id) return;

      try {
        if (tab === 'activite') {
          const [acts, badges] = await Promise.all([
            fetchUserActivities(user.id),
            fetchUserBadges(user.id),
          ]);
          setDashboardData((prev) => {
            const next = {
              ...(prev || ({} as any)),
              activite: acts,
              badges,
            };
            updateCache('dashboard', next);
            return next;
          });
          setLoadingTab((prev) => ({ ...prev, activite: false }));
        } else if (tab === 'carnets') {
          const carnets = await fetchUserCarnets(user.id);
          setDashboardData((prev) => {
            const next = {
              ...(prev || ({} as any)),
              carnets,
            };
            updateCache('dashboard', next);
            return next;
          });
          setLoadingTab((prev) => ({ ...prev, carnets: false }));
        } else if (tab === 'voyages') {
          const [prochainVoyage, clubs] = await Promise.all([
            fetchNextTrip(user.id),
            fetchUserClubs(user.id),
          ]);
          setDashboardData((prev) => {
            const next = {
              ...(prev || ({} as any)),
              prochainVoyage,
              clubs,
            };
            updateCache('dashboard', next);
            return next;
          });
          setLoadingTab((prev) => ({ ...prev, voyages: false }));
        }
      } catch (err) {
        console.warn(`Erreur chargement données onglet ${tab}:`, err);
      }
    },
    [user, updateCache]
  );

  // Effet de chargement initial
  useEffect(() => {
    if (user?.id) {
      loadEssentialProfile();
      loadTabData(activeTab);
    }
  }, [user?.id, loadEssentialProfile, loadTabData, activeTab]);

  // Mise à jour locale optimiste du profil
  const updateLocalProfile = useCallback(
    (patch: Partial<CompteUserProfile>) => {
      setProfile((prev) => {
        if (!prev) return null;
        const updated = { ...prev, ...patch };
        updateCache('profile', updated);
        return updated;
      });
    },
    [updateCache]
  );

  return {
    user,
    signOut,
    profile,
    dashboardData,
    activeTab,
    setActiveTab,
    loadingProfile,
    loadingTab,
    isPending,
    modals: {
      editModalOpen,
      setEditModalOpen,
      settingsModalOpen,
      setSettingsModalOpen,
      shareModalOpen,
      setShareModalOpen,
    },
    updateLocalProfile,
    refreshTab: () => loadTabData(activeTab),
    refreshProfile: loadEssentialProfile,
  };
}
