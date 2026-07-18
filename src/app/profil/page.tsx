'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

// ─── Logged-out state ─────────────────────────────────────────────────────────
function LoggedOutProfile() {
  const benefits = [
    { icon: '🗺️', title: 'Configurateur IA', desc: 'Kit personnalisé en 2 minutes' },
    { icon: '📓', title: 'Carnets de voyage', desc: 'Documentez vos aventures' },
    { icon: '🏔️', title: 'Clubs & Communauté', desc: 'Rejoignez des passionnés' },
    { icon: '🎖️', title: 'Fidélité & Badges', desc: 'Récompenses pour chaque sortie' },
  ];

  return (
    <div className="flex flex-col">
      {/* CTA header */}
      <div className="px-4 py-6 flex flex-col items-center text-center gap-4" style={{ background: '#1C2620' }}>
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: '72px', height: '72px', background: 'rgba(228,80,28,0.2)', border: '2px solid rgba(228,80,28,0.4)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E4501C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <div>
          <h2 className="font-display font-bold text-xl" style={{ color: '#E7E3D6' }}>Votre profil aventurier</h2>
          <p className="text-sm mt-1" style={{ color: '#9AAD9E' }}>Rejoignez la communauté des voyageurs</p>
        </div>
        <div className="flex gap-3 w-full">
          <Link
            href="/connexion"
            className="flex-1 py-3 rounded-2xl font-semibold text-sm text-center"
            style={{ background: '#E4501C', color: 'white' }}
          >
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="flex-1 py-3 rounded-2xl font-semibold text-sm text-center"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#E7E3D6' }}
          >
            Créer un compte
          </Link>
        </div>
      </div>
      {/* Benefits preview */}
      <div className="px-4 py-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9AAD9E' }}>Ce qui vous attend</p>
        {benefits?.map((b) => (
          <div key={b?.title} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.08)' }}>
            <span className="text-2xl flex-shrink-0" aria-hidden="true">{b?.icon}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#1C2620' }}>{b?.title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>{b?.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Logged-in state ──────────────────────────────────────────────────────────
function LoggedInProfile() {
  const { profile, signOut } = useAuth();

  const menuItems = [
    { href: '/abonnements', icon: '⭐', label: 'Abonnement & Premium' },
    { href: '/carnets', icon: '📓', label: 'Journal de bord' },
    { href: '/messagerie', icon: '💬', label: 'Messagerie' },
    { href: '/fidelite', icon: '🎖️', label: 'Fidélité & Récompenses' },
    { href: '/gamification', icon: '🏆', label: 'Badges & Progression' },
  ];

  return (
    <div className="flex flex-col">
      {/* Profile header */}
      <div className="px-4 py-6 flex flex-col items-center text-center gap-3" style={{ background: '#1C2620' }}>
        {/* Settings button */}
        <div className="self-end">
          <Link
            href="/compte"
            aria-label="Paramètres du compte"
            className="flex items-center justify-center w-10 h-10 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E7E3D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>

        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full text-2xl font-bold"
          style={{ width: '72px', height: '72px', background: '#E4501C', color: 'white' }}
          aria-hidden="true"
        >
          {profile?.full_name?.[0]?.toUpperCase() || '?'}
        </div>

        <div>
          <h2 className="font-display font-bold text-xl" style={{ color: '#E7E3D6' }}>
            {profile?.full_name || 'Aventurier'}
          </h2>
          {profile?.location && (
            <p className="text-sm mt-0.5" style={{ color: '#9AAD9E' }}>📍 {profile?.location}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-lg" style={{ color: '#E7E3D6', fontFamily: 'var(--font-mono)' }}>
              {profile?.xp ?? 0}
            </span>
            <span className="text-xs" style={{ color: '#9AAD9E' }}>XP</span>
          </div>
          <div className="w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-lg" style={{ color: '#E7E3D6', fontFamily: 'var(--font-mono)' }}>
              {profile?.loyalty_points ?? 0}
            </span>
            <span className="text-xs" style={{ color: '#9AAD9E' }}>Points</span>
          </div>
          <div className="w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold text-lg" style={{ color: '#E7E3D6', fontFamily: 'var(--font-mono)' }}>
              {profile?.level ?? 1}
            </span>
            <span className="text-xs" style={{ color: '#9AAD9E' }}>Niveau</span>
          </div>
        </div>
      </div>
      {/* Menu items */}
      <div className="flex flex-col gap-1 px-4 py-4">
        {menuItems?.map((item) => (
          <Link
            key={item?.href}
            href={item?.href}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{ background: '#EDEAE0' }}
            aria-label={item?.label}
          >
            <span className="text-xl flex-shrink-0 w-7 text-center" aria-hidden="true">{item?.icon}</span>
            <span className="flex-1 text-sm font-medium" style={{ color: '#1C2620' }}>{item?.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AAD9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}

        {/* Sign out */}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full mt-2"
          style={{ background: 'rgba(220,38,38,0.08)' }}
          aria-label="Se déconnecter"
        >
          <span className="text-xl flex-shrink-0 w-7 text-center" aria-hidden="true">🚪</span>
          <span className="flex-1 text-sm font-medium text-left" style={{ color: '#DC2626' }}>Se déconnecter</span>
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProfilPage() {
  const { user, loading } = useAuth();

  return (
    <main
      id="main-content"
      className="md:hidden flex flex-col"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(52px + env(safe-area-inset-top))',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        background: '#E7E3D6',
        overflowY: 'auto',
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[#E4501C] border-t-transparent animate-spin" aria-label="Chargement" />
        </div>
      ) : user ? (
        <LoggedInProfile />
      ) : (
        <LoggedOutProfile />
      )}
    </main>
  );
}
