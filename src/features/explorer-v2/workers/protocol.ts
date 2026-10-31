/**
 * Protocole typé entre le hook `useGeoProfile` et le worker géo.
 *
 * Un message = un `id` de requête + une `op` versionnée. Toute réponse porte le
 * même `id` (corrélation) et un discriminant `ok` : une erreur est une réponse,
 * jamais un message perdu ni une promesse qui ne se résout pas.
 */
import type { ProfileRequest, ProfileResult } from '../geo/profile';

export const GEO_PROTOCOL_VERSION = 1;

export type GeoWorkerRequest = {
  protocolVersion: typeof GEO_PROTOCOL_VERSION;
  id: number;
  op: 'profile';
  positions: Array<[number, number]>;
  stepM?: number;
  demZoom?: number;
};

export type GeoWorkerSuccess = {
  protocolVersion: typeof GEO_PROTOCOL_VERSION;
  id: number;
  ok: true;
  result: ProfileResult;
};

export type GeoWorkerFailure = {
  protocolVersion: typeof GEO_PROTOCOL_VERSION;
  id: number;
  ok: false;
  error: string;
};

export type GeoWorkerResponse = GeoWorkerSuccess | GeoWorkerFailure;

/** Validation défensive d'une requête reçue par le worker (message non fiable). */
export function isGeoWorkerRequest(value: unknown): value is GeoWorkerRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.protocolVersion === GEO_PROTOCOL_VERSION &&
    typeof candidate.id === 'number' &&
    Number.isFinite(candidate.id) &&
    candidate.op === 'profile' &&
    Array.isArray(candidate.positions)
  );
}

export type ProfileComputer = (request: ProfileRequest) => Promise<ProfileResult>;

/**
 * Construit le handler de messages du worker. Injecter le calculateur rend le
 * protocole testable sans navigateur : on vérifie la corrélation des `id`, la
 * forme des erreurs et le refus des messages inconnus.
 */
export function createGeoMessageHandler(computeProfile: ProfileComputer) {
  return async function handleMessage(raw: unknown): Promise<GeoWorkerResponse | null> {
    if (!isGeoWorkerRequest(raw)) return null;
    const request = raw;
    try {
      const result = await computeProfile({
        id: request.id,
        positions: request.positions,
        stepM: request.stepM,
        demZoom: request.demZoom,
      });
      return {
        protocolVersion: GEO_PROTOCOL_VERSION,
        id: request.id,
        ok: true,
        result,
      };
    } catch (error) {
      return {
        protocolVersion: GEO_PROTOCOL_VERSION,
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : 'profil indisponible',
      };
    }
  };
}
