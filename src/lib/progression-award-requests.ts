/**
 * P2 — Demandes de vérification serveur des producteurs de progression.
 *
 * Les écritures métier (carnet, checklist) restent des écritures directes
 * client ; ces appels demandent au serveur de recalculer les preuves et
 * d'attribuer les points. Best-effort strict : aucun échec réseau ne remonte
 * au parcours utilisateur, et l'idempotence serveur empêche tout doublon.
 */

export function requestCarnetPublicationAward(carnetId: string): void {
  void fetch(`/api/carnets/${carnetId}/publish`, {
    method: 'POST',
    keepalive: true,
  }).catch(() => {
    /* silencieux : la progression n'est jamais bloquante */
  });
}

export function requestChecklistCompletionAward(tripId: string): void {
  void fetch(`/api/trips/${tripId}/checklist/complete`, {
    method: 'POST',
    keepalive: true,
  }).catch(() => {
    /* silencieux : la progression n'est jamais bloquante */
  });
}
