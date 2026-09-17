'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const POPULAR_PAGES = [
  { label: 'Explorer', href: '/explorer', icon: 'GlobeAltIcon' },
  { label: 'Hub Voyage', href: '/hub', icon: 'SparklesIcon' },
  { label: 'Boutique & Kits', href: '/boutique', icon: 'ShoppingBagIcon' },
  { label: 'Communauté', href: '/communaute', icon: 'UserGroupIcon' },
];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export default function NotFound() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '404 — Page introuvable | Le Kit du Voyageur',
    description: 'La page que vous cherchez a été déplacée, renommée ou n’existe plus.',
    url: `${siteUrl}/404`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history?.back();
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />

      {/* DESKTOP */}
      <div className="hidden md:flex min-h-screen flex-col items-center justify-center bg-[var(--lkv-surface,var(--lkv-surface-muted))] p-6">
        <div className="text-center max-w-md w-full glass p-8 rounded-[1.75rem] border border-[var(--lkv-primary)]/10 shadow-elevation-2">
          <div className="flex justify-center mb-4">
            <span
              className="text-8xl font-extrabold leading-none tracking-tight font-display select-none"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--lkv-primary, var(--lkv-primary))',
                opacity: 0.25,
              }}
            >
              404
            </span>
          </div>

          <p
            className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-[var(--lkv-secondary,var(--lkv-secondary))] mb-2"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Sentier introuvable
          </p>

          <h1
            className="text-2xl font-bold text-[var(--lkv-text-primary,var(--lkv-primary))] mb-3 font-display"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Cette page n&apos;existe pas
          </h1>

          <p className="text-[var(--lkv-text-secondary,var(--lkv-secondary))] mb-8 text-sm leading-relaxed font-sans">
            Le sentier que vous cherchez a peut-être été balisé ailleurs, renommé ou n&apos;existe plus.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center justify-center gap-2 bg-white/70 hover:bg-white text-[var(--lkv-primary,var(--lkv-primary))] border border-[var(--lkv-primary)]/12 px-5 py-3 rounded-full font-medium text-sm transition-all active:scale-[0.98] min-h-[44px]"
            >
              <Icon name="ArrowLeftIcon" size={16} variant="outline" />
              Retour
            </button>
            <Link
              href="/hub"
              className="inline-flex items-center justify-center gap-2 bg-[var(--lkv-primary,var(--lkv-primary))] hover:bg-[var(--lkv-primary-hover,var(--lkv-primary-hover))] text-white px-6 py-3 rounded-full font-semibold text-sm transition-all shadow-green active:scale-[0.98] min-h-[44px]"
            >
              <Icon name="HomeIcon" size={16} variant="outline" />
              Aller au Hub
            </Link>
          </div>

          <div className="pt-6 border-t border-[var(--lkv-primary)]/8">
            <p
              className="text-[11px] text-[var(--lkv-text-muted,var(--lkv-text-muted))] font-mono tracking-widest uppercase mb-3"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Points de repère
            </p>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="flex items-center gap-2.5 bg-white/60 hover:bg-white border border-[var(--lkv-primary)]/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-[var(--lkv-primary,var(--lkv-primary))] transition-all active:scale-[0.98] min-h-[40px]"
                >
                  <Icon name={page.icon} size={14} variant="outline" className="text-[var(--lkv-secondary,var(--lkv-secondary))]" />
                  {page.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell background="var(--lkv-surface, var(--lkv-surface-muted))">
          <div className="px-5 py-10 text-center flex flex-col items-center justify-center min-h-[calc(100dvh-120px)]">
            <div className="glass p-6 rounded-[1.75rem] border border-[var(--lkv-primary)]/10 w-full max-w-sm shadow-elevation-1">
              <span
                className="text-7xl font-extrabold leading-none font-display block mb-3 select-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--lkv-primary, var(--lkv-primary))',
                  opacity: 0.25,
                }}
              >
                404
              </span>

              <p
                className="text-[10px] font-mono font-semibold tracking-[0.2em] uppercase text-[var(--lkv-secondary,var(--lkv-secondary))] mb-2"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Sentier introuvable
              </p>

              <h1
                className="text-xl font-bold text-[var(--lkv-text-primary,var(--lkv-primary))] mb-2 font-display"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Cette page n&apos;existe pas
              </h1>

              <p className="text-[var(--lkv-text-secondary,var(--lkv-secondary))] mb-6 text-xs leading-relaxed font-sans">
                Le sentier que vous cherchez a peut-être été déplacé ou n&apos;existe plus.
              </p>

              <div className="flex gap-2.5 justify-center mb-6">
                <button
                  onClick={handleGoBack}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white/70 active:bg-white text-[var(--lkv-primary,var(--lkv-primary))] border border-[var(--lkv-primary)]/12 px-4 py-3 rounded-full font-medium text-xs transition-all min-h-[44px]"
                >
                  <Icon name="ArrowLeftIcon" size={14} variant="outline" />
                  Retour
                </button>
                <Link
                  href="/hub"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[var(--lkv-primary,var(--lkv-primary))] active:bg-[var(--lkv-primary-hover,var(--lkv-primary-hover))] text-white px-4 py-3 rounded-full font-semibold text-xs transition-all shadow-green min-h-[44px]"
                >
                  <Icon name="HomeIcon" size={14} variant="outline" />
                  Hub
                </Link>
              </div>

              <div className="pt-4 border-t border-[var(--lkv-primary)]/8">
                <p
                  className="text-[10px] text-[var(--lkv-text-muted,var(--lkv-text-muted))] font-mono tracking-widest uppercase mb-2.5"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Points de repère
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {POPULAR_PAGES.map((page) => (
                    <Link
                      key={page.href}
                      href={page.href}
                      className="flex items-center gap-2 bg-white/60 active:bg-white border border-[var(--lkv-primary)]/10 rounded-xl px-3 py-2 text-[11px] font-medium text-[var(--lkv-primary,var(--lkv-primary))] transition-all min-h-[40px]"
                    >
                      <Icon name={page.icon} size={13} variant="outline" className="text-[var(--lkv-secondary,var(--lkv-secondary))]" />
                      <span className="truncate">{page.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
