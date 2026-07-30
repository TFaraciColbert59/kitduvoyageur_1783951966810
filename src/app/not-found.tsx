'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const POPULAR_PAGES = [
  { label: 'Configurateur IA', href: '/ai-configurator', icon: 'SparklesIcon' },
  { label: 'Boutique', href: '/boutique', icon: 'ShoppingBagIcon' },
  { label: 'Destinations', href: '/pays', icon: 'GlobeAltIcon' },
  { label: 'Mon inventaire', href: '/inventaire', icon: 'ArchiveBoxIcon' },
];

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history?.back();
    }
  };

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1C2620] p-4">
          <div className="text-center max-w-lg">
            <div className="flex justify-center mb-6">
              <h1 className="text-[10rem] font-bold leading-none" style={{ fontFamily: 'var(--font-display)', color: '#17402C', opacity: 0.2 }}>404</h1>
            </div>
            <p className="text-[10px] font-mono text-[#17402C] tracking-[0.25em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Page introuvable</p>
            <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>Cette page n&apos;existe pas</h2>
            <p className="text-white/50 mb-8 text-sm leading-relaxed">La page que vous cherchez a peut-être été déplacée, renommée ou n&apos;existe plus.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <button onClick={handleGoBack} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all">
                <Icon name="ArrowLeftIcon" size={16} variant="outline" />Retour
              </button>
              <Link href="/" className="inline-flex items-center justify-center gap-2 bg-[#17402C] hover:bg-[#cc3d10] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">
                <Icon name="HomeIcon" size={16} variant="outline" />Accueil
              </Link>
            </div>
            <div>
              <p className="text-xs text-white/30 font-mono tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>Pages populaires</p>
              <div className="grid grid-cols-2 gap-2">
                {POPULAR_PAGES.map((page) => (
                  <Link key={page.href} href={page.href} className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/60 hover:text-white transition-all">
                    <Icon name={page.icon} size={14} variant="outline" className="text-[#17402C]" />{page.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <h1 style={{ fontSize: '80px', fontWeight: 800, color: '#17402C', opacity: 0.2, marginBottom: '16px', fontFamily: 'var(--font-display)', lineHeight: 1 }}>404</h1>
            <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '12px' }}>Page introuvable</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Cette page n&apos;existe pas</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', lineHeight: '1.6' }}>La page que vous cherchez a peut-être été déplacée ou n&apos;existe plus.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
              <button onClick={handleGoBack} style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Retour</button>
              <Link href="/" style={{ padding: '12px 20px', borderRadius: '12px', background: '#17402C', color: 'white', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Accueil</Link>
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Pages populaires</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {POPULAR_PAGES.map((page) => (
                <Link key={page.href} href={page.href} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {page.label}
                </Link>
              ))}
            </div>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
