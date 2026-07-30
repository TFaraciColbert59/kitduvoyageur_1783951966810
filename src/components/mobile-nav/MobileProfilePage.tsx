'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';


// ── Types ──────────────────────────────────────────────────────────────────────
interface StatItem {
  value: string;
  label: string;
  icon: string;
}

interface MenuItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  badge?: string;
}

// ── Logged-out state ───────────────────────────────────────────────────────────
function LoggedOutProfile() {
  const benefits = [
    { icon: '🗺️', title: 'Configurateur IA', desc: 'Kit personnalisé en 2 minutes' },
    { icon: '📓', title: 'Carnets de voyage', desc: 'Documentez vos aventures' },
    { icon: '🏔️', title: 'Communauté', desc: 'Rejoignez des passionnés' },
    { icon: '🎖️', title: 'Fidélité & Badges', desc: 'Récompenses pour chaque sortie' },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero CTA */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1C2620 0%, #243028 100%)',
          padding: '40px 24px 32px',
        }}
      >
        {/* Decorative orb */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(228,80,28,0.2) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center gap-5">
          {/* Avatar placeholder */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(228,80,28,0.15)',
              border: '2px solid rgba(228,80,28,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>

          <div>
            <h2
              className="font-display font-extrabold text-white"
              style={{ fontSize: '24px', letterSpacing: '-0.03em' }}
            >
              Votre profil aventurier
            </h2>
            <p
              className="text-white/50 mt-1"
              style={{ fontSize: '14px' }}
            >
              Rejoignez la communauté des voyageurs
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <Link
              href="/connexion"
              className="flex-1 flex items-center justify-center font-semibold haptic-press"
              style={{
                background: '#17402C',
                color: 'white',
                borderRadius: '16px',
                padding: '14px',
                fontSize: '15px',
                boxShadow: '0 8px 24px rgba(228,80,28,0.35)',
              }}
            >
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="flex-1 flex items-center justify-center font-semibold haptic-press"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(231,227,214,0.9)',
                borderRadius: '16px',
                padding: '14px',
                fontSize: '15px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="px-5 py-6 flex flex-col gap-3">
        <p
          className="font-semibold uppercase tracking-widest"
          style={{ fontSize: '11px', color: '#9AAD9E', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}
        >
          Ce qui vous attend
        </p>
        {benefits.map((b, i) => (
          <div
            key={b.title}
            className="flex items-center gap-4"
            style={{
              background: '#EDEAE0',
              border: '1px solid rgba(28,38,32,0.06)',
              borderRadius: '18px',
              padding: '16px',
              animationDelay: `${i * 60}ms`,
            }}
          >
            <span
              style={{
                fontSize: '28px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(28,38,32,0.05)',
                borderRadius: '14px',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {b.icon}
            </span>
            <div>
              <p
                className="font-display font-semibold text-[#1C2620]"
                style={{ fontSize: '15px', letterSpacing: '-0.01em' }}
              >
                {b.title}
              </p>
              <p
                className="text-[#5C6B5E]"
                style={{ fontSize: '13px', marginTop: '2px' }}
              >
                {b.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 'calc(60px + env(safe-area-inset-bottom) + 16px)' }} aria-hidden="true" />
    </div>
  );
}

// ── Logged-in state ────────────────────────────────────────────────────────────
function LoggedInProfile() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'voyages' | 'stats' | 'badges'>('voyages');

  const stats: StatItem[] = [
    { value: '0', label: 'Voyages', icon: '✈️' },
    { value: '0', label: 'Kits créés', icon: '🎒' },
    { value: '0', label: 'Pays visités', icon: '🌍' },
    { value: '0', label: 'Badges', icon: '🏅' },
  ];

  const menuItems: MenuItem[] = [
    {
      href: '/abonnements',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      label: 'Abonnement & Premium',
      sub: 'Plan gratuit',
      badge: 'Upgrade',
    },
    {
      href: '/carnets',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
      ),
      label: 'Journal de bord',
      sub: '0 carnet',
    },
    {
      href: '/inventaire',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
        </svg>
      ),
      label: 'Mon inventaire',
      sub: '0 équipement',
    },
    {
      href: '/fidelite',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      ),
      label: 'Fidélité & Récompenses',
      sub: '0 points',
    },
    {
      href: '/gamification',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      ),
      label: 'Badges & Progression',
      sub: 'Niveau 1',
    },
    {
      href: '/messagerie',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
      label: 'Messagerie',
    },
  ];

  const displayName = profile?.full_name || profile?.username || 'Voyageur';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col">
      {/* Profile header */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1C2620 0%, #243028 100%)',
          padding: '32px 24px 24px',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(228,80,28,0.2) 0%, transparent 70%)',
            filter: 'blur(24px)',
          }}
        />

        <div className="relative z-10 flex items-center gap-4 mb-6">
          {/* Avatar */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #17402C, #B5652D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(228,80,28,0.4)',
            }}
          >
            <span
              className="text-white font-display font-bold"
              style={{ fontSize: '22px' }}
            >
              {initials}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h2
              className="font-display font-bold text-white truncate"
              style={{ fontSize: '20px', letterSpacing: '-0.02em' }}
            >
              {displayName}
            </h2>
            <p
              className="text-white/50 truncate"
              style={{ fontSize: '13px', marginTop: '2px' }}
            >
              {profile?.email || 'Voyageur passionné'}
            </p>
            <div
              className="inline-flex items-center gap-1 mt-2"
              style={{
                background: 'rgba(228,80,28,0.15)',
                border: '1px solid rgba(228,80,28,0.25)',
                borderRadius: '999px',
                padding: '3px 10px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#17402C', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                NIVEAU 1 · EXPLORATEUR
              </span>
            </div>
          </div>

          <Link
            href="/compte"
            className="flex items-center justify-center w-10 h-10 rounded-full haptic-press"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            aria-label="Modifier le profil"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Link>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-4 gap-2"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px',
            padding: '14px 8px',
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span style={{ fontSize: '18px' }} aria-hidden="true">{stat.icon}</span>
              <span
                className="font-display font-bold text-white"
                style={{ fontSize: '18px', letterSpacing: '-0.02em', lineHeight: 1 }}
              >
                {stat.value}
              </span>
              <span
                className="text-white/40 text-center"
                style={{ fontSize: '10px', lineHeight: 1.2 }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className="px-5 py-5 flex flex-col gap-2">
        <p
          className="font-semibold uppercase tracking-widest mb-2"
          style={{ fontSize: '11px', color: '#9AAD9E', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}
        >
          Mon espace
        </p>

        {menuItems.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 haptic-press"
            style={{
              background: '#EDEAE0',
              border: '1px solid rgba(28,38,32,0.06)',
              borderRadius: '18px',
              padding: '14px 16px',
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(28,38,32,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#33463C',
              }}
            >
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-semibold text-[#1C2620] truncate"
                style={{ fontSize: '15px' }}
              >
                {item.label}
              </p>
              {item.sub && (
                <p
                  className="text-[#5C6B5E] truncate"
                  style={{ fontSize: '12px', marginTop: '1px' }}
                >
                  {item.sub}
                </p>
              )}
            </div>
            {item.badge ? (
              <span
                style={{
                  background: 'rgba(228,80,28,0.1)',
                  color: '#17402C',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {item.badge}
              </span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(28,38,32,0.3)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <div className="px-5 pb-6">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 haptic-press"
          style={{
            background: 'rgba(228,80,28,0.06)',
            border: '1px solid rgba(228,80,28,0.15)',
            borderRadius: '18px',
            padding: '14px',
            color: '#17402C',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Se déconnecter
        </button>
      </div>

      <div style={{ height: 'calc(60px + env(safe-area-inset-bottom) + 16px)' }} aria-hidden="true" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MobileProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '18px' }} />
        ))}
      </div>
    );
  }

  return user ? <LoggedInProfile /> : <LoggedOutProfile />;
}
