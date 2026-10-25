'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { triggerNativeHaptic } from '@/lib/native/haptics';
import { DESTINATIONS, type DestinationId } from '@/components/mobile-nav/destinationRegistry';

// 5 Glyphes SF Symbols (19x19, stroke 1.8) conformes Apple iOS
const SF_ICONS: Record<DestinationId, React.ReactNode> = {
  adventures: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21 12 5 5 21M3 21h18M12 5v16M8.5 15h7" />
    </svg>
  ),
  community: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  explorer: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polygon points="15.5 8.5 13.3 13.3 8.5 15.5 10.7 10.7 15.5 8.5" fill="currentColor" fillOpacity={0.15} />
    </svg>
  ),
  messages: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  ),
  me: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.168 18.849a6.5 6.5 0 0 1 11.664 0" />
    </svg>
  ),
};

export interface IOS27BottomBarProps {
  /** Mode forcé (optionnel pour mock ou preview) */
  activeTabId?: DestinationId;
  /** Rappel lors du clic (optionnel) */
  onSelectTab?: (id: DestinationId) => void;
  /** Style additionnel */
  className?: string;
  style?: React.CSSProperties;
  /** Désactiver le masquage automatique du clavier pour preview */
  disableKeyboardDetection?: boolean;
}

/**
 * Bottom Bar iOS 27 Liquid Glass native Apple pour Next.js (LKDV)
 * 
 * - Hauteur : 48px, largeur : min(calc(100% - 24px), 402px), border-radius : 999px
 * - Matériau optique Liquid Glass avec réfraction spéculaire rasante
 * - Lentille active dynamique avec physique ressort (cubic-bezier(.32, .72, 0, 1))
 * - Icônes SF Symbols vectorielles pures + labels typographiques 10px SF Pro
 * - Retour haptique Apple Taptic Engine au pointerdown
 * - Micro-interaction de compression tactile (scale 0.92 au toucher)
 * - Auto-masquage lors de l'ouverture du clavier virtuel iOS
 */
export function IOS27BottomBar({
  activeTabId,
  onSelectTab,
  className = '',
  style,
  disableKeyboardDetection = false,
}: IOS27BottomBarProps) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Résolution de l'onglet actif (via prop forcée ou via URL)
  const currentTabId: DestinationId | null = activeTabId ?? (
    DESTINATIONS.find((tab) =>
      pathname === tab.href || tab.matchPaths.some((p) => pathname.startsWith(p))
    )?.id ?? null
  );

  const activeIndex = currentTabId
    ? DESTINATIONS.findIndex((tab) => tab.id === currentTabId)
    : -1;

  // Masquage intelligent quand le clavier iOS apparaît
  useEffect(() => {
    if (disableKeyboardDetection || typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const initialHeight = window.innerHeight;

    const handleResize = () => {
      // Clavier iOS déployé si la hauteur visible chute de plus de 15%
      setIsKeyboardOpen(viewport.height < initialHeight * 0.85);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, [disableKeyboardDetection]);

  const handlePointerDown = (id: DestinationId) => {
    triggerNativeHaptic('selection');
    if (onSelectTab) {
      startTransition(() => {
        onSelectTab(id);
      });
    }
  };

  if (isKeyboardOpen) return null;

  return (
    <nav
      className={`tb ios27-bar ${className}`}
      aria-label="Navigation principale"
      style={style}
    >
      {/* Lentille glissante physique (Spring Easing Apple) */}
      <span
        className="lens"
        aria-hidden="true"
        style={{
          transform: activeIndex >= 0 ? `translateX(${activeIndex * 100}%)` : 'none',
          opacity: activeIndex >= 0 ? 1 : 0,
        }}
      />

      {/* 5 Cellules de navigation */}
      {DESTINATIONS.map((tab) => {
        const isActive = tab.id === currentTabId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch={false}
            className={isActive ? 'on' : ''}
            aria-current={isActive ? 'page' : undefined}
            onPointerDown={() => handlePointerDown(tab.id)}
            onClick={(e) => {
              if (onSelectTab) {
                // Si contrôlé en démo / preview, éviter le rechargement
                if (activeTabId !== undefined) {
                  e.preventDefault();
                  onSelectTab(tab.id);
                }
              }
            }}
          >
            {SF_ICONS[tab.id]}
            <span>{tab.label.fr}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default IOS27BottomBar;
