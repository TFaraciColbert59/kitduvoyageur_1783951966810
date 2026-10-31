/**
 * src/features/kit-studio/scene/camera/machine.ts
 * Pure 8-state camera state machine for Kit Studio 3D (Lot L5-1).
 * ZERO imports from React, Three.js, or DOM.
 *
 * Covers:
 * - B-07: Closing drawer transitions CLOSING -> OVERVIEW
 * - C-06: User gesture interrupts immediately (< 1 frame -> MANUAL)
 * - C-07: Zero animation queue (3 rapid adds in 300ms -> 1 OPENING)
 * - C-08: Already open bag (INSIDE/OPENING) does not replay OPENING
 * - C-09: `recenter` available from all 8 states -> OVERVIEW
 * - C-11: Min safe distance enforced via framing
 * - C-13: `openable: false` never emits or enters OPENING / INSIDE
 */

import {
  clampCameraPose,
  computeOpeningFraming,
  computeOverviewFraming,
  computePartFraming,
  DEFAULT_BAG_BBOX,
  interpolatePose,
} from './framing';
import {
  CameraActorPriority,
  getIntentPriority,
  type BoundingBoxM,
  type CameraIntent,
  type CameraPose,
  type CameraStateId,
} from './intents';

export interface CameraCapabilitiesInput {
  openable: boolean;
  hasInterior: boolean;
  maxHingeAngleRad?: number;
}

export interface CameraTransition {
  from: CameraPose;
  to: CameraPose;
  fromLidAngleRad: number;
  toLidAngleRad: number;
  durationMs: number;
  elapsedMs: number;
  nextStateOnComplete?: CameraStateId;
}

export interface CameraMachineSnapshot {
  state: CameraStateId;
  reducedMotion: boolean;
  bagOpen: boolean;
  lidAngleRad: number;
  currentPose: CameraPose;
  targetPose: CameraPose;
  focusedPartId: string | null;
  transition: CameraTransition | null;
  openingCount: number;
  placementPulseCount: number;
  degradedReason: string | null;
}

export interface CameraMachineOptions {
  initialState?: CameraStateId;
  bbox?: BoundingBoxM;
  capabilities?: CameraCapabilitiesInput;
  reducedMotion?: boolean;
}

const COALESCE_WINDOW_MS = 32;
const DEFAULT_TRANSITION_MS = 420;
const OPENING_TRANSITION_MS = 520;
const CLOSING_TRANSITION_MS = 380;

export class CameraStateMachine {
  private bbox: BoundingBoxM;
  private capabilities: CameraCapabilitiesInput;
  private snapshot: CameraMachineSnapshot;
  private lastIntentAtMs = -Infinity;
  private lastIntentPriority: CameraActorPriority = CameraActorPriority.REST;

  constructor(options: CameraMachineOptions = {}) {
    this.bbox = options.bbox ?? DEFAULT_BAG_BBOX;
    this.capabilities = options.capabilities ?? {
      openable: true,
      hasInterior: true,
      maxHingeAngleRad: 1.5,
    };

    const overview = computeOverviewFraming(this.bbox);
    const reduced = Boolean(options.reducedMotion || options.initialState === 'REDUCED');
    const initialState: CameraStateId =
      options.initialState ?? (reduced ? 'REDUCED' : 'OVERVIEW');
    const isInitiallyOpen = initialState === 'INSIDE' || initialState === 'OPENING';
    const maxAngle = this.capabilities.openable ? (this.capabilities.maxHingeAngleRad ?? 1.5) : 0;

    this.snapshot = {
      state: initialState,
      reducedMotion: reduced,
      bagOpen: isInitiallyOpen && this.capabilities.openable,
      lidAngleRad: isInitiallyOpen && this.capabilities.openable ? maxAngle : 0,
      currentPose: isInitiallyOpen ? computeOpeningFraming(this.bbox) : overview,
      targetPose: isInitiallyOpen ? computeOpeningFraming(this.bbox) : overview,
      focusedPartId: null,
      transition: null,
      openingCount: isInitiallyOpen && this.capabilities.openable ? 1 : 0,
      placementPulseCount: 0,
      degradedReason: initialState === 'DEGRADED' ? 'initial' : null,
    };
  }

