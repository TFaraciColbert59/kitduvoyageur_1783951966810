'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LkvIcon from '@/components/ui/LkvIcon';

interface Tab {
  href: string;
  label: string;
  iconName: 'home' | 'mountain' | 'bag' | 'doc' | 'user';
  ariaLabel: string;
  matchPaths?: string[];
}

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Accueil',
    iconName: 'home',
    ariaLabel: 'Accueil',
    matchPaths: ['/'],
  },
  {
    href: '/explorer',
    label: 'Aventures',
    iconName: 'mountain',
    ariaLabel: 'Explorer les sentiers et destinations',
    matchPaths: ['/explorer', '/pays', '/carte-interactive'],
  },
  {
    href: '/boutique',
    label: 'Boutique',
    iconName: 'bag',
    ariaLabel: 'Boutique',
    matchPaths: ['/boutique', '/kits', '/occasion', '/produit', '/panier', '/checkout'],
  },
  {
    href: '/carnets',
    label: 'Carnet',
    iconName: 'doc',
    ariaLabel: 'Mes carnets de voyage',
    matchPaths: ['/carnets', '/inventaire', '/fidelite', '/gamification'],
  },
  {
    href: '/compte',
    label: 'Compte',
    iconName: 'user',
    ariaLabel: 'Mon compte',
    matchPaths: ['/compte', '/profil', '/connexion', '/inscription'],
  },
];

function TabLink({ tab, isActive }: { tab: Tab; isActive: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-label={tab.ariaLabel}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex flex-col items-center justify-center flex-1 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-inset rounded-sm"
    >
      <div
        className="relative flex flex-col items-center justify-center"
        style={{ gap: '3px' }}
      >
        <LkvIcon
          name={tab.iconName}
          size={22}
          color={isActive ? '#17402C' : '#6B7A72'}
        />
        <span
          style={{
            fontSize: '10px',
            letterSpacing: '0.01em',
            lineHeight: 1,
            fontFamily: 'var(--font-sans)',
            color: isActive ? '#17402C' : '#6B7A72',
            fontWeight: isActive ? 600 : 500,
          }}
        >
          {tab.label}
        </span>
      </div>

      {/* Active dot indicator */}
      {isActive && (
        <motion.div
          layoutId="active-dot"
          aria-hidden="true"
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#17402C',
            position: 'absolute',
            bottom: '6px',
            left: '50%',
            marginLeft: '-2px',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const { loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (tab: Tab): boolean => {
    if (tab.href === '/') return pathname === '/';
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(
      (p) => p !== '/' && (pathname === p || pathname?.startsWith(p + '/'))
    );
  };

  if (loading || !mounted) return null;

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="md:hidden"
      style={{
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }}
    >
      <div
        style={{
          height: '62px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          borderRadius: '22px',
          border: '1px solid rgba(11,31,23,0.06)',
          boxShadow: '0 10px 30px rgba(11,31,23,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
        }}
      >
        {TABS.map((tab) => (
          <TabLink
            key={tab.href}
            tab={tab}
            isActive={isActive(tab)}
          />
        ))}
      </div>
    </nav>
  );
}
