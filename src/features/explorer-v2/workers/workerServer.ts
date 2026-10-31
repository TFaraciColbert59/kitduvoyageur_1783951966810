/**
 * Câblage du worker géo, isolé du bootstrap `geo.worker.ts` pour être testable
 * hors navigateur (un faux `scope` suffit).
 *
 * Deux garanties, apprises de l'incident « profil bloqué en chargement » :
 *  - une réponse `postMessage` qui échoue (worker en cours de fermeture, buffer
 *    détaché) ne produit **jamais** de rejet non géré qui tuerait le worker ;
 *  - une erreur inattendue du handler répond `ok: false` avec le même `id`
 *    quand il est identifiable, sinon elle est journalisée sans rejeter.
 */
import {
  GEO_PROTOCOL_VERSION,
  createGeoMessageHandler,
  type GeoWorkerResponse,
  type ProfileComputer,
} from './protocol';

/** Sous-ensemble de `DedicatedWorkerGlobalScope` utilisé par le serveur. */
export interface WorkerScopeLike {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  postMessage(message: GeoWorkerResponse): void;
}

export function attachGeoWorkerServer(scope: WorkerScopeLike, computeProfile: ProfileComputer): void {
  const handleMessage = createGeoMessageHandler(computeProfile);

  scope.addEventListener('message', (event) => {
    void handleMessage(event.data)
      .then((response) => {
        if (!response) return;
        try {
          scope.postMessage(response);
        } catch {
          // Worker en cours de fermeture : la réponse n'a plus de destinataire.
        }
      })
      .catch(() => {
        const id = (event.data as { id?: unknown } | null)?.id;
        if (typeof id !== 'number') return;
        try {
          scope.postMessage({
            protocolVersion: GEO_PROTOCOL_VERSION,
            id,
            ok: false,
            error: 'échec interne du worker géo',
          });
        } catch {
          // Même raison : plus de destinataire.
        }
      });
  });
}
