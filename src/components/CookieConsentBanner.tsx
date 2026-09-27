'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { getStoredConsent, storeConsent, CONSENT_VERSION } from '@/lib/cookieConsent';
import { isNative } from '@/lib/native/platform';

export { useCookieConsent } from '@/lib/cookieConsent';

// Pas d'avertissement "useLayoutEffect does nothing on the server".
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Dans l'application mobile native (iOS / Android), aucune bannière cookie web
    if (isNative()) return;

    const stored = getStoredConsent();
    if (!stored || stored.version !== CONSENT_VERSION) {
      // Affichage immediat. Le timer de 1000 ms d'avant laisset la page
      // se stabiliser avec --cookie-banner-h:0px, puis levait la nav de
      // ~190px et reflowait le contenu 1s plus tard, sous l'oeil de
      // l'utilisateur (saut de layout sur les 60 routes).
      setVisible(true);
    }
  }, []);

  // La banniere est un overlay fixe : elle occupe la bande que
  // --page-bottom-inset reserve a la bottom-nav. On publie sa hauteur
  // reelle pour que TOUTES les pages liberent cette bande sans avoir a
  // la connaitre individuellement (la sous-nav de fin de flux passait
  // dessous et devenait incliquable).
  // Layout effect : --cookie-banner-h doit etre publie DANS le meme commit
  // que l'insertion du panneau. En useEffect le navigateur peignait d'abord
  // la banniere par-dessus la bottom-nav, puis la nav se levait au paint
  // suivant (2e saut). Ici la levee est appliquee avant le paint.
  useIsomorphicLayoutEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    const el = panelRef.current;
    if (!el) return;
    // Bande totale occupee : du bas du viewport jusqu'au sommet du panneau.
    // Elle inclut la bottom-nav (le panneau est deja remonte de --nav-offset),
    // donc c'est CETTE valeur qu'il faut lever / reserver, pas la seule
    // hauteur du panneau.
    const publish = () => {
      const h = Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top));
      root.style.setProperty('--cookie-banner-h', h + 'px');
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    // ResizeObserver ne voit que les changements de LARGEUR du panneau
    // (sa hauteur est dictee par son contenu). Or la valeur publiee depend
    // aussi de window.innerHeight : repli de la barre d'URL mobile et
    // clavier virtuel la font varier sans toucher la largeur.
    window.addEventListener('resize', publish);
    window.visualViewport?.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      window.visualViewport?.removeEventListener('resize', publish);
      root.style.removeProperty('--cookie-banner-h');
    };
  }, [visible]);

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
    // Non-modal: pas de blocage du reste de l'écran
    <div
      role="region"
      aria-label="Gestion des cookies"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-0 left-0 right-0 z-[var(--z-command)] pointer-events-none px-3"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div
        ref={panelRef}
        className="pointer-events-auto max-w-[min(38rem,calc(100vw-24px))] mx-auto bg-[color:var(--lkv-surface)] backdrop-blur-[var(--glass-blur)] saturate-[var(--glass-saturation)] border border-[color:var(--glass-border)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          margin: '0 auto',
          // P2 — offset UNIQUE via token : jamais sous la bottom bar mobile
          // (`--nav-offset` inclut déjà la safe-area basse).
          marginBottom: 'calc(var(--nav-offset) + var(--space-2))',
        }}
      >
        <style jsx>{`
          @media (min-width: 640px) {
            div {
              margin-bottom: calc(20px + env(safe-area-inset-bottom)) !important;
            }
          }
        `}</style>
        {!showDetails ? (
          <div className="px-4 py-3 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl lkv-glass flex items-center justify-center flex-shrink-0 text-[color:var(--icon-primary)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.955 11.955 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.017-.5-3.92-1.382-5.593" />
                </svg>
              </div>
              <p id="cookie-banner-desc" className="flex-1 min-w-0 text-[color:var(--lkv-text-secondary)] text-xs leading-snug">
                Cookies nécessaires et analytiques pour votre cordée.{' '}
                <Link href="/cookies" className="text-[color:var(--lkv-text-primary)] underline decoration-[color:var(--lkv-text-muted)] underline-offset-2 hover:decoration-[color:var(--lkv-text-primary)] font-medium">
                  En savoir plus
                </Link>
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 pl-11">
              <button
                onClick={acceptAll}
                className="flex-1 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn hover:brightness-[1.05] text-[color:var(--lkv-text-primary)] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 min-h-[var(--lkv-touch-min)] flex items-center justify-center"
              >
                Tout accepter
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn hover:brightness-[1.05] text-[color:var(--lkv-text-primary)] px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 min-h-[var(--lkv-touch-min)] flex items-center justify-center"
              >
                Refuser
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="w-[var(--lkv-touch-min)] flex-shrink-0 border border-[color:var(--glass-border)] hover:border-[color:var(--glass-border-strong)] text-[color:var(--lkv-text-secondary)] hover:text-[color:var(--lkv-text-primary)] px-0 py-2 rounded-xl text-xs transition-all active:scale-95 min-h-[var(--lkv-touch-min)] flex items-center justify-center"
                aria-label="Gérer mes préférences cookies"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V6a1 1 0 0 1 1-1zM12 12a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0v-5a1 1 0 0 1 1-1z" />
                </svg>
              </button>
            </div>
          </div>
) : (
          <div className="p-4 sm:p-5 pointer-events-auto">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setShowDetails(false)}
                className="text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-text-secondary)] transition-colors"
                aria-label="Retour"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-semibold text-[color:var(--lkv-text-primary)] text-sm">Personnaliser mes préférences</h2>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-[color:var(--lkv-text-primary)] text-xs font-medium">🔒 Nécessaires</p>
                  <p className="text-[color:var(--lkv-text-muted)] text-[10px] mt-0.5">Authentification, panier — toujours actifs</p>
                </div>
                <div className="w-9 h-5 bg-[color:var(--lkv-primary)] rounded-full flex items-center justify-end pr-0.5 cursor-not-allowed opacity-60 flex-shrink-0">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-[color:var(--lkv-text-primary)] text-xs font-medium">📊 Analytiques</p>
                  <p className="text-[color:var(--lkv-text-muted)] text-[10px] mt-0.5">Google Analytics — audience anonymisée</p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--lkv-primary)] ${analytics ? 'bg-[color:var(--lkv-primary)] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
                  aria-pressed={analytics}
                  aria-label="Activer les cookies analytiques"
                >
                  <div className="w-4 h-4 bg-white rounded-full " />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                <div className="flex-1 pr-3">
                  <p className="text-[color:var(--lkv-text-primary)] text-xs font-medium">🎯 Marketing</p>
                  <p className="text-[color:var(--lkv-text-muted)] text-[10px] mt-0.5">Publicités personnalisées</p>
                </div>
                <button
                  onClick={() => setMarketing(!marketing)}
                  className={`w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--lkv-primary)] ${marketing ? 'bg-[color:var(--lkv-primary)] justify-end pr-0.5' : 'bg-white/15 justify-start pl-0.5'}`}
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
                className="flex-1 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn hover:brightness-[1.05] text-[color:var(--lkv-text-primary)] px-3 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-primary)] focus:ring-offset-2 focus:ring-offset-[color:var(--lkv-primary)] min-h-[44px]"
              >
                Enregistrer
              </button>
              <button
                onClick={rejectAll}
                className="bg-[color:var(--lkv-surface)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] border border-[color:var(--glass-border)] hover:border-[color:var(--glass-border-strong)] text-[color:var(--lkv-text-primary)] hover:text-[color:var(--lkv-text-primary)] px-3 py-2 rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)] focus:ring-offset-2 focus:ring-offset-[color:var(--lkv-primary)] min-h-[44px]"
              >
                Tout refuser
              </button>
            </div>

            <p className="text-[color:var(--lkv-text-muted)] text-[10px] text-center mt-2">
              <Link href="/cookies" className="hover:text-[color:var(--lkv-text-secondary)] transition-colors">Politique cookies</Link>
              {' · '}
              <Link href="/politique-confidentialite" className="hover:text-[color:var(--lkv-text-secondary)] transition-colors">Confidentialité</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