  getSnapshot(): CameraMachineSnapshot {
    return this.snapshot;
  }

  setBagContext(bbox: BoundingBoxM, capabilities: CameraCapabilitiesInput): CameraMachineSnapshot {
    this.bbox = bbox;
    this.capabilities = capabilities;

    const overview = computeOverviewFraming(bbox);
    const bagOpen = capabilities.openable && capabilities.hasInterior ? this.snapshot.bagOpen : false;
    const lidAngleRad = bagOpen ? (capabilities.maxHingeAngleRad ?? 1.5) : 0;
    const nextState: CameraStateId =
      !bagOpen && (this.snapshot.state === 'OPENING' || this.snapshot.state === 'INSIDE')
        ? this.snapshot.reducedMotion
          ? 'REDUCED'
          : 'OVERVIEW'
        : this.snapshot.state;

    this.snapshot = {
      ...this.snapshot,
      state: nextState,
      bagOpen,
      lidAngleRad,
      currentPose: clampCameraPose(this.snapshot.currentPose, bbox),
      targetPose: bagOpen ? computeOpeningFraming(bbox) : overview,
      transition: null,
    };
    return this.snapshot;
  }

  dispatch(intent: CameraIntent): CameraMachineSnapshot {
    const now = intent.timestampMs ?? 0;
    const priority = getIntentPriority(intent);

    // 1. Le geste utilisateur gagne toujours immédiatement (< 1 frame, C-06)
    if (intent.kind === 'user-gesture') {
      const clamped = clampCameraPose(
        {
          target: this.snapshot.currentPose.target,
          azimuthRad: intent.azimuthRad,
          elevationRad: intent.elevationRad,
          distanceM: intent.distanceM,
        },
        this.bbox
      );
      this.lastIntentAtMs = now;
      this.lastIntentPriority = priority;
      this.snapshot = {
        ...this.snapshot,
        state: 'MANUAL',
        currentPose: clamped,
        targetPose: clamped,
        transition: null,
      };
      return this.snapshot;
    }

    // 2. Recentrer est disponible depuis TOUS les 8 états et ramène à OVERVIEW (C-09)
    if (intent.kind === 'recenter') {
      const overview = computeOverviewFraming(this.bbox);
      this.lastIntentAtMs = now;
      this.lastIntentPriority = priority;
      this.startOrCutTransition({
        nextState: 'OVERVIEW',
        toPose: overview,
        toLidAngleRad: 0,
        bagOpen: false,
        durationMs: DEFAULT_TRANSITION_MS,
        focusedPartId: null,
        clearDegraded: true,
      });
      return this.snapshot;
    }

    // 3. Dégradation WebGL / performance
    if (intent.kind === 'degrade') {
      this.lastIntentAtMs = now;
      this.lastIntentPriority = priority;
      this.snapshot = {
        ...this.snapshot,
        state: 'DEGRADED',
        transition: null,
        degradedReason: intent.reason,
      };
      return this.snapshot;
    }

    // Si en DEGRADED, on ignore les intentions d'animation 3D tant qu'un recenter/reset explicite n'a pas lieu
    if (this.snapshot.state === 'DEGRADED') {
      return this.snapshot;
    }

    // 4. Bascule prefers-reduced-motion (Règle 6 : conserve toutes les fonctions, coupe les interpolations)
    if (intent.kind === 'set-reduced-motion') {
      const immediatePose = this.snapshot.targetPose;
      const immediateLid = this.snapshot.transition
        ? this.snapshot.transition.toLidAngleRad
        : this.snapshot.lidAngleRad;
      const resolvedState =
        intent.enabled && this.snapshot.state === 'OVERVIEW'
          ? 'REDUCED'
          : !intent.enabled && this.snapshot.state === 'REDUCED'
            ? 'OVERVIEW'
            : this.snapshot.transition?.nextStateOnComplete ?? this.snapshot.state;

      this.snapshot = {
        ...this.snapshot,
        reducedMotion: intent.enabled,
        state: resolvedState,
        currentPose: immediatePose,
        lidAngleRad: immediateLid,
        transition: null,
      };
      return this.snapshot;
    }

    // 5. Arbitrage de priorité dans une même fenêtre de coalescence (§4.4)
    if (
      now - this.lastIntentAtMs >= 0 &&
      now - this.lastIntentAtMs <= COALESCE_WINDOW_MS &&
      priority < this.lastIntentPriority
    ) {
      return this.snapshot;
    }
    this.lastIntentAtMs = now;
    this.lastIntentPriority = priority;

    // 6. Focus sur une pièce (Personnaliser / Insignes)
    if (intent.kind === 'focus-part') {
      const partPose = computePartFraming(
        this.bbox,
        intent.partId,
        intent.anchor,
        intent.normal
      );
      this.startOrCutTransition({
        nextState: 'FOCUS_PART',
        toPose: partPose,
        toLidAngleRad: this.snapshot.lidAngleRad,
        bagOpen: this.snapshot.bagOpen,
        durationMs: DEFAULT_TRANSITION_MS,
        focusedPartId: intent.partId,
      });
      return this.snapshot;
    }

    // 7. Ouverture du sac et rangement intérieur (C-07, C-08, C-13, C-14)
    if (intent.kind === 'open-and-place') {
      const isInterior = intent.isInteriorSlot !== false;

      // C-13: Si le sac n'est pas ouvrable ou n'a pas d'intérieur modélisé -> JAMAIS d'ouverture simulée
      if (!this.capabilities.openable || !this.capabilities.hasInterior || !isInterior) {
        return this.snapshot;
      }

      const hasVisual = intent.hasVisual !== false;

      // C-08 & C-07: Si déjà en OPENING ou INSIDE (ou bagOpen === true), ne JAMAIS rejouer OPENING !
      if (
        this.snapshot.state === 'OPENING' ||
        this.snapshot.state === 'INSIDE' ||
        this.snapshot.bagOpen
      ) {
        if (hasVisual) {
          this.snapshot = {
            ...this.snapshot,
            placementPulseCount: this.snapshot.placementPulseCount + 1,
          };
        }
        return this.snapshot;
      }

      // C-14: Si l'objet n'a pas de représentation visuelle 3D (visual === null), pas d'animation d'objet
      if (!hasVisual) {
        return this.snapshot;
      }

      const maxAngle = this.capabilities.maxHingeAngleRad ?? 1.5;
      const openingPose = computeOpeningFraming(this.bbox);
      const nextOpeningCount = this.snapshot.openingCount + 1;

      if (this.snapshot.reducedMotion) {
        this.snapshot = {
          ...this.snapshot,
          state: 'INSIDE',
          bagOpen: true,
          lidAngleRad: maxAngle,
          currentPose: openingPose,
          targetPose: openingPose,
          transition: null,
          openingCount: nextOpeningCount,
          placementPulseCount: this.snapshot.placementPulseCount + 1,
        };
        return this.snapshot;
      }

      this.snapshot = {
        ...this.snapshot,
        state: 'OPENING',
        bagOpen: true,
        targetPose: openingPose,
        focusedPartId: null,
        openingCount: nextOpeningCount,
        placementPulseCount: this.snapshot.placementPulseCount + 1,
        transition: {
          from: this.snapshot.currentPose,
          to: openingPose,
          fromLidAngleRad: this.snapshot.lidAngleRad,
          toLidAngleRad: maxAngle,
          durationMs: OPENING_TRANSITION_MS,
          elapsedMs: 0,
          nextStateOnComplete: 'INSIDE',
        },
      };
      return this.snapshot;
    }

    // 8. Fermeture d'un drawer -> retour au cadrage d'ensemble (B-07: CLOSING -> OVERVIEW)
    if (intent.kind === 'close-bag') {
      const overview = computeOverviewFraming(this.bbox);

      if (this.snapshot.bagOpen || this.snapshot.state === 'INSIDE' || this.snapshot.state === 'OPENING') {
        if (this.snapshot.reducedMotion) {
          this.snapshot = {
            ...this.snapshot,
            state: 'OVERVIEW',
            bagOpen: false,
            lidAngleRad: 0,
            currentPose: overview,
            targetPose: overview,
            focusedPartId: null,
            transition: null,
          };
          return this.snapshot;
        }

        this.snapshot = {
          ...this.snapshot,
          state: 'CLOSING',
          bagOpen: false,
          targetPose: overview,
          focusedPartId: null,
          transition: {
            from: this.snapshot.currentPose,
            to: overview,
            fromLidAngleRad: this.snapshot.lidAngleRad,
            toLidAngleRad: 0,
            durationMs: CLOSING_TRANSITION_MS,
            elapsedMs: 0,
            nextStateOnComplete: 'OVERVIEW',
          },
        };
        return this.snapshot;
      }

      this.startOrCutTransition({
        nextState: 'OVERVIEW',
        toPose: overview,
        toLidAngleRad: 0,
        bagOpen: false,
        durationMs: DEFAULT_TRANSITION_MS,
        focusedPartId: null,
      });
      return this.snapshot;
    }

    return this.snapshot;
  }

