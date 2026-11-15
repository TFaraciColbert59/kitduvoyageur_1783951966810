/**
 * Lot N01 — Écran verrouillé : statistiques et prochaine instruction (K4.12)
 * & Activités en direct sur iOS / Dynamic Island (S1.06).
 *
 * Invariants :
 * - Rétrocompatibilité totale avec `LiveActivityState` et `LiveActivityStart`
 *   de `src/features/explorer-v2/native/liveActivity.ts`.
 * - Enrichissement avec la prochaine manœuvre virage par virage (`nextManeuver`),
 *   les emplacements Dynamic Island (`compactLeading`, `compactTrailing`,
 *   `minimal`, `expanded`) et le payload de notification continue Android
 *   (`androidNotification`).
 * - Garantie issue de `01 — Horloges et reprise` : l'interface Live Activity /
 *   écran verrouillé est un miroir de la séance identifiée par `clientSessionId` ;
 *   elle ne crée jamais de deuxième séance et n'invente jamais de durée.
 */

import { rhythmMetric } from '../explorer-v2/sheet/sportSelection';
import type { Sport, SportSelection } from '../explorer-v2/state/types';
import { maneuverActionLabel } from './turnByTurn';
import type {
  AndroidLockScreenNotificationPayload,
  DynamicIslandPresentation,
  LockScreenManeuverPayload,
  LockScreenNavigationPayload,
  ManeuverKind,
  NavigationUnits,
  RouteManeuver,
} from './types';
import {
  formatNavigationDistance,
  formatNavigationDuration,
  formatNavigationElevation,
  formatNavigationPaceFromSpeed,
  formatNavigationSpeed,
} from './unitsAndOrientation';

export const MANEUVER_ICON_BY_KIND: Readonly<Record<ManeuverKind, string>> = {
  depart: 'flag-start',
  straight: 'arrow-up',
  'slight-left': 'arrow-up-left',
  'turn-left': 'corner-up-left',
  'sharp-left': 'turn-sharp-left',
  'slight-right': 'arrow-up-right',
  'turn-right': 'corner-up-right',
  'sharp-right': 'turn-sharp-right',
  'u-turn': 'rotate-ccw',
  waypoint: 'map-pin',
  arrive: 'flag-checkered',
};

export interface BuildLockScreenPayloadInput {
  clientSessionId: string | null;
  sport: Sport;
  selection?: SportSelection;
  startedAt: number;
  distanceM: number;
  elevGainM: number;
  movingS: number;
  paused: boolean;
  autoPaused?: boolean;
  offRoute: boolean;
  offRouteM?: number | null;
  units?: NavigationUnits;
  nextManeuver?: RouteManeuver | null;
  distanceToNextManeuverM?: number | null;
  audioMuted?: boolean;
}

/**
 * Construit le payload complet pour l'écran verrouillé iOS (ActivityKit +
 * Dynamic Island) et la notification continue Android (`K4.12`, `S1.06`).
 */
