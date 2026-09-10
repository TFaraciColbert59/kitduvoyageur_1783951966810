// src/features/discovery/providers/viator/viatorErrors.ts
// Erreurs typées Viator. Réutilise l'enveloppe DiscoveryError partagée.
import { DiscoveryError } from '../tripadvisor/tripadvisorErrors';

export const viatorConfigError = () =>
  new DiscoveryError('config', 'Viator n’est pas configuré.');

export const viatorAuthError = (status: number) =>
  new DiscoveryError('auth', `Accès Viator refusé (HTTP ${status}).`, status);

export const viatorQuotaError = (status = 429) =>
  new DiscoveryError('quota', 'Quota ou limite de débit Viator atteint.', status);

export const viatorNotFoundError = (status = 404) =>
  new DiscoveryError('not_found', 'Ressource Viator introuvable.', status);

export const viatorTimeoutError = () =>
  new DiscoveryError('timeout', 'Délai d’attente Viator dépassé.');

export const viatorUpstreamError = (message = 'Erreur du service Viator.', status?: number) =>
  new DiscoveryError('upstream', message, status);

export const viatorValidationError = (message = 'Réponse Viator invalide.') =>
  new DiscoveryError('validation', message);

export function mapViatorStatus(status: number, detail?: string) {
  if (status === 400) return viatorValidationError(detail || 'Requête Viator invalide.');
  if (status === 401 || status === 403) return viatorAuthError(status);
  if (status === 404) return viatorNotFoundError(status);
  if (status === 429) return viatorQuotaError(status);
  if (status >= 500) return viatorUpstreamError('Viator est indisponible.', status);
  return viatorUpstreamError(`Réponse Viator inattendue (${status}).`, status);
}
