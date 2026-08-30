'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import GlobalSearchModal from '@/components/ui/GlobalSearchModal';
import { createClient } from '@/lib/supabase/client';
import { useCartCount } from '@/hooks/useCartCount';

const NAV_LINKS = [
  { label: 'Aventures', href: '/explorer' },
  { label: 'Earth', href: '/pays' },
  { label: 'Matériel', href: '/materiel' },
  { label: 'Communauté', href: '/communaute' },
];

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const cartCount = useCartCount();

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

    const channelName = `notifications-header-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
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
        <header className="fixed top-3 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-[880px] lg:max-w-[940px] px-3 pointer-events-none transition-all duration-300">
          <div
            className={`w-full rounded-full px-4 py-1.5 transition-all duration-300 flex items-center justify-between gap-3 pointer-events-auto cursor-default ${
              scrolled ? 'shadow-md bg-white/90' : 'shadow-xs'
            }`}
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.15) 100%)',
              backdropFilter: 'blur(16px) saturate(170%)',
              WebkitBackdropFilter: 'blur(16px) saturate(170%)',
              border: '1px solid rgba(255, 255, 255, 0.50)',
              boxShadow: 'inset 0 1px 1.5px rgba(255, 255, 255, 0.85), 0 8px 24px -6px rgba(23, 64, 44, 0.10)',
            }}
          >
            {/* Left: Logo Liquid Glass (Icon Only — Sans texte) */}
            <Link
              href="/"
              className="flex items-center group focus-visible:outline-none opacity-100 hover:opacity-90 active:scale-95 transition-all cursor-pointer touch-manipulation py-0.5 shrink-0"
              aria-label="Accueil LKDV"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/80 shadow-xs flex items-center justify-center bg-[#17402C]/10 group-hover:scale-105 transition-transform">
                <img
                  src="/assets/images/app_logo.png"
                  alt="LKDV"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            {/* Center: Navigation Links with Animated Sliding Pill */}
            <nav className="flex items-center gap-1 p-0.5 rounded-full bg-white/[0.08] border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] shrink-0">
              {[
                { label: 'Aventures', href: '/explorer' },
                { label: 'Earth', href: '/pays' },
                { label: 'Matériel', href: '/materiel' },
                { label: 'Communauté', href: '/communaute' },
                { label: 'Mon compte', href: user ? '/compte' : '/connexion' },
              ].map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && link.href !== '/compte' && pathname?.startsWith(link.href)) || (link.href === '/compte' && pathname?.startsWith('/compte'));
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="relative px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase transition-colors duration-200 cursor-pointer touch-manipulation whitespace-nowrap select-none"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="header-active-pill"
                        className="absolute inset-0 rounded-full bg-[#17402C]/10 border border-[#17402C]/15 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8)]"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span
                      className={`relative z-10 transition-colors ${
                        isActive ? 'text-[#17402C] font-extrabold' : 'text-[#365233]/80 hover:text-[#17402C]'
                      }`}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions in Liquid Glass Style */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center gap-1 rounded-full bg-white/[0.08] border border-white/25 p-0.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
                {/* Panier */}
                <Link
                  href="/panier"
                  className="w-7 h-7 rounded-full hover:bg-white/30 text-[#17402C] active:opacity-70 transition-colors flex items-center justify-center relative cursor-pointer touch-manipulation"
                  aria-label="Panier"
                  title={cartCount > 0 ? `Panier (${cartCount} article${cartCount > 1 ? 's' : ''})` : 'Panier'}
                >
                  <Icon name="ShoppingBagIcon" size={14} />
                  {cartCount > 0 && (
                    <span
                      className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#5B7F55] ring-2 ring-white"
                      title={`${cartCount} article(s)`}
                    />
                  )}
                </Link>

                {/* Notifications Button */}
                <Link
                  href="/alertes"
                  className="w-7 h-7 rounded-full hover:bg-white/30 text-[#17402C] active:opacity-70 transition-colors flex items-center justify-center cursor-pointer touch-manipulation relative"
                  aria-label="Notifications"
                  title={unreadCount > 0 ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})` : 'Notifications'}
                >
                  <Icon name="BellIcon" size={14} />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#5B7F55] ring-2 ring-white animate-pulse"
                      title={`${unreadCount} notification(s)`}
                    />
                  )}
                </Link>

                {/* Recherche Button */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-7 h-7 rounded-full hover:bg-white/30 text-[#17402C] active:opacity-70 transition-colors flex items-center justify-center cursor-pointer touch-manipulation"
                  aria-label="Rechercher sur tout le site"
                  title="Rechercher sur tout le site"
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Global Site Search Overlay */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
