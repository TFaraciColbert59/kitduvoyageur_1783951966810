'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NaviguerButton from './NaviguerButton';

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  ariaLabel: string;
}

const SearchIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const BackpackIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10H4V10z" />
    <path d="M9 6V5a3 3 0 0 1 6 0v1" />
    <path d="M8 16h8" />
    <path d="M8 12h8" />
  </svg>
);

const ActivityIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

export default function BottomTabBar() {
  const pathname = usePathname();
  const { loading } = useAuth();

  const isActive = (href: string) => {
    if (href === '/explorer') return pathname === '/explorer' || pathname === '/';
    return pathname.startsWith(href);
  };

  const tabs: Tab[] = [
    {
      href: '/explorer',
      label: 'Explorer',
      icon: <SearchIcon active={false} />,
      activeIcon: <SearchIcon active={true} />,
      ariaLabel: 'Explorer les sentiers et destinations',
    },
    {
      href: '/mon-kit',
      label: 'Mon Kit',
      icon: <BackpackIcon active={false} />,
      activeIcon: <BackpackIcon active={true} />,
      ariaLabel: 'Mon kit et inventaire',
    },
  ];

  const rightTabs: Tab[] = [
    {
      href: '/activite',
      label: 'Activité',
      icon: <ActivityIcon active={false} />,
      activeIcon: <ActivityIcon active={true} />,
      ariaLabel: 'Activité et communauté',
    },
    {
      href: '/profil',
      label: 'Profil',
      icon: <ProfileIcon active={false} />,
      activeIcon: <ProfileIcon active={true} />,
      ariaLabel: 'Mon profil',
    },
  ];

  if (loading) return null;

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Backdrop blur bar */}
      <div
        className="flex items-center justify-around"
        style={{
          height: '56px',
          background: 'rgba(231, 227, 214, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(28, 38, 32, 0.1)',
        }}
      >
        {/* Left 2 tabs */}
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.ariaLabel}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-inset rounded-sm transition-colors duration-100"
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

        {/* Central Naviguer button — elevated */}
        <div className="flex flex-col items-center justify-center flex-1 relative" style={{ marginTop: '-20px' }}>
          <NaviguerButton isActive={isActive('/naviguer')} />
        </div>

        {/* Right 2 tabs */}
        {rightTabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.ariaLabel}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-inset rounded-sm transition-colors duration-100"
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
