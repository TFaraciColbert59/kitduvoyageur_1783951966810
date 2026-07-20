'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const ExploreIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const ShopIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const AIIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  ariaLabel: string;
  matchPaths?: string[];
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const { loading } = useAuth();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  const tabs: Tab[] = [
    {
      href: '/explorer',
      label: 'Explorer',
      icon: <ExploreIcon active={false} />,
      activeIcon: <ExploreIcon active={true} />,
      ariaLabel: 'Explorer les sentiers et destinations',
      matchPaths: ['/explorer', '/pays'],
    },
    {
      href: '/boutique',
      label: 'Boutique',
      icon: <ShopIcon active={false} />,
      activeIcon: <ShopIcon active={true} />,
      ariaLabel: 'Boutique et produits',
      matchPaths: ['/boutique', '/kits', '/occasion', '/produit'],
    },
    {
      href: '/ai-configurator',
      label: 'Kit IA',
      icon: <AIIcon active={false} />,
      activeIcon: <AIIcon active={true} />,
      ariaLabel: 'Configurateur de kit IA',
      matchPaths: ['/ai-configurator'],
    },
    {
      href: '/profil',
      label: 'Profil',
      icon: <ProfileIcon active={false} />,
      activeIcon: <ProfileIcon active={true} />,
      ariaLabel: 'Mon profil et compte',
      matchPaths: ['/profil', '/compte', '/inventaire'],
    },
  ];

  const isActive = (tab: Tab): boolean => {
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  };

  const activeIndex = tabs.findIndex(t => isActive(t));

  const [indicatorStyle, setIndicatorStyle] = useState({ left: '0%', opacity: 0 });

  useEffect(() => {
    if (activeIndex < 0) {
      setIndicatorStyle(s => ({ ...s, opacity: 0 }));
      return;
    }
    const tabWidth = 100 / tabs.length;
    const left = activeIndex * tabWidth + tabWidth / 2;
    setIndicatorStyle({ left: `${left}%`, opacity: 1 });
  }, [activeIndex, tabs.length]);

  if (loading) return null;

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
    >
      <div
        className="relative flex items-center justify-around"
        style={{
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(231, 227, 214, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(28, 38, 32, 0.1)',
        }}
      >
        {/* Animated indicator */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '6px',
            width: '28px',
            height: '3px',
            borderRadius: '2px',
            background: '#E4501C',
            transform: 'translateX(-50%)',
            left: indicatorStyle.left,
            opacity: indicatorStyle.opacity,
            transition: reducedMotion
              ? 'none' :'left 250ms cubic-bezier(0.19, 1, 0.22, 1), opacity 150ms ease',
            pointerEvents: 'none',
          }}
        />

        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.ariaLabel}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-[56px] min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-inset rounded-sm"
              style={{ color: active ? '#E4501C' : '#7A8A7D' }}
            >
              {active ? tab.activeIcon : tab.icon}
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: active ? '#E4501C' : '#7A8A7D' }}
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
