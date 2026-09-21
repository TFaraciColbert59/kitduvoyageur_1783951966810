'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Card, Section, Switch } from '@/components/ui';
import { getStoredConsent, storeConsent } from '@/lib/cookieConsent';

export default function CookiesPage() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
      setHasConsent(true);
    }
  }, []);

  const handleSave = () => {
    storeConsent({ necessary: true, analytics, marketing });
    setSaved(true);
    setHasConsent(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAcceptAll = () => {
    setAnalytics(true);
    setMarketing(true);
    storeConsent({ necessary: true, analytics: true, marketing: true });
    setSaved(true);
    setHasConsent(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRejectAll = () => {
    setAnalytics(false);
    setMarketing(false);
    storeConsent({ necessary: true, analytics: false, marketing: false });
    setSaved(true);
    setHasConsent(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const preferences = (
    <Card variant="compact" className="bg-[color:var(--lkv-surface-muted)] p-[var(--space-5)]">
      <h2 className="mb-1 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
        Gérer mes préférences
      </h2>
      <p className="mb-[var(--space-5)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
        {hasConsent
          ? 'Vos préférences actuelles sont affichées ci-dessous. Vous pouvez les modifier à tout moment.'
          : "Vous n'avez pas encore défini vos préférences."}
      </p>

      <div className="mb-[var(--space-5)] space-y-[var(--space-3)]">
        <div className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] p-[var(--space-3)]">
          <div>
            <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">
              Cookies nécessaires
            </p>
            <p className="mt-0.5 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
              Toujours actifs — exemptés de consentement (CNIL)
            </p>
          </div>
          <Switch
            checked
            disabled
            onCheckedChange={() => undefined}
            aria-label="Cookies nécessaires, toujours actifs"
          />
        </div>

        <div className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] p-[var(--space-3)]">
          <div>
            <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">
              Cookies analytiques
            </p>
            <p className="mt-0.5 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
              Google Analytics — mesure d&apos;audience anonymisée
            </p>
          </div>
          <Switch
            checked={analytics}
            onCheckedChange={setAnalytics}
            aria-label="Activer ou désactiver les cookies analytiques"
          />
        </div>

        <div className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] p-[var(--space-3)]">
          <div>
            <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">
              Cookies marketing
            </p>
            <p className="mt-0.5 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
              Publicités personnalisées et remarketing
            </p>
          </div>
          <Switch
            checked={marketing}
            onCheckedChange={setMarketing}
            aria-label="Activer ou désactiver les cookies marketing"
          />
        </div>
      </div>

      <div className="flex flex-col gap-[var(--space-2)] sm:flex-row">
        <Button onClick={handleSave} fullWidth>
          {saved ? 'Préférences enregistrées' : 'Enregistrer mes choix'}
        </Button>
        <Button variant="secondary" onClick={handleAcceptAll} fullWidth>
          Tout accepter
        </Button>
        <Button variant="ghost" onClick={handleRejectAll} fullWidth>
          Tout refuser
        </Button>
      </div>
    </Card>
  );

  const sections = (
    <>
      <Section spacing="sm">
        <h2 className="mb-[var(--space-3)] border-b border-[color:var(--lkv-border)] pb-2 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
          1. Qu&apos;est-ce qu&apos;un cookie ?
        </h2>
        <p className="text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
          Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite d&apos;un
          site web. Il permet au site de mémoriser des informations sur votre visite.
        </p>
      </Section>
      <Section spacing="sm">
        <h2 className="mb-[var(--space-3)] border-b border-[color:var(--lkv-border)] pb-2 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
          2. Cookies utilisés
        </h2>
        <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
          Cookies nécessaires (exemptés de consentement) : sb-*-auth-token (session),
          lkdv_cookie_consent (6 mois), __stripe_mid (1 an), __stripe_sid (30 min).
        </p>
        <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
          Cookies analytiques (consentement requis) : _ga (13 mois), _ga_* (13 mois), _gid (24h) —
          Google Analytics avec anonymisation IP.
        </p>
        <p className="text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
          Cookies marketing : aucun actif actuellement.
        </p>
      </Section>
      <Section spacing="sm">
        <h2 className="mb-[var(--space-3)] border-b border-[color:var(--lkv-border)] pb-2 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
          3. Durée de conservation
        </h2>
        <p className="text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">
          Votre consentement est mémorisé pendant 6 mois. Les cookies Google Analytics ont une durée
          maximale de 13 mois.
        </p>
      </Section>
      <Section spacing="sm">
        <h2 className="mb-[var(--space-3)] border-b border-[color:var(--lkv-border)] pb-2 text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
          4. Contact DPO
        </h2>
        <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
          Email :{' '}
          <a
            href="mailto:dpo@lekitduvoyageur.fr"
            className="text-[color:var(--lkv-primary)] underline"
          >
            dpo@lekitduvoyageur.fr
          </a>
        </p>
      </Section>
    </>
  );

  const legalNav = (
    <div className="flex flex-wrap gap-[var(--space-3)] border-t border-[color:var(--lkv-border)] pt-[var(--space-5)]">
      <Link href="/politique-confidentialite" className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)] hover:underline">
        Politique de confidentialité
      </Link>
      <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">·</span>
      <Link href="/mentions-legales" className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)] hover:underline">
        Mentions légales
      </Link>
      <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">·</span>
      <Link href="/cgu" className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)] hover:underline">
        CGU
      </Link>
      <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">·</span>
      <Link href="/cgv" className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)] hover:underline">
        CGV
      </Link>
    </div>
  );

  const desktopContent = (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <p className="mb-3 font-mono text-[length:var(--lkv-text-caption-1)] uppercase tracking-widest text-[color:var(--lkv-primary)]">
          Cookies &amp; Traceurs
        </p>
        <h1 className="mb-2 font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-text-primary)]">
          Politique de gestion des cookies
        </h1>
        <p className="mb-10 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Conformément aux recommandations de la CNIL (délibération n° 2020-091 du 17 septembre 2020)
          et à l&apos;article 82 de la loi Informatique et Libertés
        </p>

        <div className="flex flex-col gap-[var(--space-8)]">
          {preferences}
          {sections}
          {legalNav}
        </div>
      </main>
      <Footer />
    </div>
  );

  const mobileContent = (
    <div className="p-[var(--space-4)]">
      <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--lkv-primary)]">
        Cookies &amp; Traceurs
      </p>
      <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-primary)]">
        Politique de gestion des cookies
      </h1>
      <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
        Conformément aux recommandations de la CNIL
      </p>
      <div className="mb-[var(--space-6)]">{preferences}</div>
      {sections}
      {legalNav}
    </div>
  );

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">{desktopContent}</div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>{mobileContent}</MobilePageShell>
      </div>
    </>
  );
}
