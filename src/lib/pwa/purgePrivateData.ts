export interface MinimalServiceWorkerRegistration {
  active: { postMessage: (message: unknown) => void } | null;
}

export interface MinimalServiceWorkerContainer {
  controller: { postMessage: (message: unknown) => void } | null;
  ready?: Promise<MinimalServiceWorkerRegistration>;
}

const PURGE_MESSAGE = { type: 'LKDV_PURGE_PRIVATE' };

/**
 * Poste la purge des caches privés au service worker.
 * - contrôleur actif : message immédiat ;
 * - contrôleur absent (première visite, mise à jour du SW) : attend `ready`
 *   puis poste au worker activé — le message n'est plus perdu silencieusement.
 * Ne jette jamais : un environnement sans SW est un no-op.
 */
export function purgePrivateCaches(
  container: MinimalServiceWorkerContainer | null | undefined
): void {
  if (!container) return;

  if (container.controller) {
    container.controller.postMessage(PURGE_MESSAGE);
    return;
  }

  container.ready
    ?.then((registration) => {
      registration.active?.postMessage(PURGE_MESSAGE);
    })
    .catch(() => {
      /* SW indisponible : no-op */
    });
}
