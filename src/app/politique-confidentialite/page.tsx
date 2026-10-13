import MarketplacePrivacyNotice from '@/components/legal/MarketplacePrivacyNotice';
import { PRIVACY_UPDATED_AT, privacySections } from '@/components/legal/PrivacyPolicySections';
import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppShell from '@/components/shell/AppShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Politique de confidentialité | Le Kit du Voyageur',
  description:
    'Politique de confidentialité et traitement des données personnelles — RGPD Art. 13 et 14. Le Kit du Voyageur.',
};

function MobilePCContent() {
  const s = 'mb-[var(--space-6)]';
  const h2 =
    'mb-[var(--space-2)] border-b border-[color:var(--lkv-border-subtle)] pb-1.5 text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';
  const p =
    'text-[length:var(--lkv-text-caption-1)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-primary)]/80';
  const link =
    'text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)] underline';
  return (
    <div className="p-[var(--space-4)]">
      <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--lkv-text-primary)]">
        RGPD · Données personnelles
      </p>
      <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-text-primary)]">
        Politique de confidentialité
      </h1>
      <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]/50">
        Conformément au RGPD (UE) 2016/679 et à la loi Informatique et Libertés
      </p>

      <MarketplacePrivacyNotice />
      <p className={`${p} mb-[var(--space-4)]`}>Dernière mise à jour : {PRIVACY_UPDATED_AT}.</p>
      {privacySections(link).map((section) => (
        <section key={section.title} className={s}>
          <h2 className={h2}>{section.title}</h2>
          <div className={p}>{section.body}</div>
        </section>
      ))}

      <div className="flex flex-wrap gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)]">
        <Link href="/mentions-legales" className={link}>
          Mentions légales
        </Link>
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]/20">
          ·
        </span>
        <Link href="/cgu" className={link}>
          CGU
        </Link>
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]/20">
          ·
        </span>
        <Link href="/cgv" className={link}>
          CGV
        </Link>
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]/20">
          ·
        </span>
        <Link href="/cookies" className={link}>
          Cookies
        </Link>
      </div>
    </div>
  );
}

export default function PolitiqueConfidentialitePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Politique de confidentialit\u00e9 — Le Kit du Voyageur',
    description:
      'Politique de confidentialit\u00e9 et traitement des donn\u00e9es personnelles — RGPD.',
    url: `${siteUrl}/politique-confidentialite`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Politique de confidentialit\u00e9',
        item: `${siteUrl}/politique-confidentialite`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        suppressHydrationWarning
      />
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
            <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3">
              RGPD · Données personnelles
            </p>
            <h1 className="font-display text-3xl text-foreground mb-2" font-extrabold>
              Politique de confidentialité
            </h1>
            <p className="text-sm text-foreground/50 mb-10">
              Conformément au Règlement (UE) 2016/679 (RGPD), articles 13 et 14 — Loi Informatique
              et Libertés n° 78-17 du 6 janvier 1978 modifiée
            </p>
            <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">
              <MarketplacePrivacyNotice />
              <p className="text-foreground/50">Dernière mise à jour : {PRIVACY_UPDATED_AT}.</p>
              {privacySections('text-primary hover:underline').map((section) => (
                <section key={section.title}>
                  <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    {section.title}
                  </h2>
                  {section.body}
                </section>
              ))}
              <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
                <Link href="/mentions-legales" className="text-primary hover:underline text-xs">
                  Mentions légales
                </Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/cgu" className="text-primary hover:underline text-xs">
                  CGU
                </Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/cgv" className="text-primary hover:underline text-xs">
                  CGV
                </Link>
                <span className="text-foreground/20 text-xs">·</span>
                <Link href="/cookies" className="text-primary hover:underline text-xs">
                  Cookies
                </Link>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <AppShell>
          <MobilePCContent />
        </AppShell>
      </div>
    </>
  );
}
