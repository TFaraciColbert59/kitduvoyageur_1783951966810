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
        className="pointer-events-none max-w-[min(42rem,calc(100vw-24px))] mx-auto bg-[#17402C] border border-white/10 rounded-2xl  overflow-hidden transition-all duration-300"
        style={{
          margin: '0 auto',
          marginBottom: 'calc(68px + env(safe-area-inset-bottom))',
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
          <div className="px-4 py-3 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#17402C]/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-[#17402C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.955 11.955 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.017-.5-3.92-1.382-5.593" />
                </svg>
              </div>
              <p id="cookie-banner-desc" className="flex-1 min-w-0 text-white/60 text-[11px] leading-snug pointer-events-auto">
                Cookies nécessaires + analytiques avec votre accord.{' '}
                <Link href="/cookies" className="text-[#A8C8A0] hover:text-white hover:underline underline-offset-2">
                  En savoir plus
                </Link>
              </p>
              <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
                <button
                  onClick={acceptAll}
                  className="bg-[#17402C] hover:bg-[#113021] text-white px-3 py-2 rounded-xl text-[11px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#17402C] min-h-[36px] flex items-center justify-center"
                >
                  Tout accepter
                </button>
                <button
                  onClick={rejectAll}
                  className="bg-white/[0.08] hover:bg-white/15 text-white/85 px-3 py-2 rounded-xl text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[36px] flex items-center justify-center"
                >
                  Refuser
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="border border-white/15 hover:border-white/30 text-white/60 hover:text-white/90 px-2.5 py-2 rounded-xl text-[11px] transition-all focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[36px] flex items-center justify-center"
                  aria-label="Gérer mes préférences cookies"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V6a1 1 0 0 1 1-1zM12 12a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0v-5a1 1 0 0 1 1-1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
) : (
          <div className="p-4 sm:p-5 pointer-events-auto">
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
                  className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-1 focus:ring-offset-[#17402C] ${analytics ? 'bg-[#17402C] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={analytics}
                  aria-label="Activer les cookies analytiques"
                >
                  <div className="w-4 h-4 bg-white rounded-full " />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-white text-xs font-medium">🎯 Marketing</p>
                  <p className="text-white/40 text-[10px] mt-0.5">Publicités personnalisées</p>
                </div>
                <button
                  onClick={() => setMarketing(!marketing)}
                  className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-1 focus:ring-offset-[#17402C] ${marketing ? 'bg-[#17402C] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={marketing}
                  aria-label="Activer les cookies marketing"
                >
                  <div className="w-4 h-4 bg-white rounded-full " />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCustom}
                className="flex-1 bg-[#17402C] hover:bg-[#cc3d10] text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#17402C] focus:ring-offset-2 focus:ring-offset-[#17402C] min-h-[44px]"
              >
                Enregistrer
              </button>
              <button
                onClick={rejectAll}
                className="border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 px-3 py-2 rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#17402C] min-h-[44px]"
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
