'use client';
import React, { useEffect, useState, memo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';
import { useUnreadBadge } from '@/hooks/useUnreadBadge';
import { useCartCount } from '@/hooks/useCartCount';
import LkvIcon from '@/components/ui/LkvIcon';

interface Tab {
  href: string;
  label: string;
  iconName: 'home' | 'mountain' | 'bag' | 'doc' | 'user' | 'search' | 'chevron-left' | 'chevron-right' | 'heart' | 'bookmark' | 'bell' | 'map-pin' | 'star' | 'minus' | 'plus' | 'close' | 'menu' | 'arrow-right' | 'arrow-left' | 'lock' | 'filter' | 'users' | 'compass' | 'box' | 'sparkles' | 'tent' | 'book';
  ariaLabel: string;
  matchPaths?: string[];
  isHero?: boolean;
}

const DEFAULT_TABS: Tab[] = [
  {
    href: '/pays',
    label: 'Earth',
    iconName: 'compass',
    ariaLabel: 'Earth, cartographie mondiale',
    matchPaths: ['/pays'],
  },
  {
    href: '/explorer',
    label: 'Aventures',
    iconName: 'mountain',
    ariaLabel: 'Explorer les sentiers et destinations',
    matchPaths: ['/explorer', '/carte-interactive', '/hors-ligne'],
  },
  {
    href: '/materiel',
    label: 'Matériel',
    iconName: 'box',
    ariaLabel: 'Mon matériel, kits et prochain départ',
    matchPaths: ['/materiel', '/materiel/', '/preparation'],
  },
  {
    href: '/communaute',
    label: 'Communauté',
    iconName: 'users',
    ariaLabel: 'Communauté, clubs, événements',
    matchPaths: [
      '/communaute',
      '/communaute/publier',
      '/clubs',
      '/groupes',
      '/carnets',
      '/entraide',
      '/createurs',
      '/experts',
      '/evenements',
      '/feed',
      '/messagerie',
    ],
  },
  {
    href: '/compte',
    label: 'Profil',
    iconName: 'user',
    ariaLabel: 'Mon compte voyageur',
    matchPaths: ['/compte', '/connexion', '/inscription', '/profil'],
  },
];

const COMMUNITY_TABS: Tab[] = [
  {
    href: '/communaute',
    label: 'Fil',
    iconName: 'sparkles',
    ariaLabel: 'Fil d’actualité communauté',
    matchPaths: ['/communaute', '/communaute/publier', '/feed'],
  },
  {
    href: '/groupes',
    label: 'Groupes',
    iconName: 'users',
    ariaLabel: 'Groupes de voyage',
    matchPaths: ['/groupes'],
  },
  {
    href: '/clubs',
    label: 'Clubs',
    iconName: 'tent',
    ariaLabel: 'Clubs outdoor',
    matchPaths: ['/clubs'],
  },
  {
    href: '/carnets',
    label: 'Carnets',
    iconName: 'book',
    ariaLabel: 'Carnets d’expédition',
    matchPaths: ['/carnets'],
  },
];

// Badge de notification (style DS glass-pill) — affiché seulement si count > 0
function BadgeDot({ count }: { count: number }) {
  return (
    <span
      className="glass-pill"
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 800,
        lineHeight: '18px',
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

// A memoized tab link — Liquid Glass icon-only, pilule animée glissante
const TabLink = memo(function TabLink({ tab, isActive, onPress, badge }: { tab: Tab; isActive: boolean; onPress: (href: string) => void; badge: number }) {
  const { triggerHaptic } = useHapticFeedback();
  const queryClient = useQueryClient();

  const prefetchData = useCallback(() => {
    if (tab.href === '/explorer') {
      queryClient.prefetchQuery({
        queryKey: ['hikes'],
        queryFn: () => fetch('/api/hikes').then((r) => (r.ok ? r.json() : [])),
        staleTime: 60_000,
      });
    } else if (tab.href === '/communaute' || tab.href === '/carnets') {
      queryClient.prefetchQuery({
        queryKey: ['carnets'],
        queryFn: () => fetch('/api/carnets').then((r) => (r.ok ? r.json() : [])),
        staleTime: 60_000,
      });
    }
  }, [tab.href, queryClient]);

  const handleClick = () => {
    onPress(tab.href);
    triggerHaptic('light');
  };

  return (
    <Link
      href={tab.href}
      prefetch={true}
      onClick={handleClick}
      onPointerEnter={prefetchData}
      onTouchStart={prefetchData}
      aria-label={tab.ariaLabel}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        position: 'relative',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        width: 44,
        height: 44,
      }}
    >
      {isActive && (
        <motion.span
          layoutId="bottom-tab-active-pill"
          className="glass-circle-btn pointer-events-none"
          style={{
            position: 'absolute',
            top: 2,
            bottom: 2,
            left: 2,
            right: 2,
            width: 40,
            height: 40,
            borderRadius: 9999,
          }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        />
      )}
      <motion.span
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}
      >
        <LkvIcon name={tab.iconName} size={22} color={isActive ? '#17402C' : '#365233'} />
      </motion.span>
      {badge > 0 && <BadgeDot count={badge} />}
    </Link>
  );
});

function HamburgerMenu({ menuOpen, setMenuOpen, openSearch, isCommunity }: { menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; openSearch?: () => void; isCommunity?: boolean }) {
  const { triggerHaptic } = useHapticFeedback();
  const cartCount = useCartCount();
  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic('selection');
          setMenuOpen(!menuOpen);
        }}
        aria-label="Menu actions"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '999px',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#17402C',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <LkvIcon name="menu" size={18} color="#17402C" />
      </motion.button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 55,
              }}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                right: 0,
                bottom: 'calc(100% + 8px)',
                zIndex: 56,
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(12px) saturate(160%)',
                WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: '135px',
              }}
            >
              {/* Search */}
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                  openSearch?.();
                }}
                aria-label="Rechercher"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  border: 'none',
                  color: '#17402C',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LkvIcon name="search" size={16} color="#17402C" />
                Recherche
              </button>

              {/* Enregistrés / Favoris */}
              {isCommunity && (
                <Link
                  href="/carnets?tab=favorites"
                  onClick={() => {
                    triggerHaptic('light');
                    setMenuOpen(false);
                  }}
                  aria-label="Enregistrés"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'rgba(23, 64, 44, 0.06)',
                    textDecoration: 'none',
                    color: '#17402C',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <LkvIcon name="bookmark" size={16} color="#17402C" />
                  Enregistrés
                </Link>
              )}

              {/* Notifications */}
              <Link
                href="/alertes"
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Notifications"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: '#17402C',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                Alertes
                <span style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#5B7F55' }} aria-hidden="true" />
              </Link>
              {/* Cart */}
              <Link
                href="/panier"
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Panier"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: '#17402C',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <LkvIcon name="bag" size={16} color="#17402C" />
                Panier
                {cartCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: '#5B7F55',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    fontFamily: 'monospace',
                  }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const [hiddenByEvent, setHiddenByEvent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPressedTab(null);
    setHiddenByEvent(false);
  }, [pathname]);

  const isGroupesHub = pathname === '/groupes';
  const isGroupeCockpit = Boolean(pathname && pathname.startsWith('/groupes/') && pathname !== '/groupes');
  const isClubsHub = pathname === '/clubs';
  const isClubDetail = Boolean(pathname && pathname.startsWith('/clubs/') && pathname !== '/clubs');
  const isCarnetsHub = pathname === '/carnets';
  const isCarnetDetail = Boolean(pathname && pathname.startsWith('/carnets/') && pathname !== '/carnets' && pathname !== '/carnets/nouveau');
  const isPaysHub = pathname === '/pays';
  const isPaysDetail = Boolean(pathname && pathname.startsWith('/pays/') && pathname !== '/pays');
  const isMaterielPreparation = Boolean(
    pathname && (pathname.startsWith('/materiel/preparation') || pathname.startsWith('/preparation'))
  );
  const isMaterielDepart = Boolean(pathname && pathname.startsWith('/materiel/depart'));
  const isMaterielHub = pathname === '/materiel';
  const isMaterielSection = isMaterielDepart || isMaterielPreparation || isMaterielHub;
  const isCommunityPage = Boolean(
    pathname && (
      pathname.startsWith('/communaute') ||
      pathname.startsWith('/entraide') ||
      pathname.startsWith('/evenements')
    )
  );

  const hasUpperExtension = isGroupesHub || isGroupeCockpit || isClubsHub || isClubDetail || isCarnetsHub || isCarnetDetail || isPaysHub || isPaysDetail || isCommunityPage || isMaterielSection;

  const [activeGroupesTab, setActiveGroupesTab] = useState<'mes-groupes' | 'decouvrir'>('mes-groupes');
  const [activeCockpitTab, setActiveCockpitTab] = useState<string>('overview');
  const [activeClubsTab, setActiveClubsTab] = useState<'decouvrir' | 'mes-clubs'>('decouvrir');
  const [activeClubDetailTab, setActiveClubDetailTab] = useState<string>('overview');
  const [activeCarnetsTab, setActiveCarnetsTab] = useState<'explorer' | 'mes-carnets'>('explorer');
  const [activeCarnetDetailTab, setActiveCarnetDetailTab] = useState<string>('overview');
  const [activePaysContinent, setActivePaysContinent] = useState<string>('all');
  const [activePaysDetailTab, setActivePaysDetailTab] = useState<string>('presentation');
  const [activeCommunityTab, setActiveCommunityTab] = useState<string>('fil');
  const [activeDepartTab, setActiveDepartTab] = useState<string>('overview');
  const [activeMaterielTab, setActiveMaterielTab] = useState<string>('overview');
  const [activeKitsTab, setActiveKitsTab] = useState<string>('all');

  useEffect(() => {
    if (!pathname) return;
    if (pathname === '/groupes') {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t === 'decouvrir') setActiveGroupesTab('decouvrir');
        else setActiveGroupesTab('mes-groupes');
      }
    } else if (pathname === '/clubs') {
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
    } else if (pathname.startsWith('/materiel/depart') || pathname === '/materiel') {
      setActiveDepartTab('overview');
      setActiveMaterielTab('overview');
    }

    if (typeof window !== 'undefined') {
      const commHandler = (e: any) => {
        if (e.detail) setActiveCommunityTab(e.detail);
      };
      const grpHandler = (e: any) => {
        if (e.detail) setActiveGroupesTab(e.detail);
      };
      const cockpitHandler = (e: any) => {
        if (e.detail) setActiveCockpitTab(e.detail);
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
      const departHandler = (e: any) => {
        if (e.detail) {
          setActiveDepartTab(e.detail);
          setActiveMaterielTab(e.detail);
        }
      };
      const kitsHandler = (e: any) => {
        if (e.detail) setActiveKitsTab(e.detail);
      };
      const toggleBottomBarHandler = (e: any) => {
        if (e.detail && typeof e.detail.hide === 'boolean') {
          setHiddenByEvent(e.detail.hide);
        }
      };

      window.addEventListener('community-tab-change', commHandler);
      window.addEventListener('groupes-tab-change', grpHandler);
      window.addEventListener('groupe-cockpit-tab-change', cockpitHandler);
      window.addEventListener('clubs-tab-change', clubsHandler);
      window.addEventListener('club-detail-tab-change', clubDetailHandler);
      window.addEventListener('carnets-tab-change', carnetsHandler);
      window.addEventListener('carnet-detail-tab-change', carnetDetailHandler);
      window.addEventListener('pays-continent-change', paysContinentHandler);
      window.addEventListener('pays-detail-tab-change', paysDetailHandler);
      window.addEventListener('depart-section-change', departHandler);
      window.addEventListener('kits-section-change', kitsHandler);
      window.addEventListener('lkdv-toggle-bottom-bar', toggleBottomBarHandler);

      return () => {
        window.removeEventListener('community-tab-change', commHandler);
        window.removeEventListener('groupes-tab-change', grpHandler);
        window.removeEventListener('groupe-cockpit-tab-change', cockpitHandler);
        window.removeEventListener('clubs-tab-change', clubsHandler);
        window.removeEventListener('club-detail-tab-change', clubDetailHandler);
        window.removeEventListener('carnets-tab-change', carnetsHandler);
        window.removeEventListener('carnet-detail-tab-change', carnetDetailHandler);
        window.removeEventListener('pays-continent-change', paysContinentHandler);
        window.removeEventListener('pays-detail-tab-change', paysDetailHandler);
        window.removeEventListener('depart-section-change', departHandler);
        window.removeEventListener('kits-section-change', kitsHandler);
        window.removeEventListener('lkdv-toggle-bottom-bar', toggleBottomBarHandler);
      };
    }
  }, [pathname]);

  const handleUpperTabSelect = (tabKey: string) => {
    triggerHaptic('selection');

    if (isMaterielSection) {
      setActiveMaterielTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('depart-section-change', { detail: tabKey }));
      }
    } else if (isGroupesHub) {
      setActiveGroupesTab(tabKey as 'mes-groupes' | 'decouvrir');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('groupes-tab-change', { detail: tabKey }));
      }
    } else if (isGroupeCockpit) {
      setActiveCockpitTab(tabKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('groupe-cockpit-tab-change', { detail: tabKey }));
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

  const getUpperTabs = () => {
    if (isMaterielSection) {
      return [
        { id: 'overview', label: "Vue d'ensemble" },
        { id: 'terrain', label: 'Terrain & Météo' },
        { id: 'equipment_hub', label: 'Sac & Matériel' },
      ];
    }
    if (isGroupesHub) {
      return [
        { id: 'mes-groupes', label: 'Mes expéditions' },
        { id: 'decouvrir', label: 'Explorer' },
      ];
    }
    if (isGroupeCockpit) {
      return [
        { id: 'overview', label: 'Cockpit' },
        { id: 'parcours', label: 'Parcours' },
        { id: 'tasks', label: 'Tâches' },
        { id: 'equipment', label: 'Matériel' },
        { id: 'expenses', label: 'Budget' },
        { id: 'discussion', label: 'Chat' },
        { id: 'members', label: 'Membres' },
      ];
    }
    if (isClubsHub) {
      return [
        { id: 'decouvrir', label: 'Découvrir' },
        { id: 'mes-clubs', label: 'Mes clubs' },
      ];
    }
    if (isClubDetail) {
      return [
        { id: 'overview', label: 'Cockpit' },
        { id: 'events', label: 'Sorties' },
        { id: 'discussions', label: 'Discussions' },
        { id: 'members', label: 'Membres' },
        { id: 'guides', label: 'Guides' },
      ];
    }
    if (isCarnetsHub) {
      return [
        { id: 'explorer', label: 'Explorer' },
        { id: 'mes-carnets', label: 'Mes carnets' },
      ];
    }
    if (isCarnetDetail) {
      return [
        { id: 'overview', label: 'Récit' },
        { id: 'map', label: 'Carte & GPX' },
        { id: 'moments', label: 'Moments' },
        { id: 'kit', label: 'Matériel' },
        { id: 'nature', label: 'Nature' },
      ];
    }
    if (isPaysHub) {
      return [
        { id: 'all', label: 'Tous' },
        { id: 'europe', label: 'Europe' },
        { id: 'asia', label: 'Asie' },
        { id: 'africa', label: 'Afrique' },
        { id: 'north-america', label: 'Amérique N.' },
        { id: 'south-america', label: 'Amérique S.' },
        { id: 'oceania', label: 'Océanie' },
      ];
    }
    if (isPaysDetail) {
      return [
        { id: 'presentation', label: 'Aperçu' },
        { id: 'destinations', label: 'Incontournables' },
        { id: 'activites', label: 'Activités' },
        { id: 'pratique', label: 'Météo & Pratique' },
        { id: 'communaute', label: 'Communauté' },
      ];
    }
    return [
      { id: 'fil', label: 'Fil' },
      { id: 'carnets', label: 'Carnets' },
      { id: 'clubs', label: 'Clubs' },
      { id: 'groupes', label: 'Groupes' },
      { id: 'evenements', label: 'Sorties' },
      { id: 'entraide', label: 'Entraide' },
    ];
  };

  const currentUpperId = isMaterielSection
    ? activeMaterielTab
    : isGroupesHub
    ? activeGroupesTab
    : isGroupeCockpit
    ? activeCockpitTab
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

  const isWideUpperTray = isGroupeCockpit || isClubDetail || isCarnetDetail || isPaysHub || isPaysDetail || isMaterielSection;

  const badges = useUnreadBadge();
  const badgeFor = (href: string): number => {
    if (href === '/materiel') return badges.materiel;
    if (href === '/compte') return badges.profil;
    if (href === '/communaute') return badges.communaute;
    return 0;
  };

  const isActive = (tab: Tab): boolean => {
    if (pressedTab && pressedTab === tab.href) return true;
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(p => pathname === p || pathname?.startsWith(p + '/'));
  };

  if (!mounted) {
    return (
      <nav role="navigation" aria-label="Chargement de la navigation" className="md:hidden flex items-center justify-center" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div style={{
          height: 52,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.38) 100%)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.75)',
          boxShadow: 'inset 0 1px 1.5px rgba(255,255,255,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
          gap: '8px',
          maxWidth: 'calc(100vw - 8px)',
        }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(23, 64, 44, 0.08)' }} />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="md:hidden flex items-center justify-center"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        // Masquage par glissement (lkdv-toggle-bottom-bar) plutôt que return
        // null : translate + visibility évitent le saut de ~40px quand
        // --bottom-nav-height bascule entre 52px et 12px (cf. audit 1.8).
        // visibility ne passe en hidden qu'après les 220ms de translation.
        transform: hiddenByEvent ? 'translate3d(0,120%,0)' : 'translate3d(0,0,0)',
        transition: hiddenByEvent
          ? 'transform 220ms cubic-bezier(0.32,0.72,0,1), visibility 0s linear 220ms'
          : 'transform 220ms cubic-bezier(0.32,0.72,0,1)',
        visibility: hiddenByEvent ? 'hidden' : 'visible',
      }}
    >
      <div
        style={{
          width: 'calc(100vw - 8px)',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'auto',
          paddingBottom: '2px',
        }}
      >
        {/* Upper extension tray coming out from behind the bottom bar — élargi pour visibilité optimale */}
        <AnimatePresence>
          {hasUpperExtension && (
            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 14, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              style={{
                width: 'calc(100% - 4px)',
                height: 44,
                marginBottom: -8,
                paddingTop: 4,
                paddingBottom: 10,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,244,239,0.78) 100%)',
                backdropFilter: 'blur(30px) saturate(200%)',
                WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                border: '1px solid rgba(255, 255, 255, 0.85)',
                borderBottom: 'none',
                boxShadow: 'inset 0 1.5px 2px rgba(255,255,255,0.98), 0 -2px 14px rgba(23, 64, 44, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isWideUpperTray ? 'flex-start' : 'space-between',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                scrollSnapType: 'x proximity',
                paddingLeft: 10,
                paddingRight: isWideUpperTray ? 28 : 14,
                scrollPaddingRight: '20px',
                gap: 4,
                zIndex: 1,
                maskImage: isWideUpperTray ? 'linear-gradient(to right, black 82%, transparent 100%)' : undefined,
                WebkitMaskImage: isWideUpperTray ? 'linear-gradient(to right, black 82%, transparent 100%)' : undefined,
              }}
            >
              {getUpperTabs().map((subTab) => {
                const isSelected = currentUpperId === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => handleUpperTabSelect(subTab.id)}
                    style={{
                      flex: isWideUpperTray ? '0 0 auto' : 1,
                      position: 'relative',
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#17402C' : '#5C6B5E',
                      fontFamily: 'inherit',
                      padding: isWideUpperTray ? '0 12px' : '0 4px',
                      whiteSpace: 'nowrap',
                      scrollSnapAlign: 'start',
                    }}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeCommunityUpperTab"
                        style={{
                          position: 'absolute',
                          top: 2,
                          bottom: 2,
                          left: 2,
                          right: 2,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(242,248,243,0.80) 100%)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          border: '1px solid rgba(255, 255, 255, 0.95)',
                          boxShadow: '0 2px 8px rgba(23, 64, 44, 0.08), inset 0 1.5px 2px rgba(255,255,255,0.98)',
                          pointerEvents: 'none',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      />
                    )}
                    <span
                      style={{
                        position: 'relative',
                        zIndex: 2,
                        lineHeight: 1,
                        transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      {subTab.label}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lower main bottom bar — hauteur ultra-compacte 52px pour laisser l'écran respirer */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: 52,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.48) 100%)',
            backdropFilter: 'blur(30px) saturate(200%)',
            WebkitBackdropFilter: 'blur(30px) saturate(200%)',
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.85)',
            boxShadow: 'inset 0 1px 1.5px rgba(255,255,255,0.95), inset 0 -1px 1px rgba(255,255,255,0.25), 0 10px 28px rgba(23, 64, 44, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 clamp(4px, 1.5vw, 8px)',
            gap: 'clamp(2px, 1.2vw, 6px)',
          }}
        >
          {DEFAULT_TABS.map((tab) => (
            <TabLink key={tab.href} tab={tab} isActive={isActive(tab)} onPress={setPressedTab} badge={badgeFor(tab.href)} />
          ))}

          <HamburgerMenu
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            openSearch={openSearch}
            isCommunity={hasUpperExtension}
          />
        </div>
      </div>
    </nav>
  );
}

export default memo(BottomTabBar);