export function buildLockScreenNavigationPayload(
  input: BuildLockScreenPayloadInput,
): LockScreenNavigationPayload {
  const units = input.units ?? 'metric';
  const distanceM = Math.max(0, Number.isFinite(input.distanceM) ? Math.round(input.distanceM) : 0);
  const elevGainM = Math.max(0, Number.isFinite(input.elevGainM) ? Math.round(input.elevGainM) : 0);
  const movingS = Math.max(0, Number.isFinite(input.movingS) ? Math.round(input.movingS) : 0);
  const autoPaused = Boolean(input.autoPaused);

  const formattedDistance = formatNavigationDistance(distanceM, units);
  const formattedDuration = formatNavigationDuration(movingS);
  const formattedElevationGain = formatNavigationElevation(elevGainM, units, true);

  const avgSpeedMs = movingS > 0 && distanceM > 0 ? distanceM / movingS : null;
  const rhythmKind = rhythmMetric(input.sport, input.selection);
  const formattedRhythm =
    rhythmKind === 'pace'
      ? formatNavigationPaceFromSpeed(avgSpeedMs, units).full
      : formatNavigationSpeed(avgSpeedMs, units).full;

  let nextManeuver: LockScreenManeuverPayload | null = null;
  if (
    input.nextManeuver &&
    typeof input.distanceToNextManeuverM === 'number' &&
    Number.isFinite(input.distanceToNextManeuverM)
  ) {
    const distM = Math.max(0, Math.round(input.distanceToNextManeuverM));
    const instruction =
      input.nextManeuver.rawInstruction ||
      maneuverActionLabel(input.nextManeuver.kind, input.nextManeuver.streetName);
    nextManeuver = {
      kind: input.nextManeuver.kind,
      iconName: MANEUVER_ICON_BY_KIND[input.nextManeuver.kind],
      instruction,
      distanceM: distM,
      formattedDistance: formatNavigationDistance(distM, units),
      bearingDeg: Number.isFinite(input.nextManeuver.bearingAfterDeg)
        ? input.nextManeuver.bearingAfterDeg
        : null,
    };
  }

  const offRouteBanner = input.offRoute
    ? typeof input.offRouteM === 'number' && Number.isFinite(input.offRouteM)
      ? `Hors itinéraire · ${formatNavigationDistance(input.offRouteM, units)}`
      : 'Hors itinéraire'
    : null;

  const statusHeadline = input.paused
    ? 'En pause'
    : autoPaused
      ? 'Pause auto'
      : offRouteBanner
        ? offRouteBanner
        : nextManeuver
          ? `${nextManeuver.instruction} (${nextManeuver.formattedDistance})`
          : `Suivi ${input.sport} actif`;

  const dynamicIsland: DynamicIslandPresentation = {
    compactLeading: input.offRoute
      ? 'alert-triangle'
      : nextManeuver
        ? nextManeuver.iconName
        : `sport-${input.sport}`,
    compactTrailing: input.offRoute
      ? 'Hors trace'
      : nextManeuver
        ? nextManeuver.formattedDistance
        : formattedDistance,
    minimal: input.offRoute
      ? '!'
      : nextManeuver
        ? nextManeuver.iconName
        : formattedDistance,
    expanded: {
      headline: statusHeadline,
      subheadline: `${formattedDistance} · ${formattedDuration} · ${formattedElevationGain}`,
      leadingStatLabel: 'Distance',
      leadingStatValue: formattedDistance,
      trailingStatLabel: 'Durée',
      trailingStatValue: formattedDuration,
      bottomBanner: offRouteBanner ?? (nextManeuver ? nextManeuver.instruction : null),
    },
  };

  const androidNotification: AndroidLockScreenNotificationPayload = {
    channelId: 'lkdv_active_navigation',
    ongoing: true,
    showWhen: true,
    visibility: 'public',
    category: nextManeuver ? 'navigation' : 'workout',
    title: statusHeadline,
    subtitle: `${formattedDistance} · ${formattedDuration}`,
    body: `${formattedElevationGain}${formattedRhythm !== '—' ? ` · ${formattedRhythm}` : ''}`,
    actions: [
      input.paused
        ? { id: 'resume', title: 'Reprendre' }
        : { id: 'pause', title: 'Pause' },
      { id: 'lap', title: 'Tour' },
      { id: 'mute', title: input.audioMuted ? 'Activer audio' : 'Muet' },
    ],
  };

  return {
    clientSessionId: input.clientSessionId,
    sport: input.sport,
    startedAt: input.startedAt,
    distanceM,
    elevGainM,
    movingS,
    paused: input.paused,
    autoPaused,
    offRoute: input.offRoute,
    units,
    formattedDistance,
    formattedDuration,
    formattedElevationGain,
    formattedRhythm,
    nextManeuver,
    offRouteBanner,
    dynamicIsland,
    androidNotification,
  };
}

export type LockScreenPlatform = 'ios' | 'android' | 'web';

export interface LockScreenCapability {
  platform: LockScreenPlatform;
  supported: boolean;
  liveActivityAvailable: boolean;
  dynamicIslandAvailable: boolean;
  ongoingNotificationAvailable: boolean;
  reason: string | null;
}

export interface LockScreenNativeBridgeAdapter {
  getPlatform(): LockScreenPlatform;
  isSupported(): Promise<{
    supported: boolean;
    dynamicIsland?: boolean;
    reason?: string;
  }>;
  start(payload: LockScreenNavigationPayload): Promise<{ supported: boolean; id?: string }>;
  update(payload: LockScreenNavigationPayload): Promise<void>;
  end(payload: LockScreenNavigationPayload): Promise<void>;
}

