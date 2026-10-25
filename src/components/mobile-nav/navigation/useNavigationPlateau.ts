'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface PlateauFlags {
  isClubsHub: boolean;
  isClubDetail: boolean;
  isCarnetsHub: boolean;
  isCarnetDetail: boolean;
  isPaysHub: boolean;
  isPaysDetail: boolean;
  isMessageriePage: boolean;
  isVoyagesHub: boolean;
}

export interface NavigationPlateauController {
  flags: PlateauFlags;
  activeId: string;
  isWide: boolean;
  hiddenByEvent: boolean;
  messagerieRequestsCount: number;
  selectTab: (tabKey: string) => void;
}

export function useNavigationPlateau(pathname: string | null): NavigationPlateauController {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  const isClubsHub = pathname === '/clubs';
  const isClubDetail = Boolean(pathname && pathname.startsWith('/clubs/') && pathname !== '/clubs');
  const isCarnetsHub = pathname === '/carnets';
  const isCarnetDetail = Boolean(pathname && pathname.startsWith('/carnets/') && pathname !== '/carnets' && pathname !== '/carnets/nouveau');
  const isPaysHub = pathname === '/pays';
  const isPaysDetail = Boolean(pathname && pathname.startsWith('/pays/') && pathname !== '/pays');
  const isMessageriePage = pathname === '/messagerie';
  const isVoyagesHub = pathname === '/voyages';

  const [activeClubsTab, setActiveClubsTab] = useState<'decouvrir' | 'mes-clubs'>('decouvrir');
  const [activeClubDetailTab, setActiveClubDetailTab] = useState<string>('overview');
  const [activeCarnetsTab, setActiveCarnetsTab] = useState<'explorer' | 'mes-carnets'>('explorer');
  const [activeCarnetDetailTab, setActiveCarnetDetailTab] = useState<string>('overview');
  const [activePaysContinent, setActivePaysContinent] = useState<string>('all');
  const [activePaysDetailTab, setActivePaysDetailTab] = useState<string>('presentation');
  const [activeCommunityTab, setActiveCommunityTab] = useState<string>('fil');
  const [activeMessagerieTab, setActiveMessagerieTab] = useState<string>('all');
  const [messagerieRequestsCount, setMessagerieRequestsCount] = useState<number>(0);
  const [activeVoyagesHubTab, setActiveVoyagesHubTab] = useState<'user' | 'public'>('user');
  const [hiddenByEvent, setHiddenByEvent] = useState(false);

  useEffect(() => {
    setHiddenByEvent(false);
  }, [pathname]);

  useEffect(() => {
    if (!pathname) return;
    if (pathname === '/clubs') {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t === 'mes-clubs') setActiveClubsTab('mes-clubs');
        else setActiveClubsTab('decouvrir');
      }
    } else if (pathname === '/carnets') {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t === 'mes-carnets') setActiveCarnetsTab('mes-carnets');
        else setActiveCarnetsTab('explorer');
      }
    } else if (pathname === '/pays') {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const c = params.get('continent');
        if (c) setActivePaysContinent(c);
      }
    } else if (pathname.startsWith('/communaute')) {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab') || 'fil';
        setActiveCommunityTab(t);
      }
    }

    if (typeof window !== 'undefined') {
      const commHandler = (e: any) => {
        if (e.detail) setActiveCommunityTab(e.detail);
      };
      const clubsHandler = (e: any) => {
        if (e.detail) setActiveClubsTab(e.detail);
      };
      const clubDetailHandler = (e: any) => {
        if (e.detail) setActiveClubDetailTab(e.detail);
      };
      const carnetsHandler = (e: any) => {
        if (e.detail) setActiveCarnetsTab(e.detail);
      };
      const carnetDetailHandler = (e: any) => {
        if (e.detail) setActiveCarnetDetailTab(e.detail);
      };
      const paysContinentHandler = (e: any) => {
        if (e.detail) setActivePaysContinent(e.detail);
      };
      const paysDetailHandler = (e: any) => {
        if (e.detail) setActivePaysDetailTab(e.detail);
      };
      const voyagesHubHandler = (e: any) => {
        if (e.detail) setActiveVoyagesHubTab(e.detail);
      };
      // Messagerie : la liste publie son onglet actif + le nb de demandes,
      // la barre publie les taps utilisateur (evenements distincts, pas d'echo).
      const messagerieStateHandler = (e: any) => {
        if (e.detail?.tab) setActiveMessagerieTab(e.detail.tab);
        if (typeof e.detail?.count === 'number') setMessagerieRequestsCount(e.detail.count);
      };
      const messagerieTabHandler = (e: any) => {
        if (e.detail) setActiveMessagerieTab(e.detail);
      };
      const toggleBottomBarHandler = (e: any) => {
        if (e.detail && typeof e.detail.hide === 'boolean') {
          setHiddenByEvent(e.detail.hide);
        }
      };

      window.addEventListener('community-tab-change', commHandler);
      window.addEventListener('clubs-tab-change', clubsHandler);
      window.addEventListener('club-detail-tab-change', clubDetailHandler);
      window.addEventListener('carnets-tab-change', carnetsHandler);
      window.addEventListener('carnet-detail-tab-change', carnetDetailHandler);
      window.addEventListener('pays-continent-change', paysContinentHandler);
      window.addEventListener('pays-detail-tab-change', paysDetailHandler);
      window.addEventListener('voyages-hub-tab-change', voyagesHubHandler);
      window.addEventListener('messagerie-tab-state', messagerieStateHandler);
      window.addEventListener('messagerie-tab-change', messagerieTabHandler);
      window.addEventListener('lkdv-toggle-bottom-bar', toggleBottomBarHandler);

      return () => {
        window.removeEventListener('community-tab-change', commHandler);
        window.removeEventListener('clubs-tab-change', clubsHandler);
        window.removeEventListener('club-detail-tab-change', clubDetailHandler);
        window.removeEventListener('carnets-tab-change', carnetsHandler);
        window.removeEventListener('carnet-detail-tab-change', carnetDetailHandler);
        window.removeEventListener('pays-continent-change', paysContinentHandler);
        window.removeEventListener('pays-detail-tab-change', paysDetailHandler);
        window.removeEventListener('voyages-hub-tab-change', voyagesHubHandler);
        window.removeEventListener('messagerie-tab-state', messagerieStateHandler);
        window.removeEventListener('messagerie-tab-change', messagerieTabHandler);
        window.removeEventListener('lkdv-toggle-bottom-bar', toggleBottomBarHandler);
      };
    }
  }, [pathname]);

  const handleUpperTabSelect = (tabKey: string) => {
    triggerHaptic('selection');

    if (isMessageriePage) {
      setActiveMessagerieTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('messagerie-tab-change', { detail: tabKey }));
      }
    } else if (isVoyagesHub) {
      setActiveVoyagesHubTab(tabKey as 'user' | 'public');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('voyages-hub-tab-change', { detail: tabKey }));
      }
    } else if (isClubsHub) {
      setActiveClubsTab(tabKey as 'decouvrir' | 'mes-clubs');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clubs-tab-change', { detail: tabKey }));
      }
    } else if (isClubDetail) {
      setActiveClubDetailTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('club-detail-tab-change', { detail: tabKey }));
      }
    } else if (isCarnetsHub) {
      setActiveCarnetsTab(tabKey as 'explorer' | 'mes-carnets');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carnets-tab-change', { detail: tabKey }));
      }
    } else if (isCarnetDetail) {
      setActiveCarnetDetailTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carnet-detail-tab-change', { detail: tabKey }));
      }
    } else if (isPaysHub) {
      setActivePaysContinent(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pays-continent-change', { detail: tabKey }));
      }
    } else if (isPaysDetail) {
      setActivePaysDetailTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pays-detail-tab-change', { detail: tabKey }));
      }
    } else {
      setActiveCommunityTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('community-tab-change', { detail: tabKey }));
      }
      if (tabKey === 'groupes') {
        router.push('/groupes');
      } else if (tabKey === 'clubs') {
        router.push('/clubs');
      } else if (tabKey === 'carnets') {
        router.push('/carnets');
      } else if (tabKey === 'fil') {
        router.push('/communaute?tab=fil');
      } else if (tabKey === 'evenements') {
        router.push('/communaute?tab=evenements');
      } else if (tabKey === 'entraide') {
        router.push('/communaute?tab=entraide');
      }
    }
  };

  const activeId = isMessageriePage
    ? activeMessagerieTab
    : isVoyagesHub
    ? activeVoyagesHubTab
    : isClubsHub
    ? activeClubsTab
    : isClubDetail
    ? activeClubDetailTab
    : isCarnetsHub
    ? activeCarnetsTab
    : isCarnetDetail
    ? activeCarnetDetailTab
    : isPaysHub
    ? activePaysContinent
    : isPaysDetail
    ? activePaysDetailTab
    : activeCommunityTab;

  const isWide = isClubDetail || isCarnetDetail || isPaysHub || isPaysDetail;

  return {
    flags: {
      isClubsHub,
      isClubDetail,
      isCarnetsHub,
      isCarnetDetail,
      isPaysHub,
      isPaysDetail,
      isMessageriePage,
      isVoyagesHub,
    },
    activeId,
    isWide,
    hiddenByEvent,
    messagerieRequestsCount,
    selectTab: handleUpperTabSelect,
  };
}
