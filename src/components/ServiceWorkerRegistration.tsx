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
    if (process.env.NODE_ENV !== 'production') return;
    if (isNative() || !('serviceWorker' in navigator)) return;

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
