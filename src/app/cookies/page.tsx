'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CONSENT_COOKIE_KEY = 'lkdv_cookie_consent';
const CONSENT_VERSION = '1';

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
};

function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_COOKIE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeConsent(consent: Omit<ConsentState, 'version'>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    CONSENT_COOKIE_KEY,
    JSON.stringify({ ...consent, version: CONSENT_VERSION })
  );
  window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: consent }));
}

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

  return (
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
              {/* Nécessaires */}
              <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                <div>
                  <p className="font-medium text-foreground text-sm">🔒 Cookies nécessaires</p>
                  <p className="text-foreground/50 text-xs mt-0.5">Toujours actifs — exemptés de consentement (CNIL)</p>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full flex items-center justify-end pr-0.5 opacity-60 cursor-not-allowed">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>

              {/* Analytics */}
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
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>

              {/* Marketing */}
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
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSave}
                className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                {saved ? '✓ Préférences enregistrées' : 'Enregistrer mes choix'}
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 bg-foreground/8 hover:bg-foreground/15 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                Tout accepter
              </button>
              <button
                onClick={handleRejectAll}
                className="flex-1 border border-border hover:border-foreground/30 text-foreground/60 hover:text-foreground/80 px-4 py-2.5 rounded-xl text-sm transition-all"
              >
                Tout refuser
              </button>
            </div>
          </section>

          {/* Qu'est-ce qu'un cookie */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, smartphone, tablette) lors de la visite d&apos;un site web. Il permet au site de mémoriser des informations sur votre visite, comme votre langue préférée et d&apos;autres paramètres.
            </p>
            <p className="mt-3">
              Les cookies peuvent être déposés par le site que vous visitez (cookies « propriétaires ») ou par des tiers (cookies « tiers »). Ils peuvent être temporaires (cookies de session, supprimés à la fermeture du navigateur) ou persistants (conservés sur votre terminal pendant une durée déterminée).
            </p>
            <p className="mt-3">
              Conformément à l&apos;article 82 de la loi Informatique et Libertés et aux recommandations de la CNIL, certains cookies nécessitent votre consentement préalable avant d&apos;être déposés sur votre terminal.
            </p>
          </section>

          {/* Cookies utilisés */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Cookies utilisés sur lekitduvoyageur.fr</h2>

            {/* Nécessaires */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-foreground">🔒 Cookies nécessaires</span>
                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">Exemptés de consentement</span>
              </div>
              <p className="text-xs text-foreground/60 mb-3">
                Ces cookies sont indispensables au fonctionnement du site. Ils ne peuvent pas être désactivés. Ils ne collectent aucune information permettant de vous identifier à des fins publicitaires.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-foreground/5">
                      <th className="text-left p-2 text-foreground font-medium">Nom</th>
                      <th className="text-left p-2 text-foreground font-medium">Finalité</th>
                      <th className="text-left p-2 text-foreground font-medium">Durée</th>
                      <th className="text-left p-2 text-foreground font-medium">Émetteur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-2 font-mono">sb-*-auth-token</td>
                      <td className="p-2 text-foreground/60">Session d&apos;authentification Supabase</td>
                      <td className="p-2 text-foreground/60">Session / 7 jours</td>
                      <td className="p-2 text-foreground/60">lekitduvoyageur.fr</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono">lkdv_cookie_consent</td>
                      <td className="p-2 text-foreground/60">Mémorisation de vos préférences cookies</td>
                      <td className="p-2 text-foreground/60">6 mois</td>
                      <td className="p-2 text-foreground/60">lekitduvoyageur.fr</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono">__stripe_mid</td>
                      <td className="p-2 text-foreground/60">Prévention de la fraude (paiement)</td>
                      <td className="p-2 text-foreground/60">1 an</td>
                      <td className="p-2 text-foreground/60">stripe.com</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono">__stripe_sid</td>
                      <td className="p-2 text-foreground/60">Session de paiement sécurisée</td>
                      <td className="p-2 text-foreground/60">30 minutes</td>
                      <td className="p-2 text-foreground/60">stripe.com</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-foreground">📊 Cookies analytiques</span>
                <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">Consentement requis</span>
              </div>
              <p className="text-xs text-foreground/60 mb-3">
                Ces cookies nous permettent de mesurer l&apos;audience du site et d&apos;analyser le comportement des visiteurs afin d&apos;améliorer nos services. Les données collectées sont anonymisées (IP tronquée) et ne permettent pas de vous identifier personnellement.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-foreground/5">
                      <th className="text-left p-2 text-foreground font-medium">Nom</th>
                      <th className="text-left p-2 text-foreground font-medium">Finalité</th>
                      <th className="text-left p-2 text-foreground font-medium">Durée</th>
                      <th className="text-left p-2 text-foreground font-medium">Émetteur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-2 font-mono">_ga</td>
                      <td className="p-2 text-foreground/60">Distinguer les utilisateurs uniques (Google Analytics)</td>
                      <td className="p-2 text-foreground/60">13 mois</td>
                      <td className="p-2 text-foreground/60">google.com</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono">_ga_*</td>
                      <td className="p-2 text-foreground/60">Maintenir l&apos;état de session (Google Analytics 4)</td>
                      <td className="p-2 text-foreground/60">13 mois</td>
                      <td className="p-2 text-foreground/60">google.com</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono">_gid</td>
                      <td className="p-2 text-foreground/60">Distinguer les utilisateurs (24h)</td>
                      <td className="p-2 text-foreground/60">24 heures</td>
                      <td className="p-2 text-foreground/60">google.com</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-foreground/50">
                Google Analytics est configuré avec l&apos;anonymisation des adresses IP (<code>anonymize_ip: true</code>). Les données sont traitées par Google LLC (États-Unis) dans le cadre du Data Privacy Framework UE-États-Unis.
              </p>
            </div>

            {/* Marketing */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-foreground">🎯 Cookies marketing</span>
                <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">Consentement requis</span>
              </div>
              <p className="text-xs text-foreground/60 mb-3">
                Ces cookies permettent de vous proposer des publicités personnalisées en fonction de vos centres d&apos;intérêt. Ils peuvent être déposés par nos partenaires publicitaires.
              </p>
              <p className="text-xs text-foreground/50 italic">
                Aucun cookie marketing n&apos;est actuellement actif sur ce site. Cette catégorie est réservée pour une utilisation future.
              </p>
            </div>
          </section>

          {/* Durée de conservation */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Durée de conservation du consentement</h2>
            <p>
              Votre consentement (ou refus) est mémorisé pendant <strong>6 mois</strong> via le cookie <code className="text-xs bg-foreground/8 px-1 py-0.5 rounded">lkdv_cookie_consent</code>. À l&apos;expiration de ce délai, la bannière de consentement s&apos;affichera à nouveau pour recueillir vos préférences actualisées.
            </p>
            <p className="mt-3">
              Les cookies analytiques (Google Analytics) ont une durée de vie maximale de <strong>13 mois</strong>, conformément aux recommandations de la CNIL.
            </p>
          </section>

          {/* Comment gérer */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Comment gérer vos cookies</h2>
            <p className="mb-3">Vous pouvez gérer vos préférences de cookies de plusieurs façons :</p>
            <div className="space-y-3">
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground text-xs mb-1">Via notre gestionnaire de consentement</p>
                <p className="text-foreground/60 text-xs">Utilisez le panneau de gestion en haut de cette page ou la bannière cookies qui s&apos;affiche lors de votre première visite.</p>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground text-xs mb-1">Via les paramètres de votre navigateur</p>
                <p className="text-foreground/60 text-xs">
                  Vous pouvez configurer votre navigateur pour refuser tous les cookies ou être averti avant d&apos;en accepter un.
                  Attention : le blocage de certains cookies peut affecter le fonctionnement du site (authentification, panier).
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { name: 'Chrome', url: 'https://support.google.com/chrome/answer/95647' },
                    { name: 'Firefox', url: 'https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent' },
                    { name: 'Safari', url: 'https://support.apple.com/fr-fr/guide/safari/sfri11471/mac' },
                    { name: 'Edge', url: 'https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09' },
                  ].map((browser) => (
                    <a
                      key={browser.name}
                      href={browser.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded-lg"
                    >
                      {browser.name} →
                    </a>
                  ))}
                </div>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground text-xs mb-1">Opt-out Google Analytics</p>
                <p className="text-foreground/60 text-xs">
                  Vous pouvez également désactiver Google Analytics via l&apos;extension officielle :{' '}
                  <a href="https://tools.google.com/dlpage/gaoptout" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    tools.google.com/dlpage/gaoptout
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Transferts hors UE */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Transferts de données hors Union Européenne</h2>
            <p>
              Google Analytics implique un transfert de données vers les États-Unis. Ce transfert est encadré par le <strong>Data Privacy Framework UE-États-Unis</strong> (décision d&apos;adéquation de la Commission européenne du 10 juillet 2023) et par des Clauses Contractuelles Types (CCT).
            </p>
            <p className="mt-3">
              Google Analytics est configuré avec l&apos;anonymisation des adresses IP, ce qui réduit le volume de données personnelles transférées.
            </p>
          </section>

          {/* Contact DPO */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Contact — Délégué à la Protection des Données (DPO)</h2>
            <p>
              Pour toute question relative à l&apos;utilisation des cookies ou pour exercer vos droits, contactez notre DPO :
            </p>
            <div className="mt-3 bg-foreground/3 rounded-xl p-4">
              <p><strong className="text-foreground">Email DPO :</strong> <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a></p>
              <p className="mt-1"><strong className="text-foreground">CNIL :</strong> <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a> — 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07</p>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
            <Link href="/politique-confidentialite" className="text-primary hover:underline text-xs">Politique de confidentialité</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/mentions-legales" className="text-primary hover:underline text-xs">Mentions légales</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgv" className="text-primary hover:underline text-xs">CGV</Link>
          </div>

          <p className="text-xs text-foreground/40">
            Dernière mise à jour : juillet 2026 — Version 1.0
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
