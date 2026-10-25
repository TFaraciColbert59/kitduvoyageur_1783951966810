'use client';

import React, { memo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { evaluateCurrentPrefetchPolicy } from '@/lib/perf/networkPrefs';
import { isMoveBeyondTolerance } from '@/hooks/gestures/gestureMath';
import Icon from '@/components/ui/Icon';
import type { DestinationId } from '@/components/mobile-nav/destinationRegistry';

// Icônes Modernes Instagram & Apple : État inactif (contour épuré 1.9) vs État actif (aplats riches / filled SF Symbols)
const MODERN_ICONS: Record<
  DestinationId,
  {
    outline: React.ReactNode;
    filled: React.ReactNode;
  }
> = {
  adventures: {
    outline: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5Z" />
        <path d="M9 22v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
      </svg>
    ),
    filled: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5 2.5 10.2a1 1 0 0 0-.2.9 1 1 0 0 0 .8.9H4v8a2 2 0 0 0 2 2h4a1 1 0 0 0 1-1v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 0 1 1h4a2 2 0 0 0 2-2v-8h.9a1 1 0 0 0 .8-.9 1 1 0 0 0-.2-.9L12 2.5Z" />
      </svg>
    ),
  },
  community: {
    outline: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    filled: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM9 14c-4.42 0-8 2.24-8 5v1.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V19c0-2.76-3.58-5-8-5ZM17.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17.5 14c-.95 0-1.85.15-2.67.42 1.94 1.15 3.17 2.89 3.17 4.58v1.5a1.5 1.5 0 0 0 .33.95A1.5 1.5 0 0 0 19 22h3.5a1.5 1.5 0 0 0 1.5-1.5V19c0-2.76-3.13-5-6.5-5Z" />
      </svg>
    ),
  },
  explorer: {
    outline: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <polygon points="16.2 7.8 13.8 13.8 7.8 16.2 10.2 10.2 16.2 7.8" />
      </svg>
    ),
    filled: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1.5A10.5 10.5 0 1 0 22.5 12 10.51 10.51 0 0 0 12 1.5ZM17.15 7.85l-2.78 6.94a1 1 0 0 1-.58.58l-6.94 2.78a.5.5 0 0 1-.65-.65l2.78-6.94a1 1 0 0 1 .58-.58l6.94-2.78a.5.5 0 0 1 .65.65ZM12 10.5a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 12 10.5Z" />
      </svg>
    ),
  },
  messages: {
    outline: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21.5 2.5 2 9.5l8 3.5 3.5 8 8-18.5Z" />
        <path d="M10 13 21.5 2.5" />
      </svg>
    ),
    filled: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.84 2.16a1 1 0 0 0-1.07-.22L1.87 9.17a1 1 0 0 0-.07 1.83l8 3.73 3.73 8a1 1 0 0 0 1.83-.07l7.23-18.9a1 1 0 0 0-.75-1.6ZM10.5 12.8 19 4.3 12.6 15.6l-2.1-2.8Z" />
      </svg>
    ),
  },
  me: {
    outline: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="9.5" r="3.5" />
        <path d="M6.4 18.2a7 7 0 0 1 11.2 0" />
      </svg>
    ),
    filled: (
      <svg className="ic w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1.5A10.5 10.5 0 1 0 22.5 12 10.51 10.51 0 0 0 12 1.5ZM12 6a3.5 3.5 0 1 1-3.5 3.5A3.5 3.5 0 0 1 12 6Zm0 13.8a7.94 7.94 0 0 1-5.63-2.37A6.5 6.5 0 0 1 12 14.5a6.5 6.5 0 0 1 5.63 2.93A7.94 7.94 0 0 1 12 19.8Z" />
      </svg>
    ),
  },
};
import type { Destination } from '@/components/mobile-nav/destinationRegistry';

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

// Durée d'appui long du tab Hub central (alignée sur les gestes du dépôt).
const HUB_LONG_PRESS_MS = 550;

