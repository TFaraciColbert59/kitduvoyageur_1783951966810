'use client';

import { useEffect } from 'react';
import { isNative } from '@/lib/native/platform';
import { APP_SW_PATH, shouldReloadOnControllerChange } from '@/lib/pwa/serviceWorkerScopes';

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
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production' || isNative()) {
      // En dev ou dans Capacitor, purger tout ancien SW d'app (`/sw.js`) qui
      // servirait des chunks `/_next/static/` périmés depuis CacheStorage.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(
            regs
              .filter((r) => (r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || '').includes('/sw.js'))
              .map((r) => r.unregister())
          )
        )
        .then((unregistered) => {
          if (typeof caches !== 'undefined') {
            return caches
              .keys()
              .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lkdv-static-')).map((k) => caches.delete(k))))
              .then(() => {
                if (unregistered.some(Boolean)) window.location.reload();
              });
          }
          if (unregistered.some(Boolean)) window.location.reload();
        })
        .catch(() => undefined);
      return;
    }

    let reloading = false;
    const onControllerChange = () => {
      // Seule une nouvelle version du worker de l'app justifie un rechargement : le worker
      // de l'Explorer qui prend la main sur ses pages ne doit pas relancer la page.
      if (reloading || !shouldReloadOnControllerChange(navigator.serviceWorker.controller?.scriptURL)) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register(`${APP_SW_PATH}?v=22`, { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .then(
          (registration) => {
            console.info('ServiceWorker registration successful with scope: ', registration?.scope);
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
    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
