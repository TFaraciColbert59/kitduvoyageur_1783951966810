import { validateSession } from './sessionEngine';
import {
  WORKOUT_CONTRACT_VERSION,
  type DeviceConnector,
  type DeviceWorkoutPayload,
  type StructuredSession,
  type WatchTransferPlan,
} from './types';

/**
 * Aucun connecteur montre n'est enregistré dans LKDV aujourd'hui. Cette
 * fonction retourne la liste réelle (vide) ; un adaptateur futur devra
 * déclarer ses capacités avant de pouvoir recevoir une séance.
 */
export function defaultDeviceConnectors(): DeviceConnector[] {
  return [];
}

function buildPayload(session: StructuredSession): DeviceWorkoutPayload {
  return {
    version: WORKOUT_CONTRACT_VERSION,
    encoding: 'lkdv_json',
    sessionId: session.id,
    sport: session.sport,
    steps: session.steps.map((step) => ({
      id: step.id,
      kind: step.kind,
      label: step.label,
      durationS: step.durationS,
      targets: step.targets,
    })),
  };
}

/**
 * Décide si une séance peut être envoyée à un appareil.
 *
 * Aucune API Garmin n'est appelée : le résultat est un plan d'envoi et un
 * payload JSON neutre. Sans connecteur connecté et capable de séances
 * structurées, le statut est explicitement indisponible ou non supporté.
 */
export function planWatchTransfer(
  session: StructuredSession,
  connectors: DeviceConnector[] = defaultDeviceConnectors()
): WatchTransferPlan {
  const errors = validateSession(session);
  if (errors.length > 0) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'invalid',
      reason: 'invalid_session',
      connectorId: null,
      detail: `Séance invalide : ${errors.join(' ')}`,
      localExecution: 'available',
      payload: null,
    };
  }

  if (connectors.length === 0) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'unavailable',
      reason: 'connector_absent',
      connectorId: null,
      detail:
        'Aucun connecteur montre enregistré. L’exécution locale reste disponible ; aucun envoi n’est simulé.',
      localExecution: 'available',
      payload: null,
    };
  }

  const connected = connectors.filter(
    (connector) => connector.status === 'connected'
  );
  if (connected.length === 0) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'unavailable',
      reason: 'connector_disconnected',
      connectorId: null,
      detail:
        'Aucun appareil connecté. Reconnecte une montre compatible avant d’envoyer la séance.',
      localExecution: 'available',
      payload: null,
    };
  }

  const capable = connected.find((connector) =>
    connector.capabilities.includes('structured_workout')
  );
  if (!capable) {
    return {
      version: WORKOUT_CONTRACT_VERSION,
      status: 'unsupported',
      reason: 'capability_absent',
      connectorId: connected[0]?.id ?? null,
      detail:
        'L’appareil connecté ne déclare pas la capacité « séance structurée ». La séance reste exécutable localement.',
      localExecution: 'available',
      payload: null,
    };
  }

  return {
    version: WORKOUT_CONTRACT_VERSION,
    status: 'ready',
    reason: 'ready',
    connectorId: capable.id,
    detail: `Séance structurée prête pour ${capable.label}.`,
    localExecution: 'available',
    payload: buildPayload(session),
  };
}

export function watchTransferLabel(plan: WatchTransferPlan): string {
  switch (plan.status) {
    case 'ready':
      return 'Prête à envoyer';
    case 'unsupported':
      return 'Appareil non compatible';
    case 'invalid':
      return 'Séance invalide';
    default:
      return 'Envoi indisponible';
  }
}
