'use client';

import { useEffect } from 'react';
import { isNative } from '@/lib/native/platform';

/**
 * Enregistrement du service worker — production, web uniquement.
 *
 * Jamais dans l'app Capacitor : le WebView charge le site distant sur la même
 * origine que le web, un SW y persisterait un cache périmé (UI fantôme,
 * hydratation cassée après déploiement). La garde doit s'exécuter côté client :
 * côté SSR rien ne distingue le WebView natif du navigateur.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (isNative() || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.info('ServiceWorker registration successful with scope: ', registration.scope);
        },
        (err) => {
          console.info('ServiceWorker registration failed: ', err);
        }
      );
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
