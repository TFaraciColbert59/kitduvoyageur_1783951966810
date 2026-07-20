'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

const CONSENT_COOKIE_KEY = 'lkdv_cookie_consent';
const CONSENT_VERSION = '1';

function getStoredConsent(): (ConsentState & { version: string }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_COOKIE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeConsent(consent: ConsentState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    CONSENT_COOKIE_KEY,
    JSON.stringify({ ...consent, version: CONSENT_VERSION })
  );
  // Dispatch event so GoogleAnalytics component can react
  window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: consent }));
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      setConsent({ necessary: true, analytics: stored.analytics, marketing: stored.marketing });
    }
  }, []);

  return consent;
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored || stored.version !== CONSENT_VERSION) {
      setVisible(true);
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gestion des cookies"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6"
    >
      <div className="max-w-2xl mx-auto bg-[#1C2620] border border-white/10 rounded-2xl shadow-2xl p-5 sm:p-6">
        {!showDetails ? (
          <>
            <div className="flex items-start gap-3 mb-4">
              <Icon name="ShieldCheckIcon" size={20} variant="outline" className="text-[#E4501C] flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-white text-sm mb-1">Nous respectons votre vie privée</h2>
                <p className="text-white/55 text-xs leading-relaxed">
                  Nous utilisons des cookies pour le bon fonctionnement du site et, avec votre accord, pour mesurer notre audience (Google Analytics).
                  Aucune donnée n&apos;est vendue à des tiers.{' '}
                  <Link href="/politique-confidentialite" className="text-[#E4501C] hover:underline">
                    En savoir plus
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={acceptAll}
                className="flex-1 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Tout accepter
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 bg-white/8 hover:bg-white/15 text-white/70 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                Tout refuser
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 px-4 py-2.5 rounded-xl text-sm transition-all"
              >
                Personnaliser
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-white text-sm mb-4">Personnaliser mes préférences</h2>
            <div className="space-y-3 mb-5">
              {/* Necessary — always on */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Cookies nécessaires</p>
                  <p className="text-white/40 text-xs">Authentification, panier, sécurité — requis</p>
                </div>
                <div className="w-10 h-5 bg-[#E4501C] rounded-full flex items-center justify-end pr-0.5 cursor-not-allowed opacity-70">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Cookies analytiques</p>
                  <p className="text-white/40 text-xs">Google Analytics — mesure d&apos;audience anonymisée</p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`w-10 h-5 rounded-full flex items-center transition-all ${analytics ? 'bg-[#E4501C] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={analytics}
                  aria-label="Activer les cookies analytiques"
                >
                  <div className="w-4 h-4 bg-white rounded-full" />
                </button>
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div>
                  <p className="text-white text-sm font-medium">Cookies marketing</p>
                  <p className="text-white/40 text-xs">Publicités personnalisées</p>
                </div>
                <button
                  onClick={() => setMarketing(!marketing)}
                  className={`w-10 h-5 rounded-full flex items-center transition-all ${marketing ? 'bg-[#E4501C] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={marketing}
                  aria-label="Activer les cookies marketing"
                >
                  <div className="w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCustom}
                className="flex-1 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Enregistrer mes choix
              </button>
              <button
                onClick={() => setShowDetails(false)}
                className="border border-white/15 text-white/50 hover:text-white/80 px-4 py-2.5 rounded-xl text-sm transition-all"
              >
                Retour
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
