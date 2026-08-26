'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
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

  const desktopContent = (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Cookies & Traceurs
        </p>
        <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Politique de gestion des cookies
        </h1>
        <p className="text-sm text-foreground/50 mb-10">
          Conformément aux recommandations de la CNIL (délibération n° 2020-091 du 17 septembre 2020) et à l&apos;article 82 de la loi Informatique et Libertés
        </p>

        <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">
          {/* Gestion des préférences */}
          <section className="bg-foreground/3 border border-border rounded-2xl p-5">
            <h2 className="text-base font-semibold text-foreground mb-1">Gérer mes préférences</h2>
            <p className="text-xs text-foreground/50 mb-5">
              {hasConsent ? 'Vos préférences actuelles sont affichées ci-dessous. Vous pouvez les modifier à tout moment.' : 'Vous n\'avez pas encore défini vos préférences.'}
            </p>

            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                <div>
                  <p className="font-medium text-foreground text-sm">🔒 Cookies nécessaires</p>
                  <p className="text-foreground/50 text-xs mt-0.5">Toujours actifs — exemptés de consentement (CNIL)</p>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full flex items-center justify-end pr-0.5 opacity-60 cursor-not-allowed">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                <div>
                  <p className="font-medium text-foreground text-sm">📊 Cookies analytiques</p>
                  <p className="text-foreground/50 text-xs mt-0.5">Google Analytics — mesure d&apos;audience anonymisée</p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`w-10 h-5 rounded-full flex items-center transition-all ${analytics ? 'bg-primary justify-end pr-0.5' : 'bg-foreground/15 justify-start pl-0.5'}`}
                  aria-pressed={analytics}
                  aria-label="Activer ou désactiver les cookies analytiques"
                >
                  <div className="w-4 h-4 bg-white rounded-full " />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                <div>
                  <p className="font-medium text-foreground text-sm">🎯 Cookies marketing</p>
                  <p className="text-foreground/50 text-xs mt-0.5">Publicités personnalisées et remarketing</p>
                </div>
                <button
                  onClick={() => setMarketing(!marketing)}
                  className={`w-10 h-5 rounded-full flex items-center transition-all ${marketing ? 'bg-primary justify-end pr-0.5' : 'bg-foreground/15 justify-start pl-0.5'}`}
                  aria-pressed={marketing}
                  aria-label="Activer ou désactiver les cookies marketing"
                >
                  <div className="w-4 h-4 bg-white rounded-full " />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                {saved ? '✓ Préférences enregistrées' : 'Enregistrer mes choix'}
              </button>
              <button onClick={handleAcceptAll} className="flex-1 bg-foreground/8 hover:bg-foreground/15 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium transition-all">Tout accepter</button>
              <button onClick={handleRejectAll} className="flex-1 border border-border hover:border-foreground/30 text-foreground/60 hover:text-foreground/80 px-4 py-2.5 rounded-xl text-sm transition-all">Tout refuser</button>
            </div>
          </section>

          <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Qu&apos;est-ce qu&apos;un cookie ?</h2><p>Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite d&apos;un site web. Il permet au site de mémoriser des informations sur votre visite.</p></section>

          <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Cookies utilisés</h2>
            <p className="mb-4">Cookies nécessaires (exemptés de consentement) : sb-*-auth-token (session), lkdv_cookie_consent (6 mois), __stripe_mid (1 an), __stripe_sid (30 min).</p>
            <p className="mb-4">Cookies analytiques (consentement requis) : _ga (13 mois), _ga_* (13 mois), _gid (24h) — Google Analytics avec anonymisation IP.</p>
            <p>Cookies marketing : aucun actif actuellement.</p>
          </section>

          <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Durée de conservation</h2><p>Votre consentement est mémorisé pendant 6 mois. Les cookies Google Analytics ont une durée maximale de 13 mois.</p></section>

          <section><h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Contact DPO</h2><p>Email : <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a></p></section>

          <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
            <Link href="/politique-confidentialite" className="text-primary hover:underline text-xs">Politique de confidentialité</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/mentions-legales" className="text-primary hover:underline text-xs">Mentions légales</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgv" className="text-primary hover:underline text-xs">CGV</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );

  const mobileContent = (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Cookies & Traceurs</p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#17402C', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Politique de gestion des cookies</h1>
      <p style={{ fontSize: '12px', color: 'rgba(23,64,44,0.5)', marginBottom: '24px' }}>Conformément aux recommandations de la CNIL</p>

      <div style={{ background: '#F4F1EA', borderRadius: '16px', border: '1px solid rgba(23,64,44,0.06)', padding: '16px', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#17402C', marginBottom: '4px' }}>Gérer mes préférences</p>
        <p style={{ fontSize: '12px', color: 'rgba(23,64,44,0.5)', marginBottom: '16px' }}>
          {hasConsent ? 'Vos préférences sont définies.' : 'Vous n\'avez pas encore défini vos préférences.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(23,64,44,0.06)' }}>
            <div><p style={{ fontSize: '13px', fontWeight: 500, color: '#17402C' }}>🔒 Cookies nécessaires</p><p style={{ fontSize: '11px', color: 'rgba(23,64,44,0.5)' }}>Toujours actifs</p></div>
            <div style={{ width: '36px', height: '18px', background: '#17402C', borderRadius: '36px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '2px', opacity: 0.6 }}>
              <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(23,64,44,0.06)' }}>
            <div><p style={{ fontSize: '13px', fontWeight: 500, color: '#17402C' }}>📊 Cookies analytiques</p></div>
            <button onClick={() => setAnalytics(!analytics)} style={{ width: '36px', height: '18px', borderRadius: '36px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', background: analytics ? '#17402C' : 'rgba(23,64,44,0.15)', justifyContent: analytics ? 'flex-end' : 'flex-start', padding: analytics ? '0 2px 0 0' : '0 0 0 2px', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(23,64,44,0.06)' }}>
            <div><p style={{ fontSize: '13px', fontWeight: 500, color: '#17402C' }}>🎯 Cookies marketing</p></div>
            <button onClick={() => setMarketing(!marketing)} style={{ width: '36px', height: '18px', borderRadius: '36px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', background: marketing ? '#17402C' : 'rgba(23,64,44,0.15)', justifyContent: marketing ? 'flex-end' : 'flex-start', padding: marketing ? '0 2px 0 0' : '0 0 0 2px', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={handleSave} style={{ background: '#17402C', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{saved ? '✓ Préférences enregistrées' : 'Enregistrer mes choix'}</button>
          <button onClick={handleAcceptAll} style={{ background: 'rgba(23,64,44,0.06)', color: '#17402C', border: 'none', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Tout accepter</button>
          <button onClick={handleRejectAll} style={{ background: 'transparent', color: 'rgba(23,64,44,0.6)', border: '1px solid rgba(23,64,44,0.06)', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}>Tout refuser</button>
        </div>
      </div>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#17402C', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(23,64,44,0.06)' }}>1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
        <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.8)', lineHeight: '1.6' }}>Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite d&apos;un site web.</p>
      </section>
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#17402C', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(23,64,44,0.06)' }}>2. Cookies utilisés</h2>
        <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.8)', lineHeight: '1.6' }}>Cookies nécessaires : session, préférences, Stripe. Cookies analytics (avec consentement) : Google Analytics, 13 mois max. Cookies marketing : aucun actif.</p>
      </section>
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#17402C', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(23,64,44,0.06)' }}>3. Contact DPO</h2>
        <p style={{ fontSize: '13px', color: 'rgba(23,64,44,0.8)', lineHeight: '1.6' }}><a href="mailto:dpo@lekitduvoyageur.fr" style={{ color: '#17402C', textDecoration: 'underline' }}>dpo@lekitduvoyageur.fr</a></p>
      </section>
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
