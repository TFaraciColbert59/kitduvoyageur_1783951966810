'use client';

import React, { useState, useEffect } from 'react';
import { usePWAStandalone } from '@/hooks/usePWAStandalone';

const DISMISS_KEY = 'lkdv_install_dismissed_at';
const DISMISS_DAYS = 14;
const MIN_PAGE_VIEWS = 2;
const PAGE_VIEWS_KEY = 'lkdv_page_views';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const isStandalone = usePWAStandalone();
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Detect iOS
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    // Track page views
    try {
      const views = parseInt(localStorage.getItem(PAGE_VIEWS_KEY) || '0', 10) + 1;
      localStorage.setItem(PAGE_VIEWS_KEY, String(views));
      if (views < MIN_PAGE_VIEWS) return;

      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const diff = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
        if (diff < DISMISS_DAYS) return;
      }
    } catch {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isStandalone) setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari — show manually since beforeinstallprompt doesn't fire
    const iosSafari =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      /safari/i.test(navigator.userAgent) &&
      !/chrome/i.test(navigator.userAgent);
    if (iosSafari && !isStandalone) setShow(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_e) { /* ignore */ }
  };

  if (!show || isStandalone) return null;

  return (
    <div
      role="banner"
      aria-label="Installer l'application"
      className="md:hidden fixed left-3 right-3 z-40 rounded-2xl shadow-lg flex items-center gap-3 px-4 py-3"
      style={{
        bottom: 'calc(86px + env(safe-area-inset-bottom))',
        background: '#1C2620',
        color: '#E7E3D6',
      }}
    >
      {/* App icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-xl"
        style={{ width: '40px', height: '40px', background: '#17402C' }}
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight" style={{ color: '#E7E3D6' }}>
          Installer l&apos;app
        </p>
        <p className="text-xs leading-tight mt-0.5" style={{ color: '#9AAD9E' }}>
          {isIOS
            ? 'Appuyez sur Partager puis "Sur l\'écran d\'accueil"' :'Accès rapide depuis votre écran d\'accueil'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: '#17402C', color: 'white' }}
            aria-label="Installer l'application sur l'écran d'accueil"
          >
            Installer
          </button>
        )}
        <button
          onClick={handleDismiss}
          aria-label="Fermer la suggestion d'installation"
          className="flex items-center justify-center w-7 h-7 rounded-full"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
