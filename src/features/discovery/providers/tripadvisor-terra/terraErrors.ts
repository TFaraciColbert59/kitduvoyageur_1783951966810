// src/features/discovery/providers/tripadvisor-terra/terraErrors.ts
// Erreurs typées du provider Terra. Réutilise l'enveloppe DiscoveryError
// partagée pour que le service reste transport-agnostique.
import { DiscoveryError } from '../tripadvisor/tripadvisorErrors';

export const terraConfigError = () =>
  new DiscoveryError('config', 'Tripadvisor Terra n’est pas configuré.');

export const terraAuthError = (status: number) =>
  new DiscoveryError('auth', `Accès Terra refusé (HTTP ${status}).`, status);

export const terraQuotaError = (status = 429) =>
  new DiscoveryError('quota', 'Quota ou limite de débit Terra atteint.', status);

export const terraNotFoundError = (status = 404) =>
  new DiscoveryError('not_found', 'Ressource Terra introuvable.', status);

export const terraTimeoutError = () =>
  new DiscoveryError('timeout', 'Délai d’attente Terra dépassé.');

export const terraUpstreamError = (message = 'Erreur du service Terra.', status?: number) =>
  new DiscoveryError('upstream', message, status);

export const terraValidationError = (message = 'Réponse Terra invalide.') =>
  new DiscoveryError('validation', message);

/** Mappe un statut HTTP Terra vers l'erreur typée correspondante. */
export function mapTerraStatus(status: number, detail?: string) {
  if (status === 400) return terraValidationError(detail || 'Requête Terra invalide.');
  if (status === 401 || status === 403) return terraAuthError(status);
  if (status === 404) return terraNotFoundError(status);
  if (status === 429) return terraQuotaError(status);
  if (status >= 500) return terraUpstreamError('Terra est indisponible.', status);
  return terraUpstreamError(`Réponse Terra inattendue (${status}).`, status);
}
