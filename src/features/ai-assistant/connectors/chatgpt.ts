/**
 * K1.14 — connecteur de découverte de parcours pour ChatGPT.
 *
 * Aucune entrée dans la navigation LKDV : la surface est externe. Le
 * connecteur n'est déclaré disponible que si un arbitrage explicite l'a
 * activé (`CHATGPT_CONNECTOR_ENABLED=true`) et si l'IA du site n'est pas
 * éteinte. Tant que ce n'est pas le cas, le manifeste et la recherche
 * répondent `connector_not_configured` : aucun droit n'est supposé.
 */

import { AI_ASSISTANT_CONTRACT_VERSION } from '../contracts';
import { MCP_PROTOCOL_VERSION } from './mcp';

export const CHATGPT_CONNECTOR_ID = 'chatgpt';
export const CHATGPT_CONNECTOR_VERSION = 'a08-chatgpt-v1';

export type ConnectorStatus =
  | { status: 'available'; reason: null; message: string }
  | {
      status: 'unavailable';
      reason: 'connector_not_configured' | 'connector_disabled';
      message: string;
    };

export interface ConnectorEnv {
  [key: string]: string | undefined;
  CHATGPT_CONNECTOR_ENABLED?: string;
  AI_MODE?: string;
}

export function readChatGptConnectorStatus(env: ConnectorEnv = process.env): ConnectorStatus {
  if (env.AI_MODE?.trim().toLowerCase() === 'off') {
    return {
      status: 'unavailable',
      reason: 'connector_disabled',
      message: 'Connecteur désactivé : l’IA du site est éteinte (AI_MODE=off).',
    };
  }
  if (env.CHATGPT_CONNECTOR_ENABLED?.trim().toLowerCase() !== 'true') {
    return {
      status: 'unavailable',
      reason: 'connector_not_configured',
      message:
        'Connecteur ChatGPT non activé : accès, licence et surface cible restent à valider. Aucun appel externe n’est effectué.',
    };
  }
  return {
    status: 'available',
    reason: null,
    message: 'Connecteur ChatGPT activé pour les utilisateurs authentifiés.',
  };
}

/** Contraintes réellement présentes dans le catalogue, et celles qui manquent. */
export const CHATGPT_TERRAIN_CONSTRAINTS = {
  available: [
    'distanceKm (hiking_routes.distance_km)',
    'elevationGainM (trail_metadata.elevation_gain)',
    'elevationLossM (trail_metadata.elevation_loss)',
    'durationHours (trail_metadata.duration_hours)',
    'difficulty (trail_metadata.difficulty)',
    'region (hiking_routes.region)',
  ],
  unavailable: [
    'surface (non agrégée au parcours)',
    'technicalClass (non agrégée au parcours)',
    'exposureClass (non agrégée au parcours)',
    'isolationClass (non agrégée au parcours)',
    'familyFriendly (trail_metadata non fiable pour le parcours)',
    'season (non renseignée par parcours)',
    'loop (non renseigné par parcours)',
  ],
} as const;

export function buildChatGptConnectorManifest(env: ConnectorEnv = process.env) {
  const status = readChatGptConnectorStatus(env);
  return {
    connector: CHATGPT_CONNECTOR_ID,
    contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
    connectorVersion: CHATGPT_CONNECTOR_VERSION,
    surface: 'external',
    navigationEntry: 'none',
    authentication: 'bearer',
    mcp: { path: '/api/ai-assistant/mcp', protocolVersion: MCP_PROTOCOL_VERSION },
    ...status,
    tools: [
      {
        name: 'search_routes',
        method: 'POST',
        path: '/api/ai-assistant/route-discovery',
        description:
          'Recherche des itinéraires réels du catalogue LKDV avec les contraintes de terrain comprises.',
        input: {
          query: 'string?',
          near: { lat: 'number', lng: 'number', radiusKm: 'number?' },
          constraints: {
            distanceKm: { min: 'number?', max: 'number?' },
            elevationGainM: { min: 'number?', max: 'number?' },
            durationHours: { min: 'number?', max: 'number?' },
            difficulty: 'string[]?',
            region: 'string[]?',
          },
          limit: 'number? (1..20)',
        },
        output: {
          appliedConstraints: 'objet écho, corrigeable',
          unknownConstraints: 'contraintes non prouvables, jamais supposées vraies',
          results: 'itinéraires avec provenance et statut measured/calculated/absent',
        },
      },
    ],
    terrainConstraints: CHATGPT_TERRAIN_CONSTRAINTS,
    dataPolicy: {
      allowed: ['nom', 'référence', 'région', 'distance', 'dénivelé', 'durée', 'difficulté'],
      excluded: ['coordonnées de l’utilisateur', 'traces GPS privées', 'notes personnelles'],
      missingValueRule: 'une valeur absente reste absente ; elle n’est jamais zéro ni estimée',
    },
  } as const;
}
