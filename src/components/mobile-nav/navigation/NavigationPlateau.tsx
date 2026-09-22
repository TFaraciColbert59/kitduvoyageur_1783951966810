'use client';

import { motion } from 'framer-motion';
import type { NavigationPlateauController, PlateauFlags } from './useNavigationPlateau';

interface UpperTab {
  id: string;
  label: string;
  count?: number;
}

function getUpperTabs(flags: PlateauFlags, messagerieRequestsCount: number): UpperTab[] {
  if (flags.isMessageriePage) {
    return [
      { id: 'all', label: 'Toutes' },
      { id: 'direct', label: 'Directs' },
      { id: 'group', label: 'Groupes' },
      { id: 'requests', label: 'Demandes', count: messagerieRequestsCount },
    ];
  }
  if (flags.isClubsHub) {
    return [
      { id: 'decouvrir', label: 'Découvrir' },
      { id: 'mes-clubs', label: 'Mes clubs' },
    ];
  }
  if (flags.isClubDetail) {
    return [
      { id: 'overview', label: 'Cockpit' },
      { id: 'events', label: 'Sorties' },
      { id: 'groups', label: 'Groupes' },
      { id: 'discussions', label: 'Discussions' },
      { id: 'members', label: 'Membres' },
      { id: 'guides', label: 'Guides' },
    ];
  }
  if (flags.isCarnetsHub) {
    return [
      { id: 'explorer', label: 'Explorer' },
      { id: 'mes-carnets', label: 'Mes carnets' },
    ];
  }
  if (flags.isCarnetDetail) {
    return [
      { id: 'overview', label: 'Récit' },
      { id: 'map', label: 'Carte & GPX' },
      { id: 'moments', label: 'Moments' },
      { id: 'kit', label: 'Matériel' },
      { id: 'nature', label: 'Nature' },
    ];
  }
  if (flags.isPaysHub) {
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
  if (flags.isPaysDetail) {
    return [
      { id: 'presentation', label: 'Aperçu' },
      { id: 'destinations', label: 'Incontournables' },
      { id: 'activites', label: 'Activités' },
      { id: 'culture', label: 'Culture' },
      { id: 'gastronomie', label: 'Gastronomie' },
      { id: 'hebergements', label: 'Hébergements' },
      { id: 'pratique', label: 'Météo & Pratique' },
      { id: 'communaute', label: 'Communauté' },
    ];
  }
  if (flags.isVoyagesHub) {
    return [
      { id: 'user', label: 'Mes voyages' },
      { id: 'public', label: 'Explorer' },
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
}

export default function NavigationPlateau({ controller }: { controller: NavigationPlateauController }) {
  const { flags, activeId, isWide, messagerieRequestsCount, selectTab } = controller;
  const upperTabs = getUpperTabs(flags, messagerieRequestsCount);

  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 14, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      style={{
        // M03 — hauteur utile 44 px pour chaque bouton (content-box
        // 44 + padding-top 4 = 48, moins les 8 px glissés sous la
        // barre : la hauteur totale étendue reste 92 px).
        width: 'calc(100% - 4px)',
        height: 48,
        marginBottom: -8,
        paddingTop: 4,
        paddingBottom: 0,
        background: 'var(--material-bar-bg)',
        backdropFilter: 'blur(var(--material-bar-blur)) saturate(var(--material-bar-saturate))',
        WebkitBackdropFilter: 'blur(var(--material-bar-blur)) saturate(var(--material-bar-saturate))',
        borderTopLeftRadius: 'var(--lkv-radius-sheet)',
        borderTopRightRadius: 'var(--lkv-radius-sheet)',
        border: '1px solid var(--material-bar-border)',
        borderBottom: 'none',
        boxShadow: 'var(--btn-rim), 0 -2px 14px rgba(23, 64, 44, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isWide ? 'flex-start' : 'space-between',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x',
        overscrollBehaviorX: 'contain',
        overscrollBehaviorY: 'none',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        scrollSnapType: 'x proximity',
        paddingLeft: 10,
        paddingRight: isWide ? 28 : 14,
        scrollPaddingRight: '20px',
        gap: 4,
        zIndex: 1,
        maskImage: isWide ? 'linear-gradient(to right, black 82%, transparent 100%)' : undefined,
        WebkitMaskImage: isWide ? 'linear-gradient(to right, black 82%, transparent 100%)' : undefined,
      }}
    >
      {upperTabs.map((subTab) => {
        const isSelected = activeId === subTab.id;
        return (
          <button
            key={subTab.id}
            type="button"
            onClick={() => selectTab(subTab.id)}
            style={{
              flex: isWide ? '0 0 auto' : 1,
              position: 'relative',
              // M03 — cible tactile utile 44 px (le fond sélectionné
              // reste visuellement à 34 px via l'inset de la pilule).
              height: 44,
              minWidth: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: isSelected ? 700 : 500,
              color: isSelected ? 'var(--lkv-primary)' : 'var(--lkv-text-muted)',
              fontFamily: 'inherit',
              padding: isWide ? '0 12px' : '0 4px',
              whiteSpace: 'nowrap',
              scrollSnapAlign: 'start',
            }}
          >
            {isSelected && (
              <motion.div
                layoutId="activeCommunityUpperTab"
                style={{
                  position: 'absolute',
                  // Fond visible 34 px dans une cible tactile de 44 px.
                  top: 5,
                  bottom: 5,
                  left: 2,
                  right: 2,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(242,248,243,0.80) 100%)',
                  backdropFilter: 'blur(var(--glass-blur-lg))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur-lg))',
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
                transition: 'transform var(--motion-control-duration) var(--lkv-ease)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {subTab.label}
              {subTab.count != null && subTab.count > 0 ? (
                <span
                  className="glass-pill"
                  aria-label={`${subTab.count} demandes en attente`}
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    fontSize: 9.5,
                    fontWeight: 800,
                    lineHeight: '16px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {subTab.count > 9 ? '9+' : subTab.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
