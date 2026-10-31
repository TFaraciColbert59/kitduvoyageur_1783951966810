/// <reference lib="webworker" />

/**
 * Worker géo de l'Explorer v2 — **bootstrap uniquement**.
 *
 * Toute la mathématique vit dans `../geo/track.ts` et `../geo/profile.ts`, que
 * le fallback main-thread importe sans exécuter ce fichier (aucun accès `self`
 * hors worker). Le câblage des messages vit dans `./workerServer.ts` pour être
 * testé sans navigateur.
 */
import { buildProfile } from '../geo/profile';
import { attachGeoWorkerServer, type WorkerScopeLike } from './workerServer';

attachGeoWorkerServer(self as unknown as WorkerScopeLike, (request) => buildProfile(request));
