'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'inventaire' | 'mes-kits' | 'historique';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 animate-pulse" style={{ background: 'rgba(28,38,32,0.06)' }}>
      <div className="h-4 rounded-full mb-2" style={{ background: 'rgba(28,38,32,0.1)', width: '60%' }} />
      <div className="h-3 rounded-full" style={{ background: 'rgba(28,38,32,0.07)', width: '40%' }} />
    </div>
  );
}

// ─── Inventaire tab ───────────────────────────────────────────────────────────
function InventaireTab() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Quick access to 3D twin */}
      <Link
        href="/jumeau-3d"
        className="flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'linear-gradient(135deg, #1C2620 0%, #243028 100%)', color: '#E7E3D6' }}
        aria-label="Voir le jumeau numérique 3D de votre équipement"
      >
        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: '44px', height: '44px', background: 'rgba(228,80,28,0.2)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E4501C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Jumeau numérique 3D</p>
          <p className="text-xs mt-0.5" style={{ color: '#9AAD9E' }}>Visualiser votre équipement en 3D</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AAD9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      {/* Full inventaire link */}
      <Link
        href="/inventaire"
        className="flex items-center gap-3 rounded-2xl p-4"
        style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.1)' }}
        aria-label="Gérer mon inventaire complet"
      >
        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: '44px', height: '44px', background: 'rgba(92,138,58,0.15)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5C8A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: '#1C2620' }}>Mon inventaire</p>
          <p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>Gérer tout mon équipement</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      {/* Placeholder items */}
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

// ─── Mes Kits tab ─────────────────────────────────────────────────────────────
function MesKitsTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <div className="flex items-center justify-center rounded-full" style={{ width: '64px', height: '64px', background: 'rgba(228,80,28,0.1)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E4501C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10H4V10z" />
            <path d="M9 6V5a3 3 0 0 1 6 0v1" />
          </svg>
        </div>
        <h3 className="font-display font-bold text-lg" style={{ color: '#1C2620' }}>Vos kits personnalisés</h3>
        <p className="text-sm" style={{ color: '#5C6B5E' }}>Connectez-vous pour accéder à vos kits sauvegardés.</p>
        <Link href="/connexion" className="px-6 py-3 rounded-full font-semibold text-sm" style={{ background: '#E4501C', color: 'white' }}>
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Link
        href="/kits"
        className="flex items-center gap-3 rounded-2xl p-4"
        style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.1)' }}
        aria-label="Voir tous mes kits"
      >
        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: '44px', height: '44px', background: 'rgba(228,80,28,0.1)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E4501C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10H4V10z" />
            <path d="M9 6V5a3 3 0 0 1 6 0v1" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: '#1C2620' }}>Mes kits sauvegardés</p>
          <p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>Voir et modifier mes kits</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      <Link
        href="/ai-configurator"
        className="flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'linear-gradient(135deg, #E4501C 0%, #cc3d10 100%)', color: 'white' }}
        aria-label="Créer un nouveau kit avec le configurateur IA"
      >
        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Créer un kit IA</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>Configurateur intelligent</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Historique tab ───────────────────────────────────────────────────────────
function HistoriqueTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <p className="text-sm" style={{ color: '#5C6B5E' }}>Connectez-vous pour voir votre historique.</p>
        <Link href="/connexion" className="px-6 py-3 rounded-full font-semibold text-sm" style={{ background: '#E4501C', color: 'white' }}>
          Se connecter
        </Link>
      </div>
    );
  }

  const sections = [
    { label: 'Commandes', href: '/compte', icon: '📦', desc: 'Suivi de vos commandes' },
    { label: 'Locations en cours', href: '/location', icon: '🏕️', desc: 'Matériel loué actuellement' },
    { label: 'Ventes occasion', href: '/occasion', icon: '♻️', desc: 'Vos annonces actives' },
  ];

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {sections.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="flex items-center gap-3 rounded-2xl p-4"
          style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.1)' }}
          aria-label={s.label}
        >
          <span className="text-2xl flex-shrink-0" aria-hidden="true">{s.icon}</span>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: '#1C2620' }}>{s.label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>{s.desc}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MonKitPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inventaire');
  const { user, loading } = useAuth();
  const isLoggedIn = !loading && !!user;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'inventaire', label: 'Inventaire' },
    { id: 'mes-kits', label: 'Mes kits' },
    { id: 'historique', label: 'Historique' },
  ];

  return (
    <main
      id="main-content"
      className="md:hidden flex flex-col"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(52px + env(safe-area-inset-top))',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        background: '#E7E3D6',
      }}
    >
      {/* Segmented control */}
      <div
        className="sticky px-4 py-3 z-10"
        style={{
          top: 'calc(52px + env(safe-area-inset-top))',
          background: 'rgba(231, 227, 214, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(28,38,32,0.08)',
        }}
      >
        <div
          role="tablist"
          aria-label="Sections Mon Kit"
          className="flex rounded-xl p-1"
          style={{ background: 'rgba(28,38,32,0.08)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                const idx = tabs.findIndex((t) => t.id === tab.id);
                if (e.key === 'ArrowRight') setActiveTab(tabs[(idx + 1) % tabs.length].id);
                if (e.key === 'ArrowLeft') setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
              }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C]"
              style={{
                background: activeTab === tab.id ? '#E7E3D6' : 'transparent',
                color: activeTab === tab.id ? '#E4501C' : '#5C6B5E',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1"
      >
        {activeTab === 'inventaire' && <InventaireTab />}
        {activeTab === 'mes-kits' && <MesKitsTab isLoggedIn={isLoggedIn} />}
        {activeTab === 'historique' && <HistoriqueTab isLoggedIn={isLoggedIn} />}
      </div>
    </main>
  );
}
