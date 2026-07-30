'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

type Tab = 'vous' | 'communaute' | 'amis';

function SkeletonFeedItem() {
  return (
    <div className="flex gap-3 px-4 py-3 animate-pulse">
      <div className="rounded-full flex-shrink-0" style={{ width: '40px', height: '40px', background: 'rgba(28,38,32,0.1)' }} />
      <div className="flex-1 flex flex-col gap-2 pt-1">
        <div className="h-3 rounded-full" style={{ background: 'rgba(28,38,32,0.1)', width: '55%' }} />
        <div className="h-3 rounded-full" style={{ background: 'rgba(28,38,32,0.07)', width: '80%' }} />
      </div>
    </div>
  );
}

function VousTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <div className="flex items-center justify-center rounded-full" style={{ width: '64px', height: '64px', background: 'rgba(228,80,28,0.1)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <h3 className="font-display font-bold text-lg" style={{ color: '#1C2620' }}>Vos carnets de voyage</h3>
        <p className="text-sm" style={{ color: '#5C6B5E' }}>Connectez-vous pour accéder à vos carnets et historique de sorties.</p>
        <Link href="/connexion" className="px-6 py-3 rounded-full font-semibold text-sm" style={{ background: '#17402C', color: 'white' }}>Se connecter</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Link href="/carnets" className="flex items-center gap-3 rounded-2xl p-4" style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.1)' }} aria-label="Mes carnets de voyage">
        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: '44px', height: '44px', background: 'rgba(58,110,165,0.15)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A6EA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
        </div>
        <div className="flex-1"><p className="font-semibold text-sm" style={{ color: '#1C2620' }}>Mes carnets</p><p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>Récits et photos de vos aventures</p></div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
      </Link>
      <Link href="/mes-aventures" className="flex items-center gap-3 rounded-2xl p-4" style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.1)' }} aria-label="Historique de mes sorties">
        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: '44px', height: '44px', background: 'rgba(92,138,58,0.15)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5C8A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
        </div>
        <div className="flex-1"><p className="font-semibold text-sm" style={{ color: '#1C2620' }}>Historique de sorties</p><p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>Toutes vos randonnées passées</p></div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
      </Link>
      <div className="flex flex-col gap-2"><SkeletonFeedItem /><SkeletonFeedItem /></div>
    </div>
  );
}

function CommunauteTab() {
  const links = [
    { href: '/feed', label: 'Feed communauté', desc: 'Actualités et partages', icon: '📰', color: '#17402C' },
    { href: '/clubs', label: 'Clubs', desc: 'Rejoindre des groupes', icon: '🏔️', color: '#3A6EA5' },
    { href: '/evenements', label: 'Événements', desc: 'Sorties et rassemblements', icon: '📅', color: '#5C8A3A' },
    { href: '/communaute', label: 'Communauté', desc: 'Espace d\'échange', icon: '💬', color: '#B5652D' },
  ];
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: '#EDEAE0', border: '1px solid rgba(28,38,32,0.1)' }} aria-label={l.label}>
          <span className="text-2xl flex-shrink-0" aria-hidden="true">{l.icon}</span>
          <div className="flex-1"><p className="font-semibold text-sm" style={{ color: '#1C2620' }}>{l.label}</p><p className="text-xs mt-0.5" style={{ color: '#5C6B5E' }}>{l.desc}</p></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      ))}
    </div>
  );
}

function AmisTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <p className="text-sm" style={{ color: '#5C6B5E' }}>Connectez-vous pour voir l&apos;activité de vos amis.</p>
        <Link href="/connexion" className="px-6 py-3 rounded-full font-semibold text-sm" style={{ background: '#17402C', color: 'white' }}>Se connecter</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-2"><SkeletonFeedItem /><SkeletonFeedItem /><SkeletonFeedItem /></div>
      <p className="text-center text-xs px-4" style={{ color: '#9AAD9E' }}>L&apos;activité de vos amis apparaîtra ici</p>
    </div>
  );
}

export default function ActivitePage() {
  const [activeTab, setActiveTab] = useState<Tab>('vous');
  const { user, loading } = useAuth();
  const isLoggedIn = !loading && !!user;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'vous', label: 'Vous' }, { id: 'communaute', label: 'Communauté' }, { id: 'amis', label: 'Amis' },
  ];

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen" style={{ background: '#E7E3D6', padding: '100px' }}>
          <p style={{ textAlign: 'center', color: '#5C6B5E' }}>Vue disponible uniquement sur mobile</p>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <main id="main-content" style={{ background: '#E7E3D6', minHeight: '100dvh' }}>
            {/* Segmented control */}
            <div style={{ padding: '12px 16px', position: 'sticky', top: 0, background: 'rgba(231, 227, 214, 0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(28,38,32,0.08)', zIndex: 10 }}>
              <div role="tablist" aria-label="Sections Activité" className="flex rounded-xl p-1" style={{ background: 'rgba(28,38,32,0.08)' }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id} role="tab" aria-selected={activeTab === tab.id} aria-controls={`panel-${tab.id}`} id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => { const idx = tabs.findIndex((t) => t.id === tab.id); if (e.key === 'ArrowRight') setActiveTab(tabs[(idx + 1) % tabs.length].id); if (e.key === 'ArrowLeft') setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id); }}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C]"
                    style={{ background: activeTab === tab.id ? '#E7E3D6' : 'transparent', color: activeTab === tab.id ? '#17402C' : '#5C6B5E', boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
              {activeTab === 'vous' && <VousTab isLoggedIn={isLoggedIn} />}
              {activeTab === 'communaute' && <CommunauteTab />}
              {activeTab === 'amis' && <AmisTab isLoggedIn={isLoggedIn} />}
            </div>
          </main>
        </MobilePageShell>
        
      </div>
    </>
  );
}
