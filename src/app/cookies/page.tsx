'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';

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
  localStorage.setItem(CONSENT_COOKIE_KEY, JSON.stringify({ ...consent, version: CONSENT_VERSION }));
  window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: consent }));
}

export default function CookiesPage() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) { setAnalytics(stored.analytics); setMarketing(stored.marketing); setHasConsent(true); }
  }, []);

  const handleSave = () => { storeConsent({ necessary: true, analytics, marketing }); setSaved(true); setHasConsent(true); setTimeout(() => setSaved(false), 3000); };
  const handleAcceptAll = () => { setAnalytics(true); setMarketing(true); storeConsent({ necessary: true, analytics: true, marketing: true }); setSaved(true); setHasConsent(true); setTimeout(() => setSaved(false), 3000); };
  const handleRejectAll = () => { setAnalytics(false); setMarketing(false); storeConsent({ necessary: true, analytics: false, marketing: false }); setSaved(true); setHasConsent(true); setTimeout(() => setSaved(false), 3000); };

  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) => (
    <button onClick={onChange} className="w-11 h-6 rounded-full flex items-center transition-all flex-shrink-0" aria-pressed={value} aria-label={label}
      style={{ background: value ? '#4A6741' : '#C8C3B0', justifyContent: value ? 'flex-end' : 'flex-start', padding: '2px' }}>
      <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
    </button>
  );

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="flex items-center gap-2 text-xs font-mono mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <a href="/" className="hover:text-white transition-colors">Accueil</a>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Cookies</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: '#4A6741' }}>Cookies & Traceurs</p>
          <h1 className="font-display text-4xl text-white mb-2" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Politique de gestion<br />des cookies
          </h1>
          <p className="text-sm text-white/50">
            Conformément aux recommandations de la CNIL (délibération n° 2020-091 du 17 septembre 2020)
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#5C6B5E' }}>

          {/* Preferences panel */}
          <section className="rounded-2xl p-7" style={{ background: '#fff', border: '2px solid #4A6741' }}>
            <h2 className="text-base font-semibold mb-1" style={{ color: '#1C2620' }}>Gérer mes préférences</h2>
            <p className="text-xs mb-6" style={{ color: '#7A7A6E' }}>
              {hasConsent ? 'Vos préférences actuelles sont affichées ci-dessous. Vous pouvez les modifier à tout moment.' : 'Vous n\'avez pas encore défini vos préférences.'}
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F5F2EC', border: '1px solid #E8E4DA' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#1C2620' }}>🔒 Cookies nécessaires</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7A7A6E' }}>Toujours actifs — exemptés de consentement (CNIL)</p>
                </div>
                <div className="w-11 h-6 rounded-full flex items-end justify-end p-0.5 opacity-50 cursor-not-allowed" style={{ background: '#4A6741' }}>
                  <div className="w-5 h-5 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F5F2EC', border: '1px solid #E8E4DA' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#1C2620' }}>📊 Cookies analytiques</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7A7A6E' }}>Google Analytics — mesure d&apos;audience anonymisée</p>
                </div>
                <Toggle value={analytics} onChange={() => setAnalytics(!analytics)} label="Activer ou désactiver les cookies analytiques" />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F5F2EC', border: '1px solid #E8E4DA' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#1C2620' }}>🎯 Cookies marketing</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7A7A6E' }}>Publicités personnalisées et remarketing</p>
                </div>
                <Toggle value={marketing} onChange={() => setMarketing(!marketing)} label="Activer ou désactiver les cookies marketing" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: '#1C2620', color: '#fff' }}>
                {saved ? '✓ Préférences enregistrées' : 'Enregistrer mes choix'}
              </button>
              <button onClick={handleAcceptAll} className="flex-1 py-3 rounded-xl text-sm font-medium transition-all" style={{ background: '#4A6741', color: '#fff' }}>
                Tout accepter
              </button>
              <button onClick={handleRejectAll} className="flex-1 py-3 rounded-xl text-sm transition-all" style={{ border: '1px solid #C8C3B0', color: '#5C6B5E' }}>
                Tout refuser
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p>Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite d&apos;un site web. Il permet au site de mémoriser des informations sur votre visite, comme votre langue préférée et d&apos;autres paramètres. Conformément à l&apos;article 82 de la loi Informatique et Libertés et aux recommandations de la CNIL, certains cookies nécessitent votre consentement préalable avant d&apos;être déposés sur votre terminal.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>2. Cookies utilisés sur lekitduvoyageur.fr</h2>
            {[
              {
                title: '🔒 Cookies nécessaires',
                badge: 'Exemptés de consentement',
                badgeColor: '#4A6741',
                desc: 'Ces cookies sont indispensables au fonctionnement du site. Ils ne peuvent pas être désactivés.',
                rows: [
                  ['sb-*-auth-token', 'Session d\'authentification Supabase', 'Session / 7 jours', 'lekitduvoyageur.fr'],
                  ['lkdv_cookie_consent', 'Mémorisation de vos préférences cookies', '6 mois', 'lekitduvoyageur.fr'],
                  ['__stripe_mid', 'Prévention de la fraude (paiement)', '1 an', 'stripe.com'],
                  ['__stripe_sid', 'Session de paiement sécurisée', '30 minutes', 'stripe.com'],
                ],
              },
              {
                title: '📊 Cookies analytiques',
                badge: 'Consentement requis',
                badgeColor: '#E4501C',
                desc: 'Ces cookies nous permettent de mesurer l\'audience du site et d\'analyser le comportement des visiteurs. Les données collectées sont anonymisées.',
                rows: [
                  ['_ga', 'Identifiant visiteur unique Google Analytics', '2 ans', 'google.com'],
                  ['_ga_*', 'Persistance de session Google Analytics 4', '2 ans', 'google.com'],
                  ['_gid', 'Identifiant de session Google Analytics', '24 heures', 'google.com'],
                ],
              },
              {
                title: '🎯 Cookies marketing',
                badge: 'Consentement requis',
                badgeColor: '#E4501C',
                desc: 'Ces cookies permettent d\'afficher des publicités personnalisées et de mesurer l\'efficacité des campagnes publicitaires.',
                rows: [
                  ['_fbp', 'Suivi des conversions Facebook Ads', '3 mois', 'facebook.com'],
                  ['_gcl_au', 'Suivi des conversions Google Ads', '3 mois', 'google.com'],
                ],
              },
            ].map((group) => (
              <div key={group.title} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: '#1C2620' }}>{group.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: group.badgeColor }}>{group.badge}</span>
                </div>
                <p className="text-xs mb-3" style={{ color: '#7A7A6E' }}>{group.desc}</p>
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E8E4DA' }}>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: '#F5F2EC' }}>
                        {['Nom', 'Finalité', 'Durée', 'Émetteur'].map((h) => (
                          <th key={h} className="text-left p-3 font-medium" style={{ color: '#1C2620' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(([name, finalite, duree, emetteur]) => (
                        <tr key={name} style={{ borderTop: '1px solid #E8E4DA' }}>
                          <td className="p-3 font-mono" style={{ color: '#1C2620' }}>{name}</td>
                          <td className="p-3" style={{ color: '#5C6B5E' }}>{finalite}</td>
                          <td className="p-3" style={{ color: '#5C6B5E' }}>{duree}</td>
                          <td className="p-3" style={{ color: '#5C6B5E' }}>{emetteur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>3. Comment gérer les cookies dans votre navigateur ?</h2>
            <p className="mb-4">Vous pouvez également configurer votre navigateur pour refuser les cookies. Voici les liens vers les paramètres des principaux navigateurs :</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: 'Chrome', url: 'https://support.google.com/chrome/answer/95647' },
                { name: 'Firefox', url: 'https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent' },
                { name: 'Safari', url: 'https://support.apple.com/fr-fr/guide/safari/sfri11471/mac' },
                { name: 'Edge', url: 'https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09' },
                { name: 'Opera', url: 'https://help.opera.com/en/latest/web-preferences/#cookies' },
              ].map((browser) => (
                <a key={browser.name} href={browser.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all hover:shadow-sm"
                  style={{ background: '#fff', border: '1px solid #E8E4DA', color: '#1C2620' }}>
                  {browser.name} →
                </a>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>4. Durée de conservation des cookies</h2>
            <p>La durée de conservation des cookies varie selon leur type. Les cookies de session sont supprimés à la fermeture du navigateur. Les cookies persistants sont conservés pendant la durée indiquée dans le tableau ci-dessus, dans la limite de 13 mois conformément aux recommandations de la CNIL.</p>
          </section>

          <div className="flex flex-wrap gap-3 pt-6" style={{ borderTop: '1px solid #E8E4DA' }}>
            {[{ href: '/politique-confidentialite', label: 'Politique de confidentialité' }, { href: '/mentions-legales', label: 'Mentions légales' }, { href: '/cgu', label: 'CGU' }, { href: '/contact', label: 'Contact DPO' }].map((link, i, arr) => (
              <React.Fragment key={link.href}>
                <Link href={link.href} className="text-xs hover:underline" style={{ color: '#4A6741' }}>{link.label}</Link>
                {i < arr.length - 1 && <span className="text-xs" style={{ color: '#C8C3B0' }}>·</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#9A9A8E' }}>Dernière mise à jour : juillet 2026</p>
        </div>
      </main>

      <NewFooterSection />
    </div>
  );
}