// Une destination de la barre : icône 22 (24 pour Aventures, tab « hero ») et
// libellé visible sous l'icône (10px, contraste AA), cible ≥ 44×44.
// Aventures : appui long → sélecteur d'aventure compact ; le clic simple ouvre
// toujours l'aventure active, jamais une liste. Alternative accessible :
// aria-haspopup + Ctrl/Cmd+K/J dans le switcher + déclencheur visible du hub.
const TabItem = memo(function TabItem({
  destination,
  isActive,
  prefetch,
  onPress,
  badge,
  onLongPress,
  optical = false,
}: {
  destination: Destination;
  isActive: boolean;
  prefetch: boolean;
  onPress: (href: string) => void;
  badge: number;
  onLongPress?: () => void;
  /** Variante Hub iOS 27 : capsule compacte, icônes seules, lentille active. */
  optical?: boolean;
}) {
  const { triggerHaptic } = useHapticFeedback();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const longPressFiredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const prefetchData = useCallback(() => {
    // P0 — garde réseau : pas de prefetch de données sur connexion limitée
    // (réseau inconnu inclus, cf. M08 / networkPrefs).
    // L'ancien prefetch `['hikes']` non paramétré a été supprimé (clé jamais lue,
    // requête gaspillée) : la carte charge ses données par viewport via
    // `useViewportData` avec ses propres clés.
    const policy = evaluateCurrentPrefetchPolicy();
    if (!policy.allow || !policy.allowData) return;

    if (destination.id === 'adventures') {
      queryClient.prefetchQuery({
        queryKey: ['hub-adventures'],
        queryFn: () => fetch('/api/hub/adventures').then((r) => (r.ok ? r.json() : null)),
        staleTime: 60_000,
      });
    } else if (destination.id === 'community') {
      queryClient.prefetchQuery({
        queryKey: ['carnets'],
        queryFn: () => fetch('/api/carnets').then((r) => (r.ok ? r.json() : [])),
        staleTime: 60_000,
      });
    }
  }, [destination.id, queryClient]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onLongPress) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      longPressFiredRef.current = true;
      onLongPress();
    }, HUB_LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!timerRef.current || !startRef.current) return;
    if (isMoveBeyondTolerance(e.clientX - startRef.current.x, e.clientY - startRef.current.y)) {
      clearLongPressTimer();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      e.preventDefault();
      window.dispatchEvent(new Event('lkdv:navigation-cancel'));
      return;
    }
    // Une ouverture dans un autre onglet ne change pas l'onglet courant.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onPress(destination.href);
    // Un retour de sélection seulement lorsque la destination active change.
    if (!isActive) triggerHaptic('selection');
  };

  return (
    <Link
      className={`lkv-nav-tab${optical ? ' lkv-nav-tab--optical' : ''}`}
      href={destination.href}
      prefetch={prefetch}
      onClick={handleClick}
      onPointerEnter={prefetchData}
      onTouchStart={prefetchData}
      onPointerDown={onLongPress ? handlePointerDown : undefined}
      onPointerMove={onLongPress ? handlePointerMove : undefined}
      onPointerUp={onLongPress ? clearLongPressTimer : undefined}
      onPointerCancel={onLongPress ? clearLongPressTimer : undefined}
      onPointerLeave={onLongPress ? clearLongPressTimer : undefined}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      aria-haspopup={onLongPress ? 'dialog' : undefined}
      aria-current={isActive ? 'page' : undefined}
      title={onLongPress ? 'Appui long : changer d’aventure' : undefined}
      aria-label={
        badge > 0
          ? `${destination.ariaLabel} — ${badge} notification${badge > 1 ? 's' : ''}`
          : destination.ariaLabel
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        textDecoration: 'none',
        position: 'relative',
        zIndex: 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: optical ? 64 : 76,
        height: 'var(--nav-height)',
      }}
    >
      {isActive && (
        <motion.span
          layoutId="bottom-tab-active-pill"
          className="lkv-nav-active-lens"
          style={{
            position: 'absolute',
            top: optical ? 6 : 4,
            left: '50%',
            marginLeft: optical ? -24 : -32,
            width: optical ? 48 : 64,
            height: optical ? 48 : 52,
            borderRadius: optical ? 999 : 20,
          }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
        />
      )}
      {/* framer-motion rend focalisable un élément muni de whileTap : l'icône
          n'est pas un arrêt de tabulation à part (le lien l'est déjà). */}
      <motion.span
        tabIndex={-1}
        aria-hidden="true"
        whileTap={reduceMotion ? undefined : { scale: 0.88 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 25 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
          color: isActive ? 'var(--feed-ink, #17402c)' : 'var(--feed-muted, #56665d)',
          transform: isActive ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease',
        }}
      >
        {isActive ? MODERN_ICONS[destination.id].filled : MODERN_ICONS[destination.id].outline}
      </motion.span>
      {badge > 0 && <BadgeDot count={badge} />}
    </Link>
  );
});

export default TabItem;

