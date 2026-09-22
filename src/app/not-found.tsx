'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Card } from '@/components/ui';

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

      <MobilePageShell background="transparent">
        <div className="flex min-h-[calc(100dvh-120px)] flex-col items-center justify-center px-[var(--space-5)] py-[var(--space-10)] text-center">
          <Card variant="featured" className="w-full max-w-sm p-6 md:max-w-md md:p-8">
            <span
              aria-hidden="true"
              className="mb-3 block select-none font-display text-[length:var(--lkv-text-title-lg)] font-extrabold leading-none tracking-tight text-[color:var(--lkv-primary)] opacity-25 md:text-8xl"
            >
              404
            </span>

            <p className="mb-2 font-mono text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.2em] text-[color:var(--lkv-secondary)] md:text-[length:var(--lkv-text-caption-1)]">
              Sentier introuvable
            </p>

            <h1 className="mb-2 font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] md:mb-3 md:text-[length:var(--lkv-text-title-lg)]">
              Cette page n&apos;existe pas
            </h1>

            <p className="mb-6 text-[length:var(--lkv-text-caption-1)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)] md:mb-8 md:text-[length:var(--lkv-text-footnote)]">
              Le sentier que vous cherchez a peut-être été balisé ailleurs, renommé ou n&apos;existe
              plus.
            </p>

            <div className="mb-6 flex justify-center gap-[var(--space-2)] md:mb-8 md:gap-[var(--space-3)]">
              <Button
                variant="secondary"
                icon={<Icon name="ArrowLeftIcon" size={16} variant="outline" />}
                onClick={handleGoBack}
                className="flex-1 md:flex-none"
              >
                Retour
              </Button>
              <Link href="/hub" className="flex-1 md:flex-none">
                <Button
                  icon={<Icon name="HomeIcon" size={16} variant="outline" />}
                  fullWidth
                >
                  Aller au Hub
                </Button>
              </Link>
            </div>

            <div className="border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-5)]">
              <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
                Points de repère
              </p>
              <div className="grid grid-cols-2 gap-[var(--space-2)]">
                {POPULAR_PAGES.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="flex min-h-[var(--lkv-touch-min)] items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption-1)] font-medium text-[color:var(--lkv-primary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
                  >
                    <Icon
                      name={page.icon}
                      size={14}
                      variant="outline"
                      className="text-[color:var(--lkv-secondary)]"
                    />
                    <span className="truncate">{page.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </MobilePageShell>
    </>
  );
}
