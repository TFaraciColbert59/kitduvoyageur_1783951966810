/// <reference lib="webworker" />

/**
 * Worker géo de l'Explorer v2 — **bootstrap uniquement**.
 *
 * Toute la mathématique vit dans `../geo/track.ts` et `../geo/profile.ts`, que
 * le fallback main-thread importe sans exécuter ce fichier (aucun accès `self`
 * hors worker). Reçoit des requêtes `GeoWorkerRequest`, répond toujours avec le
 * même `id`, et n'échange que des structures sérialisables.
 */
import { buildProfile } from '../geo/profile';
import {
  GEO_PROTOCOL_VERSION,
  createGeoMessageHandler,
  type GeoWorkerResponse,
} from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const handleMessage = createGeoMessageHandler((request) => buildProfile(request));

scope.addEventListener('message', (event: MessageEvent<unknown>) => {
  void handleMessage(event.data).then((response: GeoWorkerResponse | null) => {
    if (!response) return;
    scope.postMessage(response);
  });
});

export { GEO_PROTOCOL_VERSION };
