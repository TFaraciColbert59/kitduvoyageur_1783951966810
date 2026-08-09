'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import LkvIcon from '@/components/ui/LkvIcon';

interface Tab {
  href: string;
  label: string;
  iconName: 'home' | 'mountain' | 'bag' | 'users' | 'user' | 'compass';
  ariaLabel: string;
  matchPaths?: string[];
  isHero?: boolean;
}

const TABS: Tab[] = [
  {
    href: '/boutique',
    label: 'Boutique',
    iconName: 'bag',
    ariaLabel: 'Boutique',
    matchPaths: ['/boutique', '/kits', '/occasion', '/produit', '/panier', '/checkout'],
  },
  {
    href: '/explorer',
    label: 'Aventures',
    iconName: 'mountain',
    ariaLabel: 'Explorer les sentiers et destinations',
    matchPaths: ['/explorer', '/pays', '/carte-interactive', '/hors-ligne'],
  },
  {
    href: '/terrain',
    label: 'Terrain',
    iconName: 'compass',
    ariaLabel: 'Mode Terrain — GPS, kit, recherche',
    matchPaths: ['/terrain', '/naviguer', '/randonnee-active', '/boussole', '/mon-materiel'],
    isHero: true,
  },
  {
    href: '/communaute',
    label: 'Communauté',
    iconName: 'users',
    ariaLabel: 'Communauté, clubs, événements',
    matchPaths: ['/communaute', '/communaute/publier', '/clubs', '/groupes', '/entraide', '/createurs', '/experts', '/evenements', '/feed', '/messagerie'],
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
  const { haptic } = useHapticFeedback();

  const handleTap = () => {
    haptic(isActive ? 'selection' : 'medium');
  };

  if (tab.isHero) {
    return (
      <Link
        href={tab.href}
        aria-label={tab.ariaLabel}
        aria-current={isActive ? 'page' : undefined}
        onClick={handleTap}
        className="relative flex flex-col items-center justify-center flex-1 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-inset rounded-sm"
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: isActive ? '#17402C' : '#1E4D33',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: isActive
              ? '0 4px 14px rgba(23,64,44,0.4)'
              : '0 2px 8px rgba(23,64,44,0.25)',
            transition: 'box-shadow 0.2s ease',
          }}
        >
          <LkvIcon name={tab.iconName} size={24} color="#fff" />
        </div>
        <span
          style={{
            fontSize: '10px',
            letterSpacing: '0.01em',
            lineHeight: 1,
            fontFamily: 'var(--font-sans)',
            color: isActive ? '#17402C' : '#6B7A72',
            fontWeight: isActive ? 600 : 500,
            marginTop: '3px',
          }}
        >
          {tab.label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={tab.href}
      aria-label={tab.ariaLabel}
      aria-current={isActive ? 'page' : undefined}
      onClick={handleTap}
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
        
        {/* Unread badge for Communauté (mocked unread count > 0) */}
        {tab.label === 'Communauté' && (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '25%',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#D92D20', // Red color for notifications (avoids forbidden orange)
            }}
          />
        )}
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
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(
      (p) => pathname === p || pathname?.startsWith(p + '/')
    );
  };

  if (loading || !mounted) {
    return (
      <nav
        role="navigation"
        aria-label="Chargement de la navigation"
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
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                width: '48px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#E2E8E4',
                }}
              />
              <div
                style={{
                  width: '32px',
                  height: '6px',
                  borderRadius: '4px',
                  background: '#E2E8E4',
                }}
              />
            </div>
          ))}
        </div>
      </nav>
    );
  }

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
