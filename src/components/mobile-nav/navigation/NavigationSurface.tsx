'use client';

import type { ReactNode } from 'react';
import { zIndex } from '@/lib/ui/zIndex';

interface NavigationSurfaceProps {
  label: string;
  hidden?: boolean;
  loading?: boolean;
  plateau?: ReactNode;
  children?: ReactNode;
}

export default function NavigationSurface({
  label,
  hidden = false,
  loading = false,
  plateau,
  children,
}: NavigationSurfaceProps) {
  if (loading) {
    return (
      <nav
        role="navigation"
        aria-label={label}
        className="md:hidden flex items-center justify-center"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: zIndex.nav,
          pointerEvents: 'none',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div
          className="lkv-material-bar"
          style={{
            height: 'var(--nav-height)',
            borderRadius: 999,
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            gap: '8px',
            maxWidth: 'calc(100vw - 8px)',
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(23, 64, 44, 0.08)' }}
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      role="navigation"
      aria-label={label}
      className="md:hidden flex items-center justify-center select-none"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: zIndex.nav,
        pointerEvents: 'none',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        paddingBottom: 'var(--safe-bottom)',
        // Masquage par glissement (lkdv-toggle-bottom-bar) plutôt que return
        // null : translate + visibility évitent le saut de ~40px quand
        // --bottom-nav-height bascule entre 52px et 12px (cf. audit 1.8).
        // visibility ne passe en hidden qu'après les 220ms de translation.
        transform: hidden ? 'translate3d(0,120%,0)' : 'translate3d(0,0,0)',
        transition: hidden
          ? 'transform var(--motion-control-duration) var(--motion-ease-standard), visibility 0s linear var(--motion-control-duration)'
          : 'transform var(--motion-control-duration) var(--motion-ease-standard)',
        visibility: hidden ? 'hidden' : 'visible',
      }}
    >
      <div
        style={{
          width: 'calc(100vw - 24px)',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          overscrollBehavior: 'contain',
          paddingBottom: '2px',
        }}
      >
        {plateau}
        {/* Barre principale — hauteur canonique et matériau par tokens (Lot 2) */}
        <div
          className="lkv-material-bar"
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: 'var(--nav-height)',
            borderRadius: 'var(--lkv-radius-nav)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--space-2)',
            gap: 'var(--space-1)',
            // M03 — le pan vertical de la page reste possible au-dessus de la
            // barre ; le plateau garde son propre `pan-x` pour faire défiler
            // les sous-onglets.
            touchAction: 'manipulation',
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>
      </div>
    </nav>
  );
}
