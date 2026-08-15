'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredConsent, storeConsent, CONSENT_VERSION } from '@/lib/cookieConsent';

export { useCookieConsent } from '@/lib/cookieConsent';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored || stored.version !== CONSENT_VERSION) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    storeConsent({ necessary: true, analytics: true, marketing: true });
    setVisible(false);
  };

  const rejectAll = () => {
    storeConsent({ necessary: true, analytics: false, marketing: false });
    setVisible(false);
  };

  const saveCustom = () => {
    storeConsent({ necessary: true, analytics, marketing });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    // Non-modal: no aria-modal, no backdrop overlay, pointer-events only on the banner itself
    <div
      role="region"
      aria-label="Gestion des cookies"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-0 left-0 right-0 z-[60] pointer-events-none"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      <div
        className="pointer-events-auto max-w-[min(42rem,calc(100vw-24px))] mx-auto bg-[#1C2620] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          margin: '0 auto',
          marginBottom: 'calc(72px + env(safe-area-inset-bottom))',
        }}
      >
        <style jsx>{`
          @media (min-width: 640px) {
            div {
              margin-bottom: calc(16px + env(safe-area-inset-bottom)) !important;
            }
          }
        `}</style>
        {!showDetails ? (
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#17402C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-[#17402C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.017-.5-3.92-1.382-5.593" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white text-sm mb-0.5">Nous respectons votre vie privée</h2>
                <p id="cookie-banner-desc" className="text-white/60 text-xs leading-relaxed">
                  Cookies nécessaires au fonctionnement + cookies analytiques (Google Analytics) avec votre accord.{' '}
                  <Link href="/cookies" className="text-[#A8C8A0] hover:text-white hover:underline underline-offset-2">
                    En savoir plus
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={acceptAll}
                className="w-full sm:flex-1 bg-[#17402C] hover:bg-[#113021] text-white px-3 py-2.5 rounded-xl text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-2 focus:ring-offset-[#1C2620] min-h-[44px] flex items-center justify-center text-center"
              >
                Tout accepter
              </button>
              <div className="flex gap-2 w-full sm:w-auto sm:flex-1">
                <button
                  onClick={rejectAll}
                  className="flex-1 bg-white/[0.08] hover:bg-white/15 text-white/85 px-3 py-2.5 rounded-xl text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#1C2620] min-h-[44px] flex items-center justify-center text-center"
                >
                  Refuser
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="flex-1 border border-white/15 hover:border-white/30 text-white/60 hover:text-white/90 px-3 py-2.5 rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#1C2620] min-h-[44px] flex items-center justify-center text-center"
                >
                  Gérer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setShowDetails(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
                aria-label="Retour"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-semibold text-white text-sm">Personnaliser mes préférences</h2>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-white text-xs font-medium">🔒 Nécessaires</p>
                  <p className="text-white/40 text-[10px] mt-0.5">Authentification, panier — toujours actifs</p>
                </div>
                <div className="w-9 h-5 bg-[#17402C] rounded-full flex items-center justify-end pr-0.5 cursor-not-allowed opacity-60 flex-shrink-0">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-white text-xs font-medium">📊 Analytiques</p>
                  <p className="text-white/40 text-[10px] mt-0.5">Google Analytics — audience anonymisée</p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-1 focus:ring-offset-[#1C2620] ${analytics ? 'bg-[#17402C] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={analytics}
                  aria-label="Activer les cookies analytiques"
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-white text-xs font-medium">🎯 Marketing</p>
                  <p className="text-white/40 text-[10px] mt-0.5">Publicités personnalisées</p>
                </div>
                <button
                  onClick={() => setMarketing(!marketing)}
                  className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-1 focus:ring-offset-[#1C2620] ${marketing ? 'bg-[#17402C] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={marketing}
                  aria-label="Activer les cookies marketing"
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCustom}
                className="flex-1 bg-[#17402C] hover:bg-[#cc3d10] text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-2 focus:ring-offset-[#1C2620] min-h-[44px]"
              >
                Enregistrer
              </button>
              <button
                onClick={rejectAll}
                className="border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 px-3 py-2 rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#1C2620] min-h-[44px]"
              >
                Tout refuser
              </button>
            </div>

            <p className="text-white/25 text-[10px] text-center mt-2">
              <Link href="/cookies" className="hover:text-white/50 transition-colors">Politique cookies</Link>
              {' · '}
              <Link href="/politique-confidentialite" className="hover:text-white/50 transition-colors">Confidentialité</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
