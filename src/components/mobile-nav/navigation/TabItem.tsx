'use client';

import React, { memo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { evaluateCurrentPrefetchPolicy } from '@/lib/perf/networkPrefs';
import { isMoveBeyondTolerance } from '@/hooks/gestures/gestureMath';
import Icon from '@/components/ui/Icon';
import type { DestinationId } from '@/components/mobile-nav/destinationRegistry';

/* Phase 3 — glyphes SF-like (pack masque) pour la bottom bar, plus modernes
   que les pictos legacy du drawer. */
const TAB_ICON: Record<DestinationId, string> = {
  adventures: 'home',
  community: 'users',
  explorer: 'compass',
  messages: 'message-square',
  me: 'user',
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
}: {
  destination: Destination;
  isActive: boolean;
  prefetch: boolean;
  onPress: (href: string) => void;
  badge: number;
  onLongPress?: () => void;
}) {
  const { triggerHaptic } = useHapticFeedback();
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
      return;
    }
    onPress(destination.href);
    // H5 : haptique medium à l'ouverture du hub, léger ailleurs.
    triggerHaptic(destination.id === 'adventures' ? 'medium' : 'light');
  };

  return (
    <Link
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
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        flex: '1 1 0',
        minWidth: 44,
        maxWidth: 76,
        height: 'var(--nav-height)',
      }}
    >
      {isActive && (
        <motion.span
          layoutId="bottom-tab-active-pill"
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            marginLeft: -32,
            width: 64,
            height: 40,
            borderRadius: 9999,
            background: 'var(--g2-bg)',
            border: '1px solid var(--glass-rim)',
            boxShadow: 'var(--glass-specular)',
          }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        />
      )}
      <motion.span
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}
      >
        {/* Icône seule (labels retirés) — glyphes SF-like, cible tactile conservée. */}
        <Icon
          name={TAB_ICON[destination.id]}
          size={onLongPress ? 28 : 26}
          color={isActive ? 'var(--glass-label)' : 'var(--glass-label-tertiary)'}
        />
      </motion.span>
      {badge > 0 && <BadgeDot count={badge} />}
    </Link>
  );
});

export default TabItem;
