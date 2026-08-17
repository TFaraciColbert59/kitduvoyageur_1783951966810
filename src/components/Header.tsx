'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

import { useAuth } from '@/contexts/AuthContext';
import GlobalSearchModal from '@/components/ui/GlobalSearchModal';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { label: 'Aventures', href: '/explorer' },
  { label: 'Earth', href: '/pays' },
  { label: 'Matériel', href: '/mon-materiel' },
  { label: 'Communauté', href: '/communaute' },
];

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const supabase = createClient();

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('notifications-header-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <div className="hidden md:block">
      <header className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-[1020px] px-3 sm:px-4 pointer-events-none transition-all duration-300">
        <div
          className={`w-full rounded-full px-4 sm:px-5 transition-all duration-300 flex items-center justify-between pointer-events-auto cursor-default ${
            scrolled
              ? 'bg-white/90 backdrop-blur-xl shadow-md border border-${FOREGROUND_900}/10 py-2'
              : 'bg-white/95 backdrop-blur-md shadow-sm border border-[#E8E4D8] py-2.5'
          }`}
        >
          {/* Left: Logo - Subtle opacity shift */}
          <Link
            href="/"
            className="flex items-center gap-2 group focus-visible:outline-none opacity-100 hover:opacity-85 active:opacity-75 transition-opacity cursor-pointer touch-manipulation py-1"
          >
            <div className="w-7.5 h-7.5 bg-[#1C2620] rounded-xl flex items-center justify-center shadow-xs">
              <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
              </svg>
            </div>
            <span className="font-bold text-[#1C2620] text-sm tracking-tight">
              Le Kit du Voyageur
            </span>
          </Link>

          {/* Center: Navigation Links - Subtle color & background shift */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`relative text-[11px] sm:text-xs font-bold tracking-wide uppercase transition-colors duration-200 px-3 py-1.5 rounded-full cursor-pointer touch-manipulation whitespace-nowrap active:opacity-75 ${
                    isActive
                      ? 'text-[#1C2620] bg-[#1C2620]/06 font-extrabold'
                      : 'text-[#6B7A72] hover:text-[#1C2620] hover:bg-[#1C2620]/04'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0.5 left-3 right-3 h-[2px] bg-[#1C2620] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>


          {/* Right: Actions - Lightweight & Discreet */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Bouton Lancer Rando */}
            <Link
              href="/randonnee-active"
              className="hidden lg:inline-flex items-center gap-1.5 bg-[#2D6A4F] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full hover:bg-[#1B4332] active:opacity-85 transition-colors cursor-pointer touch-manipulation whitespace-nowrap shadow-xs"
              title="Lancer le mode randonnée GPS"
            >
              <span>🥾</span>
              <span>Lancer rando</span>
            </Link>

            {/* Panier Button */}
            <Link
              href="/panier"
              className="w-9 h-9 text-[#1C2620] hover:text-[#2D6A4F] hover:bg-[#1C2620]/05 active:opacity-70 transition-colors rounded-full flex items-center justify-center relative cursor-pointer touch-manipulation"
              aria-label="Panier"
              title="Panier"
            >
              <Icon name="ShoppingBagIcon" size={17} />
            </Link>

            {/* Notifications Button — unique point d'accès aux notifications */}
            <Link
              href="/alertes"
              className="w-9 h-9 text-[#1C2620] hover:text-[#2D6A4F] hover:bg-[#1C2620]/05 active:opacity-70 transition-colors rounded-full flex items-center justify-center cursor-pointer touch-manipulation relative"
              aria-label="Notifications"
              title="Notifications"
            >
              <Icon name="BellIcon" size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-[#2D6A4F] text-white text-[8px] font-bold rounded-full px-1 border border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Recherche Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 text-[#1C2620] hover:text-[#2D6A4F] hover:bg-[#1C2620]/05 active:opacity-70 transition-colors rounded-full flex items-center justify-center cursor-pointer touch-manipulation"
              aria-label="Rechercher sur tout le site"
              title="Rechercher sur tout le site"
            >
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Mon Compte Button */}
            <Link
              href={user ? '/compte' : '/connexion'}
              className="bg-[#1C2620] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full hover:bg-[#2D3F35] active:opacity-85 transition-colors whitespace-nowrap flex items-center justify-center cursor-pointer touch-manipulation shadow-xs"
            >
              {mounted && user ? 'Mon compte' : 'Se connecter'}
            </Link>
          </div>
        </div>
      </header>
      </div>

      {/* Global Site Search Overlay */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
