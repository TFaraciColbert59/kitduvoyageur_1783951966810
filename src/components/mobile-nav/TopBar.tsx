'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TopBarProps {
  cartCount?: number;
  notifCount?: number;
}

const PAGE_TITLES: Record<string, string> = {
  '/explorer': 'Explorer',
  '/mon-kit': 'Mon Kit',
  '/naviguer': 'Naviguer',
  '/activite': 'Activité',
  '/profil': 'Profil',
};

function getTitle(pathname: string): string {
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key)) return val;
  }
  return 'Le Kit du Voyageur';
}

export default function TopBar({ cartCount = 0, notifCount = 0 }: TopBarProps) {
  const pathname = usePathname();
  const title = getTitle(pathname);
  const showNotif = pathname.startsWith('/activite');

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
      style={{
        height: '52px',
        paddingTop: 'env(safe-area-inset-top)',
        background: 'rgba(231, 227, 214, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(28, 38, 32, 0.08)',
      }}
      aria-label="Barre de navigation contextuelle"
    >
      {/* Logo / Title */}
      <span className="font-display font-bold text-[#1C2620] text-base tracking-tight">
        {title}
      </span>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Cart icon — only when cart has items */}
        {cartCount > 0 && (
          <Link
            href="/panier"
            aria-label={`Panier — ${cartCount} article${cartCount > 1 ? 's' : ''}`}
            className="relative flex items-center justify-center w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
              style={{ width: '16px', height: '16px', fontSize: '9px', background: '#E4501C' }}
              aria-hidden="true"
            >
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          </Link>
        )}

        {/* Notification bell — only on Activité tab */}
        {showNotif && (
          <button
            aria-label={notifCount > 0 ? `${notifCount} notification${notifCount > 1 ? 's' : ''} non lue${notifCount > 1 ? 's' : ''}` : 'Notifications'}
            className="relative flex items-center justify-center w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: '16px', height: '16px', fontSize: '9px', background: '#E4501C' }}
                aria-hidden="true"
              >
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
