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

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function tcxIntensity(kind: StructuredSession['steps'][number]['kind']): string {
  switch (kind) {
    case 'warmup':
      return 'Warmup';
    case 'interval':
      return 'Active';
    case 'recovery':
      return 'Resting';
    case 'cooldown':
      return 'Cooldown';
    default:
      return 'Active';
  }
}

function buildTcxTargetXml(step: StructuredSession['steps'][number]): string {
  const hr = step.targets.find((t) => t.kind === 'heart_rate' && t.min !== null && t.max !== null);
  if (hr) {
    return [
      '        <Target xsi:type="HeartRate_t">',
      '          <HeartRateZone xsi:type="CustomHeartRateZone_t">',
      `            <Low xsi:type="HeartRateInBeatsPerMinute_t"><Value>${Math.round(hr.min!)}</Value></Low>`,
      `            <High xsi:type="HeartRateInBeatsPerMinute_t"><Value>${Math.round(hr.max!)}</Value></High>`,
      '          </HeartRateZone>',
      '        </Target>',
    ].join('\n');
  }
  const pace = step.targets.find((t) => t.kind === 'pace' && t.min !== null && t.max !== null);
  if (pace) {
    const lowSpeed = (1000 / Math.max(60, pace.max!)).toFixed(2);
    const highSpeed = (1000 / Math.max(60, pace.min!)).toFixed(2);
    return [
      '        <Target xsi:type="Speed_t">',
      '          <SpeedZone xsi:type="CustomSpeedZone_t">',
      `            <LowInMetersPerSecond>${lowSpeed}</LowInMetersPerSecond>`,
      `            <HighInMetersPerSecond>${highSpeed}</HighInMetersPerSecond>`,
      '          </SpeedZone>',
      '        </Target>',
    ].join('\n');
  }
  const cadence = step.targets.find((t) => t.kind === 'cadence' && t.min !== null && t.max !== null);
  if (cadence) {
    return [
      '        <Target xsi:type="Cadence_t">',
      '          <CadenceZone xsi:type="CustomCadenceZone_t">',
      `            <Low>${Math.round(cadence.min!)}</Low>`,
      `            <High>${Math.round(cadence.max!)}</High>`,
      '          </CadenceZone>',
      '        </Target>',
    ].join('\n');
  }
  return '        <Target xsi:type="None_t" />';
}

/** Exporte une séance structurée au format Garmin/ANT+ Training Center XML (.tcx). */
export function buildStructuredWorkoutTcx(session: StructuredSession): string {
  const sportAttr = session.sport === 'course' ? 'Running' : 'Biking';
  const stepsXml = session.steps
    .map((step, index) =>
      [
        '      <Step xsi:type="Step_t">',
        `        <StepId>${index + 1}</StepId>`,
        `        <Name>${escapeXml(step.label)}</Name>`,
        '        <Duration xsi:type="Time_t">',
        `          <Seconds>${Math.max(1, Math.round(step.durationS))}</Seconds>`,
        '        </Duration>',
        `        <Intensity>${tcxIntensity(step.kind)}</Intensity>`,
        buildTcxTargetXml(step),
        '      </Step>',
      ].join('\n')
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '  <Workouts>',
    `    <Workout Sport="${sportAttr}">`,
    `      <Name>${escapeXml(session.title)}</Name>`,
    stepsXml,
    '      <ScheduledOn>LKDV</ScheduledOn>',
    '    </Workout>',
    '  </Workouts>',
    '</TrainingCenterDatabase>',
  ].join('\n');
}

/** Exporte une séance structurée au format JSON portable LKDV. */
export function buildStructuredWorkoutJson(session: StructuredSession): string {
  return JSON.stringify(
    {
      schema: 'lkdv.structured-workout.v1',
      version: session.version,
      provider: session.provider,
      exportedAt: new Date().toISOString(),
      session,
    },
    null,
    2
  );
}
