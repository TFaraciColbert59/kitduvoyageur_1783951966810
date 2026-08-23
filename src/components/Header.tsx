'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import GlobalSearchModal from '@/components/ui/GlobalSearchModal';
import { createClient } from '@/lib/supabase/client';
import { getCart } from '@/lib/cart';

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
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCartCount = () => {
      const items = getCart();
      const total = Array.isArray(items) ? items.reduce((s, i) => s + (i.quantity || 1), 0) : 0;
      setCartCount(total);
    };
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

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
        <header className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-[1020px] px-3 sm:px-4 pointer-events-none transition-all duration-300">
          <div
            className={`w-full rounded-full px-4 sm:px-5 transition-all duration-300 flex items-center justify-between pointer-events-auto cursor-default ${
              scrolled ? 'py-1.5 shadow-md' : 'py-2 shadow-sm'
            }`}
            style={{
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.03) 100%)',
              backdropFilter: 'blur(10px) saturate(160%)',
              WebkitBackdropFilter: 'blur(10px) saturate(160%)',
              border: '1px solid rgba(255, 255, 255, 0.38)',
              boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.07), inset 0 1px 1.5px rgba(255, 255, 255, 0.8), inset 0 -1px 1px rgba(255, 255, 255, 0.15)',
            }}
          >
            {/* Left: Logo Liquid Glass */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus-visible:outline-none opacity-100 hover:opacity-85 active:opacity-75 transition-opacity cursor-pointer touch-manipulation py-1"
            >
              <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-b from-[#17402C]/20 to-[#17402C]/08 border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] text-[#17402C]">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
                </svg>
              </div>
              <span className="font-bold text-[#17402C] text-sm tracking-tight font-display">
                Le Kit du Voyageur
              </span>
            </Link>

            {/* Center: Navigation Links with Animated Sliding Pill */}
            <nav className="flex items-center gap-1 p-1 rounded-full bg-white/[0.06] border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="relative px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold tracking-wide uppercase transition-colors duration-200 cursor-pointer touch-manipulation whitespace-nowrap select-none"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="header-active-pill"
                        className="absolute inset-0 rounded-full bg-[#17402C]/10 border border-[#17402C]/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_2px_8px_rgba(23,64,44,0.06)]"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span
                      className={`relative z-10 transition-colors ${
                        isActive ? 'text-[#17402C] font-extrabold' : 'text-[#365233]/75 hover:text-[#17402C]'
                      }`}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions in Liquid Glass Style */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Bouton Lancer Rando Liquid Glass */}
              <Link
                href="/randonnee-active"
                className="hidden lg:inline-flex items-center gap-1.5 bg-gradient-to-b from-[#17402C]/15 to-[#17402C]/06 text-[#17402C] border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] text-[11px] font-bold px-3.5 py-1.5 rounded-full hover:bg-[#17402C]/20 active:opacity-85 transition-all cursor-pointer touch-manipulation whitespace-nowrap"
                title="Lancer le mode randonnée GPS"
              >
                <span>🥾</span>
                <span>Lancer rando</span>
              </Link>

              {/* Panier Button */}
              <Link
                href="/panier"
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] text-[#17402C] active:opacity-70 transition-colors flex items-center justify-center relative cursor-pointer touch-manipulation"
                aria-label="Panier"
                title="Panier"
              >
                <Icon name="ShoppingBagIcon" size={16} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] flex items-center justify-center bg-[#17402C] text-white text-[9px] font-bold rounded-full px-1 border border-white">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>

              {/* Notifications Button */}
              <Link
                href="/alertes"
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] text-[#17402C] active:opacity-70 transition-colors flex items-center justify-center cursor-pointer touch-manipulation relative"
                aria-label="Notifications"
                title="Notifications"
              >
                <Icon name="BellIcon" size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-[#17402C] text-white text-[8px] font-bold rounded-full px-1 border border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Recherche Button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/20 border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] text-[#17402C] active:opacity-70 transition-colors flex items-center justify-center cursor-pointer touch-manipulation"
                aria-label="Rechercher sur tout le site"
                title="Rechercher sur tout le site"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>

              {/* Mon Compte Button */}
              <Link
                href={user ? '/compte' : '/connexion'}
                className="bg-gradient-to-b from-[#17402C] to-[#0F2D1F] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full hover:brightness-110 active:opacity-85 transition-all whitespace-nowrap flex items-center justify-center cursor-pointer touch-manipulation shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(23,64,44,0.18)] border border-white/20"
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
