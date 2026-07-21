'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/* ── Icons ── */
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {active ? (
      <>
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" fill="currentColor" opacity="0.15"/>
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ) : (
      <>
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </svg>
);

const ExploreIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {active ? (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" fill="currentColor" opacity="0.9"/>
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      </>
    )}
  </svg>
);

const KitIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {active ? (
      <>
        <path d="M4 7h16a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1z" fill="currentColor" opacity="0.15"/>
        <path d="M4 7h16a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 12v4M10 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <path d="M4 7h16a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M12 12v4M10 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </>
    )}
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {active ? (
      <>
        <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </>
    )}
  </svg>
);

interface Tab {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  ariaLabel: string;
  matchPaths?: string[];
}

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Accueil',
    icon: (active) => <HomeIcon active={active} />,
    ariaLabel: 'Accueil',
    matchPaths: ['/'],
  },
  {
    href: '/explorer',
    label: 'Explorer',
    icon: (active) => <ExploreIcon active={active} />,
    ariaLabel: 'Explorer les sentiers et destinations',
    matchPaths: ['/explorer', '/pays', '/carte-interactive'],
  },
  {
    href: '/ai-configurator',
    label: 'Mon Kit',
    icon: (active) => <KitIcon active={active} />,
    ariaLabel: 'Configurateur de kit IA',
    matchPaths: ['/ai-configurator', '/boutique', '/kits', '/occasion', '/produit', '/panier', '/checkout'],
  },
  {
    href: '/profil',
    label: 'Profil',
    icon: (active) => <ProfileIcon active={active} />,
    ariaLabel: 'Mon profil et compte',
    matchPaths: ['/profil', '/compte', '/inventaire', '/carnets', '/fidelite', '/gamification'],
  },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const { loading } = useAuth();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  const isActive = (tab: Tab): boolean => {
    if (tab.href === '/') return pathname === '/';
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(p => p !== '/' && (pathname === p || pathname.startsWith(p + '/')));
  };

  const activeIndex = TABS.findIndex(t => isActive(t));

  if (loading) return null;

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Blur backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(231,227,214,0.88)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          borderTop: '0.5px solid rgba(255,255,255,0.6)',
          boxShadow: '0 -1px 0 rgba(28,38,32,0.06), 0 -8px 32px rgba(14,21,18,0.06)',
        }}
      />

      <div
        className="relative flex items-center"
        style={{
          height: 'calc(60px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {TABS.map((tab, index) => {
          const active = isActive(tab);
          const pressed = pressedIndex === index;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.ariaLabel}
              aria-current={active ? 'page' : undefined}
              onMouseDown={() => setPressedIndex(index)}
              onMouseUp={() => setPressedIndex(null)}
              onTouchStart={() => setPressedIndex(index)}
              onTouchEnd={() => setPressedIndex(null)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-inset rounded-sm relative"
              style={{
                color: active ? '#E4501C' : '#7A8A7D',
                transform: pressed && !reducedMotion ? 'scale(0.88)' : 'scale(1)',
                transition: reducedMotion ? 'none' : `transform 120ms cubic-bezier(0.34,1.56,0.64,1), color 200ms ease`,
              }}
            >
              {/* Active pill background */}
              {active && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '40px',
                    height: '32px',
                    borderRadius: '12px',
                    background: 'rgba(228,80,28,0.10)',
                    transition: reducedMotion ? 'none' : 'all 300ms cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              )}

              {/* Icon */}
              <span className="relative z-10" style={{ marginTop: active ? '-2px' : '0' }}>
                {tab.icon(active)}
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  color: active ? '#E4501C' : '#7A8A7D',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