export const defaultWebNoopLockScreenBridge: LockScreenNativeBridgeAdapter = {
  getPlatform(): LockScreenPlatform {
    return 'web';
  },
  async isSupported() {
    return {
      supported: false,
      dynamicIsland: false,
      reason: 'Surface native écran verrouillé non disponible dans le navigateur web.',
    };
  },
  async start() {
    return { supported: false };
  },
  async update() {
    // No-op sur web
  },
  async end() {
    // No-op sur web
  },
};

export interface LockScreenActionHandlers {
  onPause?: (clientSessionId: string | null) => void;
  onResume?: (clientSessionId: string | null) => void;
  onMarkLap?: (clientSessionId: string | null) => void;
  onToggleMute?: (clientSessionId: string | null) => void;
}

/**
 * Contrôleur de cycle de vie de l'écran verrouillé / Live Activity (`K4.12`, `S1.06`).
 * Garantit qu'un redémarrage ou une mise à jour conserve le même `clientSessionId`
 * sans jamais créer de séance parallèle.
 */
export class LockScreenBridgeController {
  private bridge: LockScreenNativeBridgeAdapter;
  private activeClientSessionId: string | null = null;
  private lastPayload: LockScreenNavigationPayload | null = null;
  private started = false;
  private handlers: LockScreenActionHandlers;

  constructor(
    bridge: LockScreenNativeBridgeAdapter = defaultWebNoopLockScreenBridge,
    handlers: LockScreenActionHandlers = {},
  ) {
    this.bridge = bridge;
    this.handlers = handlers;
  }

  public get currentPayload(): LockScreenNavigationPayload | null {
    return this.lastPayload ? { ...this.lastPayload } : null;
  }

  public get isStarted(): boolean {
    return this.started;
  }

  public async checkCapability(): Promise<LockScreenCapability> {
    const platform = this.bridge.getPlatform();
    try {
      const res = await this.bridge.isSupported();
      return {
        platform,
        supported: res.supported === true,
        liveActivityAvailable: platform === 'ios' && res.supported === true,
        dynamicIslandAvailable:
          platform === 'ios' && res.supported === true && res.dynamicIsland === true,
        ongoingNotificationAvailable: platform === 'android' && res.supported === true,
        reason: res.reason ?? null,
      };
    } catch {
      return {
        platform,
        supported: false,
        liveActivityAvailable: false,
        dynamicIslandAvailable: false,
        ongoingNotificationAvailable: false,
        reason: 'bridge_error',
      };
    }
  }

  /**
   * Synchronise la séance sur l'écran verrouillé.
   * Si la même `clientSessionId` est déjà démarrée, effectue uniquement un `update`
   * (aucune duplication de Live Activity ni création de deuxième séance).
   */
  public async sync(input: BuildLockScreenPayloadInput): Promise<LockScreenNavigationPayload> {
    const payload = buildLockScreenNavigationPayload(input);
    this.lastPayload = payload;

    const sameSession =
      this.started &&
      this.activeClientSessionId !== null &&
      input.clientSessionId === this.activeClientSessionId;

    if (!this.started || !sameSession) {
      this.activeClientSessionId = input.clientSessionId;
      try {
        const res = await this.bridge.start(payload);
        this.started = res.supported === true;
      } catch {
        this.started = false;
      }
      return payload;
    }

    try {
      await this.bridge.update(payload);
    } catch {
      // Une erreur Live Activity ne doit jamais interrompre la capture GPS
    }
    return payload;
  }

  public async stop(finalInput?: BuildLockScreenPayloadInput): Promise<void> {
    const payload = finalInput
      ? buildLockScreenNavigationPayload(finalInput)
      : this.lastPayload;
    if (this.started && payload) {
      try {
        await this.bridge.end(payload);
      } catch {
        // Ignorer
      }
    }
    this.started = false;
    this.activeClientSessionId = null;
    this.lastPayload = payload ?? null;
  }

  /** Traite une commande reçue depuis l'écran verrouillé ou la Dynamic Island. */
  public handleLockScreenAction(actionId: 'pause' | 'resume' | 'lap' | 'mute'): void {
    switch (actionId) {
      case 'pause':
        this.handlers.onPause?.(this.activeClientSessionId);
        break;
      case 'resume':
        this.handlers.onResume?.(this.activeClientSessionId);
        break;
      case 'lap':
        this.handlers.onMarkLap?.(this.activeClientSessionId);
        break;
      case 'mute':
        this.handlers.onToggleMute?.(this.activeClientSessionId);
        break;
    }
  }
}
