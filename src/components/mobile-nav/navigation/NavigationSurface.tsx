'use client';

import type { ReactNode } from 'react';
import LiquidGlass from '@/components/glass/LiquidGlass';
import { zIndex } from '@/lib/ui/zIndex';

interface NavigationSurfaceProps {
  label: string;
  hidden?: boolean;
  loading?: boolean;
  /** Matériau optique iOS 27, réservé aux surfaces de navigation. */
  opticalNavigation?: boolean;
  plateau?: ReactNode;
  children?: ReactNode;
}

export default function NavigationSurface({
  label,
  hidden = false,
  loading = false,
  opticalNavigation = false,
  plateau,
  children,
}: NavigationSurfaceProps) {
  if (loading) {
    return (
      <nav
        role="navigation"
        aria-label={label}
        className="lkv-nav-surface md:hidden flex items-center justify-center"
        data-optical={opticalNavigation ? 'true' : undefined}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: zIndex.nav,
          pointerEvents: 'none',
          paddingBottom: opticalNavigation
            ? 'calc(var(--safe-bottom) + 10px)'
            : 'var(--safe-bottom)',
        }}
      >
        <div
          className={`lkv-material-bar${opticalNavigation ? ' lkv-nav-glass' : ''}`}
          style={{
            position: 'relative',
            height: 'var(--nav-height)',
            borderRadius: opticalNavigation ? 32 : 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 14px',
            gap: '10px',
            width: opticalNavigation ? 'min(430px, calc(100vw - 32px))' : 'calc(100vw - 8px)',
            maxWidth: opticalNavigation ? '430px' : 'calc(100vw - 8px)',
            isolation: 'isolate',
          }}
        >
          {opticalNavigation ? (
            <LiquidGlass
              className="lkv-nav-refraction"
              priority="control"
              displacementScale={78}
              blurAmount={14}
              saturation={215}
              aberrationIntensity={3}
              cornerRadius={32}
              interactive={false}
              elasticity={0}
              overLight
              glassTint="rgba(16, 16, 16, 0.14)"
              shadow="0 8px 15px rgba(0, 0, 0, 0.02)"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            >
              <span aria-hidden="true" />
            </LiquidGlass>
          ) : null}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="lkv-nav-loading-dot animate-pulse"
              style={{
                position: 'relative',
                zIndex: 1,
                width: 44,
                height: 44,
                borderRadius: 999,
                background: 'rgba(23, 64, 44, 0.08)',
              }}
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
      className="lkv-nav-surface md:hidden flex items-center justify-center select-none"
      data-hidden={hidden}
      data-optical={opticalNavigation ? 'true' : undefined}
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
        paddingBottom: opticalNavigation
          ? 'calc(var(--safe-bottom) + 10px)'
          : 'var(--safe-bottom)',
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
          width: opticalNavigation ? 'min(430px, calc(100vw - 32px))' : 'calc(100vw - 24px)',
          maxWidth: opticalNavigation ? '430px' : '480px',
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
          className={`lkv-material-bar${opticalNavigation ? ' lkv-nav-glass' : ''}`}
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: 'var(--nav-height)',
            borderRadius: 'var(--lkv-radius-nav)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: opticalNavigation ? '0 12px' : '0 var(--space-2)',
            gap: 'var(--space-1)',
            // M03 — le pan vertical de la page reste possible au-dessus de la
            // barre ; le plateau garde son propre `pan-x` pour faire défiler
            // les sous-onglets.
            touchAction: 'manipulation',
            overscrollBehavior: 'contain',
            isolation: 'isolate',
          }}
        >
          {opticalNavigation ? (
            <LiquidGlass
              className="lkv-nav-refraction"
              priority="control"
              displacementScale={78}
              blurAmount={14}
              saturation={215}
              aberrationIntensity={3}
              cornerRadius={32}
              interactive={false}
              elasticity={0}
              overLight
              glassTint="rgba(16, 16, 16, 0.22)"
              shadow="0 8px 15px rgba(0, 0, 0, 0.02)"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            >
              <span aria-hidden="true" />
            </LiquidGlass>
          ) : null}
          {children}
        </div>
      </div>
    </nav>
  );
}