  /**
   * Avance l'interpolation en cours de `deltaMs` millisecondes (aucune file : 1 seule transition active).
   */
  step(deltaMs: number): CameraMachineSnapshot {
    const tr = this.snapshot.transition;
    if (!tr) return this.snapshot;

    const elapsedMs = Math.min(tr.durationMs, Math.max(0, tr.elapsedMs + Math.max(0, deltaMs)));
    const progress = tr.durationMs <= 0 ? 1 : elapsedMs / tr.durationMs;
    const interpolated = clampCameraPose(interpolatePose(tr.from, tr.to, progress), this.bbox);
    const ease = 1 - Math.pow(1 - progress, 3);
    const lidAngleRad = tr.fromLidAngleRad + (tr.toLidAngleRad - tr.fromLidAngleRad) * ease;

    if (progress >= 1) {
      this.snapshot = {
        ...this.snapshot,
        state: tr.nextStateOnComplete ?? this.snapshot.state,
        currentPose: tr.to,
        targetPose: tr.to,
        lidAngleRad: tr.toLidAngleRad,
        transition: null,
      };
      return this.snapshot;
    }

    this.snapshot = {
      ...this.snapshot,
      currentPose: interpolated,
      lidAngleRad,
      transition: {
        ...tr,
        elapsedMs,
      },
    };
    return this.snapshot;
  }

