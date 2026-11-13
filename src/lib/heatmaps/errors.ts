/**
 * Erreurs serveur du lot C02. Chaque code est stable et journalisable : la
 * route traduit le code en statut HTTP sans jamais exposer de coordonnée ni de
 * donnée de séance.
 */

export type HeatmapDataErrorCode =
  | 'consent_unavailable'
  | 'activity_unavailable'
  | 'preferences_unavailable';

export class HeatmapDataError extends Error {
  public readonly code: HeatmapDataErrorCode;

  constructor(code: HeatmapDataErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'HeatmapDataError';
    this.code = code;
  }
}

export function isHeatmapDataError(error: unknown): error is HeatmapDataError {
  return error instanceof HeatmapDataError;
}
