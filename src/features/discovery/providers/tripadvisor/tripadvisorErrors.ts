// src/features/discovery/providers/tripadvisor/tripadvisorErrors.ts
import type { DiscoveryErrorReason } from '../../types/discovery.types';

export type DiscoveryErrorCode =
  | 'config'
  | 'quota'
  | 'auth'
  | 'not_found'
  | 'timeout'
  | 'upstream'
  | 'validation';

const REASON_BY_CODE: Record<DiscoveryErrorCode, DiscoveryErrorReason> = {
  config: 'missing_config',
  quota: 'quota',
  auth: 'auth',
  not_found: 'unknown_country',
  timeout: 'timeout',
  upstream: 'upstream',
  validation: 'invalid_response',
};

export class DiscoveryError extends Error {
  readonly code: DiscoveryErrorCode;
  readonly status?: number;
  readonly reason: DiscoveryErrorReason;

  constructor(code: DiscoveryErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'DiscoveryError';
    this.code = code;
    this.status = status;
    this.reason = REASON_BY_CODE[code];
  }
}

export const configError = () =>
  new DiscoveryError('config', 'Tripadvisor n’est pas configuré.');

export const quotaError = (status = 429) =>
  new DiscoveryError('quota', 'Quota Tripadvisor atteint.', status);

export const authError = (status: number) =>
  new DiscoveryError('auth', 'Accès Tripadvisor refusé (HTTP 403).', status);

export const notFoundError = (status = 404) =>
  new DiscoveryError('not_found', 'Ressource Tripadvisor introuvable.', status);

export const timeoutError = () =>
  new DiscoveryError('timeout', 'Délai d’attente Tripadvisor dépassé.');

export const upstreamError = (message = 'Erreur du service Tripadvisor.', status?: number) =>
  new DiscoveryError('upstream', message, status);

export const validationError = (message = 'Réponse Tripadvisor invalide.') =>
  new DiscoveryError('validation', message);

/**
 * Neutralise toute fuite de la clé dans les logs : remplace la valeur du
 * paramètre `key=` par `***`. À utiliser sur toute URL avant journalisation.
 */
export function redactKey(input: string): string {
  return input.replace(/([?&]key=)[^&\s]*/gi, '$1***');
}