  private startOrCutTransition(params: {
    nextState: CameraStateId;
    toPose: CameraPose;
    toLidAngleRad: number;
    bagOpen: boolean;
    durationMs: number;
    focusedPartId: string | null;
    clearDegraded?: boolean;
  }): void {
    const degradedReason = params.clearDegraded ? null : this.snapshot.degradedReason;

    if (this.snapshot.reducedMotion) {
      this.snapshot = {
        ...this.snapshot,
        state: params.nextState,
        bagOpen: params.bagOpen,
        lidAngleRad: params.toLidAngleRad,
        currentPose: params.toPose,
        targetPose: params.toPose,
        focusedPartId: params.focusedPartId,
        transition: null,
        degradedReason,
      };
      return;
    }

    // Une nouvelle intention REMPLACE la transition en vol depuis la position réelle courante (zéro file)
    this.snapshot = {
      ...this.snapshot,
      state: params.nextState,
      bagOpen: params.bagOpen,
      targetPose: params.toPose,
      focusedPartId: params.focusedPartId,
      degradedReason,
      transition: {
        from: this.snapshot.currentPose,
        to: params.toPose,
        fromLidAngleRad: this.snapshot.lidAngleRad,
        toLidAngleRad: params.toLidAngleRad,
        durationMs: params.durationMs,
        elapsedMs: 0,
      },
    };
  }
}
